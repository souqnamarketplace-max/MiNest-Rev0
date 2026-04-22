import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { supabase } from '@/lib/supabase';
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BookingCard from "./BookingCard";
import { toast } from "sonner";
import { notifyBookingConfirmed, notifyBookingDeclined } from "@/lib/notificationService";

export default function BookingRequestsList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [respondingTo, setRespondingTo] = useState(null);
  const [hostResponse, setHostResponse] = useState("");
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState("pending");

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["host-bookings", user?.id, filter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, listings(title, city, province_or_state, cover_photo_url)')
        .eq('host_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(b => ({
        ...b,
        listing_title: b.listings?.title || 'Listing',
        listing_city: b.listings?.city,
      }));
    },
    enabled: !!user,
  });

  const filteredBookings = filter === "all"
    ? bookings
    : bookings.filter(b => b.status === filter);

  const handleAction = async (booking, action) => {
    setProcessing(true);
    try {
      const updateData = {
        status: action,
        host_response: hostResponse.trim() || null,
        updated_at: new Date().toISOString(),
      };

      await entities.Booking.update(booking.id, updateData);

      toast.success(action === "confirmed" ? "Booking confirmed!" : "Booking declined.");
      // Notify the guest
      if (action === "confirmed") {
        notifyBookingConfirmed({ guestId: booking.guest_user_id, listingTitle: booking.listing_title, checkIn: booking.check_in });
      } else {
        notifyBookingDeclined({ guestId: booking.guest_user_id, listingTitle: booking.listing_title });
      }
      queryClient.invalidateQueries({ queryKey: ["host-bookings"] });
      setRespondingTo(null);
      setHostResponse("");
    } catch (err) {
      toast.error("Failed to update booking.");
    } finally {
      setProcessing(false);
    }
  };

  const pendingCount = bookings.filter(b => b.status === "pending").length;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4 text-accent" />
          Booking Requests
          {pendingCount > 0 && (
            <span className="text-xs bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full font-medium">
              {pendingCount} pending
            </span>
          )}
        </h2>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {[
          { value: "pending", label: "Pending" },
          { value: "confirmed", label: "Confirmed" },
          { value: "completed", label: "Completed" },
          { value: "declined", label: "Declined" },
          { value: "cancelled", label: "Cancelled" },
          { value: "all", label: "All" },
        ].map(tab => (
          <button key={tab.value} onClick={() => setFilter(tab.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filter === tab.value
                ? "bg-accent text-accent-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredBookings.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {filter === "pending" ? "No pending booking requests." : `No ${filter} bookings.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBookings.map(booking => (
            <BookingCard key={booking.id} booking={booking} viewAs="host">
              {booking.status === "pending" && (
                <>
                  <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1 flex-1"
                    onClick={() => { setRespondingTo(booking); setHostResponse(""); }}>
                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive gap-1 flex-1"
                    onClick={() => handleAction(booking, "declined")}>
                    <XCircle className="w-3.5 h-3.5" /> Decline
                  </Button>
                </>
              )}
              {booking.status === "confirmed" && (
                <Button size="sm" variant="outline" className="text-muted-foreground gap-1"
                  onClick={() => handleAction(booking, "completed")}>
                  Mark as Completed
                </Button>
              )}
            </BookingCard>
          ))}
        </div>
      )}

      {/* Approve dialog with optional response */}
      <Dialog open={!!respondingTo} onOpenChange={(o) => !o && setRespondingTo(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-accent/5 rounded-lg p-3 text-sm">
              <p className="font-medium">{respondingTo?.listing_title}</p>
              <p className="text-muted-foreground text-xs mt-1">
                {respondingTo?.checkin_date} → {respondingTo?.checkout_date} · {respondingTo?.nights} nights · ${respondingTo?.total_amount}
              </p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Message to guest (optional)</label>
              <Textarea className="mt-1 min-h-[60px]" value={hostResponse}
                placeholder="e.g., Looking forward to hosting you!"
                onChange={(e) => setHostResponse(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRespondingTo(null)}>Cancel</Button>
              <Button className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground gap-1"
                disabled={processing}
                onClick={() => handleAction(respondingTo, "confirmed")}>
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Confirm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
