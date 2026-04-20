/**
 * Owner-facing page to manage payment plans for their listings.
 * Accessed from Dashboard or from a listing's settings.
 */
import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entities, invokeFunction } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConnectAccountBanner from "@/components/payments/ConnectAccountBanner";
import PaymentPlanSetup from "@/components/payments/PaymentPlanSetup";
import { formatCents, getSubscriptionStatusConfig } from "@/lib/paymentHelpers";
import { CreditCard, Settings, CheckCircle2, XCircle, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function OwnerPaymentSetup() {
  const { user, navigateToLogin, logout } = useAuth();
  const qc = useQueryClient();
  const [setupListing, setSetupListing] = useState(null);

  const { data: connectStatus, refetch: refetchConnect } = useQuery({
    queryKey: ["connect-status", user?.id],
    queryFn: () => Promise.resolve({ status: 'not_connected', charges_enabled: false }),
    enabled: !!user,
  });

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["my-listings", user?.id],
    queryFn: () => entities.Listing.filter({ owner_user_id: user.id, status: "active" }, "-created_at", 30),
    enabled: !!user,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["my-payment-plans", user?.id],
    queryFn: () => entities.PaymentPlan.filter({ owner_user_id: user.id }, "-created_at", 50),
    enabled: !!user,
  });

  const getPlanForListing = (listingId) =>
    plans.find(p => p.listing_id === listingId && p.status === "active");

  const handleDisablePlan = async (plan) => {
    await entities.PaymentPlan.update(plan.id, { status: "archived" });
    await entities.Listing.update(plan.listing_id, { payments_enabled: false });
    qc.invalidateQueries({ queryKey: ["my-payment-plans"] });
    toast.success("Payments disabled for this listing");
  };

  const isConnected = connectStatus?.connected;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Rent Payment Setup</h1>
        <p className="text-sm text-muted-foreground mt-1">Enable in-app rent payments for your listings</p>
      </div>

      {/* Step 1: Connect Account */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Step 1 — Connect your bank</h2>
        <ConnectAccountBanner
          status={connectStatus?.onboarding_status || "not_started"}
          onStatusChange={refetchConnect}
        />
      </div>

      {/* Step 2: Enable per listing */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Step 2 — Enable payments per listing</h2>

        {!isConnected && (
          <div className="bg-muted/40 rounded-xl border border-border p-4 text-sm text-muted-foreground text-center">
            Complete Step 1 to enable payments on your listings.
          </div>
        )}

        {isConnected && isLoading && <Skeleton className="h-32 rounded-xl" />}

        {isConnected && !isLoading && listings.length === 0 && (
          <div className="bg-card rounded-xl border border-border p-6 text-center">
            <p className="text-muted-foreground text-sm">No active listings found.</p>
            <Link to="/create-listing">
              <Button size="sm" className="mt-3 bg-accent hover:bg-accent/90 text-accent-foreground">Create a Listing</Button>
            </Link>
          </div>
        )}

        {isConnected && listings.length > 0 && (
          <div className="space-y-3">
            {listings.map(listing => {
              const plan = getPlanForListing(listing.id);
              return (
                <div key={listing.id} className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                        {listing.cover_photo_url
                          ? <img src={listing.cover_photo_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-accent/10 flex items-center justify-center"><DollarSign className="w-4 h-4 text-accent" /></div>
                        }
                      </div>
                      <div className="min-w-0">
                        <Link to={`/listing/${listing.slug || listing.id}`} className="font-semibold text-sm text-foreground hover:text-accent line-clamp-1">
                          {listing.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">{listing.city}, {listing.province_or_state}</p>
                        {plan && (
                          <p className="text-xs text-accent font-medium mt-0.5">
                            {formatCents(plan.amount, plan.currency)} / {plan.interval}
                            <span className="text-muted-foreground ml-2">· {plan.commission_percentage}% fee</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {plan ? (
                        <>
                          <Badge className="bg-accent/10 text-accent text-xs"><CheckCircle2 className="w-3 h-3 mr-1" /> Enabled</Badge>
                          <Button size="sm" variant="outline" onClick={() => setSetupListing(listing)} className="text-xs h-7 px-2">
                            <Settings className="w-3 h-3 mr-1" /> Edit
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs h-7 px-2 text-destructive border-destructive" onClick={() => handleDisablePlan(plan)}>
                            <XCircle className="w-3 h-3" />
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" className="text-xs bg-accent hover:bg-accent/90 text-accent-foreground gap-1" onClick={() => setSetupListing(listing)}>
                          <CreditCard className="w-3 h-3" /> Enable Payments
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Setup Modal */}
      <Dialog open={!!setupListing} onOpenChange={(o) => !o && setSetupListing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {getPlanForListing(setupListing?.id) ? "Update Payment Plan" : "Enable Rent Payments"} — {setupListing?.title}
            </DialogTitle>
          </DialogHeader>
          {setupListing && (
            <PaymentPlanSetup
              listing={setupListing}
              existingPlan={getPlanForListing(setupListing.id)}
              onSuccess={() => {
                setSetupListing(null);
                qc.invalidateQueries({ queryKey: ["my-payment-plans"] });
                qc.invalidateQueries({ queryKey: ["my-listings"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}