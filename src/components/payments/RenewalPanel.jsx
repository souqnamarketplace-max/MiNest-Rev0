/**
 * RenewalPanel — orchestrates the renewal workflow inside an
 * agreement view. Mirrors TerminationPanel.jsx in structure: a single
 * panel that shifts between many states based on the agreement row.
 *
 * Visible states:
 *   1. EligibleState        — user is on an active lease, no renewal in flight
 *                             → "Offer Renewal" button + collapsible form
 *   2. EndingSoonBanner     — within 60 days of lease_end_date, no renewal
 *                             → urgent prompt to renew (rendered above #1)
 *   3. AwaitingResponseState — a renewal offer has been sent; the actor is
 *                             the proposer and is waiting on the counterparty
 *                             → shows proposed terms + Cancel button
 *   4. RespondState         — a renewal offer has been received; the actor
 *                             is the counterparty
 *                             → Accept / Counter / Decline (counter only in
 *                                first round)
 *   5. RenewedState         — renewal completed; child agreement created
 *                             → link to new agreement
 *   6. NotEligibleState     — agreement is not in 'accepted' state, or
 *                             termination is in progress (silent — render nothing)
 *
 * Props:
 *   agreement      — rental_agreements row (parent)
 *   onChanged      — callback to re-fetch the agreement after any action
 *
 * Note: the logged-in user is read internally from AuthContext, mirroring
 * TerminationPanel.jsx's signature so the mount line in RentalAgreementView
 * is symmetric: `<TerminationPanel agreement={...} onChanged={...} />` ↔
 * `<RenewalPanel agreement={...} onChanged={...} />`.
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  RotateCw,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  XCircle,
  CalendarDays,
  DollarSign,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/AuthContext";
import {
  offerRenewal,
  respondToRenewal,
  counterRenewal,
  cancelRenewal,
} from "@/lib/renewalFlow";

// Convert cents → dollars string for display
function centsToDollars(cents) {
  if (cents == null) return "—";
  return `$${(Number(cents) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(d) {
  if (!d) return "—";
  try {
    return format(new Date(`${d}T00:00:00`), "PPP");
  } catch {
    return d;
  }
}

/**
 * Days until the given YYYY-MM-DD date, from today. Returns null if
 * the date is invalid.
 */
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Pretty summary card showing the current proposal terms.
 */
function ProposalSummary({ leaseEndDate, rentCents, depositCents, note }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="w-3 h-3" /> New end date
          </div>
          <div className="font-medium">{formatDate(leaseEndDate)}</div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <DollarSign className="w-3 h-3" /> New rent
          </div>
          <div className="font-medium">{centsToDollars(rentCents)}/mo</div>
        </div>
        <div className="col-span-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <DollarSign className="w-3 h-3" /> New deposit
          </div>
          <div className="font-medium">{centsToDollars(depositCents)}</div>
        </div>
      </div>
      {note && (
        <div className="text-sm text-muted-foreground border-t border-border pt-2 mt-2 whitespace-pre-wrap">
          “{note}”
        </div>
      )}
    </div>
  );
}

/**
 * The collapsible offer/counter form. Used both for the initial offer
 * and for a counter-offer (with different button labels).
 */
