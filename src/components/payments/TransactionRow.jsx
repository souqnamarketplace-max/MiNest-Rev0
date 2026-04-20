/**
 * A single row in a transaction list.
 */
import React from "react";
import { Badge } from "@/components/ui/badge";
import { formatCents, getTransactionStatusConfig } from "@/lib/paymentHelpers";
import { format } from "date-fns";
import { ExternalLink } from "lucide-react";
import ReceiptDownloadButton from "@/components/payments/ReceiptDownloadButton";

export default function TransactionRow({ tx, viewAs = "tenant" }) {
  const cfg = getTransactionStatusConfig(tx.status);
  const amount = viewAs === "owner" ? tx.amount_to_owner : tx.amount;
  const label = viewAs === "owner" ? "Received" : "Paid";

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground line-clamp-1">{tx.listing_title || "Rental"}</p>
        <p className="text-xs text-muted-foreground">
          {tx.created_date ? format(new Date(tx.created_date), "MMM d, yyyy") : "—"}
          {tx.period_start && tx.period_end && (
            <span className="ml-1">
              · {format(new Date(tx.period_start), "MMM d")} – {format(new Date(tx.period_end), "MMM d, yyyy")}
            </span>
          )}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold text-foreground">{formatCents(amount, tx.currency || "cad")}</p>
        <Badge className={`text-[10px] mt-0.5 ${cfg.color}`}>{cfg.label}</Badge>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <ReceiptDownloadButton transaction={tx} />
        {tx.receipt_url && tx.status === "succeeded" && (
          <a
            href={tx.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-accent"
            title="View Stripe receipt"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}