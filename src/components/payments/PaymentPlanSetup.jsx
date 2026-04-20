/**
 * Homeowner sets up a PaymentPlan for a listing.
 */
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { invokeFunction } from '@/api/entities';
import { Loader2, DollarSign, Info } from "lucide-react";
import { toast } from "sonner";
import { formatCents } from "@/lib/paymentHelpers";

export default function PaymentPlanSetup({ listing, existingPlan, onSuccess }) {
  const [amount, setAmount] = useState(existingPlan ? (existingPlan.amount / 100).toString() : (listing?.rent_amount || "").toString());
  const [interval, setInterval] = useState(existingPlan?.interval || listing?.rent_period || "month");
  const [description, setDescription] = useState(existingPlan?.description || "");
  const [loading, setLoading] = useState(false);
  const [previewFee, setPreviewFee] = useState(null);

  const handlePreview = () => {
    const amountNum = parseFloat(amount);
    if (!amountNum) return;
    // Preview will be confirmed server-side; show estimate
    setPreviewFee({ amount: amountNum * 100, commission: "~1%" });
  };

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      toast.error("Please enter a valid rent amount");
      return;
    }
    setLoading(true);
    const functionName = existingPlan ? "updatePaymentPlan" : "createPaymentPlan";
    const res = await invokeFunction(functionName, {
      listing_id: listing.id,
      amount: amountNum,
      currency: listing.currency_code?.toLowerCase() || "cad",
      interval: interval === "monthly" ? "month" : interval === "weekly" ? "week" : interval,
      description,
    });
    setLoading(false);
    if (res.data?.plan) {
      if (existingPlan) {
        const migrated = res.data.subscriptions_migrated || 0;
        toast.success(
          migrated > 0
            ? `Payment plan updated! ${migrated} tenant${migrated > 1 ? "s" : ""} notified of the new amount.`
            : "Payment plan updated successfully."
        );
      } else {
        toast.success("Payment plan created! Tenants can now pay rent through the app.");
      }
      onSuccess?.(res.data);
    } else {
      toast.error(res.data?.error || "Failed to update payment plan");
    }
  };

  const intervalLabel = { month: "month", week: "week", year: "year" };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-semibold block mb-1.5">Rent Amount ({listing?.currency_code || "CAD"})</label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="number"
            min="1"
            step="0.01"
            placeholder="1500.00"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setPreviewFee(null); }}
            className="pl-8"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold block mb-1.5">Billing Interval</label>
        <Select value={interval} onValueChange={setInterval}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Monthly</SelectItem>
            <SelectItem value="week">Weekly</SelectItem>
            <SelectItem value="year">Yearly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-semibold block mb-1.5">Description (optional)</label>
        <Input
          placeholder={`Rent for ${listing?.title || "your listing"}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="bg-muted/40 rounded-lg p-3 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-accent" />
        <span>
          A small platform fee (based on your account type) is deducted per payment.
          The remainder is transferred directly to your connected bank account.
        </span>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={loading || !amount}
        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
        {existingPlan ? "Update Payment Plan" : "Enable Rent Payments"}
      </Button>
    </div>
  );
}