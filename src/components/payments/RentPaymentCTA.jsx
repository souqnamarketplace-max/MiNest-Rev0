/**
 * Shown on a ListingDetail page for tenants.
 * Guides them through: agreement pending → sign → pay.
 */
import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { formatCents, getIntervalLabel, getSubscriptionStatusConfig } from "@/lib/paymentHelpers";
import { CreditCard, FileText, CheckCircle2, Clock, Link as LinkIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

export default function RentPaymentCTA({ listing }) {
  const { user, navigateToLogin, logout } = useAuth();

  const { data: plan } = useQuery({
    queryKey: ["payment-plan", listing?.id],
    queryFn: () => entities.PaymentPlan.filter({ listing_id: listing.id, status: "active" }).then(r => r[0] || null),
    enabled: !!listing?.id && !!listing?.payments_enabled,
  });

  const { data: agreement } = useQuery({
    queryKey: ["tenant-agreement", listing?.id, user?.id],
    queryFn: () => entities.RentalAgreement.filter({ tenant_user_id: user.id, listing_id: listing.id }, "-created_at", 5)
      .then(r => r.find(a => ["accepted", "pending_tenant"].includes(a.status)) || null),
    enabled: !!user?.id && !!listing?.id,
  });

  const { data: existingSub } = useQuery({
    queryKey: ["tenant-sub", listing?.id, user?.id],
    queryFn: () => entities.TenantSubscription.filter({ tenant_user_id: user.id, listing_id: listing.id })
      .then(r => r.find(s => ["active", "trialing", "incomplete", "past_due"].includes(s.status)) || null),
    enabled: !!user?.id && !!listing?.id,
  });

  if (user?.id === listing?.owner_user_id) return null;

  // Always show if tenant has an active or pending agreement (even without a plan)
  const hasAgreement = !!agreement;
  if (!hasAgreement && (!listing?.payments_enabled || !plan)) return null;

  // Active subscription
  if (existingSub) {
    const cfg = getSubscriptionStatusConfig(existingSub.status);
    return (
      <div className="bg-accent/5 border border-accent/20 rounded-2xl p-5 space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-foreground text-sm">Rent Payments Active</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          {plan ? `You're paying ${formatCents(plan.amount, plan.currency)} / ${getIntervalLabel(plan.interval)}.` : "Your rent payments are active."}
        </p>
        <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
        <Link to="/my-payments" className="text-xs text-accent hover:underline block">Manage payments →</Link>
      </div>
    );
  }

  // Pending agreement — needs to sign
  if (agreement?.status === "pending_tenant") {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-yellow-700" />
          <h3 className="font-semibold text-yellow-800 text-sm">Rental Offer Received!</h3>
        </div>
        <p className="text-xs text-yellow-700">
          The owner has sent you a rental agreement. Sign it to proceed with rent payments.
        </p>
        <Link to={`/my-payments?agreement=${agreement.id}`}>
          <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground gap-2 text-sm">
            <FileText className="w-4 h-4" /> Review & Sign Agreement
          </Button>
        </Link>
      </div>
    );
  }

  // Accepted agreement — can pay
  if (agreement?.status === "accepted") {
    return (
      <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-foreground text-sm">Agreement Signed</h3>
        </div>
        {plan && (
          <p className="text-sm text-foreground font-semibold">
            {formatCents(plan.amount, plan.currency)} / {getIntervalLabel(plan.interval)}
          </p>
        )}
        <Link to={`/my-payments?agreement=${agreement.id}`}>
          <Button className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground gap-2">
            <CreditCard className="w-4 h-4" /> Set Up Rent Payments
          </Button>
        </Link>
        <p className="text-[10px] text-muted-foreground text-center">Secured by Stripe. Cancel anytime.</p>
      </div>
    );
  }

  // No agreement yet — prompt (only if payments enabled + plan exists)
  if (user && listing?.payments_enabled && plan) {
    return (
      <div className="bg-muted/40 border border-border rounded-2xl p-5 space-y-3 text-center">
        <Clock className="w-6 h-6 text-muted-foreground mx-auto" />
        <h3 className="font-semibold text-foreground text-sm">Rent Payments Available</h3>
        <p className="text-xs text-muted-foreground">
          This owner accepts online rent payments ({formatCents(plan.amount, plan.currency)}/{getIntervalLabel(plan.interval)}).
          Contact them to request a rental agreement.
        </p>
      </div>
    );
  }

  return null;
}