import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Eye, MessageSquare, Settings, MoreHorizontal, Pause, Pencil, Trash2, Zap, Search, UserCircle, CreditCard, TrendingUp, DollarSign, AlertTriangle, FileText , Shield} from "lucide-react";
import { getCurrencyByCountry, formatRentPrice } from "@/lib/pricingHelpers";
import { useCountry } from "@/lib/CountryContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import BoostModal from "@/components/listings/BoostModal";
import BoostStatusBadge from "@/components/listings/BoostStatusBadge";
import ViewingRequestsList from "@/components/owner/ViewingRequestsList";
import BookingRequestsList from "@/components/bookings/BookingRequestsList";
import AvailabilityCalendar from "@/components/bookings/AvailabilityCalendar";
import RentalRequestsList from "@/components/owner/RentalRequestsList";
import MyActiveRentals from "@/components/dashboard/MyActiveRentals";
import MyViewingsList from "@/components/viewer/MyViewingsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCents } from "@/lib/paymentHelpers";
import ConnectAccountBanner from "@/components/payments/ConnectAccountBanner";
import SubscriptionCard from "@/components/payments/SubscriptionCard";
import TransactionRow from "@/components/payments/TransactionRow";
import PaymentDisputeForm from "@/components/payments/PaymentDisputeForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import RentalAgreementView from "@/components/payments/RentalAgreementView.jsx";
import PaymentScheduleCalendar from "@/components/payments/PaymentScheduleCalendar";
import DepositRefundModal from "@/components/payments/DepositRefundModal";
import { useHaptic, HapticPatterns } from "@/lib/hapticFeedback";

const statusColors = {
  active: "bg-accent/10 text-accent", draft: "bg-muted text-muted-foreground",
  paused: "bg-secondary/10 text-secondary", expired: "bg-destructive/10 text-destructive",
  pending_review: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400", rejected: "bg-destructive/10 text-destructive",
};

