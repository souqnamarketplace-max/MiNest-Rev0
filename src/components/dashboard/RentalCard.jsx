/**
 * RentalCard — compact card for a single rental agreement, used by
 * MyActiveRentals on the Dashboard. Shows agreement number, title, status,
 * dates, role (tenant / landlord), and a "View Agreement" CTA.
 *
 * Props:
 *   agreement: rental_agreements row (with optional joined fields)
 *   role: "tenant" | "landlord" — affects which counterparty info is shown
 *   counterpartyName?: string — pre-resolved display name (avoids extra fetch)
 */
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Hash,
  Calendar,
  User,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";

function fmtDate(d) {
  if (!d) return "—";
  try { return format(new Date(d), "PP"); } catch { return String(d); }
}

const STATUS_CONFIG = {
  pending_tenant: {
    label: "Awaiting tenant signature",
    cls: "bg-amber-50 border-amber-200 text-amber-800",
    icon: Clock,
  },
  accepted: {
    label: "Active",
    cls: "bg-emerald-50 border-emerald-200 text-emerald-800",
    icon: CheckCircle2,
  },
  declined: {
    label: "Declined",
    cls: "bg-red-50 border-red-200 text-red-800",
    icon: XCircle,
  },
  expired: {
    label: "Expired",
    cls: "bg-muted border-border text-muted-foreground",
    icon: Clock,
  },
  canceled: {
    label: "Cancelled",
    cls: "bg-muted border-border text-muted-foreground",
    icon: XCircle,
  },
};

export default function RentalCard({ agreement, role = "tenant", counterpartyName }) {
  if (!agreement) return null;
  const statusCfg = STATUS_CONFIG[agreement.status] || STATUS_CONFIG.pending_tenant;
  const StatusIcon = statusCfg.icon;

  const numStr = agreement.agreement_number != null
    ? `#${String(agreement.agreement_number).padStart(4, "0")}`
    : null;

  const counterpartyLabel = role === "tenant" ? "Landlord" : "Tenant";
  const counterpartyDisplay = counterpartyName
    || (role === "tenant" ? agreement.owner_legal_name : agreement.tenant_legal_name)
    || "—";

  const link = `/my-payments?agreement=${agreement.id}`;

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-accent/30 transition-colors">
      {/* Top row: title + status badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {agreement.listing_title || "Rental Agreement"}
            </h3>
            {numStr && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                <Hash className="w-2.5 h-2.5" />
                {numStr}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {agreement.governing_province_or_state || ""}{agreement.governing_province_or_state ? " · " : ""}
            {agreement.country === "US" ? "United States" : "Canada"}
          </p>
        </div>
        <div className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border whitespace-nowrap ${statusCfg.cls}`}>
          <StatusIcon className="w-3 h-3" />
          <span>{statusCfg.label}</span>
        </div>
      </div>

      {/* Middle row: counterparty + dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
          <User className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-muted-foreground/80">{counterpartyLabel}:</span>
          <span className="text-foreground font-medium truncate">{counterpartyDisplay}</span>
        </div>
        {agreement.lease_start_date && (
          <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">
              {fmtDate(agreement.lease_start_date)} → {fmtDate(agreement.lease_end_date)}
            </span>
          </div>
        )}
      </div>

      {/* Bottom row: actions */}
      <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
        <Button asChild size="sm" variant="default" className="h-8 text-xs gap-1 bg-accent hover:bg-accent/90 text-accent-foreground">
          <Link to={link}>
            <FileText className="w-3 h-3" /> View Agreement
            <ChevronRight className="w-3 h-3" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
