/**
 * Form for tenants/owners to raise a payment dispute.
 */
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { entities } from '@/api/entities';
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { notifyDisputeOpened } from "@/lib/notificationService";

const DISPUTE_TYPES = [
  { value: "payment_not_received", label: "Payment not received" },
  { value: "overcharged", label: "Overcharged" },
  { value: "unauthorized_charge", label: "Unauthorized charge" },
  { value: "service_not_delivered", label: "Service not delivered" },
  { value: "refund_requested", label: "Refund requested" },
  { value: "other", label: "Other" },
];

export default function PaymentDisputeForm({ subscription, onSuccess }) {
  const [disputeType, setDisputeType] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!disputeType || !description.trim()) {
      toast.error("Please select a dispute type and provide details.");
      return;
    }
    setLoading(true);
    await entities.PaymentDispute.create({
      reporter_user_id: subscription.tenant_user_id || subscription.owner_user_id,
      reported_user_id: subscription.owner_user_id || subscription.tenant_user_id,
      subscription_id: subscription.id,
      listing_id: subscription.listing_id,
      dispute_type: disputeType,
      description,
      status: "open",
    });
    setLoading(false);
    toast.success("Dispute submitted. Our team will review it within 2 business days.");
    // Notify admin about the dispute
    notifyDisputeOpened({ disputeId: null, userName: null, amount: null });
    setDisputeType("");
    setDescription("");
    onSuccess?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-destructive mb-2">
        <AlertTriangle className="w-4 h-4" />
        <h3 className="font-semibold text-sm">Report a Payment Issue</h3>
      </div>

      <div>
        <label className="text-sm font-semibold block mb-1.5">Issue Type</label>
        <Select value={disputeType} onValueChange={setDisputeType}>
          <SelectTrigger><SelectValue placeholder="Select issue type..." /></SelectTrigger>
          <SelectContent>
            {DISPUTE_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-semibold block mb-1.5">Description</label>
        <Textarea
          placeholder="Describe the issue in detail..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-[100px] text-sm"
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={loading || !disputeType || !description.trim()}
        className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Submit Dispute
      </Button>
    </div>
  );
}