export default function Dashboard() {
  const { user, navigateToLogin, logout } = useAuth();
  const { country } = useCountry();
  const dashCurrency = getCurrencyByCountry(country);
  const qc = useQueryClient();
  const triggerHaptic = useHaptic();
  const [boostModalOpen, setBoostModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [refreshViewings, setRefreshViewings] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Payment state
  const [paymentTab, setPaymentTab] = useState("tenant");
  const [disputeTarget, setDisputeTarget] = useState(null);
  const [refundTarget, setRefundTarget] = useState(null);
  const [selectedAgreement, setSelectedAgreement] = useState(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("boost_success") === "true") {
      toast.success("🚀 Your listing is now boosted & featured for 7 days!");
      window.history.replaceState({}, "", "/dashboard");
    } else if (params.get("boost_canceled") === "true") {
      toast.error("Boost purchase was cancelled. No charge was made.");
      window.history.replaceState({}, "", "/dashboard");
    }
    if (params.get("subscription_success") === "1") {
      toast.success("🎉 Rent payment set up successfully!");
      setActiveTab("payments");
      window.history.replaceState({}, "", "/dashboard");
    }
    const agreementId = params.get("agreement");
    if (agreementId) {
      setSelectedAgreement(agreementId);
      setActiveTab("payments");
      window.history.replaceState({}, "", "/dashboard");
    }
    const tab = params.get("tab");
    if (tab) {
      setActiveTab(tab);
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  const { data: userProfile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: () => entities.UserProfile.filter({ user_id: user.id }).then(r => r[0] || null),
    enabled: !!user,
  });
  const isSeeker = userProfile?.user_type_intent === "seeker";

  const { data: seekerProfile } = useQuery({
    queryKey: ["my-seeker-profile", user?.id],
    queryFn: () => entities.SeekerProfile.filter({ owner_user_id: user.id }).then(r => r[0] || null),
    enabled: !!user && isSeeker !== undefined,
  });

  const { data: listings = [], refetch } = useQuery({
    queryKey: ["my-listings", user?.id],
    queryFn: () => entities.Listing.filter({ owner_user_id: user.id }, "-created_at", 20),
    enabled: !!user,
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ["my-favorites", user?.id],
    queryFn: () => entities.Favorite.filter({ user_id: user.id }, "-created_at", 10),
    enabled: !!user,
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ["my-conversations", user?.id],
    queryFn: () => entities.Conversation.filter({ participant_ids: [user.id] }, "-last_message_at", 5),
    enabled: !!user,
  });

  // Payment queries
  const { data: connectStatus, refetch: refetchConnect } = useQuery({
    queryKey: ["connect-status", user?.id],
    queryFn: () => Promise.resolve({ status: 'not_connected', charges_enabled: false }),
    enabled: !!user && activeTab === "payments",
  });

  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ["payment-dashboard", user?.id],
    queryFn: async () => { return {}; }, // Stripe dashboard - available after Phase 4
    enabled: !!user && activeTab === "payments",
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
    enabled: !!user && activeTab === "payments",
  });

  const { data: ownerAgreements = [] } = useQuery({
    queryKey: ["owner-agreements", user?.id],
    queryFn: () => entities.RentalAgreement.filter({ owner_user_id: user.id }, "-created_at", 30),
    enabled: !!user && activeTab === "payments",
  });

  const { data: paymentPlans = [] } = useQuery({
    queryKey: ["my-payment-plans", user?.id],
    queryFn: () => entities.PaymentPlan.filter({ owner_user_id: user.id }, "-created_at", 25),
    enabled: !!user && activeTab === "payments",
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
    enabled: !!user && tenantAgreements.length > 0 && activeTab === "payments",
  });

  const allPlans = [...paymentPlans, ...tenantAgreementPlans];
  const getPlanForAgreement = (agreement) =>
    allPlans.find(p => p.id === agreement.payment_plan_id) ||
    allPlans.find(p => p.listing_id === agreement.listing_id && p.status === "active");

  const pendingAgreements = tenantAgreements.filter(a => a.status === "pending_tenant");
  const activeAgreement = selectedAgreement
    ? tenantAgreements.find(a => a.id === selectedAgreement) || ownerAgreements.find(a => a.id === selectedAgreement)
    : null;

  const handleRenew = async (listing) => {
    const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await entities.Listing.update(listing.id, { status: 'active', expires_at: newExpiry });
    toast.success("Listing renewed for 30 days!");
    refetch();
  };

  const handleStatusChange = async (listing, newStatus) => {
    try {
      await entities.Listing.update(listing.id, { status: newStatus });
      toast.success(`Listing ${newStatus}`);
      triggerHaptic(HapticPatterns.MEDIUM_TAP);
      refetch();
    } catch (err) {
      toast.error("Failed to update listing status.");
    }
  };

  const handleDelete = async (listing) => {
    // FIX #4: Confirmation before permanent delete
    if (!window.confirm(`Delete "${listing.title}"? This cannot be undone.`)) return;
    try {
      await entities.Listing.delete(listing.id);
      toast.success("Listing deleted");
      triggerHaptic(HapticPatterns.SUCCESS);
      refetch();
    } catch (err) {
      toast.error("Failed to delete listing. Please try again.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            {userProfile?.is_admin && (
              <Link to="/admin">
                <Button variant="outline" size="sm" className="border-accent text-accent hover:bg-accent/10 gap-1">
                  <Shield className="w-3.5 h-3.5" /> Admin Panel
                </Button>
              </Link>
            )}
          </div>
          <p className="text-muted-foreground text-sm">Welcome back, {userProfile?.display_name || userProfile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "there"}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!isSeeker && (
            <Link to="/create-listing">
              <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <PlusCircle className="w-4 h-4 mr-1" /> New Listing
              </Button>
            </Link>
          )}
          {isSeeker && (
            <Link to="/search">
              <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Search className="w-4 h-4 mr-1" /> Find a Room
              </Button>
            </Link>
          )}
          <Button size="sm" variant="outline" onClick={() => setActiveTab("payments")}><CreditCard className="w-4 h-4 mr-1" /> Payments</Button>
          <Link to="/profile">
            <Button size="sm" variant="outline"><Settings className="w-4 h-4 mr-1" /> Profile</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
         {[
           { label: "Active Listings", value: listings.filter(l => l.status === "active").length, icon: Eye },
           { label: "Pending Review", value: listings.filter(l => l.status === "pending_review").length, icon: Eye },
           { label: "Boosted & Featured", value: listings.filter(l => l.is_boosted && l.boost_end_at && new Date(l.boost_end_at) > new Date()).length, icon: Zap },
           { label: "Conversations", value: conversations.length, icon: MessageSquare },
         ].map((stat, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Seeker Profile CTA */}
      {isSeeker && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Your Roommate Profile</h2>
            {seekerProfile && (
              <Link to="/seeker-onboarding">
                <Button variant="outline" size="sm"><Pencil className="w-3 h-3 mr-1" /> Edit Profile</Button>
              </Link>
            )}
          </div>
          {!seekerProfile ? (
            <div className="bg-card rounded-xl border border-border p-8 text-center">
              <UserCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-2 font-medium">You don't have a roommate profile yet.</p>
              <p className="text-sm text-muted-foreground mb-4">Create a profile so listers and other seekers can find you.</p>
              <Link to="/seeker-onboarding">
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <UserCircle className="w-4 h-4 mr-1" /> Create My Profile
                </Button>
              </Link>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                <UserCircle className="w-6 h-6 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground">{seekerProfile.headline || "Roommate Seeker"}</div>
                <div className="text-sm text-muted-foreground">{[seekerProfile.preferred_cities?.[0], seekerProfile.preferred_province_or_state, seekerProfile.preferred_country].filter(Boolean).join(", ")}</div>
                {seekerProfile.max_budget && (
                  <div className="text-sm text-accent font-medium">Budget: up to ${seekerProfile.max_budget?.toLocaleString()} {dashCurrency}/mo</div>
                )}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${seekerProfile.status === "active" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"}`}>
                {seekerProfile.status || "active"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* My Active Rentals — prominent section above the tabs.
          Hidden when the user has no active leases or rentals. */}
      <MyActiveRentals />

      {/* Tabs for Seeker & Owner */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mb-1">
          <TabsList className="flex w-max min-w-full sm:w-auto bg-muted/60 rounded-xl p-1 h-auto gap-1">
            {!isSeeker && (
              <TabsTrigger value="requests" className="flex-1 sm:flex-none rounded-lg px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap data-[state=active]:bg-card data-[state=active]:shadow-sm">
                Viewings
              </TabsTrigger>
            )}
            {!isSeeker && (
              <TabsTrigger value="rental_requests" className="flex-1 sm:flex-none rounded-lg px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap data-[state=active]:bg-card data-[state=active]:shadow-sm">
                Inquiries
              </TabsTrigger>
            )}
            {isSeeker && (
              <TabsTrigger value="myviewings" className="flex-1 sm:flex-none rounded-lg px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap data-[state=active]:bg-card data-[state=active]:shadow-sm">
                My Viewings
              </TabsTrigger>
            )}
            <TabsTrigger value="payments" className="flex-1 sm:flex-none rounded-lg px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap data-[state=active]:bg-card data-[state=active]:shadow-sm gap-1">
              <CreditCard className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Payments
            </TabsTrigger>
            {!isSeeker && (
              <TabsTrigger value="bookings" className="flex-1 sm:flex-none rounded-lg px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap data-[state=active]:bg-card data-[state=active]:shadow-sm">
                Bookings
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {!isSeeker && (
          <TabsContent value="requests" className="mt-6">
            <ViewingRequestsList forceRefresh={refreshViewings} />
          </TabsContent>
        )}

        {!isSeeker && (
          <TabsContent value="rental_requests" className="mt-6">
            <RentalRequestsList />
          </TabsContent>
        )}

        {isSeeker && (
          <TabsContent value="myviewings" className="mt-6">
            <MyViewingsList />
          </TabsContent>
        )}

        {/* BOOKINGS TAB */}
            {!isSeeker && (
              <TabsContent value="bookings" className="mt-6">
                <BookingRequestsList />

                {/* Availability Calendars for daily listings */}
                {listings.filter(l => l.rent_period === "daily" && l.status === "active").length > 0 && (
                  <div className="mt-8 space-y-4">
                    <h2 className="text-lg font-semibold text-foreground">Manage Availability</h2>
                    <p className="text-sm text-muted-foreground">Block or unblock dates for your daily rental listings. Booked dates cannot be changed.</p>
                    <div className="grid md:grid-cols-2 gap-4">
                      {listings
                        .filter(l => l.rent_period === "daily" && l.status === "active")
                        .map(listing => (
                          <div key={listing.id} className="space-y-2">
                            <div className="flex items-center gap-2">
                              {listing.cover_photo_url && (
                                <img src={listing.cover_photo_url} alt="" className="w-8 h-8 rounded-md object-cover" />
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{listing.title}</p>
                                <p className="text-xs text-muted-foreground">{listing.city}</p>
                              </div>
                            </div>
                            <AvailabilityCalendar listing={listing} onUpdate={() => refetch()} />
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )}
              </TabsContent>
            )}

            {/* PAYMENTS TAB */}
        <TabsContent value="payments" className="mt-6">
          {dashboardLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          ) : (
            <Tabs value={paymentTab} onValueChange={setPaymentTab}>
              <TabsList className="mb-6">
                {!isSeeker && <TabsTrigger value="owner"><TrendingUp className="w-3.5 h-3.5 mr-1" /> As Owner</TabsTrigger>}
                <TabsTrigger value="tenant"><CreditCard className="w-3.5 h-3.5 mr-1" /> As Tenant</TabsTrigger>
              </TabsList>

              {/* OWNER VIEW */}
              {!isSeeker && (
                <TabsContent value="owner" className="space-y-6">
                  <ConnectAccountBanner
                    status={connectStatus?.onboarding_status || "not_started"}
                    onStatusChange={() => { refetchConnect(); refetchDashboard(); }}
                  />
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
                  <div>
                    <h2 className="text-base font-semibold text-foreground mb-3">Tenant Subscriptions</h2>
                    {ownerSubs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No tenants have set up payments yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {ownerSubs.map(sub => (
                          <div key={sub.id} className="space-y-2">
                            <SubscriptionCard subscription={sub} viewAs="owner" onCancelled={refetchDashboard} />
                            <div className="flex gap-2 ml-1">
                              <button className="text-xs text-accent flex items-center gap-1 hover:underline" onClick={() => setRefundTarget(sub)}>
                                <DollarSign className="w-3 h-3" /> Refund Deposit
                              </button>
                              <button className="text-xs text-destructive flex items-center gap-1 hover:underline" onClick={() => setDisputeTarget(sub)}>
                                <AlertTriangle className="w-3 h-3" /> Report Issue
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {ownerTx.length > 0 && (
                    <div>
                      <h2 className="text-base font-semibold text-foreground mb-3">Payment History</h2>
                      <div className="bg-card rounded-xl border border-border px-4">
                        {ownerTx.map(tx => <TransactionRow key={tx.id} tx={tx} viewAs="owner" />)}
                      </div>
                    </div>
                  )}
                  {ownerAgreements.length > 0 && (
                    <div>
                      <h2 className="text-base font-semibold text-foreground mb-3">Rental Agreements Sent</h2>
                      <div className="space-y-2">
                        {ownerAgreements.map(a => (
                          <div key={a.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{a.listing_title}</p>
                              <p className="text-xs text-muted-foreground">Tenant: {a.tenant_user_id} · {a.lease_start_date} → {a.lease_end_date}</p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              a.status === "accepted" ? "bg-accent/10 text-accent" :
                              a.status === "pending_tenant" ? "bg-yellow-500/10 text-yellow-600" :
                              a.status === "declined" ? "bg-destructive/10 text-destructive" :
                              "bg-muted text-muted-foreground"
                            }`}>{a.status === "pending_tenant" ? "Awaiting Tenant" : a.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
              )}

              {/* TENANT VIEW */}
              <TabsContent value="tenant" className="space-y-6">
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
                            <button
                              className="text-xs text-muted-foreground border border-border px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
                              onClick={async () => {
                                try {
                                  await entities.RentalAgreement.update(a.id, { status: 'declined' });
                                  refetchAgreements();
                                } catch { toast.error("Failed to decline agreement."); }
                              }}
                            >
                              Decline
                            </button>
                            <button
                              className="text-xs bg-accent text-accent-foreground px-3 py-1.5 rounded-lg flex items-center gap-1 font-medium"
                              onClick={() => setSelectedAgreement(a.id)}
                            >
                              <FileText className="w-3 h-3" /> Review
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeAgreement && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-base font-semibold text-foreground">Rental Agreement</h2>
                      <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelectedAgreement(null)}>← Back</button>
                    </div>
                    <RentalAgreementView
                      agreement={activeAgreement}
                      plan={getPlanForAgreement(activeAgreement)}
                      onSigned={() => { refetchAgreements(); refetchDashboard(); }}
                      onDeclined={() => { setSelectedAgreement(null); refetchAgreements(); }}
                    />
                  </div>
                )}

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

                <div>
                  <h2 className="text-base font-semibold text-foreground mb-3">My Rent Subscriptions</h2>
                  {tenantSubs.length === 0 ? (
                    <div className="bg-card rounded-xl border border-border p-8 text-center">
                      <CreditCard className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">No active rent subscriptions.</p>
                      <p className="text-xs text-muted-foreground mt-1">Sign a rental agreement to get started.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tenantSubs.map(sub => (
                        <div key={sub.id} className="space-y-2">
                          <SubscriptionCard subscription={sub} viewAs="tenant" onCancelled={refetchDashboard} />
                          <button className="text-xs text-destructive flex items-center gap-1 ml-1 hover:underline" onClick={() => setDisputeTarget(sub)}>
                            <AlertTriangle className="w-3 h-3" /> Report Issue
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {(tenantAgreements.filter(a => a.status === "accepted").length > 0 || tenantSubs.length > 0) && (
                  <PaymentScheduleCalendar
                    agreements={tenantAgreements}
                    subscriptions={tenantSubs}
                    transactions={tenantTx}
                  />
                )}

                {tenantTx.length > 0 && (
                  <div>
                    <h2 className="text-base font-semibold text-foreground mb-3">Payment History</h2>
                    <div className="bg-card rounded-xl border border-border px-4">
                      {tenantTx.map(tx => <TransactionRow key={tx.id} tx={tx} viewAs="tenant" />)}
                    </div>
                  </div>
                )}

                {tenantAgreements.filter(a => a.status !== "pending_tenant").length > 0 && (
                  <div>
                    <h2 className="text-base font-semibold text-foreground mb-3">My Agreements</h2>
                    <div className="space-y-2">
                      {tenantAgreements.filter(a => a.status !== "pending_tenant").map(a => (
                        <div key={a.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{a.listing_title}</p>
                            <p className="text-xs text-muted-foreground">{a.lease_start_date} → {a.lease_end_date}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              a.status === "accepted" ? "bg-accent/10 text-accent" :
                              a.status === "declined" ? "bg-destructive/10 text-destructive" :
                              "bg-muted text-muted-foreground"
                            }`}>{a.status}</span>
                            {a.status === "accepted" && (
                              <button className="text-xs text-accent hover:underline" onClick={() => setSelectedAgreement(a.id)}>View</button>
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
        </TabsContent>
      </Tabs>

      {/* Active Boosts & Features */}
      {!isSeeker && (
        <div className="mb-4 flex justify-end">
          <Link to="/boost-manager">
            <Button variant="outline" size="sm" className="gap-1">
              <Zap className="w-3.5 h-3.5" /> Manage Boosts
            </Button>
          </Link>
        </div>
      )}
      {!isSeeker && (listings.filter(l => l.is_boosted || l.is_featured).length > 0) && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Active Boosts & Features</h2>
          <div className="space-y-2">
            {listings.filter(l => l.is_boosted || l.is_featured).map(listing => {
              const daysRemaining = listing.boost_end_at 
                ? Math.ceil((new Date(listing.boost_end_at) - new Date()) / (1000 * 60 * 60 * 24))
                : null;
              return (
                <Link key={listing.id} to={`/listing/${listing.slug || listing.id}`} className="block">
                  <div className="bg-card rounded-xl border border-border p-4 hover:border-accent/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground line-clamp-1">{listing.title}</div>
                        <div className="text-sm text-muted-foreground">{listing.city}, {listing.province_or_state}</div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <BoostStatusBadge listing={listing} />
                          {daysRemaining && daysRemaining > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">{daysRemaining} days remaining</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Listings */}
      {!isSeeker && <div className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">Your Listings</h2>
        {listings.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <p className="text-muted-foreground mb-4">You haven't posted any rooms yet.</p>
            <Link to="/create-listing">
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <PlusCircle className="w-4 h-4 mr-1" /> Post Your First Room
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {listings.map(listing => (
              <div key={listing.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                  {listing.cover_photo_url ? (
                    <img src={listing.cover_photo_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No img</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/listing/${listing.slug || listing.id}`} className="font-semibold text-foreground hover:text-accent line-clamp-1">
                    {listing.title}
                  </Link>
                  <div className="text-sm text-muted-foreground">{listing.city}, {listing.province_or_state}</div>
                  {listing.status === 'active' && listing.expires_at && new Date(listing.expires_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) && (
                    <p className="text-xs text-yellow-600 mt-0.5">⏰ Expiring in {Math.ceil((new Date(listing.expires_at) - Date.now()) / 86400000)} days — renew to stay visible</p>
                  )}
                  {listing.status === "pending_review" && (
                    <p className="text-xs text-yellow-600 mt-0.5">⏳ Under review — we'll notify you once approved</p>
                  )}
                  {listing.status === "rejected" && (
                    <p className="text-xs text-destructive mt-0.5">❌ Not approved — please review our guidelines and resubmit</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge className={`text-xs ${statusColors[listing.status] || "bg-muted text-muted-foreground"}`}>
                      {listing.status?.replace(/_/g, " ")}
                    </Badge>
                    <BoostStatusBadge listing={listing} />
                    <span className="text-sm font-semibold text-accent">{formatRentPrice(listing.rent_amount || listing.monthly_rent, listing.rent_period || "monthly", dashCurrency)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Eye className="w-3 h-3" /> {listing.view_count || 0}
                </div>
                <DropdownMenu>
                   <DropdownMenuTrigger asChild>
                     <Button variant="ghost" size="icon" aria-label="More options"><MoreHorizontal className="w-4 h-4" /></Button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent align="end">
                     {listing.status === 'expired' && (
                        <DropdownMenuItem onClick={() => handleRenew(listing)} className="text-accent">
                          <RefreshCw className="w-4 h-4 mr-2" /> Renew Listing
                        </DropdownMenuItem>
                      )}
                     {listing.status === "active" && listing.expires_at && new Date(listing.expires_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) && (
                        <DropdownMenuItem onClick={() => handleRenew(listing)} className="text-yellow-600">
                          <RefreshCw className="w-4 h-4 mr-2" /> Renew (Expiring Soon)
                        </DropdownMenuItem>
                      )}
                     {listing.status === "active" && !(listing.is_boosted && listing.boost_end_at && new Date(listing.boost_end_at) > new Date()) && (
                        <DropdownMenuItem onClick={() => { setSelectedListing(listing); setBoostModalOpen(true); }}>
                          <Zap className="w-4 h-4 mr-2" /> Boost Listing
                        </DropdownMenuItem>
                      )}
                     <DropdownMenuItem onClick={() => handleStatusChange(listing, listing.status === "active" ? "paused" : "active")}>
                       <Pause className="w-4 h-4 mr-2" /> {listing.status === "active" ? "Pause" : "Activate"}
                     </DropdownMenuItem>
                     <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(listing)}>
                       <Trash2 className="w-4 h-4 mr-2" /> Delete
                     </DropdownMenuItem>
                   </DropdownMenuContent>
                 </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>}

      {/* Recent Conversations */}
      {conversations.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Messages</h2>
            <Link to="/messages"><Button variant="ghost" size="sm">View All</Button></Link>
          </div>
          <div className="space-y-2">
            {conversations.slice(0, 3).map(c => (
              <Link key={c.id} to={`/messages?id=${c.id}`} className="block bg-card rounded-xl border border-border p-4 hover:border-accent/30 transition-colors">
                <div className="text-sm font-medium text-foreground">{c.listing_title || "Conversation"}</div>
                <div className="text-sm text-muted-foreground line-clamp-1">{c.last_message_text}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {selectedListing && (
       <BoostModal
         listing={selectedListing}
         open={boostModalOpen}
         onOpenChange={setBoostModalOpen}
       />
      )}

      {/* Dispute Modal */}
      <Dialog open={!!disputeTarget} onOpenChange={(o) => !o && setDisputeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report a Payment Issue</DialogTitle>
          </DialogHeader>
          {disputeTarget && (
            <PaymentDisputeForm subscription={disputeTarget} onSuccess={() => setDisputeTarget(null)} />
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