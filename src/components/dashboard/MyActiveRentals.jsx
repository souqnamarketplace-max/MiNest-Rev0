/**
 * MyActiveRentals — prominent section at the top of the Dashboard.
 *
 * Shows two groups (only when non-empty):
 *   - "My Active Leases" — agreements where I'm the tenant, status='accepted'
 *     or 'pending_tenant' (action needed)
 *   - "Rentals on My Properties" — agreements where I'm the landlord
 *
 * Hidden entirely if both groups are empty (no clutter for new users).
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { entities } from "@/api/entities";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import RentalCard from "@/components/dashboard/RentalCard";
import { FileText, Loader2, AlertCircle } from "lucide-react";

function Section({ icon: Icon, title, count, children, accentBg }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accentBg}`}>
          <Icon className="w-4 h-4" />
        </div>
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
        {count > 0 && (
          <span className="text-xs text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">{count}</span>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

export default function MyActiveRentals() {
  const { user } = useAuth();

  // Fetch agreements where I'm the tenant
  const { data: tenantAgreements = [], isLoading: loadingT } = useQuery({
    queryKey: ["my-active-rentals-tenant", user?.id],
    queryFn: () =>
      entities.RentalAgreement.filter(
        { tenant_user_id: user.id },
        "-created_at",
        20
      ),
    enabled: !!user?.id,
    staleTime: 30000,
  });

  // Fetch agreements where I'm the landlord
  const { data: ownerAgreements = [], isLoading: loadingO } = useQuery({
    queryKey: ["my-active-rentals-owner", user?.id],
    queryFn: () =>
      entities.RentalAgreement.filter(
        { owner_user_id: user.id },
        "-created_at",
        20
      ),
    enabled: !!user?.id,
    staleTime: 30000,
  });

  // Filter out non-actionable statuses (declined, expired, canceled) for now —
  // these are surfaced via /my-payments later if needed.
  const visibleStatuses = new Set(["pending_tenant", "accepted"]);
  const activeTenant = tenantAgreements.filter(a => visibleStatuses.has(a.status));
  const activeOwner = ownerAgreements.filter(a => visibleStatuses.has(a.status));

  // Resolve counterparty names in a single batch fetch — avoids one query per card.
  const counterpartyIds = React.useMemo(() => {
    const ids = new Set();
    activeTenant.forEach(a => a.owner_user_id && ids.add(a.owner_user_id));
    activeOwner.forEach(a => a.tenant_user_id && ids.add(a.tenant_user_id));
    return [...ids];
  }, [activeTenant, activeOwner]);

  const { data: profileMap = {} } = useQuery({
    queryKey: ["my-active-rentals-profiles", counterpartyIds.sort().join(",")],
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

  if (loadingT || loadingO) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="w-3 h-3 animate-spin" />
        Loading rentals…
      </div>
    );
  }

  // Hide entirely when there's nothing to show
  if (activeTenant.length === 0 && activeOwner.length === 0) return null;

  // Nudge banner for pending_tenant on the tenant side (action required)
  const pendingForMe = activeTenant.filter(a => a.status === "pending_tenant");

  return (
    <div className="space-y-6 mb-8">
      {pendingForMe.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <strong>
              {pendingForMe.length} rental offer{pendingForMe.length === 1 ? "" : "s"} awaiting your signature.
            </strong>{" "}
            Open the agreement to review terms, fill in your information, upload ID, and sign.
          </div>
        </div>
      )}

      {activeTenant.length > 0 && (
        <Section
          icon={FileText}
          title="My Leases"
          count={activeTenant.length}
          accentBg="bg-accent/10 text-accent"
        >
          {activeTenant.map(a => (
            <RentalCard
              key={a.id}
              agreement={a}
              role="tenant"
              counterpartyName={profileMap[a.owner_user_id] || a.owner_legal_name}
            />
          ))}
        </Section>
      )}

      {activeOwner.length > 0 && (
        <Section
          icon={FileText}
          title="Rentals on My Properties"
          count={activeOwner.length}
          accentBg="bg-blue-50 text-blue-600"
        >
          {activeOwner.map(a => (
            <RentalCard
              key={a.id}
              agreement={a}
              role="landlord"
              counterpartyName={profileMap[a.tenant_user_id] || a.tenant_legal_name}
            />
          ))}
        </Section>
      )}
    </div>
  );
}
