import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, Loader2, ArrowLeft, Users, DollarSign,
  Clock, Home,
} from "lucide-react";
import { Link } from "react-router-dom";

export default function FraudSignals() {
  const { user, isLoadingAuth, navigateToLogin } = useAuth();

  // Admin check
  const { data: adminProfile } = useQuery({
    queryKey: ["admin-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("user_profiles").select("is_admin").eq("user_id", user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  // Rapid account creation (> 3 accounts from same email domain in last 24h)
  const { data: rapidAccounts = [], isLoading: loadingRapid } = useQuery({
    queryKey: ["fraud-rapid-accounts"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from("user_profiles")
        .select("user_id, email, created_at")
        .gte("created_at", since);
      if (!recent) return [];
      // Group by domain
      const domains = {};
      recent.forEach((p) => {
        if (!p.email) return;
        const domain = p.email.split("@")[1];
        if (!domain) return;
        domains[domain] = domains[domain] || [];
        domains[domain].push(p);
      });
      return Object.entries(domains)
        .filter(([, users]) => users.length >= 3)
        .map(([domain, users]) => ({ domain, count: users.length, users }))
        .sort((a, b) => b.count - a.count);
    },
    enabled: !!adminProfile?.is_admin,
  });

  // Suspicious listings: price more than 50% below city median
  const { data: cheapListings = [], isLoading: loadingCheap } = useQuery({
    queryKey: ["fraud-cheap-listings"],
    queryFn: async () => {
      const { data: listings } = await supabase
        .from("listings")
        .select("id, title, slug, city, rent_normalized_monthly, owner_user_id, created_at, display_id")
        .eq("status", "active")
        .not("city", "is", null)
        .not("rent_normalized_monthly", "is", null)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (!listings || listings.length === 0) return [];

      // Compute median per city
      const byCity = {};
      listings.forEach((l) => {
        if (!byCity[l.city]) byCity[l.city] = [];
        byCity[l.city].push(l.rent_normalized_monthly);
      });
      const medians = {};
      for (const [city, prices] of Object.entries(byCity)) {
        if (prices.length < 5) continue; // need at least 5 to compute meaningful median
        const sorted = [...prices].sort((a, b) => a - b);
        medians[city] = sorted[Math.floor(sorted.length / 2)];
      }
      // Flag listings < 50% of city median
      return listings
        .filter((l) => medians[l.city] && l.rent_normalized_monthly < medians[l.city] * 0.5)
        .map((l) => ({ ...l, city_median: medians[l.city], discount_pct: Math.round((1 - l.rent_normalized_monthly / medians[l.city]) * 100) }))
        .slice(0, 50);
    },
    enabled: !!adminProfile?.is_admin,
  });

  // Users with many listings (potential fake hosts)
  const { data: multiListers = [], isLoading: loadingMulti } = useQuery({
    queryKey: ["fraud-multi-listers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("listings")
        .select("owner_user_id")
        .eq("status", "active");
      if (!data) return [];
      const counts = {};
      data.forEach((l) => {
        counts[l.owner_user_id] = (counts[l.owner_user_id] || 0) + 1;
      });
      const flagged = Object.entries(counts)
        .filter(([, n]) => n > 10)
        .map(([user_id, count]) => ({ user_id, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
      if (flagged.length === 0) return [];
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, email, display_name, created_at")
        .in("user_id", flagged.map((f) => f.user_id));
      return flagged.map((f) => ({
        ...f,
        email: profiles?.find((p) => p.user_id === f.user_id)?.email,
        display_name: profiles?.find((p) => p.user_id === f.user_id)?.display_name,
        account_created: profiles?.find((p) => p.user_id === f.user_id)?.created_at,
      }));
    },
    enabled: !!adminProfile?.is_admin,
  });

  // Recent listings (< 24h old) — for manual review
  const { data: newListings = [], isLoading: loadingNew } = useQuery({
    queryKey: ["fraud-new-listings"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("listings")
        .select("id, title, slug, city, country, rent_normalized_monthly, owner_user_id, created_at, status")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!adminProfile?.is_admin,
  });

  React.useEffect(() => {
    if (!isLoadingAuth && !user) navigateToLogin(window.location.href);
  }, [user, isLoadingAuth, navigateToLogin]);

  if (isLoadingAuth) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>;
  }

  if (!adminProfile?.is_admin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-destructive">Access Denied</h2>
          <p className="text-sm text-muted-foreground mt-2">Admin privileges required.</p>
        </div>
      </div>
    );
  }

  const totalSignals = rapidAccounts.length + cheapListings.length + multiListers.length;
  const loading = loadingRapid || loadingCheap || loadingMulti || loadingNew;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10">
      <div className="mb-6">
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </Link>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-orange-600" /> Fraud Signals
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Patterns that might indicate fraud. Always investigate before taking action — false positives are normal.
        </p>
        {!loading && (
          <div className="mt-3 flex items-center gap-2">
            <Badge className={totalSignals > 0 ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}>
              {totalSignals} active signal{totalSignals !== 1 ? "s" : ""}
            </Badge>
          </div>
        )}
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard Icon={Users} label="Rapid signups" value={rapidAccounts.length} color="red" loading={loadingRapid} />
        <StatCard Icon={DollarSign} label="Suspiciously cheap" value={cheapListings.length} color="orange" loading={loadingCheap} />
        <StatCard Icon={Home} label="Multi-listers (>10)" value={multiListers.length} color="yellow" loading={loadingMulti} />
        <StatCard Icon={Clock} label="New in 24h" value={newListings.length} color="blue" loading={loadingNew} />
      </div>

      {/* Section: Rapid accounts */}
      <SignalSection
        title="Rapid account creation (same email domain)"
        description="3+ accounts from the same email domain in the last 24 hours. Could indicate scripted signups."
        Icon={Users}
        empty="No suspicious signup clusters detected."
        loading={loadingRapid}
      >
        {rapidAccounts.map((a) => (
          <div key={a.domain} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">@{a.domain}</p>
              <Badge className="bg-red-100 text-red-700">{a.count} accounts</Badge>
            </div>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {a.users.slice(0, 5).map((u) => (
                <li key={u.user_id} className="font-mono">{u.email} · {new Date(u.created_at).toLocaleString()}</li>
              ))}
              {a.users.length > 5 && <li className="italic">...and {a.users.length - 5} more</li>}
            </ul>
          </div>
        ))}
      </SignalSection>

      {/* Section: Cheap listings */}
      <SignalSection
        title="Suspiciously low prices"
        description="Listings priced 50%+ below the median for their city. Classic bait-and-switch pattern."
        Icon={DollarSign}
        empty="No suspicious prices detected."
        loading={loadingCheap}
      >
        {cheapListings.map((l) => (
          <Link to={`/listing/${l.slug || l.id}`} key={l.id} className="block bg-card rounded-xl border border-border p-4 hover:border-accent/30">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {l.display_id && (
                    <span className="inline-flex items-center px-1.5 py-0.5 bg-accent/10 text-accent rounded text-[10px] font-mono font-semibold flex-shrink-0">
                      {l.display_id}
                    </span>
                  )}
                  <p className="text-sm font-semibold truncate">{l.title}</p>
                </div>
                <p className="text-xs text-muted-foreground">{l.city} · ${l.rent_normalized_monthly}/mo (city median: ${l.city_median})</p>
              </div>
              <Badge className="bg-orange-100 text-orange-700 flex-shrink-0">-{l.discount_pct}%</Badge>
            </div>
          </Link>
        ))}
      </SignalSection>

      {/* Section: Multi-listers */}
      <SignalSection
        title="Users with many active listings"
        description="Users with 10+ active listings. Might be legit property managers, or could be a fraud ring."
        Icon={Home}
        empty="No unusual concentration of listings."
        loading={loadingMulti}
      >
        {multiListers.map((m) => (
          <div key={m.user_id} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{m.display_name || m.email || "Unknown user"}</p>
                <p className="text-xs text-muted-foreground font-mono">{m.email}</p>
                {m.account_created && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Account created {new Date(m.account_created).toLocaleDateString()}
                  </p>
                )}
              </div>
              <Badge className="bg-yellow-100 text-yellow-800">{m.count} listings</Badge>
            </div>
          </div>
        ))}
      </SignalSection>
    </div>
  );
}

function StatCard({ Icon, label, value, color, loading }) {
  const colors = {
    red: "bg-red-100 text-red-700",
    orange: "bg-orange-100 text-orange-700",
    yellow: "bg-yellow-100 text-yellow-800",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
  };
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : (
        <p className="text-2xl font-bold">{value}</p>
      )}
    </div>
  );
}

function SignalSection({ title, description, Icon, empty, loading, children }) {
  const items = React.Children.toArray(children);
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-accent" />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">{empty}</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}