function OfferForm({
  defaultEndDate,
  defaultRent,
  defaultDeposit,
  submitting,
  onSubmit,
  onCancel,
  submitLabel,
}) {
  const [leaseEndDate, setLeaseEndDate] = useState(defaultEndDate || "");
  const [rentDollars, setRentDollars] = useState(defaultRent ?? "");
  const [depositDollars, setDepositDollars] = useState(defaultDeposit ?? "");
  const [note, setNote] = useState("");

  return (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="renewal-end-date">New lease end date</Label>
          <Input
            id="renewal-end-date"
            type="date"
            value={leaseEndDate}
            onChange={e => setLeaseEndDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="renewal-rent">New monthly rent (CAD)</Label>
          <Input
            id="renewal-rent"
            type="number"
            min="0"
            step="0.01"
            value={rentDollars}
            onChange={e => setRentDollars(e.target.value)}
            placeholder="e.g. 1850.00"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="renewal-deposit">New deposit amount (CAD)</Label>
        <Input
          id="renewal-deposit"
          type="number"
          min="0"
          step="0.01"
          value={depositDollars}
          onChange={e => setDepositDollars(e.target.value)}
          placeholder="e.g. 1850.00"
        />
        <p className="text-xs text-muted-foreground">
          Leave the same as the current deposit unless you want to change it.
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="renewal-note">Note (optional)</Label>
        <Textarea
          id="renewal-note"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Anything you'd like the other party to know about this offer."
          rows={3}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() =>
            onSubmit({
              newLeaseEndDate: leaseEndDate,
              newRentDollars: rentDollars,
              newDepositDollars: depositDollars,
              note,
            })
          }
          disabled={submitting}
        >
          {submitting ? "Sending…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}

export default function RenewalPanel({ agreement, onChanged }) {
  const { user } = useAuth();
  const currentUserId = user?.id || null;

  const [submitting, setSubmitting] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [declineNote, setDeclineNote] = useState("");
  const [showDeclineForm, setShowDeclineForm] = useState(false);

  const isLandlord = agreement?.owner_user_id === currentUserId;
  const isTenant = agreement?.tenant_user_id === currentUserId;
  const isParty = isLandlord || isTenant;

  const renewalStatus = agreement?.renewal_status || "none";
  const status = agreement?.status;
  const terminationActive =
    agreement?.termination_status &&
    agreement.termination_status !== "none" &&
    agreement.termination_status !== "declined";

  const isProposer = agreement?.renewal_proposed_by === currentUserId;
  const hasCounter = !!agreement?.renewal_responded_by;

  // Days until lease ends — drives the "ending soon" banner.
  // Computed inline (cheap arithmetic, no need to memoize).
  const daysToEnd = daysUntil(agreement?.lease_end_date);
  const isEndingSoon =
    daysToEnd != null && daysToEnd >= 0 && daysToEnd <= 60;

  // ---- Don't render at all in these cases
  if (!agreement || !isParty) return null;
  if (status !== "accepted" && renewalStatus !== "renewed") return null;
  if (terminationActive) return null;

  // ---- Action handlers
  async function handleOffer(form) {
    setSubmitting(true);
    try {
      await offerRenewal({
        agreement,
        actorUserId: currentUserId,
        ...form,
      });
      toast.success("Renewal offer sent.");
      setShowOfferForm(false);
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || "Couldn't send renewal offer.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCounter(form) {
    setSubmitting(true);
    try {
      await counterRenewal({
        agreement,
        actorUserId: currentUserId,
        ...form,
      });
      toast.success("Counter-offer sent.");
      setShowCounterForm(false);
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || "Couldn't send counter-offer.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAccept() {
    setSubmitting(true);
    try {
      const result = await respondToRenewal({
        agreement,
        actorUserId: currentUserId,
        accept: true,
      });
      const childId = result?.child?.id;
      toast.success(
        childId
          ? "Renewal accepted. New agreement created — please review and sign."
          : "Renewal accepted."
      );
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || "Couldn't accept renewal.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecline() {
    setSubmitting(true);
    try {
      await respondToRenewal({
        agreement,
        actorUserId: currentUserId,
        accept: false,
        note: declineNote,
      });
      toast.success("Renewal declined.");
      setShowDeclineForm(false);
      setDeclineNote("");
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || "Couldn't decline renewal.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    setSubmitting(true);
    try {
      await cancelRenewal({ agreement, actorUserId: currentUserId });
      toast.success("Renewal offer canceled.");
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || "Couldn't cancel offer.");
    } finally {
      setSubmitting(false);
    }
  }

  // --------------------------------------------------------------------
  // 5. RenewedState — child agreement exists
  // --------------------------------------------------------------------
  if (renewalStatus === "renewed") {
    const childId = agreement.renewal_new_agreement_id;
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-foreground">Lease renewed</div>
            <div className="text-sm text-muted-foreground">
              A new rental agreement has been created with the agreed-upon
              terms. The tenant must sign the new agreement to activate it.
            </div>
          </div>
        </div>
        {childId && (
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <Link to={`/rentals/${childId}`}>
              View new agreement <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------
  // 3 & 4. There's an active offer in flight
  // --------------------------------------------------------------------
  if (renewalStatus === "renewal_offered") {
    const proposedEndDate = agreement.renewal_proposed_lease_end_date;
    const proposedRentCents = agreement.renewal_proposed_rent_amount;
    const proposedDepositCents = agreement.renewal_proposed_deposit_amount;
    const proposedNote = agreement.renewal_proposed_note;

    // 3. Awaiting response — actor is the current proposer
    if (isProposer) {
      return (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-foreground">
                {hasCounter ? "Counter-offer sent" : "Renewal offer sent"}
              </div>
              <div className="text-sm text-muted-foreground">
                Waiting for the other party to accept
                {!hasCounter && ", counter,"} or decline.
              </div>
            </div>
          </div>
          <ProposalSummary
            leaseEndDate={proposedEndDate}
            rentCents={proposedRentCents}
            depositCents={proposedDepositCents}
            note={proposedNote}
          />
          {!hasCounter && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={submitting}
              >
                Cancel offer
              </Button>
            </div>
          )}
        </div>
      );
    }

    // 4. Respond state — actor is the counterparty
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
            {hasCounter ? <RefreshCw className="w-5 h-5" /> : <RotateCw className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-foreground">
              {hasCounter
                ? "Renewal counter-offer — your response needed"
                : "Renewal offer — your response needed"}
            </div>
            <div className="text-sm text-muted-foreground">
              {hasCounter
                ? "The other party countered with the terms below. You can accept or decline — counters are limited to one round."
                : "The other party has proposed renewing your lease with the terms below."}
            </div>
          </div>
        </div>
        <ProposalSummary
          leaseEndDate={proposedEndDate}
          rentCents={proposedRentCents}
          depositCents={proposedDepositCents}
          note={proposedNote}
        />

        {!showCounterForm && !showDeclineForm && (
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeclineForm(true)}
              disabled={submitting}
            >
              <XCircle className="w-4 h-4 mr-1" /> Decline
            </Button>
            {!hasCounter && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCounterForm(true)}
                disabled={submitting}
              >
                <RefreshCw className="w-4 h-4 mr-1" /> Counter
              </Button>
            )}
            <Button size="sm" onClick={handleAccept} disabled={submitting}>
              <CheckCircle2 className="w-4 h-4 mr-1" />
              {submitting ? "Accepting…" : "Accept"}
            </Button>
          </div>
        )}

        {showCounterForm && (
          <OfferForm
            defaultEndDate={proposedEndDate}
            defaultRent={
              proposedRentCents != null ? (proposedRentCents / 100).toFixed(2) : ""
            }
            defaultDeposit={
              proposedDepositCents != null
                ? (proposedDepositCents / 100).toFixed(2)
                : ""
            }
            submitting={submitting}
            onSubmit={handleCounter}
            onCancel={() => setShowCounterForm(false)}
            submitLabel="Send counter-offer"
          />
        )}

        {showDeclineForm && (
          <div className="space-y-3 mt-3">
            <div className="space-y-1">
              <Label htmlFor="renewal-decline-note">Reason (optional)</Label>
              <Textarea
                id="renewal-decline-note"
                value={declineNote}
                onChange={e => setDeclineNote(e.target.value)}
                placeholder="Optional note to the other party."
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDeclineForm(false);
                  setDeclineNote("");
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDecline}
                disabled={submitting}
              >
                {submitting ? "Declining…" : "Decline renewal"}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------
  // 1 & 2. EligibleState (with optional EndingSoonBanner)
  // --------------------------------------------------------------------

  // Don't show the offer-renewal control if there's no lease_end_date
  // to renew against.
  if (!agreement.lease_end_date) return null;

  const currentRentDollars =
    agreement.rent_amount != null ? (agreement.rent_amount / 100).toFixed(2) : "";
  const currentDepositDollars =
    agreement.deposit_amount != null
      ? (agreement.deposit_amount / 100).toFixed(2)
      : "";

  return (
    <div className="space-y-3">
      {isEndingSoon && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-amber-900">
              Lease ending in {daysToEnd} day{daysToEnd === 1 ? "" : "s"}.
            </span>{" "}
            <span className="text-amber-900/80">
              Lease ends {formatDate(agreement.lease_end_date)}. Send a
              renewal offer below if you'd like to extend.
            </span>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
            <RotateCw className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-foreground">Lease renewal</div>
            <div className="text-sm text-muted-foreground">
              Either party can propose extending this lease with new terms.
              The other party can accept, counter once, or decline.
            </div>
          </div>
          {!showOfferForm && (
            <Button size="sm" onClick={() => setShowOfferForm(true)}>
              Offer renewal
            </Button>
          )}
        </div>

        {showOfferForm && (
          <OfferForm
            defaultEndDate=""
            defaultRent={currentRentDollars}
            defaultDeposit={currentDepositDollars}
            submitting={submitting}
            onSubmit={handleOffer}
            onCancel={() => setShowOfferForm(false)}
            submitLabel="Send renewal offer"
          />
        )}
      </div>
    </div>
  );
}
