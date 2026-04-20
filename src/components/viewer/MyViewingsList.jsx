import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Calendar, MapPin, DollarSign, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/geoHelpers";
import { useCountry } from "@/lib/CountryContext";
import { getCurrencyByCountry } from "@/lib/pricingHelpers";

const statusConfig = {
  requested: { label: "Pending", color: "bg-yellow-50 text-yellow-700" },
  awaiting_viewer_confirmation: { label: "Awaiting Response", color: "bg-blue-50 text-blue-700" },
  confirmed: { label: "Confirmed", color: "bg-green-50 text-green-700" },
  declined: { label: "Declined", color: "bg-red-50 text-red-700" },
  cancelled_by_viewer: { label: "Cancelled", color: "bg-gray-50 text-gray-700" },
  cancelled_by_owner: { label: "Cancelled by Owner", color: "bg-gray-50 text-gray-700" },
};

export default function MyViewingsList() {
    const { country } = useCountry();
  const currency = getCurrencyByCountry(country);
  const { user, navigateToLogin, logout } = useAuth();

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["myViewings", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return entities.ViewingAppointment.filter(
        { viewer_user_id: user.id },
        "-created_at",
        50
      );
    },
    enabled: !!user?.id,
    staleTime: 10000,
  });

  const { data: listings = [] } = useQuery({
    queryKey: ["viewingListings", appointments.map(a => a.listing_id).join(",")],
    queryFn: async () => {
      const listingIds = [...new Set(appointments.map(a => a.listing_id))];
      const allListings = [];
      for (const id of listingIds) {
        const l = await entities.Listing.filter({ id });
        if (l[0]) allListings.push(l[0]);
      }
      return allListings;
    },
    enabled: appointments.length > 0,
  });

  const listingMap = useMemo(() => {
    return Object.fromEntries(listings.map(l => [l.id, l]));
  }, [listings]);

  // Group by status
  const confirmed = appointments.filter(a => a.status === "confirmed");
  const pending = appointments.filter(
    a => a.status === "requested" || a.status === "awaiting_viewer_confirmation"
  );
  const past = appointments.filter(
    a => a.status === "declined" || a.status.includes("cancelled")
  );

  const renderGroup = (title, appts) => (
    <div className="space-y-3">
      <h3 className="font-semibold text-foreground flex items-center gap-2">
        <Badge variant="outline">{appts.length}</Badge> {title}
      </h3>
      {appts.length === 0 ? (
        <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4 text-center">
          No {title.toLowerCase()}
        </div>
      ) : (
        <div className="space-y-3">
          {appts.map(appt => {
            const listing = listingMap[appt.listing_id];
            const startTime = appt.confirmed_start_at
              ? new Date(appt.confirmed_start_at)
              : new Date(appt.requested_start_at);

            return (
              <Link
                key={appt.id}
                to={`/listing/${listingsMap[appt.listing_id]?.slug || appt.listing_id}`}
                className="block bg-card rounded-xl border border-border p-4 hover:border-accent/30 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                    {listing?.cover_photo_url ? (
                      <img src={listing.cover_photo_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                        No img
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-semibold text-foreground line-clamp-1">{listing?.title}</h4>
                      <Badge className={statusConfig[appt.status]?.color}>
                        {statusConfig[appt.status]?.label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {listing?.city}
                      </div>
                      {(listing?.rent_amount || listing?.monthly_rent) && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {`$${listing.monthly_rent ? Math.round(listing.monthly_rent).toLocaleString() : 0} ${currency}`}/mo
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-xs text-foreground font-medium">
                      <Calendar className="w-3 h-3 text-accent" />
                      {format(startTime, "MMM d, yyyy h:mm a")}
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );

  if (!user) return null;

  return (
    <div className="space-y-6">
      {confirmed.length === 0 && pending.length === 0 && past.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="font-semibold mb-1">No viewing requests yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Browse listings and schedule viewings to see them here.
          </p>
          <Link to="/search">
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">Find Rooms</Button>
          </Link>
        </div>
      ) : (
        <>
          {renderGroup("Confirmed Viewings", confirmed)}
          {renderGroup("Pending", pending)}
          {renderGroup("Past", past)}
        </>
      )}
    </div>
  );
}