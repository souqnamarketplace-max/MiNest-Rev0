/**
 * Admin panel: all transactions, subscriptions, disputes, and revenue.
 */
import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entities, invokeFunction } from '@/api/entities';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCents, getSubscriptionStatusConfig, getTransactionStatusConfig, DISPUTE_STATUS_CONFIG } from "@/lib/paymentHelpers";
import { DollarSign, Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function PaymentTransactionsPanel() {
  const qc = useQueryClient();
  const [disputeTab, setDisputeTab] = useState("open");
  const [adminNotes, setAdminNotes] = useState({});
  const [resolving, setResolving] = useState(null);

  const { data: dashboard } = useQuery({
    queryKey: ["admin-payment-dashboard"],
    queryFn: () => entities.PaymentTransaction.list("-created_at", 100),
  });

  const { data: disputes = [], refetch: refetchDisputes } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: () => entities.PaymentDispute.list("-created_at", 100),
  });

  const summary = dashboard?.summary || {};
  const transactions = dashboard?.transactions || [];
  const subscriptions = dashboard?.subscriptions || [];

  const filteredDisputes = disputes.filter(d =>
    disputeTab === "all" ? true : disputeTab === "open" ? ["open", "under_review"].includes(d.status) : d.status === disputeTab
  );

  const handleResolveDispute = async (dispute, resolution) => {
    setResolving(dispute.id);
    await entities.PaymentDispute.update(dispute.id, {
      status: resolution,
      admin_notes: adminNotes[dispute.id] || "",
      resolved_by: "admin",
      resolved_at: new Date().toISOString(),
    });
    qc.invalidateQueries({ queryKey: ["admin-disputes"] });
    toast.success("Dispute resolved");
    setResolving(null);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Platform Revenue", value: formatCents(summary.total_revenue_cents, "CAD"), icon: DollarSign },
          { label: "Total Volume", value: formatCents(summary.total_volume_cents, "CAD"), icon: DollarSign },
          { label: "Active Subscriptions", value: summary.active_subscriptions ?? 0, icon: Users },
          { label: "Open Disputes", value: summary.open_disputes ?? 0, icon: AlertTriangle },
        ].map((s, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-3">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className="w-3.5 h-3.5 text-accent" />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <span className="text-xl font-bold text-foreground">{s.value}</span>
          </div>
        ))}
      </div>

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="disputes">Disputes {disputes.filter(d => d.status === "open").length > 0 && `(${disputes.filter(d => d.status === "open").length})`}</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-4">
          <div className="space-y-2">
            {transactions.slice(0, 50).map(tx => {
              const cfg = getTransactionStatusConfig(tx.status);
              return (
                <div key={tx.id} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-1">{tx.listing_title || tx.listing_id}</p>
                    <p className="text-xs text-muted-foreground">Tenant: {tx.tenant_user_id} · {tx.created_date ? format(new Date(tx.created_date), "MMM d, yyyy") : "—"}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold">{formatCents(tx.amount, tx.currency)}</p>
                    <p className="text-xs text-accent">Fee: {formatCents(tx.platform_fee, tx.currency)}</p>
                  </div>
                  <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                </div>
              );
            })}
            {transactions.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No transactions yet.</p>}
          </div>
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-4">
          <div className="space-y-2">
            {subscriptions.slice(0, 50).map(sub => {
              const cfg = getSubscriptionStatusConfig(sub.status);
              return (
                <div key={sub.id} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{sub.listing_title || sub.listing_id}</p>
                    <p className="text-xs text-muted-foreground">Tenant: {sub.tenant_user_id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCents(sub.amount_per_period, sub.currency || "CAD")}/period</p>
                    {sub.next_payment_date && (
                      <p className="text-xs text-muted-foreground">Next: {format(new Date(sub.next_payment_date), "MMM d")}</p>
                    )}
                  </div>
                  <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                </div>
              );
            })}
            {subscriptions.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No subscriptions yet.</p>}
          </div>
        </TabsContent>

        <TabsContent value="disputes" className="mt-4">
          <div className="flex gap-2 mb-3">
            {["open", "under_review", "resolved_for_tenant", "resolved_for_owner", "closed", "all"].map(s => (
              <Button key={s} size="sm" variant={disputeTab === s ? "default" : "outline"} onClick={() => setDisputeTab(s)} className="text-xs capitalize h-7 px-2">
                {s.replace(/_/g, " ")}
              </Button>
            ))}
          </div>
          <div className="space-y-3">
            {filteredDisputes.map(d => {
              const cfg = DISPUTE_STATUS_CONFIG[d.status] || {};
              return (
                <div key={d.id} className="bg-card rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold capitalize">{d.dispute_type?.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">By: {d.reporter_user_id} · Listing: {d.listing_id}</p>
                      <p className="text-sm text-foreground mt-1">{d.description}</p>
                      {d.admin_notes && <p className="text-xs text-muted-foreground mt-1">Admin notes: {d.admin_notes}</p>}
                    </div>
                    <Badge className={`text-xs flex-shrink-0 ${cfg.color}`}>{cfg.label}</Badge>
                  </div>
                  {["open", "under_review"].includes(d.status) && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Admin notes / resolution..."
                        className="text-xs min-h-[60px]"
                        value={adminNotes[d.id] || ""}
                        onChange={(e) => setAdminNotes(prev => ({ ...prev, [d.id]: e.target.value }))}
                      />
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => handleResolveDispute(d, "under_review")} disabled={resolving === d.id}>
                          Mark Under Review
                        </Button>
                        <Button size="sm" className="text-xs bg-accent text-accent-foreground gap-1" onClick={() => handleResolveDispute(d, "resolved_for_tenant")} disabled={resolving === d.id}>
                          <CheckCircle2 className="w-3 h-3" /> Resolve for Tenant
                        </Button>
                        <Button size="sm" className="text-xs bg-secondary text-secondary-foreground gap-1" onClick={() => handleResolveDispute(d, "resolved_for_owner")} disabled={resolving === d.id}>
                          <CheckCircle2 className="w-3 h-3" /> Resolve for Owner
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => handleResolveDispute(d, "closed")} disabled={resolving === d.id}>
                          Close
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredDisputes.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No disputes in this category.</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}