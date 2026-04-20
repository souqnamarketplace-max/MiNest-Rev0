import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Home, TrendingUp, DollarSign, Users, MapPin, Clock } from "lucide-react";
import { formatCents } from "@/lib/paymentHelpers";

const COLORS = ["hsl(var(--accent))", "hsl(var(--secondary))", "hsl(var(--primary))", "#f59e0b", "#8b5cf6", "#ec4899"];

function StatCard({ label, value, icon: Icon, sub }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-accent" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export default function MarketAnalyticsPanel() {
  const { data: listings = [] } = useQuery({
    queryKey: ["analytics-listings"],
    queryFn: () => entities.Listing.list("-created_at", 500),
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["analytics-transactions"],
    queryFn: () => entities.PaymentTransaction.filter({ status: "succeeded" }, "-created_at", 500),
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["analytics-subscriptions"],
    queryFn: () => entities.TenantSubscription.list("-created_at", 500),
  });

  const { data: agreements = [] } = useQuery({
    queryKey: ["analytics-agreements"],
    queryFn: () => entities.RentalAgreement.list("-created_at", 500),
  });

  // --- Listing stats
  const listingStats = useMemo(() => {
    const byStatus = listings.reduce((acc, l) => {
      acc[l.status] = (acc[l.status] || 0) + 1;
      return acc;
    }, {});
    return byStatus;
  }, [listings]);

  // --- Revenue by month (last 6 months)
  const revenueByMonth = useMemo(() => {
    const months = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
      months[key] = { month: key, revenue: 0, fees: 0, count: 0 };
    }
    transactions.forEach(t => {
      const d = new Date(t.created_date);
      const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
      if (months[key]) {
        months[key].revenue += t.amount / 100;
        months[key].fees += t.platform_fee / 100;
        months[key].count += 1;
      }
    });
    return Object.values(months);
  }, [transactions]);

  // --- New listings per month (last 6 months)
  const listingsByMonth = useMemo(() => {
    const months = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
      months[key] = { month: key, listings: 0, rented: 0 };
    }
    listings.forEach(l => {
      const d = new Date(l.created_date);
      const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
      if (months[key]) {
        months[key].listings += 1;
        if (l.status === "rented") months[key].rented += 1;
      }
    });
    return Object.values(months);
  }, [listings]);

  // --- Top cities
  const topCities = useMemo(() => {
    const cities = {};
    listings.forEach(l => {
      if (!l.city) return;
      if (!cities[l.city]) cities[l.city] = { city: l.city, total: 0, rented: 0, active: 0 };
      cities[l.city].total += 1;
      if (l.status === "rented") cities[l.city].rented += 1;
      if (l.status === "active") cities[l.city].active += 1;
    });
    return Object.values(cities).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [listings]);

  // --- Listing type breakdown
  const typeBreakdown = useMemo(() => {
    const types = {};
    listings.forEach(l => {
      const t = l.listing_type?.replace(/_/g, " ") || "unknown";
      types[t] = (types[t] || 0) + 1;
    });
    return Object.entries(types).map(([name, value]) => ({ name, value }));
  }, [listings]);

  // --- Average rent by city
  const avgRentByCity = useMemo(() => {
    const cityData = {};
    listings.filter(l => l.status === "active" && l.rent_normalized_monthly).forEach(l => {
      if (!l.city) return;
      if (!cityData[l.city]) cityData[l.city] = { total: 0, count: 0 };
      cityData[l.city].total += l.rent_normalized_monthly;
      cityData[l.city].count += 1;
    });
    return Object.entries(cityData)
      .map(([city, d]) => ({ city, avg: Math.round(d.total / d.count) }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 6);
  }, [listings]);

  // --- Summary numbers
  const totalRevenue = transactions.reduce((s, t) => s + (t.amount || 0), 0);
  const totalFees = transactions.reduce((s, t) => s + (t.platform_fee || 0), 0);
  const activeSubs = subscriptions.filter(s => s.status === "active").length;
  const occupancyRate = listings.length > 0
    ? Math.round((listingStats["rented"] || 0) / listings.filter(l => ["active", "rented"].includes(l.status)).length * 100) || 0
    : 0;

  // --- Listing status pie
  const statusPie = Object.entries(listingStats)
    .map(([name, value]) => ({ name: name.replace(/_/g, " "), value }))
    .filter(d => d.value > 0);

  return (
    <div className="space-y-8">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Revenue Processed" value={formatCents(totalRevenue, "cad")} icon={DollarSign} sub="All time" />
        <StatCard label="Platform Fees Earned" value={formatCents(totalFees, "cad")} icon={TrendingUp} sub="All time" />
        <StatCard label="Active Subscriptions" value={activeSubs} icon={Users} sub="Paying tenants" />
        <StatCard label="Occupancy Rate" value={`${occupancyRate}%`} icon={Home} sub="Rented / (Active+Rented)" />
      </div>

      {/* Revenue Chart */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-foreground mb-4">Monthly Revenue (Last 6 Months)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={revenueByMonth}>
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${v}`} />
            <Tooltip formatter={(v, n) => [`$${v.toFixed(0)}`, n === "fees" ? "Platform Fees" : "Total Revenue"]} />
            <Bar dataKey="revenue" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} name="revenue" />
            <Bar dataKey="fees" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="fees" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Listings Over Time + Status Pie */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-4">New Listings per Month</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={listingsByMonth}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="listings" stroke="hsl(var(--secondary))" strokeWidth={2} dot={false} name="New Listings" />
              <Line type="monotone" dataKey="rented" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} name="Rented" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-4">Listing Status Breakdown</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie data={statusPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                  {statusPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5">
              {statusPie.map((s, i) => (
                <div key={s.name} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="capitalize text-foreground">{s.name}</span>
                  <span className="text-muted-foreground ml-auto font-semibold">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Cities + Avg Rent */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-accent" /> Top Cities by Listings
          </h3>
          <div className="space-y-2">
            {topCities.map(c => (
              <div key={c.city} className="flex items-center gap-3 text-sm">
                <span className="font-medium text-foreground w-28 truncate">{c.city}</span>
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-secondary rounded-full"
                    style={{ width: `${Math.round((c.total / (topCities[0]?.total || 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-muted-foreground w-8 text-right">{c.total}</span>
                <span className="text-xs text-accent w-14 text-right">{c.rented} rented</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-4">Average Monthly Rent by City</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={avgRentByCity} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
              <YAxis type="category" dataKey="city" tick={{ fontSize: 11 }} width={70} />
              <Tooltip formatter={v => [`$${v}`, "Avg Rent"]} />
              <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Listing type + agreements */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-4">Listing Type Distribution</h3>
          <div className="space-y-3">
            {typeBreakdown.map((t, i) => (
              <div key={t.name} className="flex items-center gap-3 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="capitalize text-foreground flex-1">{t.name}</span>
                <span className="font-semibold text-foreground">{t.value}</span>
                <span className="text-muted-foreground text-xs">
                  ({Math.round((t.value / listings.length) * 100)}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-4">Agreement Funnel</h3>
          {(() => {
            const total = agreements.length;
            const accepted = agreements.filter(a => a.status === "accepted").length;
            const withPayment = agreements.filter(a => a.subscription_id).length;
            const items = [
              { label: "Total Agreements Sent", value: total, color: "bg-muted-foreground" },
              { label: "Signed by Tenant", value: accepted, color: "bg-secondary" },
              { label: "With Active Payment", value: withPayment, color: "bg-accent" },
            ];
            return (
              <div className="space-y-3">
                {items.map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-foreground">{item.label}</span>
                      <span className="font-semibold">{item.value}</span>
                    </div>
                    <div className="bg-muted rounded-full h-2">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{ width: total > 0 ? `${Math.round((item.value / total) * 100)}%` : "0%" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}