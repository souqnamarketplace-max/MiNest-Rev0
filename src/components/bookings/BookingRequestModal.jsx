import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar, Loader2, AlertCircle } from "lucide-react";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { notifyBookingRequested } from "@/lib/notificationService";
import {
  checkAvailability,
  validateBookingDates,
  calculateNights,
  calculateBookingTotal,
  formatTime,
  getCancellationPolicyText,
} from "@/lib/bookingHelpers";

export default function BookingRequestModal({ open, onOpenChange, listing, onSuccess }) {
  const { user } = useAuth();
  const [checkinDate, setCheckinDate] = useState("");
  const [checkoutDate, setCheckoutDate] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(null);
  const [errors, setErrors] = useState([]);

  const nightlyRate = Number(listing?.rent_amount) || 0;
  const cleaningFee = Number(listing?.cleaning_fee) || 0;
  const nights = checkinDate && checkoutDate ? calculateNights(checkinDate, checkoutDate) : 0;
  const pricing = nights > 0 ? calculateBookingTotal(nightlyRate, nights, cleaningFee) : null;

  // Check availability when dates change
  useEffect(() => {
    if (!checkinDate || !checkoutDate || !listing?.id) {
      setAvailable(null);
      setErrors([]);
      return;
    }

    const { valid, errors: validationErrors, nights: n } = validateBookingDates(checkinDate, checkoutDate, listing);
    if (!valid) {
      setErrors(validationErrors);
      setAvailable(false);
      return;
    }

    setChecking(true);
    setErrors([]);
    checkAvailability(listing.id, checkinDate, checkoutDate).then(result => {
      setAvailable(result.available);
      if (!result.available) {
        setErrors(["These dates overlap with an existing booking. Please choose different dates."]);
      }
      setChecking(false);
    });
  }, [checkinDate, checkoutDate, listing?.id]);

  const handleSubmit = async () => {
    if (!checkinDate || !checkoutDate) {
      toast.error("Please select check-in and check-out dates.");
      return;
    }
    if (!available) {
      toast.error("Selected dates are not available.");
      return;
    }
    if (nights <= 0) {
      toast.error("Invalid date range.");
      return;
    }

    setSubmitting(true);
    try {
      await entities.Booking.create({
        listing_id: listing.id,
        guest_user_id: user.id,
        host_user_id: listing.owner_user_id,
        checkin_date: checkinDate,
        checkout_date: checkoutDate,
        nights,
        nightly_rate: nightlyRate,
        cleaning_fee: cleaningFee,
        total_amount: pricing.total,
        status: "pending",
        guest_message: message.trim() || null,
      });

      toast.success("Booking request sent! The host will review and respond.");
      notifyBookingRequested({
        ownerId: listing.owner_user_id,
        guestName: user?.user_metadata?.full_name,
        listingTitle: listing.title,
        checkIn: form.check_in,
        checkOut: form.check_out,
      });
      onOpenChange(false);
      onSuccess?.();

      // Reset form
      setCheckinDate("");
      setCheckoutDate("");
      setMessage("");
    } catch (err) {
      console.error("Booking error:", err);
      toast.error(err?.message || "Failed to submit booking request.");
    } finally {
      setSubmitting(false);
    }
  };

  const minDate = listing?.available_from || new Date().toISOString().split('T')[0];
  const maxDate = listing?.available_until || undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-accent" />
            Request a Booking
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Date selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Check-in</Label>
              <Input type="date" className="mt-1" value={checkinDate}
                min={minDate} max={maxDate}
                onChange={(e) => setCheckinDate(e.target.value)} />
              {listing?.checkin_time && (
                <p className="text-xs text-muted-foreground mt-0.5">After {formatTime(listing.checkin_time)}</p>
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Check-out</Label>
              <Input type="date" className="mt-1" value={checkoutDate}
                min={checkinDate || minDate} max={maxDate}
                onChange={(e) => setCheckoutDate(e.target.value)} />
              {listing?.checkout_time && (
                <p className="text-xs text-muted-foreground mt-0.5">Before {formatTime(listing.checkout_time)}</p>
              )}
            </div>
          </div>

          {/* Availability status */}
          {checking && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Checking availability...
            </div>
          )}

          {errors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-1">
              {errors.map((err, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}

          {available && nights > 0 && (
            <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">${nightlyRate.toLocaleString()} × {nights} night{nights !== 1 ? "s" : ""}</span>
                <span className="font-medium">${pricing.subtotal.toLocaleString()}</span>
              </div>
              {cleaningFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cleaning fee</span>
                  <span className="font-medium">${cleaningFee.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold border-t border-accent/20 pt-2 mt-2">
                <span>Total</span>
                <span className="text-accent">${pricing.total.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Message */}
          <div>
            <Label className="text-xs text-muted-foreground">Message to host (optional)</Label>
            <Textarea className="mt-1 min-h-[70px]" value={message}
              placeholder="Introduce yourself and share your travel plans..."
              onChange={(e) => setMessage(e.target.value)} maxLength={500} />
          </div>

          {/* Cancellation policy */}
          {listing?.cancellation_policy && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
              <span className="font-medium capitalize">{listing.cancellation_policy}</span> cancellation: {getCancellationPolicyText(listing.cancellation_policy)}
            </p>
          )}

          {/* Submit */}
          <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
            onClick={handleSubmit}
            disabled={submitting || !available || nights <= 0 || checking}
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting...</>
            ) : (
              <>Request Booking{pricing ? ` · $${pricing.total.toLocaleString()}` : ""}</>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            You won't be charged until the host confirms your booking.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
