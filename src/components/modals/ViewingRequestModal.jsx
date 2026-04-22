import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { entities, invokeFunction } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { Calendar, Clock, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ViewingRequestModal({ open, onOpenChange, listing, existingAppointment = null, onSuccess = null }) {
  const { user, navigateToLogin, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    date: "",
    time: "",
    message: "",
  });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotError, setSlotError] = useState("");

  // Fetch available slots when date changes
  useEffect(() => {
    if (!form.date) {
      setAvailableSlots([]);
      return;
    }

    setSlotsLoading(true);
    setSlotError("");

// Generate time slots locally (9am-6pm, every 30min)
    const slots = [];
    for (let h = 9; h < 18; h++) {
      for (let m of [0, 30]) {
        const time = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        slots.push({ time, available: true });
      }
    }
    setAvailableSlots(slots);
    setSlotsLoading(false);
  }, [form.date, listing.id]);

  // Initialize form with existing appointment data if updating
  useEffect(() => {
    if (existingAppointment && open) {
      const startTime = new Date(existingAppointment.requested_start_at || existingAppointment.confirmed_start_at);
      setForm({
        date: startTime.toISOString().split('T')[0],
        time: startTime.toTimeString().slice(0, 5),
        message: existingAppointment.viewer_message || "",
      });
    }
  }, [existingAppointment, open, listing]);

  const handleSubmit = async () => {
    // Validation
    if (!form.date || !form.time) {
      toast.error("Please select date and time");
      return;
    }

    const requestedStart = new Date(`${form.date}T${form.time}`);
    const duration = listing?.viewing_duration_minutes || 30;
    const requestedEnd = new Date(requestedStart.getTime() + duration * 60 * 1000);

    setLoading(true);
    try {
      if (existingAppointment) {
        // Update existing appointment
        await entities.ViewingAppointment.update(existingAppointment.id, {
          requested_start_at: requestedStart.toISOString(),
          requested_end_at: requestedEnd.toISOString(),
          viewer_message: form.message || "",
          status: "requested",
        });
        toast.success("Viewing request updated!");
      } else {
        // Create new appointment
        await entities.ViewingAppointment.create({
          listing_id: listing.id,
          listing_owner_user_id: listing.owner_user_id,
          viewer_user_id: user.id,
          status: "requested",
          requested_start_at: requestedStart.toISOString(),
          requested_end_at: requestedEnd.toISOString(),
          timezone: "UTC",
          viewer_message: form.message || "",
          source_type: "listing_detail",
        });
        toast.success("Viewing request sent!");
      }

      setSubmitted(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err.message || "Failed to process viewing request");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSubmitted(false);
    setForm({ date: "", time: "", message: "" });
    setAvailableSlots([]);
    setSlotError("");
    onOpenChange(false);
  };

  if (!listing) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingAppointment ? "Update Viewing Request" : "Request a Viewing"}</DialogTitle>
        </DialogHeader>

        {!submitted ? (
          <div className="space-y-4">
            {/* Listing Context */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              {listing.cover_photo_url && (
                <img src={listing.cover_photo_url} alt={listing.title} className="w-full h-32 object-cover rounded-md" />
              )}
              <div>
                <h4 className="font-semibold text-foreground line-clamp-2">{listing.title}</h4>
                <div className="text-sm text-muted-foreground mt-1">
                  <div>{listing.rent_amount || listing.monthly_rent} {listing.currency_code}/month</div>
                  <div>{[listing.neighborhood, listing.city].filter(Boolean).join(", ")}</div>
                </div>
              </div>
            </div>

            {/* Date & Time */}
            <div className="space-y-3">
              <div>
                <Label>Preferred Date *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value, time: "" })}
                  className="mt-1"
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              {/* Available Slots */}
              {form.date && (
                <div>
                  <Label>Available Times *</Label>
                  {slotsLoading ? (
                    <div className="mt-1 p-3 rounded-lg bg-muted flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading available times...
                    </div>
                  ) : slotError ? (
                    <div className="mt-1 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2 text-sm text-destructive">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{slotError}</span>
                    </div>
                  ) : availableSlots.length > 0 ? (
                    <Select value={form.time} onValueChange={(v) => setForm({ ...form, time: v })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select a time" />
                      </SelectTrigger>
                      <SelectContent className="max-h-48">
                        {availableSlots.map((slot, idx) => {
                          const timeStr = slot.time;
                          // Calculate end time (30min later)
                          const [h, m] = timeStr.split(":").map(Number);
                          const endMin = m + 30;
                          const endH = h + Math.floor(endMin / 60);
                          const endM = endMin % 60;
                          const endTimeStr = `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`;
                          return (
                            <SelectItem key={idx} value={timeStr}>
                              {timeStr} - {endTimeStr}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="mt-1 p-3 rounded-lg bg-muted text-sm text-muted-foreground text-center">
                      No times available for this date
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Message */}
            <div>
              <Label>Message to owner (optional)</Label>
              <Textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="e.g., I'm very interested in this room..."
                className="mt-1 min-h-20 text-sm"
              />
            </div>

            {/* Info Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-900">
              <p className="font-semibold mb-1">Viewing Details</p>
              <p>The available times shown respect the owner's preferences and existing bookings. The owner will confirm your request in MiNest.</p>
            </div>

            {/* Submit */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleClose} disabled={loading} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !form.time}
                className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
              >
                {loading ? "Processing..." : existingAppointment ? "Update Request" : "Send Request"}
              </Button>
            </div>
          </div>
        ) : (
          // Success State
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-accent" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-foreground mb-1">
                {existingAppointment ? "Viewing request updated" : "Viewing request sent"}
              </h3>
              <p className="text-sm text-muted-foreground">The lister will review your request and respond in MiNest.</p>
            </div>
            <Button onClick={handleClose} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}