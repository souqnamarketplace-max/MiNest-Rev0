import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { Badge } from "@/components/ui/badge";
import ViewingRequestCard from "@/components/owner/ViewingRequestCard";
import { Calendar } from "lucide-react";

export default function ViewingRequestsList({ forceRefresh }) {
  const { user, navigateToLogin, logout } = useAuth();

  const { data: userListings = [] } = useQuery({
    queryKey: ["ownerListings", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return entities.Listing.filter({ owner_user_id: user.id }, "-created_at");
    },
    enabled: !!user?.id,
  });

  const { data: allAppointments = [], refetch: refetchAppointments } = useQuery({
    queryKey: ["viewingAppointments", userListings.map(l => l.id).join(",")],
    queryFn: async () => {
      if (userListings.length === 0) return [];
      const allAppts = [];
      for (const listing of userListings) {
        const appts = await entities.ViewingAppointment.filter(
          { listing_id: listing.id },
          "-created_at"
        );
        allAppts.push(...appts);
      }
      return allAppts;
    },
    enabled: userListings.length > 0,
    staleTime: 10000,
  });

  // Refetch when forceRefresh prop changes
  React.useEffect(() => {
    if (forceRefresh) {
      refetchAppointments();
    }
  }, [forceRefresh, refetchAppointments]);

  const { data: viewerProfiles = [] } = useQuery({
    queryKey: ["viewerProfiles", allAppointments.map(a => a.viewer_user_id).join(",")],
    queryFn: async () => {
      const viewers = [...new Set(allAppointments.map(a => a.viewer_user_id))];
      const profiles = [];
      for (const viewerId of viewers) {
        const p = await entities.UserProfile.filter({ user_id: viewerId });
        if (p[0]) profiles.push(p[0]);
      }
      return profiles;
    },
    enabled: allAppointments.length > 0,
  });

  const listingMap = useMemo(() => {
    return Object.fromEntries(userListings.map(l => [l.id, l]));
  }, [userListings]);

  const viewerMap = useMemo(() => {
    return Object.fromEntries(viewerProfiles.map(p => [p.user_id, p]));
  }, [viewerProfiles]);

  // Group by status
  const pending = allAppointments.filter(a => a.status === "requested");
  const awaitingViewer = allAppointments.filter(a => a.status === "awaiting_viewer_confirmation");
  const confirmed = allAppointments.filter(a => a.status === "confirmed");
  const declined = allAppointments.filter(a => a.status === "declined");

  const renderGroup = (title, appointments, isEmpty) => (
    <div className="space-y-3">
      <h3 className="font-semibold text-foreground flex items-center gap-2">
        <Badge variant="outline">{appointments.length}</Badge> {title}
      </h3>
      {appointments.length === 0 ? (
        <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4 text-center">
          {isEmpty}
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map(appt => (
            <ViewingRequestCard
              key={appt.id}
              appointment={appt}
              viewerProfile={viewerMap[appt.viewer_user_id]}
              listing={listingMap[appt.listing_id]}
              onStatusChange={refetchAppointments}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (!user) return null;

  return (
    <div className="space-y-6">
      {pending.length === 0 && awaitingViewer.length === 0 && confirmed.length === 0 && declined.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="font-semibold mb-1">No viewing requests yet</h3>
          <p className="text-sm text-muted-foreground">When seekers request to view your rooms, they'll appear here.</p>
        </div>
      ) : (
        <>
          {renderGroup("Pending Review", pending, "No pending requests")}
          {renderGroup("Awaiting Viewer Response", awaitingViewer, "No proposals awaiting response")}
          {renderGroup("Confirmed", confirmed, "No confirmed viewings")}
          {renderGroup("Declined", declined, "No declined requests")}
        </>
      )}
    </div>
  );
}