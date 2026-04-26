/**
 * Renewal flow helpers — wraps the multi-step lease renewal negotiation
 * against rental_agreements. Mirrors terminationFlow.js in shape, but
 * with the important difference that a successful renewal CREATES A
 * NEW CHILD AGREEMENT rather than flipping a status on the existing
 * row. The parent gets `renewal_status='renewed'` and a back-link via
 * `renewal_new_agreement_id`. The child gets `addendum_parent_id` set
 * to the parent's id and a fresh agreement_number.
 *
 * Workflow states held in `renewal_status`:
 *   'none'             — no renewal in progress (default)
 *   'renewal_offered'  — one party proposed; awaiting other party
 *   'renewed'          — accepted + child agreement created
 *   'ending'           — (reserved for "I'm not renewing" intent flag)
 *
 * The single-round counter rule:
 *   - First offer: status flips to 'renewal_offered', renewal_proposed_*
 *     fields filled.
 *   - Counter: same status ('renewal_offered'), but renewal_responded_*
 *     fields filled AND renewal_proposed_by switches to the counterer.
 *     The previous proposer becomes the new responder. After this,
 *     they may only accept or decline — no re-counter.
 *
 * To detect "is this a counter?" we check whether
 * renewal_responded_* are already filled. If yes, we're past the
 * single allowed counter and decline-or-accept is the only option.
 *
 * Public API:
 *   offerRenewal(...)
 *   respondToRenewal(...)
 *   counterRenewal(...)
 *   cancelRenewal(...)
 *
 * All return either the updated parent agreement row (and, for
 * acceptance, also the child agreement) or null on failure.
 */

import { entities } from "@/api/entities";
import { logAuditEvent, AuditEvents } from "@/lib/auditLog";
import { postSystemMessage, findConversation } from "@/lib/conversationSystemMessages";

/**
 * Identify which side of the agreement an actor is on.
 * Returns "landlord" | "tenant" | "other".
 */
function roleOf(agreement, actorUserId) {
  if (!agreement || !actorUserId) return "other";
  if (agreement.owner_user_id === actorUserId) return "landlord";
  if (agreement.tenant_user_id === actorUserId) return "tenant";
  return "other";
}

/**
 * Best-effort notification.
 *
 * IMPORTANT: NotificationCenter navigates on click via `n.data?.link`,
 * so we MUST include data.link or the notification looks like dead text.
 * The default link points at the agreement page; callers may override
 * via the `link` arg (e.g. for accept-renewal, the new child agreement).
 *
 * The `notifications` table has no top-level `agreement_id` column —
 * all entity references live in the `data` jsonb. Earlier versions of
 * this helper wrote `agreement_id` as a column and silently failed
 * with "column does not exist".
 */
async function notify({ userId, type, title, body, agreementId, link }) {
  if (!userId) return;
  const targetLink = link || (agreementId ? `/rentals/${agreementId}` : null);
  try {
    await entities.Notification.create({
      user_id: userId,
      type,
      title,
      body,
      data: {
        ...(targetLink ? { link: targetLink } : {}),
        ...(agreementId ? { agreement_id: agreementId } : {}),
      },
    });
  } catch (err) {
    console.warn("[renewalFlow] notification failed (non-fatal):", err);
  }
}

/**
 * Best-effort system message in the related conversation.
 */
async function postRenewalSystemMessage({ agreement, actorUserId, type }) {
  try {
    const otherUserId =
      agreement.owner_user_id === actorUserId
        ? agreement.tenant_user_id
        : agreement.owner_user_id;
    const convo = await findConversation({
      listingId: agreement.listing_id,
      userIdA: actorUserId,
      userIdB: otherUserId,
    });
    if (!convo?.id) return;
    await postSystemMessage({
      conversationId: convo.id,
      senderUserId: actorUserId,
      type,
      payload: {
        agreement_id: agreement.id,
        agreement_number: agreement.agreement_number,
        listing_title: agreement.listing_title,
      },
    });
  } catch (err) {
    console.warn("[renewalFlow] system message failed (non-fatal):", err);
  }
}

/**
 * Convert dollars → cents safely. Accepts numbers or numeric strings.
 */
