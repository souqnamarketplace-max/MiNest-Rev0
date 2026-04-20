import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { entities } from '@/api/entities';
import { toast } from "sonner";
import { Loader2, DollarSign, AlertTriangle, CreditCard, Building2 } from "lucide-react";
import { formatCents } from "@/lib/paymentHelpers";

export default function DepositRefundModal({ open, onOpenChange, subscription, onSuccess }) {
  const [refundAmount, setRefundAmount] = useState(
    subscription?.amount_per_period ? (subscription.amount_per_period / 100).toFixed(2) : ""
  );
  const [refundReason, setRefundReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("stripe");
  const [bankDetails, setBankDetails] = useState({ bank_name: "", account_name: "", account_number: "", transit_number: "", institution_number: "", notes: "" });
  const [loading, setLoading] = useState(false);

  const depositCents = subscription?.amount_per_period || 0;
  const refundCents = Math.round(parseFloat(refundAmount) * 100);
  const isFullRefund = refundCents === depositCents;
  const setBankField = (key, value) => setBankDetails(p => ({ ...p, [key]: value }));

  const handleRefund = async () => {
    if (!refundAmount || refundCents <= 0) { toast.error("Please enter a valid refund amount"); return; }
    if (refundMethod === "manual" && (!bankDetails.account_name || !bankDetails.account_number)) {
      toast.error("Please enter account name and number for manual transfer."); return;
    }
    setLoading(true);
    try {
      // Record refund in system
      await entities.TenantSubscription.update(subscription.id, {
        refund_status: "refunded",
        refund_amount: refundCents,
        refund_reason: refundReason,
        refund_method: refundMethod,
        refund_bank_details: refundMethod === "manual" ? bankDetails : null,
        refunded_at: new Date().toISOString(),
      });
      toast.success(
        refundMethod === "stripe"
          ? "Refund recorded! Complete the Stripe refund manually in your Stripe dashboard."
          : `Manual refund of ${formatCents(refundCents, "cad")} recorded. Please complete the bank transfer.`
      );
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error("Failed to record refund. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-accent" /> Process Deposit Refund
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/40 rounded-lg p-3 text-sm">
            <p className="text-muted-foreground">Subscription: <strong>{subscription?.listing_title}</strong></p>
            <p className="text-muted-foreground mt-1">Deposit on file: <strong>{formatCents(depositCents, "cad")}</strong></p>
          </div>
          <div>
            <label className="text-sm font-semibold block mb-1.5">Refund Amount</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="number" min="0" step="0.01" placeholder="0.00" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="pl-8" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{refundCents > 0 ? (isFullRefund ? "Full refund" : "Partial refund") : ""}</p>
          </div>
          <div>
            <label className="text-sm font-semibold block mb-2">Refund Method</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "stripe", icon: CreditCard, label: "Original Payment", sub: "Via Stripe (3-5 days)" },
                { value: "manual", icon: Building2, label: "Bank Transfer", sub: "E-transfer / wire" },
              ].map(({ value, icon: Icon, label, sub }) => (
                <button key={value} type="button" onClick={() => setRefundMethod(value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-sm ${refundMethod === value ? "border-accent bg-accent/5 text-accent" : "border-border text-muted-foreground hover:border-accent/40"}`}>
                  <Icon className="w-5 h-5" />
                  <span className="font-medium text-xs">{label}</span>
                  <span className="text-[10px] text-muted-foreground">{sub}</span>
                </button>
              ))}
            </div>
          </div>
          {refundMethod === "manual" && (
            <div className="space-y-3 bg-muted/30 rounded-xl p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tenant Bank Details</p>
              <div><label className="text-xs font-medium block mb-1">Account Name *</label><Input placeholder="Full name on account" value={bankDetails.account_name} onChange={e => setBankField("account_name", e.target.value)} /></div>
              <div><label className="text-xs font-medium block mb-1">Bank Name</label><Input placeholder="e.g. TD Bank, RBC" value={bankDetails.bank_name} onChange={e => setBankField("bank_name", e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs font-medium block mb-1">Account Number *</label><Input placeholder="e.g. 1234567" value={bankDetails.account_number} onChange={e => setBankField("account_number", e.target.value)} /></div>
                <div><label className="text-xs font-medium block mb-1">Transit Number</label><Input placeholder="e.g. 12345" value={bankDetails.transit_number} onChange={e => setBankField("transit_number", e.target.value)} /></div>
              </div>
              <div><label className="text-xs font-medium block mb-1">Notes</label><Input placeholder="e.g. tenant@email.com for e-transfer" value={bankDetails.notes} onChange={e => setBankField("notes", e.target.value)} /></div>
            </div>
          )}
          <div>
            <label className="text-sm font-semibold block mb-1.5">Reason (optional)</label>
            <Textarea placeholder="e.g. Lease ended — no damage found" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} className="min-h-16 text-sm" />
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2 text-xs text-yellow-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{refundMethod === "stripe" ? "Complete the actual refund in your Stripe dashboard after recording." : "You are responsible for completing the actual bank transfer."}</span>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
          <Button onClick={handleRefund} disabled={loading || !refundAmount} className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
            {refundMethod === "stripe" ? "Record Refund" : "Record & Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
