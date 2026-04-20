/**
 * Displays a single TenantSubscription — used on both tenant and owner dashboards.
 */
import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { formatCents, getSubscriptionStatusConfig, getIntervalLabel } from "@/lib/paymentHelpers";
import { Home, Calendar, XCircle, Loader2, CreditCard } from "lucide-react";
import { entities } from '@/api/entities';
import { toast } from "sonner";
import { format } from "date-fns";

export default function SubscriptionCard({ subscription, viewAs = "tenant", onCancelled }) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);

  const cfg = getSubscriptionStatusConfig(subscription.status);
  const amountField = viewAs === "owner" ? subscription.amount_to_owner : subscription.amount_per_period;

  const handleUpdatePayment = async () => {
    toast.info("Payment update coming soon with Stripe integration!");
    setUpdatingPayment(false);
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await entities.TenantSubscription.update(subscription.id, { status: 'cancelled', cancel_reason: cancelReason });
      toast.success("Subscription cancelled.");
      setShowCancel(false);
      onCancelled?.();
    } catch (err) {
      toast.error(err.message || "Failed to cancel subscription");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Home className="w-4 h-4 text-accent" />
          </div>
          <div className="min-w-0">
            <Link
              to={`/listing/${subscription.listing_id}`}
              className="font-semibold text-foreground hover:text-accent text-sm line-clamp-1"
            >
              {subscription.listing_title || "Rental"}
            </Link>
            <p className="text-xs text-muted-foreground mt-0.5">
              {viewAs === "owner" ? `Tenant: ${subscription.tenant_user_id}` : `Owner: ${subscription.owner_user_id}`}
            </p>
          </div>
        </div>
        <Badge className={`text-xs flex-shrink-0 ${cfg.color}`}>{cfg.label}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Amount</p>
          <p className="font-semibold text-foreground">{formatCents(amountField, subscription.currency || "CAD")}</p>
          {viewAs === "owner" && subscription.platform_fee_amount > 0 && (
            <p className="text-[11px] text-muted-foreground">after platform fee</p>
          )}
        </div>
        {subscription.next_payment_date && (
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Next Payment</p>
            <p className="font-semibold text-foreground">{format(new Date(subscription.next_payment_date), "MMM d, yyyy")}</p>
          </div>
        )}
      </div>

      {subscription.status === "active" && !showCancel && (
        <div className="flex gap-2 flex-wrap">
          {viewAs === "tenant" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-secondary border-secondary/40 hover:bg-secondary/5"
              onClick={handleUpdatePayment}
              disabled={updatingPayment}
            >
              {updatingPayment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
              Update Payment
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive hover:bg-destructive/10 gap-1"
            onClick={() => setShowCancel(true)}
          >
            <XCircle className="w-3.5 h-3.5" /> Cancel Subscription
          </Button>
        </div>
      )}

      {showCancel && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-destructive">Confirm cancellation</p>
          <input
            className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background"
            placeholder="Reason for cancellation (optional)"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowCancel(false)} className="text-xs">Keep</Button>
            <Button size="sm" onClick={handleCancel} disabled={cancelling} className="text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1">
              {cancelling && <Loader2 className="w-3 h-3 animate-spin" />} Confirm Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}