function dollarsToCents(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/**
 * Add days to a YYYY-MM-DD date string and return YYYY-MM-DD.
 */
function addDays(dateStr, days) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Step 1 — Offer renewal.
 *
 * Either party can offer, but only when:
 *   - status='accepted' (lease is active)
 *   - renewal_status='none' (no renewal in flight)
 *   - lease_end_date is set
 *   - no termination is currently in progress
 *
 * Inputs:
 *   agreement              — the parent rental_agreements row
 *   actorUserId            — auth.users.id of the offerer
 *   newLeaseEndDate        — proposed new lease end (YYYY-MM-DD)
 *   newRentDollars         — proposed new rent in dollars (UI units)
 *   newDepositDollars      — proposed new deposit in dollars
 *   note                   — optional free-text rationale
 */
export async function offerRenewal({
  agreement,
  actorUserId,
  newLeaseEndDate,
  newRentDollars,
  newDepositDollars,
  note,
}) {
  if (!agreement?.id || !actorUserId) throw new Error("Missing agreement or actor.");
  if (agreement.status !== "accepted") {
    throw new Error("Renewal is only available on active agreements.");
  }
  if (agreement.renewal_status && agreement.renewal_status !== "none") {
    throw new Error("A renewal is already in progress for this lease.");
  }
  if (!agreement.lease_end_date) {
    throw new Error("This agreement has no lease end date set.");
  }
  if (
    agreement.termination_status &&
    agreement.termination_status !== "none" &&
    agreement.termination_status !== "declined"
  ) {
    throw new Error(
      "This lease has a termination request in progress. Resolve that first."
    );
  }
  const role = roleOf(agreement, actorUserId);
  if (role === "other") throw new Error("Only landlord or tenant can offer renewal.");

  if (!newLeaseEndDate) throw new Error("Please choose a new lease end date.");
  // The new end date must be after the current lease_end_date.
  if (new Date(newLeaseEndDate) <= new Date(agreement.lease_end_date)) {
    throw new Error("The new lease end date must be after the current end date.");
  }

  const proposedRentCents = dollarsToCents(newRentDollars);
  const proposedDepositCents = dollarsToCents(newDepositDollars);
  if (proposedRentCents == null || proposedRentCents < 0) {
    throw new Error("Please enter a valid rent amount.");
  }
  if (proposedDepositCents == null || proposedDepositCents < 0) {
    throw new Error("Please enter a valid deposit amount.");
  }

  const updated = await entities.RentalAgreement.update(agreement.id, {
    renewal_status: "renewal_offered",
    renewal_proposed_by: actorUserId,
    renewal_proposed_at: new Date().toISOString(),
    renewal_proposed_lease_end_date: newLeaseEndDate,
    renewal_proposed_rent_amount: proposedRentCents,
    renewal_proposed_deposit_amount: proposedDepositCents,
    renewal_proposed_note: note?.trim() || null,
    // Clear any previous response fields so this looks like a fresh offer.
    renewal_responded_by: null,
    renewal_responded_at: null,
    renewal_response_note: null,
    renewal_new_agreement_id: null,
  });

  logAuditEvent({
    action: AuditEvents.RENEWAL_OFFERED,
    targetTable: "rental_agreements",
    targetId: agreement.id,
    metadata: {
      role,
      agreement_number: agreement.agreement_number ?? null,
      proposed_lease_end_date: newLeaseEndDate,
      proposed_rent_cents: proposedRentCents,
      proposed_deposit_cents: proposedDepositCents,
    },
  });

  // Notify the other party.
  const otherUserId =
    agreement.owner_user_id === actorUserId
      ? agreement.tenant_user_id
      : agreement.owner_user_id;
  notify({
    userId: otherUserId,
    type: "renewal_offered",
    title: "Renewal Offer",
    body: "The other party has proposed renewing your lease. Review the terms.",
    agreementId: agreement.id,
  });

  postRenewalSystemMessage({
    agreement,
    actorUserId,
    type: "renewal_offered",
  });

  return updated;
}

/**
 * Step 2a — Respond to renewal: accept or decline.
 *
 * If accept=true and we're at the FIRST round (no counter yet), the
 * responder is the original recipient and must be the counterparty.
 * If accept=true and we're at the SECOND round (counter exists), the
 * responder is the original requester (who must accept the counter).
 *
 * Acceptance triggers the child-agreement creation.
 */
export async function respondToRenewal({ agreement, actorUserId, accept, note }) {
  if (!agreement?.id || !actorUserId) throw new Error("Missing agreement or actor.");
  if (agreement.renewal_status !== "renewal_offered") {
    throw new Error("No active renewal offer to respond to.");
  }

  const isFirstRound = !agreement.renewal_responded_by;
  const role = roleOf(agreement, actorUserId);
  if (role === "other") throw new Error("Only landlord or tenant can respond.");

  if (isFirstRound) {
    // The actor must be the OTHER party (not the proposer).
    if (agreement.renewal_proposed_by === actorUserId) {
      throw new Error("The proposer can't accept their own renewal offer.");
    }
  } else {
    // We're past a counter — only the original proposer can act.
    // (The counterer became renewal_proposed_by after the counter, so the
    //  original proposer is now renewal_responded_by.)
    if (agreement.renewal_responded_by !== actorUserId) {
      throw new Error("Only the original proposer can accept or decline a counter.");
    }
  }

  if (!accept) {
    // Decline path — clear renewal fields, status back to 'none'.
    const cleared = await entities.RentalAgreement.update(agreement.id, {
      renewal_status: "none",
      renewal_proposed_by: null,
      renewal_proposed_at: null,
      renewal_proposed_lease_end_date: null,
      renewal_proposed_rent_amount: null,
      renewal_proposed_deposit_amount: null,
      renewal_proposed_note: null,
      renewal_responded_by: null,
      renewal_responded_at: null,
      renewal_response_note: note?.trim() || null,
      renewal_new_agreement_id: null,
    });

    logAuditEvent({
      action: AuditEvents.RENEWAL_DECLINED,
      targetTable: "rental_agreements",
      targetId: agreement.id,
      metadata: {
        role,
        agreement_number: agreement.agreement_number ?? null,
        was_counter: !isFirstRound,
      },
    });

    // Notify whoever was awaiting a response. In first round that's
    // renewal_proposed_by; after a counter, the actor IS the original
    // proposer, so we notify the counterer (which was previously
    // renewal_proposed_by — but renewal_proposed_by on the row at this
    // point is the counterer themselves, so it's still the right id).
    const notifyTarget = agreement.renewal_proposed_by;
    notify({
      userId: notifyTarget,
      type: "renewal_declined",
      title: "Renewal Declined",
      body: "The other party declined the renewal offer.",
      agreementId: agreement.id,
    });

    postRenewalSystemMessage({
      agreement,
      actorUserId,
      type: "renewal_declined",
    });

    return cleared;
  }

  // Accept path — create the child agreement using whichever fields are
  // currently active. After a counter, renewal_proposed_* hold the
  // counter terms (renewal_proposed_by holds the counterer's id).
  const childAgreement = await createChildAgreement({
    parent: agreement,
  });

  // Mark the parent as renewed with a back-link to the child.
  const updatedParent = await entities.RentalAgreement.update(agreement.id, {
    renewal_status: "renewed",
    renewal_responded_by: actorUserId,
    renewal_responded_at: new Date().toISOString(),
    renewal_response_note: note?.trim() || null,
    renewal_new_agreement_id: childAgreement.id,
  });

  logAuditEvent({
    action: AuditEvents.RENEWAL_ACCEPTED,
    targetTable: "rental_agreements",
    targetId: agreement.id,
    metadata: {
      role,
      agreement_number: agreement.agreement_number ?? null,
      was_counter: !isFirstRound,
      child_agreement_id: childAgreement.id,
      child_agreement_number: childAgreement.agreement_number,
    },
  });

  logAuditEvent({
    action: AuditEvents.RENEWAL_COMPLETED,
    targetTable: "rental_agreements",
    targetId: childAgreement.id,
    metadata: {
      role,
      parent_agreement_id: agreement.id,
      parent_agreement_number: agreement.agreement_number ?? null,
      child_agreement_number: childAgreement.agreement_number,
    },
  });

  // Notify the counterparty (whoever didn't act last).
  const otherUserId =
    agreement.owner_user_id === actorUserId
      ? agreement.tenant_user_id
      : agreement.owner_user_id;
  notify({
    userId: otherUserId,
    type: "renewal_accepted",
    title: "Renewal Accepted",
    body: "Your renewal was accepted. A new agreement has been created — please sign it.",
    agreementId: childAgreement.id,
  });

  postRenewalSystemMessage({
    agreement,
    actorUserId,
    type: "renewal_accepted",
  });

  return { parent: updatedParent, child: childAgreement };
}

/**
 * Step 2b — Counter the renewal offer with different terms.
 *
 * Only allowed in the FIRST round (i.e. nobody has countered yet).
 * After this, the original proposer can only accept or decline.
 */
export async function counterRenewal({
  agreement,
  actorUserId,
  newLeaseEndDate,
  newRentDollars,
  newDepositDollars,
  note,
}) {
  if (!agreement?.id || !actorUserId) throw new Error("Missing agreement or actor.");
  if (agreement.renewal_status !== "renewal_offered") {
    throw new Error("No active renewal offer to counter.");
  }
  if (agreement.renewal_responded_by) {
    throw new Error("This offer has already been countered. Only accept or decline is available.");
  }
  if (agreement.renewal_proposed_by === actorUserId) {
    throw new Error("You can't counter your own offer.");
  }
  const role = roleOf(agreement, actorUserId);
  if (role === "other") throw new Error("Only landlord or tenant can counter.");

  if (!newLeaseEndDate) throw new Error("Please choose a new lease end date.");
  if (new Date(newLeaseEndDate) <= new Date(agreement.lease_end_date)) {
    throw new Error("The new lease end date must be after the current end date.");
  }

  const counterRentCents = dollarsToCents(newRentDollars);
  const counterDepositCents = dollarsToCents(newDepositDollars);
  if (counterRentCents == null || counterRentCents < 0) {
    throw new Error("Please enter a valid rent amount.");
  }
  if (counterDepositCents == null || counterDepositCents < 0) {
    throw new Error("Please enter a valid deposit amount.");
  }

  // The counterer's previous proposer becomes the responder. The
  // counterer becomes the new proposed_by. This keeps a single
  // "active proposal" pair on the row at all times.
  const previousProposer = agreement.renewal_proposed_by;
  const updated = await entities.RentalAgreement.update(agreement.id, {
    renewal_proposed_by: actorUserId,
    renewal_proposed_at: new Date().toISOString(),
    renewal_proposed_lease_end_date: newLeaseEndDate,
    renewal_proposed_rent_amount: counterRentCents,
    renewal_proposed_deposit_amount: counterDepositCents,
    renewal_proposed_note: note?.trim() || null,
    renewal_responded_by: previousProposer,
    renewal_responded_at: new Date().toISOString(),
    renewal_response_note: null,
  });

  logAuditEvent({
    action: AuditEvents.RENEWAL_COUNTERED,
    targetTable: "rental_agreements",
    targetId: agreement.id,
    metadata: {
      role,
      agreement_number: agreement.agreement_number ?? null,
      counter_lease_end_date: newLeaseEndDate,
      counter_rent_cents: counterRentCents,
      counter_deposit_cents: counterDepositCents,
    },
  });

  notify({
    userId: previousProposer,
    type: "renewal_countered",
    title: "Renewal Counter-Offer",
    body: "The other party countered your renewal offer with different terms.",
    agreementId: agreement.id,
  });

  postRenewalSystemMessage({
    agreement,
    actorUserId,
    type: "renewal_countered",
  });

  return updated;
}

/**
 * Step 3 — Cancel a pending renewal offer (only the current proposer
 * can cancel, and only while it's in 'renewal_offered' state).
 */
export async function cancelRenewal({ agreement, actorUserId }) {
  if (!agreement?.id || !actorUserId) throw new Error("Missing agreement or actor.");
  if (agreement.renewal_status !== "renewal_offered") {
    throw new Error("Renewal is not in a cancellable state.");
  }
  if (agreement.renewal_proposed_by !== actorUserId) {
    throw new Error("Only the current proposer can cancel a renewal offer.");
  }

  const updated = await entities.RentalAgreement.update(agreement.id, {
    renewal_status: "none",
    renewal_proposed_by: null,
    renewal_proposed_at: null,
    renewal_proposed_lease_end_date: null,
    renewal_proposed_rent_amount: null,
    renewal_proposed_deposit_amount: null,
    renewal_proposed_note: null,
    renewal_responded_by: null,
    renewal_responded_at: null,
    renewal_response_note: null,
    renewal_new_agreement_id: null,
  });

  logAuditEvent({
    action: AuditEvents.RENEWAL_CANCELED,
    targetTable: "rental_agreements",
    targetId: agreement.id,
    metadata: {
      role: roleOf(agreement, actorUserId),
      agreement_number: agreement.agreement_number ?? null,
    },
  });

  return updated;
}

/**
 * Helper — create the child agreement that comes out of an accepted renewal.
 *
 * Strategy:
 *   - Copy the parent row wholesale (so all listing/tenant info carries
 *     forward — no re-upload of IDs, jurisdiction, special terms, etc.)
 *   - Override: lease_start_date (= parent.lease_end + 1 day),
 *     lease_end_date, rent_amount, deposit_amount, agreement_number,
 *     addendum_parent_id, status, signature fields.
 *   - Auto-sign on landlord side (so tenant can immediately act on it),
 *     leave tenant signature blank → status = 'pending_tenant'.
 *
 * The fields we OMIT from the copy are anything that should not survive:
 *   - id (auto-generated)
 *   - created_at / updated_at
 *   - status, both signatures, both signed_at, ips, user agents
 *   - all renewal_* fields (child starts fresh with renewal_status='none')
 *   - all termination_* fields
 *   - addendum_parent_id (we set our own)
 */
async function createChildAgreement({ parent }) {
  // The landlord auto-signs (parent.owner_user_id). The acceptor of the
  // renewal might be either party — that's tracked in audit metadata,
  // not in this row.

  // Build base payload by copying the parent row, then stripping fields
  // that must not be carried over.
  const stripped = { ...parent };
  const dropKeys = [
    "id",
    "created_at",
    "updated_at",
    "status",
    "owner_signature",
    "owner_signed_at",
    "owner_signed_ip",
    "owner_signed_user_agent",
    "tenant_signature",
    "tenant_signed_at",
    "tenant_signed_ip",
    "tenant_signed_user_agent",
    "addendum_parent_id",
    "renewal_status",
    "renewal_proposed_by",
    "renewal_proposed_at",
    "renewal_proposed_lease_end_date",
    "renewal_proposed_rent_amount",
    "renewal_proposed_deposit_amount",
    "renewal_proposed_note",
    "renewal_responded_by",
    "renewal_responded_at",
    "renewal_response_note",
    "renewal_new_agreement_id",
    "termination_status",
    "termination_requested_by",
    "termination_requested_at",
    "termination_reason",
    "termination_proposed_end_date",
    "termination_proposed_fee_cents",
    "termination_responded_by",
    "termination_responded_at",
    "termination_response_note",
    "termination_signed_by_requester_at",
    "termination_signed_by_responder_at",
    "termination_effective_date",
  ];
  for (const k of dropKeys) delete stripped[k];

  // The agreed-upon terms live in renewal_proposed_* on the parent at
  // the moment of acceptance.
  const newLeaseEndDate = parent.renewal_proposed_lease_end_date;
  const newRentCents = parent.renewal_proposed_rent_amount;
  const newDepositCents = parent.renewal_proposed_deposit_amount;
  const newLeaseStartDate = addDays(parent.lease_end_date, 1);
  const newAgreementNumber = (parent.agreement_number || 0) + 1;

  const nowIso = new Date().toISOString();

  // Landlord auto-signs the child agreement. Tenant must sign fresh.
  // We use the landlord's own name from the parent (owner_signature on
  // the parent might be blank for various reasons — fall back to a
  // sensible label). The legal weight comes from the audit log entry.
  const ownerName =
    parent.owner_signature?.trim() ||
    parent.landlord_legal_name ||
    parent.owner_legal_name ||
    "Landlord";

  const childPayload = {
    ...stripped,
    // Term + money overrides
    lease_start_date: newLeaseStartDate,
    lease_end_date: newLeaseEndDate,
    rent_amount: newRentCents,
    deposit_amount: newDepositCents,
    // Lineage
    agreement_number: newAgreementNumber,
    addendum_parent_id: parent.id,
    // Lifecycle: tenant must sign
    status: "pending_tenant",
    // Landlord auto-signature (since landlord originated or agreed to terms)
    owner_signature: ownerName,
    owner_signed_at: nowIso,
    // Renewal/termination state on the child starts clean
    renewal_status: "none",
  };

  const child = await entities.RentalAgreement.create(childPayload);

  // Best-effort: backfill listing_title / counterparty fields from parent
  // if the create stripped anything. (Most schemas keep them — this is
  // belt-and-suspenders.)
  if (!child.listing_title && parent.listing_title) {
    try {
      await entities.RentalAgreement.update(child.id, {
        listing_title: parent.listing_title,
      });
    } catch {
      /* non-fatal */
    }
  }

  return child;
}
