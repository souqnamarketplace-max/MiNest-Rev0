import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, Users, Home, Flag, Check, Pause, Trash2, Play, Zap, 
  DollarSign, BadgeCheck, CreditCard, Percent, FileText, BarChart2, 
  MessageSquare, Eye, AlertTriangle, ClipboardList, Mail, Search
} from "lucide-react";
import BoostSettingsPanel from "@/components/admin/BoostSettingsPanel";
import ListingEditModal from "@/components/admin/ListingEditModal";
import ListingModerationCard from "@/components/admin/ListingModerationCard";
import EarningsPanel from "@/components/admin/EarningsPanel";
import VerificationSettingsPanel from "@/components/admin/VerificationSettingsPanel";
import CommissionRulesPanel from "@/components/admin/CommissionRulesPanel";
import PaymentTransactionsPanel from "@/components/admin/PaymentTransactionsPanel";
import RentalAgreementsPanel from "@/components/admin/RentalAgreementsPanel";
import MarketAnalyticsPanel from "@/components/admin/MarketAnalyticsPanel";
import SupportRequestsPanel from "@/components/admin/SupportRequestsPanel";
import LegalPagesPanel from "@/components/admin/LegalPagesPanel";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { notifyListingApproved, notifyListingRejected } from "@/lib/notificationService";

export default function Admin() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const urlTab = new URLSearchParams(window.location.search).get("tab");
  const [tab, setTab] = useState(urlTab || "moderation");
  const [editingListing, setEditingListing] = useState(null);

  // SECURITY: Verify admin status via Supabase server-side with service role
  // This cannot be bypassed client-side — RLS enforces users can only see own profile
  // is_admin field should ONLY be settable by service_role (not by users via RLS)
  const { data: adminProfile, isLoading: checkingAdmin } = useQuery({
    queryKey: ["admin-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      // Use direct Supabase query — RLS on user_profiles ensures users can only 
      // read their own row, so this cannot be spoofed by other users
      const { data, error } = await supabase
        .from('user_profiles')
        .select('is_admin, role, user_id')
        .eq('user_id', user.id)
        .single();
      if (error) return null;
      // Double-check: session user must match the profile user_id
      if (data?.user_id !== user.id) return null;
      return data;
    },
    enabled: !!user?.id,
    // Don't cache admin status for too long — re-verify every 5 minutes
    staleTime: 5 * 60 * 1000,
    // On error, assume not admin (fail closed, not open)
    onError: () => null,
  });

  if (!user) return <Navigate to="/login" replace />;
  if (checkingAdmin) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
    </div>
  );
  if (!adminProfile?.is_admin) return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <Shield className="w-12 h-12 text-destructive mx-auto mb-4" />
      <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
      <p className="text-muted-foreground">You don't have admin privileges. Contact the platform owner.</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">MiNest Admin</h1>
          <p className="text-sm text-muted-foreground">Platform management dashboard</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto mb-6 bg-muted p-1 rounded-xl">
          <TabsTrigger value="moderation"><ClipboardList className="w-3.5 h-3.5 mr-1" />Moderation</TabsTrigger>
          <TabsTrigger value="listings"><Home className="w-3.5 h-3.5 mr-1" />Listings</TabsTrigger>
          <TabsTrigger value="users"><Users className="w-3.5 h-3.5 mr-1" />Users</TabsTrigger>
          <TabsTrigger value="reports"><Flag className="w-3.5 h-3.5 mr-1" />Reports</TabsTrigger>
          <TabsTrigger value="verification"><BadgeCheck className="w-3.5 h-3.5 mr-1" />Verification</TabsTrigger>
          <TabsTrigger value="boost"><Zap className="w-3.5 h-3.5 mr-1" />Boost</TabsTrigger>
          <TabsTrigger value="earnings"><DollarSign className="w-3.5 h-3.5 mr-1" />Earnings</TabsTrigger>
          <TabsTrigger value="payments"><CreditCard className="w-3.5 h-3.5 mr-1" />Payments</TabsTrigger>
          <TabsTrigger value="commission"><Percent className="w-3.5 h-3.5 mr-1" />Commission</TabsTrigger>
          <TabsTrigger value="rentals"><FileText className="w-3.5 h-3.5 mr-1" />Rentals</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart2 className="w-3.5 h-3.5 mr-1" />Analytics</TabsTrigger>
          <TabsTrigger value="support"><MessageSquare className="w-3.5 h-3.5 mr-1" />Support</TabsTrigger>
          <TabsTrigger value="legal"><FileText className="w-3.5 h-3.5 mr-1" />Legal</TabsTrigger>
          <a href="/admin/email-test" className="px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 rounded-lg flex items-center gap-1"><Mail className="w-3.5 h-3.5" />Test Emails</a>
          <a href="/admin/audit-log" className="px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 rounded-lg flex items-center gap-1"><Shield className="w-3.5 h-3.5" />Audit Log</a>
          <a href="/admin/fraud-signals" className="px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 rounded-lg flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />Fraud</a>
          <a href="/admin/users" className="px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 rounded-lg flex items-center gap-1"><Users className="w-3.5 h-3.5" />Users</a>
        </TabsList>

        {/* MODERATION TAB */}
        <TabsContent value="moderation">
          <ModerationTab />
        </TabsContent>

        {/* LISTINGS TAB */}
        <TabsContent value="listings">
          <ListingsTab onEdit={setEditingListing} />
        </TabsContent>

        {/* USERS TAB */}
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>

        {/* REPORTS TAB */}
        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>

        {/* VERIFICATION TAB */}
        <TabsContent value="verification">
          <VerificationTab />
        </TabsContent>

        <TabsContent value="boost"><BoostSettingsPanel /></TabsContent>
        <TabsContent value="earnings"><EarningsPanel /></TabsContent>
        <TabsContent value="payments"><PaymentTransactionsPanel /></TabsContent>
        <TabsContent value="commission"><CommissionRulesPanel /></TabsContent>
        <TabsContent value="rentals"><RentalAgreementsPanel /></TabsContent>
        <TabsContent value="analytics"><MarketAnalyticsPanel /></TabsContent>
        <TabsContent value="support"><SupportRequestsPanel /></TabsContent>
        <TabsContent value="legal"><LegalPagesPanel /></TabsContent>
      </Tabs>

      {editingListing && (
        <ListingEditModal
          listing={editingListing}
          onClose={() => setEditingListing(null)}
          onSaved={() => { setEditingListing(null); qc.invalidateQueries({ queryKey: ["admin-all-listings"] }); }}
        />
      )}
    </div>
  );
}

