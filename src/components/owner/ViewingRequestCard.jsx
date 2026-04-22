import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { entities } from '@/api/entities';
import { notifyViewingConfirmed, notifyViewingDeclined } from "@/lib/notificationService";
import { getAvatarFallback, formatDate } from "@/lib/geoHelpers";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock, MessageSquare, Home } from "lucide-react";
import { toast } from "sonner";
import ProposeNewTimeModal from "@/components/modals/ProposeNewTimeModal";

const statusConfig = {
  requested: { label: "Pending Review", color: "bg-yellow-50 border-yellow-200" },
  awaiting_viewer_confirmation: { label: "Awaiting Response", color: "bg-blue-50 border-blue-200" },
  confirmed: { label: "Confirmed", color: "bg-green-50 border-green-200" },
  declined: { label: "Declined", color: "bg-red-50 border-red-200" },
};

export default function ViewingRequestCard({ appointment, viewerProfile, listing, onStatusChange }) {
  const [loading, setLoading] = useState(false);
  const [proposeModalOpen, setProposeModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineInput, setShowDeclineInput] = useState(false);

  const requestedStart = new Date(appointment.requested_start_at);
  const duration = 30; // default 30 min viewing duration
  const requestedEnd = new Date(requestedStart.getTime() + duration * 60 * 1000);
  const confirmedStart = appointment.confirmed_start_at ? new Date(appointment.confirmed_start_at) : null;

  const handleApprove = async () => {
    setLoading(true);
    try {
      await entities.ViewingAppointment.update(appointment.id, {
        status: "confirmed",
        confirmed_start_at: appointment.requested_start_at,
        approved_at: new Date().toISOString(),
      });
      toast.success("Viewing approved!");
      notifyViewingConfirmed({ viewerId: appointment.viewer_user_id, listingTitle: listing?.title, date: requestedStart.toLocaleDateString() });
      onStatusChange?.();
    } catch (err) {
      toast.error("Failed to approve viewing");
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    setLoading(true);
    try {
      await entities.ViewingAppointment.update(appointment.id, {
        status: "declined",
        declined_at: new Date().toISOString(),
        owner_response_message: declineReason || "",
      });
      toast.success("Viewing declined");
      notifyViewingDeclined({ viewerId: appointment.viewer_user_id, listingTitle: listing?.title, reason: declineReason });
      setShowDeclineInput(false);
      onStatusChange?.();
    } catch (err) {
      toast.error("Failed to decline viewing");
    } finally {
      setLoading(false);
    }
  };

  const handlePropose = async (proposedStart, proposedEnd, message) => {
    setLoading(true);
    try {
      await entities.ViewingAppointment.update(appointment.id, {
        status: "awaiting_viewer_confirmation",
        confirmed_start_at: proposedStart.toISOString(),
        reschedule_reason: message || "",
        owner_response_message: message || "",
      });
      toast.success("Proposed new time sent to viewer!");
      setProposeModalOpen(false);
      onStatusChange?.();
    } catch (err) {
      toast.error("Failed to propose new time");
    } finally {
      setLoading(false);
    }
  };

  const isPending = appointment.status === "requested";
  const isAwaitingViewer = appointment.status === "awaiting_viewer_confirmation";

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${statusConfig[appointment.status]?.color}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className="w-10 h-10">
            <AvatarImage src={viewerProfile?.avatar_url} />
            <AvatarFallback className="bg-accent/10 text-accent text-xs">
              {getAvatarFallback(viewerProfile?.display_name || "S")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-foreground truncate">{viewerProfile?.display_name || "Viewer"}</h4>
            <p className="text-xs text-muted-foreground">
              {viewerProfile?.email}
            </p>
          </div>
        </div>
        <Badge variant="outline">{statusConfig[appointment.status]?.label}</Badge>
      </div>

      {/* Unit Details */}
      {listing && (
        <div className="bg-white/50 rounded-lg p-3 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">Unit</p>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Home className="w-4 h-4 text-accent" />
            {listing.title}
          </div>
          {(listing.city || listing.province_or_state) && (
            <p className="text-xs text-muted-foreground">{[listing.city, listing.province_or_state].filter(Boolean).join(", ")}</p>
          )}
        </div>
      )}

      {/* Requested Time */}
      <div className="bg-white/50 rounded-lg p-3 space-y-1">
        <p className="text-xs font-semibold text-muted-foreground">Requested Time</p>
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Clock className="w-4 h-4 text-accent" />
          {format(requestedStart, "EEE, MMM d, yyyy h:mm a")}
        </div>
        <p className="text-xs text-muted-foreground">
          {Math.round((requestedEnd - requestedStart) / 60000)} minutes
        </p>
      </div>

      {/* Confirmed Time (if approved or proposed) */}
      {confirmedStart && (
        <div className="bg-white/50 rounded-lg p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1">
            {isAwaitingViewer ? "Proposed Time" : "Confirmed Time"}
          </p>
          <p className="text-sm font-medium text-foreground">
            {format(confirmedStart, "EEE, MMM d, yyyy h:mm a")}
          </p>
        </div>
      )}

      {/* Viewer Message */}
      {appointment.viewer_message && (
        <div className="bg-white/50 rounded-lg p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> Message from viewer
          </p>
          <p className="text-sm text-foreground">{appointment.viewer_message}</p>
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div className="flex gap-2 pt-2">
          {!showDeclineInput ? (
            <>
              <Button
                onClick={handleApprove}
                disabled={loading}
                className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground text-sm"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
              </Button>
              <Button
                onClick={() => setShowDeclineInput(true)}
                variant="outline"
                disabled={loading}
                className="flex-1 text-sm"
              >
                <XCircle className="w-4 h-4 mr-1" /> Decline
              </Button>
              <Button
                onClick={() => setProposeModalOpen(true)}
                variant="outline"
                disabled={loading}
                className="flex-1 text-sm"
              >
                Propose Time
              </Button>
            </>
          ) : (
            <div className="space-y-2 w-full">
              <textarea
                placeholder="Optional reason for declining..."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="w-full text-xs border rounded-lg p-2"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDeclineInput(false)}
                  disabled={loading}
                  className="flex-1 text-sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDecline}
                  disabled={loading}
                  className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm"
                >
                  Confirm Decline
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Awaiting Viewer Response */}
      {isAwaitingViewer && (
        <div className="text-xs text-muted-foreground bg-white/50 rounded-lg p-2">
          Waiting for viewer to confirm or decline your proposed time...
        </div>
      )}

      {/* Propose Modal */}
      <ProposeNewTimeModal
        open={proposeModalOpen}
        onOpenChange={setProposeModalOpen}
        onPropose={handlePropose}
        loading={loading}
        originalStart={requestedStart}
      />
    </div>
  );
}