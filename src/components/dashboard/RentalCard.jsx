/**
 * RentalCard — compact card for a single rental agreement, used by
 * MyActiveRentals on the Dashboard and the Rentals page. Shows
 * agreement number, title, status, dates, role (tenant / landlord),
 * and a "View Agreement" CTA.
 *
 * Props:
 *   agreement          — rental_agreements row (with optional joined fields)
 *   role               — "tenant" | "landlord" — affects which counterparty info is shown
 *   counterpartyName?  — optional override for the counterparty display name
 *
 * Adds:
 *   - Correct pill labels for terminated_early / expired / canceled / declined
 *     (previously fell through to "Awaiting tenant signature").
 *   - A 60-day "lease ending soon" banner shown when:
 *       status === 'accepted'
 *       AND renewal_status === 'none'
 *       AND lease_end_date is within 60 days
 *       AND no termination is in progress
 */

import React from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  FileText,
  Calendar,
  User,
  Home,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
  Flag,
  RotateCw,
  AlertCircle,
} from "lucide-react";

function fmtAgreementNumber(n) {
  if (n == null) return null;
  return `#${String(n).padStart(4, "0")}`;
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    return format(new Date(`${d}T00:00:00`), "MMM d, yyyy");
  } catch {
    return d;
  }
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Status pill — covers ALL agreement.status values explicitly. The
 * previous version fell through to "Awaiting tenant signature" for
 * any non-pending_tenant/non-accepted state, which incorrectly
 * labeled terminated_early agreements.
 */
function StatusPill({ agreement }) {
  const s = agreement?.status;

  // Special case: a renewal is in progress on an accepted agreement.
  if (s === "accepted" && agreement?.renewal_status === "renewal_offered") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
        <RotateCw className="w-3 h-3" /> Renewal in progress
      </span>
    );
  }

  // Special case: a termination is in progress on an accepted agreement.
  if (
    s === "accepted" &&
    agreement?.termination_status &&
    agreement.termination_status !== "none" &&
    agreement.termination_status !== "declined"
  ) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="w-3 h-3" /> Termination pending
      </span>
    );
  }

  switch (s) {
    case "pending_tenant":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3" /> Awaiting tenant signature
        </span>
      );
    case "accepted":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> Active
        </span>
      );
    case "terminated_early":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
          <Flag className="w-3 h-3" /> Terminated
        </span>
      );
    case "expired":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          <Calendar className="w-3 h-3" /> Expired
        </span>
      );
    case "canceled":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          <XCircle className="w-3 h-3" /> Canceled
        </span>
      );
    case "declined":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
          <XCircle className="w-3 h-3" /> Declined
        </span>
      );
    default:
      // Unknown status — render generically rather than misleadingly.
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
          {s || "Unknown"}
        </span>
      );
  }
}

export default function RentalCard({ agreement, role = "tenant", counterpartyName }) {
  if (!agreement) return null;
  const num = fmtAgreementNumber(agreement.agreement_number);

  // 60-day renewal reminder. Computed inline (cheap arithmetic, no need
  // to memoize — and memoizing here would force a hook to live below an
  // early `return null`, which is a rules-of-hooks violation).
  const daysToEnd = daysUntil(agreement.lease_end_date);
  const showRenewalReminder =
    agreement.status === "accepted" &&
    (agreement.renewal_status || "none") === "none" &&
    !(
      agreement.termination_status &&
      agreement.termination_status !== "none" &&
      agreement.termination_status !== "declined"
    ) &&
    daysToEnd != null &&
    daysToEnd >= 0 &&
    daysToEnd <= 60;

  const showRenewedBadge = agreement.renewal_status === "renewed";

  // Counterparty label — fall back to a sensible default.
  const counterparty =
    counterpartyName ||
    (role === "tenant"
      ? agreement.landlord_legal_name || agreement.owner_legal_name || "Landlord"
      : agreement.tenant_legal_name || "Tenant");

  return (
    <Link
      to={`/rentals/${agreement.id}`}
      className="block rounded-xl border border-border bg-card hover:border-accent/40 hover:shadow-sm transition-all"
    >
      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold truncate">
                {agreement.listing_title || "Rental agreement"}
              </div>
              {num && (
                <div className="text-xs text-muted-foreground">Agreement {num}</div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <StatusPill agreement={agreement} />
            {showRenewedBadge && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Renewed
              </span>
            )}
          </div>
        </div>

        {/* Renewal reminder banner */}
        {showRenewalReminder && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <span className="font-semibold">
                Lease ends in {daysToEnd} day{daysToEnd === 1 ? "" : "s"}.
              </span>{" "}
              Open the agreement to send a renewal offer.
            </div>
          </div>
        )}

        {/* Body row */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <User className="w-3.5 h-3.5" />
            <span className="truncate">{counterparty}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Home className="w-3.5 h-3.5" />
            <span className="capitalize">{role}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>Start: {fmtDate(agreement.lease_start_date)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>End: {fmtDate(agreement.lease_end_date)}</span>
          </div>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-end text-xs font-medium text-accent">
          View agreement <ChevronRight className="w-3 h-3 ml-0.5" />
        </div>
      </div>
    </Link>
  );
}
