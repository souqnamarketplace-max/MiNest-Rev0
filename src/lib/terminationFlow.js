/**
 * Termination flow helpers — wraps the multi-step early termination
 * negotiation against rental_agreements. Each helper is a single function
 * that updates the agreement row, posts an audit event, fires a
 * notification to the counterparty, and (best-effort) drops a system
 * message into the conversation.
 *
 * Workflow states held in `termination_status`:
 *   'none'       — no termination in progress (default)
 *   'requested'  — initiator filed a request, awaiting other party
 *   'countered'  — other party proposed different terms, awaiting initiator
 *   'accepted'   — both sides agreed; proceed to dual-sign
 *   'declined'   — refused; agreement stays active
 *
 * When BOTH termination_signed_by_requester_at AND
 * termination_signed_by_responder_at are set, the agreement's main `status`
 * flips to 'terminated_early' and termination_effective_date is locked in.
 *
 * Public API is small on purpose:
 *   requestTermination(...)
 *   respondToTermination(...)
 *   counterTermination(...)
 *   signTermination(...)
 *   cancelTermination(...)
 *
 * All return either the updated agreement row or null on failure.
 */
import { entities } from "@/api/entities";
import { supabase } from "@/lib/supabase";
import { logAuditEvent, AuditEvents } from "@/lib/auditLog";
import { shouldNotify } from "@/lib/notificationPreferences";
import { findConversation, postSystemMessage } from "@/lib/conversationSystemMessages";

/**
 * Determine the counterparty user_id given the actor + agreement.
 */
function counterpartyId(agreement, actorUserId) {
  if (!agreement || !actorUserId) return null;
  if (agreement.owner_user_id === actorUserId)  return agreement.tenant_user_id;
  if (agreement.tenant_user_id === actorUserId) return agreement.owner_user_id;
  return null;
}

function roleOf(agreement, actorUserId) {
  if (agreement.owner_user_id === actorUserId)  return "landlord";
  if (agreement.tenant_user_id === actorUserId) return "tenant";
  return "other";
}

/**
 * Best-effort notification — never throws. Caller doesn't need to wrap.
 */
async function notify({ userId, type, title, body, agreementId }) {
  if (userId && type) {
    try {
      if (!(await shouldNotify(userId, type))) return;
    } catch (e) { /* fail-open */ }
  }
  try {
    await entities.Notification.create({
      user_id: userId,
      type,
      title,
      body,
      read: false,
      data: { agreement_id: agreementId },
    });
  } catch (err) {
    console.warn("[terminationFlow] notify failed (non-fatal):", err?.message || err);
  }
}

/**
 * Best-effort system message into conversation.
 */
async function postFlowMessage({ agreement, actorUserId, type, payload = {} }) {
  try {
    const otherId = counterpartyId(agreement, actorUserId);
    if (!otherId) return;
    const convo = await findConversation({
      listingId: agreement.listing_id,
      userIdA: actorUserId,
      userIdB: otherId,
    });
    if (!convo?.id) return;
    await postSystemMessage({
      conversationId: convo.id,
      senderUserId: actorUserId,
      type,
      payload: {
        agreement_id: agreement.id,
        agreement_number: agreement.agreement_number ?? null,
        listing_title: agreement.listing_title ?? null,
        ...payload,
      },
    });
  } catch (err) {
    console.warn("[terminationFlow] system message failed (non-fatal):", err?.message || err);
  }
}

/**
 * Step 1 — Initiator requests early termination.
 *
 * @param {object} args
 * @param {object} args.agreement     — current rental_agreements row
 * @param {string} args.actorUserId   — must be owner or tenant on this agreement
 * @param {string} args.reason        — required, explains why
 * @param {string} args.proposedEndDate — ISO 'YYYY-MM-DD'
 * @param {number} args.proposedFeeCents — integer >= 0; 0 = no fee
 *
 * Throws if pre-conditions fail (caller surfaces toast).
 */