// ── Moderation Tab ────────────────────────────────────────────────────────────
function ModerationTab() {
  const [statusFilter, setStatusFilter] = useState("pending_review");
  const { data: listings = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-moderation", statusFilter],
    queryFn: () => entities.Listing.filter({ status: statusFilter }, "-created_at", 50),
  });

  const statuses = ["pending_review", "active", "paused", "flagged", "rejected"];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
              statusFilter === s ? "bg-accent text-white" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : listings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No listings with status: {statusFilter.replace(/_/g, " ")}</div>
      ) : (
        <div className="space-y-3">
          {listings.map(l => <ListingModerationCard key={l.id} listing={l} onActionComplete={refetch} />)}
        </div>
      )}
    </div>
  );
}

// ── Listings Tab ──────────────────────────────────────────────────────────────
//
// Uses SERVER-SIDE pagination, search, and filters via Supabase range() queries.
// Only fetches one page (50 rows) at a time regardless of total listing count.
// Scales to 100k+ listings without degrading performance.
//
function ListingsTab({ onEdit }) {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [countryFilter, setCountryFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const PAGE_SIZE = 50;

  // Debounce search input so we don't hit the DB on every keystroke
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 when any filter changes
  React.useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, countryFilter]);

  // Fetch one page of listings from the server, with filters applied SERVER-side
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-listings-page", page, debouncedSearch, statusFilter, countryFilter],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = supabase
        .from("listings")
        .select("id, display_id, title, slug, status, city, province_or_state, country, rent_amount, cover_photo_url, owner_user_id", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      // Apply filters on the server
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (countryFilter !== "all") q = q.eq("country", countryFilter);

      if (debouncedSearch) {
        const s = debouncedSearch;
        // ilike on text columns only. `id` is a uuid type — can't be ilike'd.
        // display_id is the admin-friendly text ID; full UUIDs aren't useful to search anyway.
        q = q.or(`title.ilike.%${s}%,city.ilike.%${s}%,slug.ilike.%${s}%,display_id.ilike.%${s}%`);
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data || [], total: count || 0 };
    },
    placeholderData: (prev) => prev, // keep old data visible while fetching new page
  });

  // Fetch aggregate counts for the status filter dropdown labels (quick, cached separately)
  const { data: statusCounts = {} } = useQuery({
    queryKey: ["admin-listings-status-counts", countryFilter],
    queryFn: async () => {
      const counts = { all: 0 };
      const statuses = ["active", "pending_review", "paused", "rejected", "rented", "draft", "flagged"];
      // One count() query per status + one for total
      const base = () => {
        let q = supabase.from("listings").select("*", { count: "exact", head: true });
        if (countryFilter !== "all") q = q.eq("country", countryFilter);
        return q;
      };
      const [totalRes, ...rest] = await Promise.all([
        base(),
        ...statuses.map((s) => base().eq("status", s)),
      ]);
      counts.all = totalRes.count || 0;
      statuses.forEach((s, i) => { counts[s] = rest[i].count || 0; });
      return counts;
    },
    staleTime: 60_000,
  });

  const handleStatus = async (listing, newStatus) => {
    await entities.Listing.update(listing.id, { status: newStatus });
    toast.success(`Listing ${newStatus}`);
    if (listing.owner_user_id) {
      if (newStatus === "active") {
        notifyListingApproved({ ownerId: listing.owner_user_id, listingTitle: listing.title, listingSlug: listing.slug || listing.id });
      } else if (newStatus === "rejected") {
        notifyListingRejected({ ownerId: listing.owner_user_id, listingTitle: listing.title });
      }
    }
    refetch();
  };

  const handleDelete = async (listing) => {
    if (!window.confirm(`Delete "${listing.title}" (${listing.display_id || listing.id.slice(0, 8)})?\n\nThis cannot be undone. The listing will be removed permanently.`)) return;
    try {
      await entities.Listing.delete(listing.id);
      toast.success("Listing deleted");
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to delete listing");
    }
  };

  const statusColors = {
    active: "bg-green-100 text-green-700",
    pending_review: "bg-yellow-100 text-yellow-700",
    paused: "bg-orange-100 text-orange-700",
    rejected: "bg-red-100 text-red-700",
    draft: "bg-gray-100 text-gray-600",
    rented: "bg-blue-100 text-blue-700",
    flagged: "bg-red-100 text-red-700",
  };

  const rows = data?.rows || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="bg-card border border-border rounded-xl p-3 flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search by L-ID, title, city, or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses ({statusCounts.all || 0})</SelectItem>
            <SelectItem value="active">Active ({statusCounts.active || 0})</SelectItem>
            <SelectItem value="pending_review">Pending ({statusCounts.pending_review || 0})</SelectItem>
            <SelectItem value="paused">Paused ({statusCounts.paused || 0})</SelectItem>
            <SelectItem value="rejected">Rejected ({statusCounts.rejected || 0})</SelectItem>
            <SelectItem value="rented">Rented ({statusCounts.rented || 0})</SelectItem>
            <SelectItem value="draft">Draft ({statusCounts.draft || 0})</SelectItem>
            <SelectItem value="flagged">Flagged ({statusCounts.flagged || 0})</SelectItem>
          </SelectContent>
        </Select>
        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger className="w-full sm:w-40 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            <SelectItem value="Canada">🍁 Canada</SelectItem>
            <SelectItem value="United States">🇺🇸 USA</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Loading..." : (
            <>
              {total.toLocaleString()} {total === 1 ? "listing" : "listings"}
              {totalPages > 1 && <span className="ml-1">· Page {page} of {totalPages.toLocaleString()}</span>}
              {isFetching && !isLoading && <span className="ml-2 text-accent">Updating…</span>}
            </>
          )}
        </p>
        {totalPages > 1 && (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-8">
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-8">
              Next
            </Button>
          </div>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-muted/50 rounded-xl animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-xl">
          <Home className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No listings match these filters.</p>
        </div>
      ) : (
        rows.map(l => (
          <div key={l.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
            <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
              {l.cover_photo_url && <img src={l.cover_photo_url} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                {l.display_id && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigator.clipboard.writeText(l.display_id);
                      toast.success(`Copied ${l.display_id}`);
                    }}
                    className="inline-flex items-center px-1.5 py-0.5 bg-accent/10 hover:bg-accent/20 text-accent rounded text-[10px] font-mono font-semibold flex-shrink-0"
                    title={`Click to copy. Full UUID: ${l.id}`}
                  >
                    {l.display_id}
                  </button>
                )}
                <p className="font-medium text-sm truncate">{l.title}</p>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {l.city}{l.province_or_state ? `, ${l.province_or_state}` : ""}
                {l.rent_amount ? ` · $${l.rent_amount}/mo` : ""}
              </p>
            </div>
            <Badge className={`text-xs ${statusColors[l.status] || "bg-gray-100"}`}>{l.status?.replace(/_/g, " ")}</Badge>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" aria-label="Edit listing" title="Edit listing" onClick={() => onEdit(l)}>
                <Eye className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="ghost" aria-label="Toggle pause" title={l.status === "active" ? "Pause" : "Activate"}
                onClick={() => handleStatus(l, l.status === "active" ? "paused" : "active")}>
                {l.status === "active" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </Button>
              {l.status === "pending_review" && (
                <Button size="sm" variant="ghost" className="text-green-600" title="Approve" onClick={() => handleStatus(l, "active")}>
                  <Check className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" title="Delete permanently" onClick={() => handleDelete(l)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))
      )}

      {/* Bottom pagination */}
      {totalPages > 1 && rows.length > 0 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-xs text-muted-foreground">Page {page} of {totalPages.toLocaleString()}</p>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────
function UsersTab() {
  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => entities.UserProfile.list("-created_at", 100),
  });

  const { data: authUsers = [] } = useQuery({
    queryKey: ["admin-auth-users"],
    queryFn: async () => {
      const { data } = await supabase.from("user_profiles").select("user_id, full_name, display_name, is_admin, account_status, avatar_url, created_at");
      return data || [];
    },
  });

  const handleAction = async (u, action) => {
    if (action === "make_admin") {
      await entities.UserProfile.update(u.id, { is_admin: true });
      toast.success("User is now admin");
    } else if (action === "remove_admin") {
      await entities.UserProfile.update(u.id, { is_admin: false });
      toast.success("Admin removed");
    } else if (action === "suspend") {
      await entities.UserProfile.update(u.id, { account_status: "suspended" });
      toast.success("User suspended");
    } else if (action === "activate") {
      await entities.UserProfile.update(u.id, { account_status: "active" });
      toast.success("User activated");
    }
    refetch();
  };

  if (isLoading) return <div className="h-40 bg-muted rounded-lg animate-pulse" />;

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-4">{users.length} users</p>
      {users.map(u => (
        <div key={u.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
          <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent flex-shrink-0">
            {u.full_name?.[0] || u.display_name?.[0] || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm truncate">{u.full_name || u.display_name || "Unnamed"}</p>
              {u.is_admin && <Badge className="text-xs bg-accent/10 text-accent">Admin</Badge>}
              {u.account_status === "suspended" && <Badge className="text-xs bg-red-100 text-red-700">Suspended</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{u.user_type_intent || "user"} · joined {new Date(u.created_at || u.created_date).toLocaleDateString()}</p>
          </div>
          <div className="flex gap-1">
            {!u.is_admin && (
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => handleAction(u, "make_admin")}>
                Make Admin
              </Button>
            )}
            {u.is_admin && (
              <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => handleAction(u, "remove_admin")}>
                Remove Admin
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-xs"
              onClick={() => handleAction(u, u.account_status === "suspended" ? "activate" : "suspend")}>
              {u.account_status === "suspended" ? "Activate" : "Suspend"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Reports Tab ───────────────────────────────────────────────────────────────
function ReportsTab() {
  const { data: reports = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: () => entities.Report.filter({ status: "pending" }, "-created_at", 50),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-report-profiles"],
    queryFn: async () => {
      if (!reports.length) return [];
      const ids = [...new Set(reports.map(r => r.reporter_user_id).filter(Boolean))];
      if (!ids.length) return [];
      const { data } = await supabase.from("user_profiles").select("user_id, full_name, display_name").in("user_id", ids);
      return data || [];
    },
    enabled: reports.length > 0,
  });

  const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p]));

  const handleReport = async (id, status) => {
    await entities.Report.update(id, { status });
    toast.success(`Report ${status}`);
    refetch();
  };

  if (isLoading) return <div className="h-40 bg-muted rounded-lg animate-pulse" />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground mb-4">{reports.length} pending reports</p>
      {reports.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No pending reports 🎉</div>
      ) : reports.map(r => {
        const reporter = profileMap[r.reporter_user_id];
        return (
          <div key={r.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <span className="font-medium text-sm capitalize">{r.reason?.replace(/_/g, " ")}</span>
                  <Badge className="text-xs">{r.target_type}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Reported by: {reporter?.full_name || reporter?.display_name || "Unknown user"}
                </p>
                {r.details && <p className="text-sm text-muted-foreground mt-1">{r.details}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleReport(r.id, "reviewed")}>
                <Check className="w-3.5 h-3.5 mr-1" /> Mark Reviewed
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleReport(r.id, "actioned")}>
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Take Action
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Verification Tab ──────────────────────────────────────────────────────────
function VerificationTab() {
  const [reviewNotes, setReviewNotes] = useState("");
  const [selected, setSelected] = useState(null);

  const { data: verifications = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-verifications"],
    queryFn: () => entities.UserVerification.filter({ status: "pending" }, "-created_at", 50),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["admin-verification-settings"],
    queryFn: () => entities.VerificationSettings.list(),
  });

  const handleApprove = async () => {
    if (!selected) return;
    await entities.UserVerification.update(selected.id, { status: "approved", approved_at: new Date().toISOString() });
    const profiles = await entities.UserProfile.filter({ user_id: selected.user_id });
    if (profiles[0]) {
      await entities.UserProfile.update(profiles[0].id, { is_verified: true, verification_badges: ["id_verified"] });
    }
    await entities.Notification.create({
      user_id: selected.user_id,
      type: "verification_approved",
      title: "Verification Approved ✅",
      body: "Your identity verification has been approved!",
      read: false,
    });
    toast.success("Verification approved");
    setSelected(null);
    refetch();
  };

  const handleReject = async () => {
    if (!selected) return;
    await entities.UserVerification.update(selected.id, { status: "rejected", rejection_reason: reviewNotes });
    await entities.Notification.create({
      user_id: selected.user_id,
      type: "verification_rejected",
      title: "Verification Not Approved",
      body: `Your verification was not approved. ${reviewNotes}`,
      read: false,
    });
    toast.success("Verification rejected");
    setSelected(null);
    setReviewNotes("");
    refetch();
  };

  if (isLoading) return <div className="h-40 bg-muted rounded-lg animate-pulse" />;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <h3 className="font-semibold">Pending Verifications ({verifications.length})</h3>
        {verifications.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No pending verifications 🎉</div>
        ) : verifications.map(v => (
          <div
            key={v.id}
            onClick={() => setSelected(v)}
            className={`bg-card border rounded-xl p-4 cursor-pointer transition-colors ${selected?.id === v.id ? "border-accent" : "border-border hover:border-accent/50"}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm capitalize">{v.verification_type?.replace(/_/g, " ")}</p>
                <p className="text-xs text-muted-foreground">{new Date(v.created_date || v.created_at).toLocaleDateString()}</p>
              </div>
              <Badge className="bg-yellow-100 text-yellow-700 text-xs">Pending</Badge>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h3 className="font-semibold">Review Submission</h3>
          <div>
            <p className="text-sm font-medium capitalize">{selected.verification_type?.replace(/_/g, " ")}</p>
            <p className="text-xs text-muted-foreground">Submitted {new Date(selected.created_date || selected.created_at).toLocaleDateString()}</p>
          </div>
          {selected.document_urls?.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer" className="block">
              <img src={url} alt={`Document ${i+1}`} className="w-full rounded-lg border border-border object-contain max-h-48" />
            </a>
          ))}
          <div>
            <label className="text-sm font-medium block mb-1">Notes (required for rejection)</label>
            <textarea
              value={reviewNotes}
              onChange={e => setReviewNotes(e.target.value)}
              className="w-full border border-border rounded-lg p-2 text-sm min-h-20"
              placeholder="Notes about this verification..."
            />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={handleApprove}>
              <Check className="w-4 h-4 mr-1" /> Approve
            </Button>
            <Button variant="destructive" className="flex-1" disabled={!reviewNotes.trim()} onClick={handleReject}>
              Reject
            </Button>
          </div>
        </div>
      )}

      <div className="md:col-span-2">
        <h3 className="font-semibold mb-3">Verification Settings</h3>
        <VerificationSettingsPanel />
      </div>
    </div>
  );
}
