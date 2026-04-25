/**
 * TerminationPanel — orchestrates the early termination workflow inside
 * an agreement view. Renders one of several panels depending on
 * agreement.termination_status:
 *
 *   none                          → "Request Early Termination" CTA
 *   requested (I'm requester)     → Pending state (cancel button)
 *   requested (I'm counterparty)  → Review form (Accept | Counter | Decline)
 *   countered (I'm requester)     → Review counter (Accept | Decline)
 *   countered (I'm counterparty)  → Pending state (waiting on requester)
 *   accepted (need my signature)  → Sign card
 *   accepted (waiting on other)   → Pending state
 *   declined                      → Declined banner + "Request Again" option
 *
 * The DOM structure is intentionally simple — one card per state, no
 * collapsing. Inputs are vertically stacked. Date is HTML5 native, fee
 * is a number input.
 *
 * Audit + notification + system message side-effects are all handled
 * inside terminationFlow.js — this file only orchestrates UI.
 */
import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Clock, AlertCircle, CheckCircle2, XCircle, RefreshCw,
  Flag, Loader2, FileText,
} from "lucide-react";
import {
  requestTermination,
  respondToTermination,
  counterTermination,
  signTermination,
  cancelTermination,
} from "@/lib/terminationFlow";
import { formatCents } from "@/lib/paymentHelpers";

function fmtFee(cents) {
  if (cents == null || cents === 0) return "No fee";
  try {
    return formatCents(cents);
  } catch {
    return `${(cents / 100).toFixed(2)}`;
  }
}

function fmtDate(d) {
  if (!d) return "—";
  try { return format(new Date(d + "T00:00:00"), "PPP"); } catch { return d; }
}

/**
 * Panel shown when no termination is in progress (or last one was declined).
 * Lets the actor open the request form.
 */
function NoneState({ agreement, onChanged }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [endDate, setEndDate] = useState("");
  const [feeDollars, setFeeDollars] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const cents = Math.max(0, Math.round(parseFloat(feeDollars || "0") * 100));
      await requestTermination({
        agreement,
        actorUserId: user.id,
        reason,
        proposedEndDate: endDate,
        proposedFeeCents: cents,
      });
      toast.success("Termination request sent. The counterparty will be notified.");
      setOpen(false);
      setReason(""); setEndDate(""); setFeeDollars("0");
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || "Failed to send request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2 min-w-0">
          <Clock className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
          <div className="text-xs text-muted-foreground">
            Need to end this lease early? Either party can propose new terms.
          </div>
        </div>
        <Button variant="outline" size="sm" className="text-xs gap-1 flex-shrink-0" onClick={() => setOpen(true)}>
          <Clock className="w-3 h-3" /> Request Early Termination
        </Button>
      </div>
    );
  }

  // Default: 30 days from today as a reasonable starting point
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-600" />
        <h3 className="text-sm font-semibold text-foreground">Request Early Termination</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        This sends a proposal to the {user?.id === agreement.owner_user_id ? "tenant" : "landlord"}.
        They can accept, decline, or propose different terms.
      </p>

      <div className="space-y-2">
        <Label htmlFor="termination-reason" className="text-xs">Reason <span className="text-muted-foreground/60">· required</span></Label>
        <Textarea
          id="termination-reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Job relocation to a different city"
          className="text-sm"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="termination-end" className="text-xs">Proposed last day <span className="text-muted-foreground/60">· required</span></Label>
          <Input
            id="termination-end"
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className="text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="termination-fee" className="text-xs">Compensation / fee <span className="text-muted-foreground/60">· optional</span></Label>
          <Input
            id="termination-fee"
            type="number"
            min="0"
            step="0.01"
            value={feeDollars}
            onChange={e => setFeeDollars(e.target.value)}
            className="text-sm"
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => setOpen(false)} disabled={submitting}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white"
          onClick={submit}
          disabled={submitting || !reason.trim() || !endDate}
        >
          {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
          Send Request
        </Button>
      </div>
    </div>
  );
}

