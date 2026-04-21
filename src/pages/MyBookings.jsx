import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from '@/lib/supabase';
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, ArrowLeft, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import BookingCard from "@/components/bookings/BookingCard";
import { entities } from '@/api/entities';
import { toast } from "sonner";

export default function MyBookings() {
  const { user } = useAuth();
  const [filter, setFilter] = useState("all");

  const { data: bookings = [], isLoading, refetch } = useQuery({
    queryKey: ["my-bookings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, listings(title, city, province_or_state, cover_photo_url, slug)')
        .eq('guest_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(b => ({
        ...b,
        listing_title: b.listings?.title || 'Listing',
        listing_city: b.listings?.city,
        listing_slug: b.listings?.slug,
        listing_cover: b.listings?.cover_photo_url,
      }));
    },
    enabled: !!user,
  });

  const filteredBookings = filter === "all"
    ? bookings
    : bookings.filter(b => b.status === filter);

  const handleCancel = async (booking) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    try {
      await entities.Booking.update(booking.id, {
        status: "cancelled",
        cancelled_by: user.id,
        cancelled_at: new Date().toISOString(),
      });
      toast.success("Booking cancelled.");
      refetch();
    } catch {
      toast.error("Failed to cancel booking.");
    }
  };

  const statusCounts = {
    all: bookings.length,
    pending: bookings.filter(b => b.status === "pending").length,
    confirmed: bookings.filter(b => b.status === "confirmed").length,
    completed: bookings.filter(b => b.status === "completed").length,
    cancelled: bookings.filter(b => b.status === "cancelled").length,
    declined: bookings.filter(b => b.status === "declined").length,
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Bookings</h1>
          <p className="text-sm text-muted-foreground">{bookings.length} total booking{bookings.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-3 mb-4">
        {[
          { value: "all", label: "All" },
          { value: "pending", label: "Pending" },
          { value: "confirmed", label: "Confirmed" },
          { value: "completed", label: "Completed" },
          { value: "cancelled", label: "Cancelled" },
          { value: "declined", label: "Declined" },
        ].map(tab => (
          <button key={tab.value} onClick={() => setFilter(tab.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filter === tab.value
                ? "bg-accent text-accent-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label} {statusCounts[tab.value] > 0 ? `(${statusCounts[tab.value]})` : ""}
          </button>
        ))}
      </div>

      {/* Bookings list */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-foreground mb-1">No bookings</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {filter === "all" ? "You haven't made any booking requests yet." : `No ${filter} bookings.`}
          </p>
          <Link to="/search">
            <Button variant="outline" size="sm">Browse daily rentals</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBookings.map(booking => (
            <div key={booking.id}>
              <BookingCard booking={booking} viewAs="guest">
                {/* Listing link */}
                {booking.listing_slug && (
                  <Link to={`/listing/${booking.listing_slug}`}
                    className="text-xs text-accent hover:underline flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> View listing
                  </Link>
                )}

                {/* Cancel button for pending/confirmed bookings */}
                {(booking.status === "pending" || booking.status === "confirmed") && (
                  <Button size="sm" variant="outline" className="text-destructive text-xs"
                    onClick={() => handleCancel(booking)}>
                    Cancel Booking
                  </Button>
                )}
              </BookingCard>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
