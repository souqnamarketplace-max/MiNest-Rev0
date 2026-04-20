import React from "react";
import { useQuery } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { DollarSign, TrendingUp, Zap, CreditCard, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/geoHelpers";

function StatCard({ label, value, sub, icon: Icon, accent }) {
  return (
    <div className={`bg-card border rounded-xl p-4 ${accent ? "border-accent/30 bg-accent/5" : "border-border"}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${accent ? "text-accent" : "text-muted-foreground"}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

export default function EarningsPanel() {
  const { data: transactions = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-transactions"],
    queryFn: () => entities.PaymentTransaction.filter({ status: "succeeded" }, "-created_at", 500),
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: () => entities.TenantSubscription.list("-created_at", 200),
  });

  const { data: boostSettings = [] } = useQuery({
    queryKey: ["admin-boost-settings"],
    queryFn: () => entities.BoostSettings.list(),
  });

  const totalRevenue = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const platformFees = transactions.reduce((sum, t) => sum + (t.platform_fee || 0), 0);
  const activeSubscriptions = subscriptions.filter(s => s.status === "active").length;
  const monthlyRecurring = subscriptions
    .filter(s => s.status === "active")
    .reduce((sum, s) => sum + (s.amount || 0), 0);

  const recentTransactions = transactions.slice(0, 20);

  if (isLoading) return (
    <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
      <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading earnings...
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Platform Earnings</h2>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={`$${(totalRevenue / 100).toFixed(2)}`} icon={DollarSign} accent />
        <StatCard label="Platform Fees" value={`$${(platformFees / 100).toFixed(2)}`} icon={Zap} />
        <StatCard label="Active Subscriptions" value={activeSubscriptions} icon={CreditCard} />
        <StatCard label="Monthly Recurring" value={`$${(monthlyRecurring / 100).toFixed(2)}`} icon={TrendingUp} />
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Recent Transactions</h3>
        {recentTransactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No transactions yet — Stripe integration needed for live data</div>
        ) : (
          <div className="space-y-2">
            {recentTransactions.map(t => (
              <div key={t.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-2">
                <div>
                  <p className="text-sm font-medium">{t.description || t.type || "Payment"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(t.created_date || t.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-accent">${((t.amount || 0) / 100).toFixed(2)}</p>
                  <Badge className="text-xs">{t.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {boostSettings[0] && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-2">Current Boost Pricing</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">CAD/day:</span> <span className="font-bold">${boostSettings[0].price_per_day_cad}</span></div>
            <div><span className="text-muted-foreground">USD/day:</span> <span className="font-bold">${boostSettings[0].price_per_day_usd}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
