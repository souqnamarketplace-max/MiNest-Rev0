/**
 * Rentals — comprehensive rental lifecycle management page.
 * Route: /rentals
 *
 * Five tabs covering the lifecycle of a rental relationship:
 *   1. Active     — current leases (tenant or landlord side)
 *   2. Pending    — agreements awaiting an action from someone
 *   3. Inquiries  — pre-agreement inquiries on listings (landlord only)
 *   4. Past       — completed / declined / expired / canceled / terminated
 *   5. Documents  — placeholder for the document vault (Zip 3.x)
 *
 * Designed to be additive — does NOT replace anything on the Dashboard or
 * MyPayments. Existing entry points keep working. This page is reachable from
 * the new "Rentals" link in the main navigation.
 */
import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { entities } from "@/api/entities";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import RentalCard from "@/components/dashboard/RentalCard";
import RentalRequestsList from "@/components/owner/RentalRequestsList";
import {
  FileText, Clock, Inbox, History, FolderOpen, AlertCircle,
} from "lucide-react";

// Status buckets (single source of truth — used to filter agreements per tab).
const ACTIVE_STATUSES  = new Set(["accepted"]);
const PENDING_STATUSES = new Set(["pending_tenant"]);
const PAST_STATUSES    = new Set(["declined", "expired", "canceled", "terminated_early"]);

