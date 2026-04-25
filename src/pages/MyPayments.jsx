/**
 * My Payments page — works for both tenants and homeowners.
 * Tenants see their subscriptions + history.
 * Owners see their earnings + tenants' subscriptions + bank connect status.
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/paymentHelpers";
import ConnectAccountBanner from "@/components/payments/ConnectAccountBanner";
import SubscriptionCard from "@/components/payments/SubscriptionCard";
import TransactionRow from "@/components/payments/TransactionRow";
import PaymentDisputeForm from "@/components/payments/PaymentDisputeForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreditCard, TrendingUp, AlertTriangle, DollarSign, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import RentalAgreementView from "@/components/payments/RentalAgreementView.jsx";
import PaymentScheduleCalendar from "@/components/payments/PaymentScheduleCalendar";
import DepositRefundModal from "@/components/payments/DepositRefundModal";

export default function MyPayments() {
  const navigate = useNavigate();
  const { user, navigateToLogin, logout } = useAuth();
  const qc = useQueryClient();
  const [disputeTarget, setDisputeTarget] = useState(null);
  const [refundTarget, setRefundTarget] = useState(null);
  const [tab, setTab] = useState("tenant");
  const [selectedAgreement, setSelectedAgreement] = useState(null);

  // Backward compat: old links (notifications, bookmarks, pre-2.1A.1 cards)
  // pointed at /my-payments?agreement=X. Redirect to /rentals/X transparently.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const agreementId = params.get("agreement");
    if (agreementId) navigate(`/rentals/${agreementId}`, { replace: true });
  }, [navigate]);

  // Handle redirect back from Stripe Connect onboarding
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("onboard_refresh") === "1") {
      qc.invalidateQueries({ queryKey: ["connect-status"] });
      window.history.replaceState({}, "", "/my-payments");
    }
    if (params.get("subscription_success") === "1") {
      toast.success("🎉 Rent payment set up successfully! Your first payment will be processed shortly.");
      window.history.replaceState({}, "", "/my-payments");
    }
  }, []);

  const { data: userProfile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: () => entities.UserProfile.filter({ user_id: user.id }).then(r => r[0] || null),
    enabled: !!user,
  });

  const { data: connectStatus, refetch: refetchConnect } = useQuery({
    queryKey: ["connect-status", user?.id],
    queryFn: () => Promise.resolve({ status: 'not_connected', charges_enabled: false }),
    enabled: !!user,
  });

  const { data: dashboard, isLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ["payment-dashboard", user?.id],
    queryFn: () => Promise.resolve({}),
    enabled: !!user,
    staleTime: 30000,
  });

  const ownerData = dashboard?.owner || {};
  const tenantData = dashboard?.tenant || {};
  const ownerSubs = ownerData.subscriptions || [];
  const ownerTx = ownerData.transactions || [];
  const tenantSubs = tenantData.subscriptions || [];
  const tenantTx = tenantData.transactions || [];

  const { data: tenantAgreements = [], refetch: refetchAgreements } = useQuery({
    queryKey: ["tenant-agreements", user?.id],
    queryFn: () => entities.RentalAgreement.filter({ tenant_user_id: user.id }, "-created_at", 20),
    enabled: !!user,
  });

  const { data: ownerAgreements = [] } = useQuery({
    queryKey: ["owner-agreements", user?.id],
    queryFn: () => entities.RentalAgreement.filter({ owner_user_id: user.id }, "-created_at", 30),
    enabled: !!user,
  });

  const { data: paymentPlans = [] } = useQuery({
    queryKey: ["my-payment-plans", user?.id],
    queryFn: () => entities.PaymentPlan.filter({ owner_user_id: user.id }, "-created_at", 25),
    enabled: !!user,
  });

  // Fetch tenant agreement plans more efficiently — batch by agreement, not listing
  const { data: tenantAgreementPlans = [] } = useQuery({
    queryKey: ["tenant-agreement-plans", tenantAgreements.map(a => a.id).join(",")],
    queryFn: async () => {
      if (tenantAgreements.length === 0) return [];
      const listingIds = tenantAgreements.map(a => a.listing_id).filter(Boolean);
      if (listingIds.length === 0) return [];
      const results = await Promise.all(
        listingIds.map(lid => entities.PaymentPlan.filter({ listing_id: lid, status: "active" }, "-created_at", 5))
      );
      return results.flat().slice(0, 10);
    },
    enabled: !!user && tenantAgreements.length > 0,
  });

  const allPlans = [...paymentPlans, ...tenantAgreementPlans];

  const getPlanForAgreement = (agreement) =>
    allPlans.find(p => p.id === agreement.payment_plan_id) ||
    allPlans.find(p => p.listing_id === agreement.listing_id && p.status === "active");

  const pendingAgreements = tenantAgreements.filter(a => a.status === "pending_tenant");
  const activeAgreement = selectedAgreement
    ? tenantAgreements.find(a => a.id === selectedAgreement) || ownerAgreements.find(a => a.id === selectedAgreement)
    : null;

  const isSeeker = userProfile?.user_type_intent === "seeker";
  const isOwner = userProfile?.user_type_intent === "lister" || userProfile?.user_type_intent === "both";

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">My Payments</h1>
        <p className="text-muted-foreground text-sm">Manage your rent subscriptions and payment history</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            {!isSeeker && <TabsTrigger value="owner"><TrendingUp className="w-3.5 h-3.5 mr-1" /> As Owner</TabsTrigger>}
            <TabsTrigger value="tenant"><CreditCard className="w-3.5 h-3.5 mr-1" /> As Tenant</TabsTrigger>
          </TabsList>

          {/* OWNER TAB */}
          {!isSeeker && (
            <TabsContent value="owner" className="space-y-6">
              {/* Connect Account */}
              <ConnectAccountBanner
                status={connectStatus?.onboarding_status || "not_started"}
                onStatusChange={() => { refetchConnect(); refetchDashboard(); }}
              />

              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Total Earned", value: formatCents(ownerData.total_earnings_cents, "CAD") },
                  { label: "Active Subscriptions", value: ownerSubs.filter(s => s.status === "active").length },
                  { label: "Past Due", value: ownerSubs.filter(s => s.status === "past_due").length },
                ].map((s, i) => (
                  <div key={i} className="bg-card rounded-xl border border-border p-3">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-xl font-bold text-foreground">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Tenant Subscriptions */}
              <div>
                <h2 className="text-base font-semibold text-foreground mb-3">Tenant Subscriptions</h2>
                {ownerSubs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tenants have set up payments yet.</p>
                ) : (
                  <div className="space-y-3">
                    {ownerSubs.map(sub => (
                      <div key={sub.id} className="space-y-2">
                        <SubscriptionCard
                          subscription={sub}
                          viewAs="owner"
                          onCancelled={refetchDashboard}
                        />
                        <div className="flex gap-2 ml-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-accent hover:text-accent/90 gap-1"
                            onClick={() => setRefundTarget(sub)}
                          >
                            <DollarSign className="w-3 h-3" /> Refund Deposit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-destructive hover:text-destructive gap-1"
                            onClick={() => setDisputeTarget(sub)}
                          >
                            <AlertTriangle className="w-3 h-3" /> Report Issue
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Transaction History */}
              {ownerTx.length > 0 && (
                <div>
                  <h2 className="text-base font-semibold text-foreground mb-3">Payment History</h2>
                  <div className="bg-card rounded-xl border border-border px-4">
                    {ownerTx.map(tx => <TransactionRow key={tx.id} tx={tx} viewAs="owner" />)}
                  </div>
                </div>
              )}

              {/* Rental Agreements Sent */}
              {ownerAgreements.length > 0 && (
                <div>
                  <h2 className="text-base font-semibold text-foreground mb-3">Rental Agreements Sent</h2>
                  <div className="space-y-2">
                    {ownerAgreements.map(a => (
                      <div key={a.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground truncate">{a.listing_title}</p>
                            {a.agreement_number != null && (
                              <span className="text-[10px] font-semibold text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5 whitespace-nowrap">
                                #{String(a.agreement_number).padStart(4, "0")}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            Tenant: {a.tenant_legal_name || a.tenant_user_id} · {a.lease_start_date} → {a.lease_end_date}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className={`text-xs ${
                            a.status === "accepted" ? "bg-accent/10 text-accent" :
                            a.status === "pending_tenant" ? "bg-yellow-500/10 text-yellow-600" :
                            a.status === "declined" ? "bg-destructive/10 text-destructive" :
                            "bg-muted text-muted-foreground"
                          }`}>{a.status === "pending_tenant" ? "Awaiting Tenant" : a.status}</Badge>
                          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => navigate(`/rentals/${a.id}`)}>
                            <FileText className="w-3 h-3" /> View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          )}

          {/* TENANT TAB */}
          <TabsContent value="tenant" className="space-y-6">

            {/* Pending Agreements Banner */}
            {pendingAgreements.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-yellow-700" />
                  <p className="font-semibold text-yellow-800 text-sm">
                    {pendingAgreements.length} Rental Offer{pendingAgreements.length > 1 ? "s" : ""} Awaiting Your Signature
                  </p>
                </div>
                <div className="space-y-2">
                  {pendingAgreements.map(a => (
                    <div key={a.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-yellow-200">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{a.listing_title}</p>
                        <p className="text-xs text-muted-foreground">Lease: {a.lease_start_date} → {a.lease_end_date}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="text-xs"
                          onClick={async () => {
                            await entities.RentalAgreement.update(a.id, { status: 'declined' });
                            refetchAgreements();
                          }}>
                          Decline
                        </Button>
                        <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground text-xs gap-1"
                          onClick={() => navigate(`/rentals/${a.id}`)}>
                          <FileText className="w-3 h-3" /> Review
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Agreement View */}
            {activeAgreement && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold text-foreground">Rental Agreement</h2>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedAgreement(null)} className="text-xs">← Back</Button>
                </div>
                <RentalAgreementView
                  agreement={activeAgreement}
                  plan={getPlanForAgreement(activeAgreement)}
                  onSigned={() => { refetchAgreements(); refetchDashboard(); }}
                  onDeclined={() => { setSelectedAgreement(null); refetchAgreements(); }}
                />
              </div>
            )}

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total Paid", value: formatCents(tenantData.total_spent_cents, "CAD"), icon: DollarSign },
                { label: "Active Subscriptions", value: tenantSubs.filter(s => s.status === "active").length, icon: CreditCard },
              ].map((s, i) => (
                <div key={i} className="bg-card rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <s.icon className="w-3.5 h-3.5 text-accent" />
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                  <p className="text-xl font-bold text-foreground">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Active Subscriptions */}
            <div>
              <h2 className="text-base font-semibold text-foreground mb-3">My Rent Subscriptions</h2>
              {tenantSubs.length === 0 ? (
                <div className="bg-card rounded-xl border border-border p-8 text-center">
                  <CreditCard className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No active rent subscriptions.</p>
                  <p className="text-xs text-muted-foreground mt-1">Find a listing with payments enabled to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tenantSubs.map(sub => (
                    <div key={sub.id} className="space-y-2">
                      <SubscriptionCard
                        subscription={sub}
                        viewAs="tenant"
                        onCancelled={refetchDashboard}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-destructive hover:text-destructive gap-1 ml-1"
                        onClick={() => setDisputeTarget(sub)}
                      >
                        <AlertTriangle className="w-3 h-3" /> Report Issue
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Schedule Calendar */}
            {(tenantAgreements.filter(a => a.status === "accepted").length > 0 || tenantSubs.length > 0) && (
              <PaymentScheduleCalendar
                agreements={tenantAgreements}
                subscriptions={tenantSubs}
                transactions={tenantTx}
              />
            )}

            {/* Transaction History */}
            {tenantTx.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-foreground mb-3">Payment History</h2>
                <div className="bg-card rounded-xl border border-border px-4">
                  {tenantTx.map(tx => <TransactionRow key={tx.id} tx={tx} viewAs="tenant" />)}
                </div>
              </div>
            )}

            {/* All Agreements */}
            {tenantAgreements.filter(a => a.status !== "pending_tenant").length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-foreground mb-3">My Agreements</h2>
                <div className="space-y-2">
                  {tenantAgreements.filter(a => a.status !== "pending_tenant").map(a => (
                    <div key={a.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{a.listing_title}</p>
                          {a.agreement_number != null && (
                            <span className="text-[10px] font-semibold text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5 whitespace-nowrap">
                              #{String(a.agreement_number).padStart(4, "0")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{a.lease_start_date} → {a.lease_end_date}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${
                          a.status === "accepted" ? "bg-accent/10 text-accent" :
                          a.status === "declined" ? "bg-destructive/10 text-destructive" :
                          "bg-muted text-muted-foreground"
                        }`}>{a.status}</Badge>
                        {a.status === "accepted" && (
                          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate(`/rentals/${a.id}`)}>View</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Dispute Modal */}
      <Dialog open={!!disputeTarget} onOpenChange={(o) => !o && setDisputeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report a Payment Issue</DialogTitle>
          </DialogHeader>
          {disputeTarget && (
            <PaymentDisputeForm
              subscription={disputeTarget}
              onSuccess={() => setDisputeTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Deposit Refund Modal */}
      <DepositRefundModal
        open={!!refundTarget}
        onOpenChange={(o) => !o && setRefundTarget(null)}
        subscription={refundTarget}
        onSuccess={() => { setRefundTarget(null); refetchDashboard(); }}
      />
    </div>
  );
}