/**
 * Panel shown to the requester while they wait. Read-only details +
 * cancel button.
 */
function PendingRequesterState({ agreement, role, onChanged }) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const cancel = async () => {
    if (!window.confirm("Cancel this termination request?")) return;
    setSubmitting(true);
    try {
      await cancelTermination({ agreement, actorUserId: user.id });
      toast.success("Termination request canceled.");
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || "Failed to cancel.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-700" />
        <h3 className="text-sm font-semibold text-amber-900">Termination request pending</h3>
      </div>
      <p className="text-xs text-amber-900">
        Awaiting response from the {role === "landlord" ? "tenant" : "landlord"}.
      </p>
      <ProposalSummary agreement={agreement} />
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" className="text-xs" onClick={cancel} disabled={submitting}>
          {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
          Cancel Request
        </Button>
      </div>
    </div>
  );
}

/**
 * Panel shown to the counterparty when termination is requested. Three
 * actions: Accept, Counter, Decline.
 */
function ReviewRequestState({ agreement, onChanged }) {
  const { user } = useAuth();
  const [mode, setMode] = useState(null); // 'counter' | null
  const [counterEnd, setCounterEnd] = useState(agreement.termination_proposed_end_date || "");
  const [counterFee, setCounterFee] = useState(((agreement.termination_proposed_fee_cents || 0) / 100).toFixed(2));
  const [counterNote, setCounterNote] = useState("");
  const [responseNote, setResponseNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const accept = async () => {
    setSubmitting(true);
    try {
      await respondToTermination({ agreement, actorUserId: user.id, accept: true, note: responseNote });
      toast.success("Termination accepted. Both parties must now sign to finalize.");
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || "Failed.");
    } finally { setSubmitting(false); }
  };

  const decline = async () => {
    if (!window.confirm("Decline this termination request? The lease stays active.")) return;
    setSubmitting(true);
    try {
      await respondToTermination({ agreement, actorUserId: user.id, accept: false, note: responseNote });
      toast.success("Termination declined.");
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || "Failed.");
    } finally { setSubmitting(false); }
  };

  const submitCounter = async () => {
    setSubmitting(true);
    try {
      const cents = Math.max(0, Math.round(parseFloat(counterFee || "0") * 100));
      await counterTermination({
        agreement,
        actorUserId: user.id,
        proposedEndDate: counterEnd,
        proposedFeeCents: cents,
        note: counterNote,
      });
      toast.success("Counter-offer sent.");
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || "Failed.");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-amber-700" />
        <h3 className="text-sm font-semibold text-amber-900">Termination request — your response needed</h3>
      </div>
      <ProposalSummary agreement={agreement} />

      {mode !== "counter" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="response-note" className="text-xs">Note (optional)</Label>
            <Textarea
              id="response-note"
              value={responseNote}
              onChange={e => setResponseNote(e.target.value)}
              placeholder="A short message back…"
              className="text-sm bg-white"
              rows={2}
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={decline} disabled={submitting}>
              <XCircle className="w-3 h-3" /> Decline
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setMode("counter")} disabled={submitting}>
              <RefreshCw className="w-3 h-3" /> Counter-Offer
            </Button>
            <Button size="sm" className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={accept} disabled={submitting}>
              {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
              <CheckCircle2 className="w-3 h-3" /> Accept
            </Button>
          </div>
        </>
      )}

      {mode === "counter" && (
        <div className="space-y-3 pt-2 border-t border-amber-200">
          <h4 className="text-xs font-semibold text-amber-900">Your counter-offer</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Last day</Label>
              <Input
                type="date" value={counterEnd}
                onChange={e => setCounterEnd(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="text-sm bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Compensation / fee</Label>
              <Input
                type="number" min="0" step="0.01"
                value={counterFee}
                onChange={e => setCounterFee(e.target.value)}
                className="text-sm bg-white"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Note (optional)</Label>
            <Textarea
              value={counterNote}
              onChange={e => setCounterNote(e.target.value)}
              placeholder="Why these terms…"
              className="text-sm bg-white" rows={2}
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setMode(null)} disabled={submitting}>
              Back
            </Button>
            <Button size="sm" className="text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={submitCounter} disabled={submitting || !counterEnd}>
              {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
              Send Counter-Offer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Panel for a counter-offer awaiting the original requester's response.
 * Two paths: I'm the original requester (Accept/Decline) or I'm the
 * counterparty waiting (read-only pending).
 */
function CounteredState({ agreement, role, isRequester, onChanged }) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [responseNote, setResponseNote] = useState("");

  if (!isRequester) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-blue-700" />
          <h3 className="text-sm font-semibold text-blue-900">Counter-offer sent</h3>
        </div>
        <p className="text-xs text-blue-900">
          Waiting on the original requester to accept or decline your counter-offer.
        </p>
        <ProposalSummary agreement={agreement} />
      </div>
    );
  }

  const accept = async () => {
    setSubmitting(true);
    try {
      await respondToTermination({ agreement, actorUserId: user.id, accept: true, note: responseNote });
      toast.success("Counter-offer accepted. Both parties must now sign to finalize.");
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || "Failed.");
    } finally { setSubmitting(false); }
  };

  const decline = async () => {
    if (!window.confirm("Decline this counter-offer? Termination will be cancelled.")) return;
    setSubmitting(true);
    try {
      await respondToTermination({ agreement, actorUserId: user.id, accept: false, note: responseNote });
      toast.success("Counter-offer declined.");
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || "Failed.");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <RefreshCw className="w-4 h-4 text-blue-700" />
        <h3 className="text-sm font-semibold text-blue-900">Counter-offer — your response needed</h3>
      </div>
      <p className="text-xs text-blue-900">
        The {role === "landlord" ? "tenant" : "landlord"} proposed different terms.
      </p>
      <ProposalSummary agreement={agreement} />
      <div className="space-y-2">
        <Label className="text-xs">Note (optional)</Label>
        <Textarea
          value={responseNote}
          onChange={e => setResponseNote(e.target.value)}
          className="text-sm bg-white" rows={2}
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
        <Button variant="outline" size="sm" className="text-xs gap-1" onClick={decline} disabled={submitting}>
          <XCircle className="w-3 h-3" /> Decline
        </Button>
        <Button size="sm" className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={accept} disabled={submitting}>
          {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
          <CheckCircle2 className="w-3 h-3" /> Accept
        </Button>
      </div>
    </div>
  );
}

/**
 * Panel for accepted termination — both parties need to sign.
 */
function AcceptedState({ agreement, isRequester, onChanged }) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const mySign = isRequester
    ? agreement.termination_signed_by_requester_at
    : agreement.termination_signed_by_responder_at;
  const otherSign = isRequester
    ? agreement.termination_signed_by_responder_at
    : agreement.termination_signed_by_requester_at;

  const sign = async () => {
    setSubmitting(true);
    try {
      await signTermination({ agreement, actorUserId: user.id });
      toast.success("Termination signed.");
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || "Failed.");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
        <h3 className="text-sm font-semibold text-emerald-900">Termination accepted — sign to finalize</h3>
      </div>
      <ProposalSummary agreement={agreement} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="bg-white rounded-lg border border-emerald-200 p-2">
          <div className="text-muted-foreground">You</div>
          <div className="font-semibold text-foreground">
            {mySign ? `Signed ${format(new Date(mySign), "PPP")}` : "Not signed yet"}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-emerald-200 p-2">
          <div className="text-muted-foreground">Counterparty</div>
          <div className="font-semibold text-foreground">
            {otherSign ? `Signed ${format(new Date(otherSign), "PPP")}` : "Not signed yet"}
          </div>
        </div>
      </div>

      {!mySign && (
        <div className="flex items-center justify-end pt-1">
          <Button size="sm" className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={sign} disabled={submitting}>
            {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
            <FileText className="w-3 h-3" /> Sign Termination
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Panel shown after agreement.status === 'terminated_early' — read-only
 * summary of the closed termination.
 */
function TerminatedState({ agreement }) {
  return (
    <div className="bg-slate-100 border border-slate-300 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Flag className="w-4 h-4 text-slate-700" />
        <h3 className="text-sm font-semibold text-slate-900">Lease terminated early</h3>
      </div>
      <p className="text-xs text-slate-800">
        Effective {fmtDate(agreement.termination_effective_date)}. Both parties signed.
      </p>
      <ProposalSummary agreement={agreement} compact />
    </div>
  );
}

/**
 * Shared block that renders the proposed terms.
 */
function ProposalSummary({ agreement, compact }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs ${compact ? "" : "bg-white rounded-lg border border-border p-2"}`}>
      <div>
        <div className="text-muted-foreground">Last day</div>
        <div className="font-semibold text-foreground">{fmtDate(agreement.termination_proposed_end_date)}</div>
      </div>
      <div>
        <div className="text-muted-foreground">Fee</div>
        <div className="font-semibold text-foreground">{fmtFee(agreement.termination_proposed_fee_cents)}</div>
      </div>
      {agreement.termination_reason && (
        <div className="sm:col-span-3">
          <div className="text-muted-foreground">Reason</div>
          <div className="text-foreground">{agreement.termination_reason}</div>
        </div>
      )}
      {agreement.termination_response_note && (
        <div className="sm:col-span-3">
          <div className="text-muted-foreground">Response note</div>
          <div className="text-foreground">{agreement.termination_response_note}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Top-level component — picks which panel to render based on the
 * agreement's current termination_status and the actor's role.
 *
 * Renders nothing for users who are not party to the agreement (admins
 * see read-only history, but no action panels).
 */
export default function TerminationPanel({ agreement, onChanged }) {
  const { user } = useAuth();
  if (!agreement || !user) return null;

  const isOwner   = user.id === agreement.owner_user_id;
  const isTenant  = user.id === agreement.tenant_user_id;
  const isParty   = isOwner || isTenant;
  const role      = isOwner ? "landlord" : isTenant ? "tenant" : "other";

  // Once status is 'terminated_early', show read-only summary regardless of role.
  if (agreement.status === "terminated_early") {
    return <TerminatedState agreement={agreement} />;
  }

  // Only active (signed) agreements have a termination workflow.
  if (agreement.status !== "accepted") return null;

  // Non-parties (e.g. admin) see a read-only summary if a termination is in flight.
  if (!isParty) {
    if (!agreement.termination_status || agreement.termination_status === "none") return null;
    return (
      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Termination in progress</h3>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
            {agreement.termination_status}
          </span>
        </div>
        <ProposalSummary agreement={agreement} />
      </div>
    );
  }

  const isRequester = agreement.termination_requested_by === user.id;
  const status = agreement.termination_status || "none";

  if (status === "none" || status === "declined") {
    return <NoneState agreement={agreement} onChanged={onChanged} />;
  }

  if (status === "requested") {
    return isRequester
      ? <PendingRequesterState agreement={agreement} role={role} onChanged={onChanged} />
      : <ReviewRequestState agreement={agreement} onChanged={onChanged} />;
  }

  if (status === "countered") {
    return <CounteredState agreement={agreement} role={role} isRequester={isRequester} onChanged={onChanged} />;
  }

  if (status === "accepted") {
    return <AcceptedState agreement={agreement} isRequester={isRequester} onChanged={onChanged} />;
  }

  // Fallback (shouldn't hit unless schema is extended later)
  return null;
}