export async function requestTermination({ agreement, actorUserId, reason, proposedEndDate, proposedFeeCents }) {
  if (!agreement?.id || !actorUserId) throw new Error("Missing agreement or actor.");
  if (agreement.status !== "accepted") {
    throw new Error("Termination can only be requested on an active (signed) agreement.");
  }
  if (agreement.termination_status && agreement.termination_status !== "none" && agreement.termination_status !== "declined") {
    throw new Error("A termination request is already in progress on this agreement.");
  }
  const role = roleOf(agreement, actorUserId);
  if (role === "other") throw new Error("Only the landlord or tenant can request termination.");
  if (!reason || !reason.trim()) throw new Error("A reason is required.");
  if (!proposedEndDate) throw new Error("A proposed end date is required.");

  const fee = Math.max(0, Math.floor(proposedFeeCents || 0));
  const updated = await entities.RentalAgreement.update(agreement.id, {
    termination_status: "requested",
    termination_requested_by: actorUserId,
    termination_requested_at: new Date().toISOString(),
    termination_reason: reason.trim(),
    termination_proposed_end_date: proposedEndDate,
    termination_proposed_fee_cents: fee,
    // Reset response fields in case a previous declined request exists
    termination_responded_by: null,
    termination_responded_at: null,
    termination_response_note: null,
    termination_signed_by_requester_at: null,
    termination_signed_by_responder_at: null,
    termination_effective_date: null,
  });

  logAuditEvent({
    action: AuditEvents.TERMINATION_REQUESTED,
    targetTable: "rental_agreements",
    targetId: agreement.id,
    metadata: {
      role,
      agreement_number: agreement.agreement_number ?? null,
      reason: reason.trim().slice(0, 500),
      proposed_end_date: proposedEndDate,
      proposed_fee_cents: fee,
    },
  });

  const otherId = counterpartyId(agreement, actorUserId);
  if (otherId) {
    notify({
      userId: otherId,
      type: "termination_requested",
      title: "Early Termination Requested",
      body: `The ${role === "landlord" ? "landlord" : "tenant"} has requested to end this lease early. Review the proposed terms.`,
      agreementId: agreement.id,
    });
  }
  postFlowMessage({
    agreement,
    actorUserId,
    type: "termination_requested",
    payload: {
      proposed_end_date: proposedEndDate,
      proposed_fee_cents: fee,
      requester_role: role,
    },
  });

  return updated;
}

/**
 * Step 2a — Counterparty accepts the proposed terms.
 * Sets termination_status='accepted' and locks termination_effective_date.
 * After this, both parties must sign (signTermination).
 */
