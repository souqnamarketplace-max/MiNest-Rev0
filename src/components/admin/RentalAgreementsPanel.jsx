/**
 * Admin panel to view and manage all rental agreements.
 * Admins can send offers on behalf of owners, cancel agreements,
 * force-accept/decline, and override renewal status.
 */
import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { FileText, Search, XCircle, CheckCircle2, RefreshCw, Send, Loader2, ChevronDown, ChevronUp } from "lucide-react";

const STATUS_COLORS = {
  pending_tenant: "bg-yellow-100 text-yellow-800",
  accepted: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
  expired: "bg-gray-100 text-gray-600",
  canceled: "bg-red-100 text-red-800",
};

function AgreementRow({ agreement, onAction }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const fmtDate = (d) => d ? format(new Date(d), "MMM d, yyyy") : "—";
  const fmtCents = (c) => c ? `$${(c / 100).toFixed(2)}` : "—";

  const doAction = async (action, extra = {}) => {
    setLoading(true);
    try {
      const statusMap = { cancel: 'cancelled', complete: 'completed', activate: 'active', pause: 'paused' };
      const newStatus = statusMap[action];
      if (newStatus) {
        await entities.RentalAgreement.update(agreement.id, { status: newStatus, ...extra });
      }
      toast.success(`Agreement ${action}d successfully`);
      onAction();
    } catch (err) {
      toast.error(err.message || 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4 flex items-center gap-3">
        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-foreground line-clamp-1">{agreement.listing_title || agreement.listing_id}</div>
          <div className="text-xs text-muted-foreground">
            Owner: {agreement.owner_user_id} · Tenant: {agreement.tenant_user_id}
          </div>
          <div className="text-xs text-muted-foreground">
            {fmtDate(agreement.lease_start_date)} → {fmtDate(agreement.lease_end_date)} · {fmtCents(agreement.rent_amount)}/{agreement.interval}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge className={`text-xs ${STATUS_COLORS[agreement.status] || "bg-muted"}`}>
            {agreement.status?.replace(/_/g, " ")}
          </Badge>
          {agreement.renewal_status === "ending" && (
            <Badge className="text-xs bg-orange-100 text-orange-800">non-renew</Badge>
          )}
          <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          {/* Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
            <div><span className="font-semibold text-foreground">Deposit:</span> {fmtCents(agreement.deposit_amount)}</div>
            <div><span className="font-semibold text-foreground">Signed At:</span> {fmtDate(agreement.tenant_signed_at)}</div>
            <div><span className="font-semibold text-foreground">Offer Expires:</span> {fmtDate(agreement.offer_expires_at)}</div>
            <div><span className="font-semibold text-foreground">Sub ID:</span> {agreement.subscription_id || "none"}</div>
          </div>

          {/* Admin Actions */}
          <div className="flex flex-wrap gap-2">
            {agreement.status === "pending_tenant" && (
              <>
                <Button size="sm" variant="outline" className="text-accent border-accent hover:bg-accent/10 gap-1" disabled={loading}
                  onClick={() => doAction("force_accept", { signature: "Admin Override" })}>
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Force Accept
                </Button>
                <Button size="sm" variant="outline" className="text-destructive border-destructive hover:bg-destructive/10 gap-1" disabled={loading}
                  onClick={() => doAction("force_decline")}>
                  <XCircle className="w-3 h-3" /> Force Decline
                </Button>
              </>
            )}
            {agreement.status === "accepted" && (
              <>
                {agreement.renewal_status !== "ending" ? (
                  <Button size="sm" variant="outline" className="text-orange-600 border-orange-300 hover:bg-orange-50 gap-1" disabled={loading}
                    onClick={() => doAction("set_non_renewal")}>
                    <XCircle className="w-3 h-3" /> Set Non-Renewal
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="text-accent border-accent hover:bg-accent/10 gap-1" disabled={loading}
                    onClick={() => doAction("clear_non_renewal")}>
                    <RefreshCw className="w-3 h-3" /> Clear Non-Renewal
                  </Button>
                )}
                <Button size="sm" variant="outline" className="text-destructive border-destructive hover:bg-destructive/10 gap-1" disabled={loading}
                  onClick={() => doAction("cancel")}>
                  <XCircle className="w-3 h-3" /> Cancel Agreement
                </Button>
              </>
            )}
            {["expired", "declined", "canceled"].includes(agreement.status) && (
              <Button size="sm" variant="outline" className="text-accent border-accent hover:bg-accent/10 gap-1" disabled={loading}
                onClick={() => doAction("reopen")}>
                <RefreshCw className="w-3 h-3" /> Reopen as Pending
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RentalAgreementsPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showSendOfferModal, setShowSendOfferModal] = useState(false);

  const { data: agreements = [], refetch } = useQuery({
    queryKey: ["admin-rental-agreements"],
    queryFn: () => entities.RentalAgreement.list("-created_at", 100),
  });

  const filtered = agreements.filter(a => {
    const matchSearch = !search ||
      a.listing_title?.toLowerCase().includes(search.toLowerCase()) ||
      a.owner_user_id?.toLowerCase().includes(search.toLowerCase()) ||
      a.tenant_user_id?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by listing, owner, or tenant..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending_tenant">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => setShowSendOfferModal(true)}>
          <Send className="w-4 h-4" /> Send Offer (Admin)
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">{filtered.length} agreement{filtered.length !== 1 ? "s" : ""}</div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No agreements found.</p>
        ) : (
          filtered.map(a => <AgreementRow key={a.id} agreement={a} onAction={refetch} />)
        )}
      </div>

      {showSendOfferModal && (
        <AdminSendOfferModal onClose={() => setShowSendOfferModal(false)} onSent={refetch} />
      )}
    </div>
  );
}

function AdminSendOfferModal({ onClose, onSent }) {
  const [form, setForm] = useState({
    listing_id: "",
    owner_user_id: "",
    tenant_user_id: "",
    lease_start_date: "",
    lease_end_date: "",
    deposit_amount: "",
    house_rules: "",
    special_terms: "",
  });
  const [loading, setLoading] = useState(false);

  const { data: listings = [] } = useQuery({
    queryKey: ["admin-listings-picker"],
    queryFn: () => entities.Listing.filter({ status: "active" }, "-created_at", 100),
  });

  const handleSubmit = async () => {
    if (!form.listing_id || !form.tenant_user_id || !form.lease_start_date || !form.lease_end_date) {
      toast.error("Fill in all required fields"); return;
    }
    setLoading(true);
    try {
      await entities.RentalAgreement.create({
        ...form,
        status: 'pending_tenant',
        deposit_amount: form.deposit_amount ? Math.round(parseFloat(form.deposit_amount) * 100) : 0,
      });
      toast.success("Rental agreement created successfully!");
    } catch (err) {
      toast.error(err.message || 'Failed to create agreement');
    } finally {
      setLoading(false);
    }
    onSent();
    onClose();
  };

  const selectedListing = listings.find(l => l.id === form.listing_id);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Send Rental Offer (Admin Override)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Listing *</label>
            <Select value={form.listing_id} onValueChange={v => {
              const l = listings.find(x => x.id === v);
              setForm(f => ({ ...f, listing_id: v, owner_user_id: l?.owner_user_id || "" }));
            }}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select listing..." /></SelectTrigger>
              <SelectContent>
                {listings.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.title} — {l.owner_user_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedListing && (
            <p className="text-xs text-muted-foreground">Owner: <strong>{form.owner_user_id}</strong></p>
          )}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Tenant Email *</label>
            <Input className="mt-1" placeholder="tenant@email.com" value={form.tenant_user_id} onChange={e => setForm(f => ({ ...f, tenant_user_id: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Lease Start *</label>
              <Input type="date" className="mt-1" value={form.lease_start_date} onChange={e => setForm(f => ({ ...f, lease_start_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Lease End *</label>
              <Input type="date" className="mt-1" value={form.lease_end_date} onChange={e => setForm(f => ({ ...f, lease_end_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Security Deposit ($)</label>
            <Input type="number" className="mt-1" placeholder="0.00" value={form.deposit_amount} onChange={e => setForm(f => ({ ...f, deposit_amount: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">House Rules</label>
            <textarea className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={form.house_rules} onChange={e => setForm(f => ({ ...f, house_rules: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Special Terms</label>
            <textarea className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-16 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={form.special_terms} onChange={e => setForm(f => ({ ...f, special_terms: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2" onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}