function StatCard({ icon: Icon, label, count, accentCls }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accentCls}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground leading-none">{count}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }) {
  return (
    <div className="bg-card border border-dashed border-border rounded-xl p-8 text-center space-y-2">
      <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-md mx-auto">{body}</p>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {[0, 1, 2, 3].map(i => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}

function CardGrid({ tenantList, ownerList, profileMap }) {
  const hasAny = (tenantList.length + ownerList.length) > 0;
  if (!hasAny) return null;
  return (
    <div className="space-y-6">
      {tenantList.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            As Tenant <span className="text-muted-foreground/60 font-normal normal-case">· {tenantList.length}</span>
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {tenantList.map(a => (
              <RentalCard
                key={a.id}
                agreement={a}
                role="tenant"
                counterpartyName={profileMap[a.owner_user_id] || a.owner_legal_name}
              />
            ))}
          </div>
        </section>
      )}
      {ownerList.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            As Landlord <span className="text-muted-foreground/60 font-normal normal-case">· {ownerList.length}</span>
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {ownerList.map(a => (
              <RentalCard
                key={a.id}
                agreement={a}
                role="landlord"
                counterpartyName={profileMap[a.tenant_user_id] || a.tenant_legal_name}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function Rentals() {
  const { user } = useAuth();

  const { data: tenantAgreements = [], isLoading: loadingT } = useQuery({
    queryKey: ["rentals-page-tenant", user?.id],
    queryFn: () =>
      entities.RentalAgreement.filter({ tenant_user_id: user.id }, "-created_at", 100),
    enabled: !!user?.id,
    staleTime: 30000,
  });

  const { data: ownerAgreements = [], isLoading: loadingO } = useQuery({
    queryKey: ["rentals-page-owner", user?.id],
    queryFn: () =>
      entities.RentalAgreement.filter({ owner_user_id: user.id }, "-created_at", 100),
    enabled: !!user?.id,
    staleTime: 30000,
  });

  // Resolve counterparty profile names in a single batch.
  const counterpartyIds = useMemo(() => {
    const ids = new Set();
    tenantAgreements.forEach(a => a.owner_user_id && ids.add(a.owner_user_id));
    ownerAgreements.forEach(a => a.tenant_user_id && ids.add(a.tenant_user_id));
    return [...ids];
  }, [tenantAgreements, ownerAgreements]);

  const { data: profileMap = {} } = useQuery({
    queryKey: ["rentals-page-profiles", counterpartyIds.sort().join(",")],
    queryFn: async () => {
      if (counterpartyIds.length === 0) return {};
      const { data } = await supabase
        .from("user_profiles")
        .select("user_id, display_name, full_name")
        .in("user_id", counterpartyIds);
      const map = {};
      for (const p of data || []) {
        map[p.user_id] = p.display_name || p.full_name || "User";
      }
      return map;
    },
    enabled: counterpartyIds.length > 0,
    staleTime: 60000,
  });

  // Bucket each agreement by status into one of the lifecycle tabs.
  const buckets = useMemo(() => {
    const filterTo = (list, set) => list.filter(a => set.has(a.status));
    return {
      activeTenant:  filterTo(tenantAgreements, ACTIVE_STATUSES),
      activeOwner:   filterTo(ownerAgreements,  ACTIVE_STATUSES),
      pendingTenant: filterTo(tenantAgreements, PENDING_STATUSES),
      pendingOwner:  filterTo(ownerAgreements,  PENDING_STATUSES),
      pastTenant:    filterTo(tenantAgreements, PAST_STATUSES),
      pastOwner:     filterTo(ownerAgreements,  PAST_STATUSES),
    };
  }, [tenantAgreements, ownerAgreements]);

  const counts = {
    active:  buckets.activeTenant.length + buckets.activeOwner.length,
    pending: buckets.pendingTenant.length + buckets.pendingOwner.length,
    past:    buckets.pastTenant.length + buckets.pastOwner.length,
  };

  const isLoading = loadingT || loadingO;
  // Default to the first non-empty tab; fall back to "active".
  const defaultTab = useMemo(() => {
    if (counts.pending > 0) return "pending";
    if (counts.active > 0) return "active";
    return "active";
  }, [counts.pending, counts.active]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rentals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your rental contracts, inquiries, and history in one place.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={FileText} label="Active leases"  count={counts.active}  accentCls="bg-emerald-50 text-emerald-700" />
        <StatCard icon={Clock}    label="Pending action" count={counts.pending} accentCls="bg-amber-50 text-amber-700" />
        <StatCard icon={History}  label="Past"            count={counts.past}    accentCls="bg-muted/50 text-muted-foreground" />
      </div>

      {/* Pending nudge (only when I have something awaiting MY signature) */}
      {buckets.pendingTenant.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <strong>
              {buckets.pendingTenant.length} rental offer{buckets.pendingTenant.length === 1 ? "" : "s"} awaiting your signature.
            </strong>{" "}
            Open one to review terms, fill your information, and sign.
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="w-full">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="flex w-max min-w-full sm:w-auto bg-muted/60 rounded-xl p-1 h-auto gap-1">
            <TabsTrigger value="active" className="rounded-lg px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap data-[state=active]:bg-card data-[state=active]:shadow-sm gap-1">
              <FileText className="w-3.5 h-3.5" /> Active
              {counts.active > 0 && <span className="text-[10px] bg-muted/60 rounded-full px-1.5 py-0.5 ml-1">{counts.active}</span>}
            </TabsTrigger>
            <TabsTrigger value="pending" className="rounded-lg px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap data-[state=active]:bg-card data-[state=active]:shadow-sm gap-1">
              <Clock className="w-3.5 h-3.5" /> Pending
              {counts.pending > 0 && <span className="text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 ml-1">{counts.pending}</span>}
            </TabsTrigger>
            <TabsTrigger value="inquiries" className="rounded-lg px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap data-[state=active]:bg-card data-[state=active]:shadow-sm gap-1">
              <Inbox className="w-3.5 h-3.5" /> Inquiries
            </TabsTrigger>
            <TabsTrigger value="past" className="rounded-lg px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap data-[state=active]:bg-card data-[state=active]:shadow-sm gap-1">
              <History className="w-3.5 h-3.5" /> Past
              {counts.past > 0 && <span className="text-[10px] bg-muted/60 rounded-full px-1.5 py-0.5 ml-1">{counts.past}</span>}
            </TabsTrigger>
            <TabsTrigger value="documents" className="rounded-lg px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap data-[state=active]:bg-card data-[state=active]:shadow-sm gap-1">
              <FolderOpen className="w-3.5 h-3.5" /> Documents
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ACTIVE */}
        <TabsContent value="active" className="mt-6">
          {isLoading ? <LoadingGrid /> : (
            counts.active === 0 ? (
              <EmptyState
                icon={FileText}
                title="No active leases"
                body="Once a rental offer is signed by both parties, the agreement will show up here."
              />
            ) : (
              <CardGrid tenantList={buckets.activeTenant} ownerList={buckets.activeOwner} profileMap={profileMap} />
            )
          )}
        </TabsContent>

        {/* PENDING */}
        <TabsContent value="pending" className="mt-6">
          {isLoading ? <LoadingGrid /> : (
            counts.pending === 0 ? (
              <EmptyState
                icon={Clock}
                title="Nothing pending"
                body="Rental offers waiting on you (or on the other party) will appear here."
              />
            ) : (
              <CardGrid tenantList={buckets.pendingTenant} ownerList={buckets.pendingOwner} profileMap={profileMap} />
            )
          )}
        </TabsContent>

        {/* INQUIRIES — pre-agreement requests on listings I own */}
        <TabsContent value="inquiries" className="mt-6">
          <RentalRequestsList />
        </TabsContent>

        {/* PAST */}
        <TabsContent value="past" className="mt-6">
          {isLoading ? <LoadingGrid /> : (
            counts.past === 0 ? (
              <EmptyState
                icon={History}
                title="No past rentals"
                body="Declined offers, expired leases, and ended rentals will show up here."
              />
            ) : (
              <CardGrid tenantList={buckets.pastTenant} ownerList={buckets.pastOwner} profileMap={profileMap} />
            )
          )}
        </TabsContent>

        {/* DOCUMENTS — placeholder for now */}
        <TabsContent value="documents" className="mt-6">
          <EmptyState
            icon={FolderOpen}
            title="Document vault — coming soon"
            body="A searchable archive of every agreement PDF, uploaded ID, payment receipt, and inspection photo. We're building this next."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