export async function respondToTermination({ agreement, actorUserId, accept, note }) {
  if (!agreement?.id || !actorUserId) throw new Error("Missing agreement or actor.");
  if (agreement.termination_status !== "requested" && agreement.termination_status !== "countered") {
    throw new Error("No active termination request to respond to.");
  }
  // Identify who the responder should be:
  //   - In 'requested' state, the responder is the OTHER party (not the requester).
  //   - In 'countered' state, the responder is the ORIGINAL REQUESTER (because the
  //     counterparty already proposed new terms and now it's the requester's turn
  //     to accept/decline the counter).
  const isRequester = agreement.termination_requested_by === actorUserId;
  if (agreement.termination_status === "requested" && isRequester) {
    throw new Error("The requester can't accept their own termination request.");
  }
  if (agreement.termination_status === "countered" && !isRequester) {
    throw new Error("Only the original requester can respond to a counter-offer.");
  }
  const role = roleOf(agreement, actorUserId);
  if (role === "other") throw new Error("Only landlord or tenant can respond.");

  const newStatus = accept ? "accepted" : "declined";
  const patch = {
    termination_status: newStatus,
    termination_responded_by: actorUserId,
    termination_responded_at: new Date().toISOString(),
    termination_response_note: (note || "").trim() || null,
  };
  // On accept, lock in the effective date from the proposal.
  if (accept) {
    patch.termination_effective_date = agreement.termination_proposed_end_date;
  }
  const updated = await entities.RentalAgreement.update(agreement.id, patch);

  logAuditEvent({
    action: accept ? AuditEvents.TERMINATION_ACCEPTED : "termination_declined",
    targetTable: "rental_agreements",
    targetId: agreement.id,
    metadata: {
      role,
      agreement_number: agreement.agreement_number ?? null,
      response_note: (note || "").slice(0, 500),
    },
  });

  // Notify the OTHER party. In the 'requested' flow, the responder is the
  // counterparty so we notify the original requester. In the 'countered'
  // flow, the responder is the original requester, so we notify the
  // counterparty (whoever sent the counter — captured in
  // termination_responded_by from the previous step).
  const notifyTarget = isRequester
    ? agreement.termination_responded_by
    : agreement.termination_requested_by;
  if (notifyTarget) {
    notify({
      userId: notifyTarget,
      type: accept ? "termination_accepted" : "termination_declined",
      title: accept ? "Termination Accepted" : "Termination Declined",
      body: accept
        ? "The counterparty accepted the termination terms. Sign to make it final."
        : "The counterparty declined the termination.",
      agreementId: agreement.id,
    });
  }
  postFlowMessage({
    agreement,
    actorUserId,
    type: accept ? "termination_accepted" : "termination_declined",
    payload: { responder_role: role, note: note || null },
  });

  return updated;
}

/**
 * Step 2b — Counterparty proposes different terms (counter-offer).
 * Sets termination_status='countered' with new proposed end date / fee.
 * Loop is bounded at one counter — original requester can only accept or
 * decline, can't counter back.
 */
export async function counterTermination({ agreement, actorUserId, proposedEndDate, proposedFeeCents, note }) {
  if (!agreement?.id || !actorUserId) throw new Error("Missing agreement or actor.");
  if (agreement.termination_status !== "requested") {
    throw new Error("Counter-offers are only allowed on initial requests.");
  }
  if (agreement.termination_requested_by === actorUserId) {
    throw new Error("The requester can't counter their own request.");
  }
  const role = roleOf(agreement, actorUserId);
  if (role === "other") throw new Error("Only landlord or tenant can counter.");
  if (!proposedEndDate) throw new Error("A proposed end date is required.");

  const fee = Math.max(0, Math.floor(proposedFeeCents || 0));
  const updated = await entities.RentalAgreement.update(agreement.id, {
    termination_status: "countered",
    termination_responded_by: actorUserId,
    termination_responded_at: new Date().toISOString(),
    termination_response_note: (note || "").trim() || null,
    termination_proposed_end_date: proposedEndDate,
    termination_proposed_fee_cents: fee,
  });

  logAuditEvent({
    action: "termination_countered",
    targetTable: "rental_agreements",
    targetId: agreement.id,
    metadata: {
      role,
      agreement_number: agreement.agreement_number ?? null,
      counter_end_date: proposedEndDate,
      counter_fee_cents: fee,
      counter_note: (note || "").slice(0, 500),
    },
  });

  if (agreement.termination_requested_by) {
    notify({
      userId: agreement.termination_requested_by,
      type: "termination_countered",
      title: "Termination Counter-Offer",
      body: "The counterparty proposed different terms for your termination request. Review and decide.",
      agreementId: agreement.id,
    });
  }
  postFlowMessage({
    agreement,
    actorUserId,
    type: "termination_countered",
    payload: { responder_role: role, proposed_end_date: proposedEndDate, proposed_fee_cents: fee },
  });

  return updated;
}

/**
 * Step 3 — Each party signs the accepted termination terms. Both
 * signatures cause the agreement.status to flip to 'terminated_early'.
 */
export async function signTermination({ agreement, actorUserId }) {
  if (!agreement?.id || !actorUserId) throw new Error("Missing agreement or actor.");
  if (agreement.termination_status !== "accepted") {
    throw new Error("Termination has not been accepted yet — nothing to sign.");
  }
  const role = roleOf(agreement, actorUserId);
  if (role === "other") throw new Error("Only landlord or tenant can sign.");

  const isRequester = agreement.termination_requested_by === actorUserId;
  const now = new Date().toISOString();
  const patch = {};
  if (isRequester) {
    if (agreement.termination_signed_by_requester_at) {
      throw new Error("You've already signed.");
    }
    patch.termination_signed_by_requester_at = now;
  } else {
    if (agreement.termination_signed_by_responder_at) {
      throw new Error("You've already signed.");
    }
    patch.termination_signed_by_responder_at = now;
  }

  // Determine if this signature completes the dual-sign
  const willBothBeSigned =
    (isRequester ? !!now : !!agreement.termination_signed_by_requester_at) &&
    (!isRequester ? !!now : !!agreement.termination_signed_by_responder_at);

  if (willBothBeSigned) {
    patch.status = "terminated_early";
  }

  const updated = await entities.RentalAgreement.update(agreement.id, patch);

  logAuditEvent({
    action: AuditEvents.TERMINATION_SIGNED || "termination_signed",
    targetTable: "rental_agreements",
    targetId: agreement.id,
    metadata: {
      role,
      agreement_number: agreement.agreement_number ?? null,
      is_requester: isRequester,
      both_signed: willBothBeSigned,
      effective_date: agreement.termination_effective_date,
    },
  });

  // If we just completed it, also fire a final audit + notification
  if (willBothBeSigned) {
    logAuditEvent({
      action: "agreement_terminated_early",
      targetTable: "rental_agreements",
      targetId: agreement.id,
      metadata: {
        role,
        agreement_number: agreement.agreement_number ?? null,
        effective_date: agreement.termination_effective_date,
      },
    });
    const otherId = counterpartyId(agreement, actorUserId);
    if (otherId) {
      notify({
        userId: otherId,
        type: "agreement_terminated_early",
        title: "Lease Terminated Early",
        body: `Both parties have signed. The lease ends on ${agreement.termination_effective_date}.`,
        agreementId: agreement.id,
      });
    }
    postFlowMessage({
      agreement,
      actorUserId,
      type: "agreement_terminated_early",
      payload: { effective_date: agreement.termination_effective_date, signer_role: role },
    });
  } else {
    // Just my signature so far — notify counterparty
    const otherId = counterpartyId(agreement, actorUserId);
    if (otherId) {
      notify({
        userId: otherId,
        type: "termination_signed_one_side",
        title: "Termination Signed",
        body: `The ${role} has signed the termination. Sign to make it final.`,
        agreementId: agreement.id,
      });
    }
  }

  return updated;
}

/**
 * Step 4 — Cancel a pending termination request (only the original
 * requester can cancel, and only if not yet accepted).
 */
export async function cancelTermination({ agreement, actorUserId }) {
  if (!agreement?.id || !actorUserId) throw new Error("Missing agreement or actor.");
  if (agreement.termination_requested_by !== actorUserId) {
    throw new Error("Only the requester can cancel a termination request.");
  }
  if (!["requested", "countered"].includes(agreement.termination_status)) {
    throw new Error("Termination is not in a cancellable state.");
  }
  const updated = await entities.RentalAgreement.update(agreement.id, {
    termination_status: "none",
    termination_requested_by: null,
    termination_requested_at: null,
    termination_reason: null,
    termination_proposed_end_date: null,
    termination_proposed_fee_cents: 0,
    termination_responded_by: null,
    termination_responded_at: null,
    termination_response_note: null,
    termination_signed_by_requester_at: null,
    termination_signed_by_responder_at: null,
    termination_effective_date: null,
  });

  logAuditEvent({
    action: "termination_canceled",
    targetTable: "rental_agreements",
    targetId: agreement.id,
    metadata: {
      role: roleOf(agreement, actorUserId),
      agreement_number: agreement.agreement_number ?? null,
    },
  });

  return updated;
}
