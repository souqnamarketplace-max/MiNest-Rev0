import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { entities } from '@/api/entities';
import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock, MessageSquare } from "lucide-react";
import { toast } from "sonner";

const statusConfig = {
  requested: { label: "Pending Review", color: "bg-yellow-50 border-yellow-200", icon: Clock },
  awaiting_viewer_confirmation: { label: "Awaiting Your Response", color: "bg-blue-50 border-blue-200", icon: Clock },
  confirmed: { label: "Confirmed", color: "bg-green-50 border-green-200", icon: CheckCircle2 },
  declined: { label: "Declined", color: "bg-red-50 border-red-200", icon: XCircle },
};

export default function ViewerAppointmentStatus({ appointment, onStatusChange }) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [loading, setLoading] = useState(false);

  const requestedStart = new Date(appointment.requested_start_at);
  const confirmedStart = appointment.confirmed_start_at ? new Date(appointment.confirmed_start_at) : null;
  const StatusIcon = statusConfig[appointment.status]?.icon || Clock;

  const handleAcceptProposal = async () => {
    setLoading(true);
    try {
      await entities.ViewingAppointment.update(appointment.id, {
        status: "confirmed",
      });
      toast.success("Viewing confirmed!");
      setAcceptDialogOpen(false);
      onStatusChange?.();
    } catch (err) {
      toast.error("Failed to confirm viewing");
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineProposal = async () => {
    setLoading(true);
    try {
      await entities.ViewingAppointment.update(appointment.id, {
        status: "declined",
        declined_at: new Date().toISOString(),
        owner_response_message: declineReason || "",
      });
      toast.success("Proposal declined");
      setDeclineDialogOpen(false);
      setDeclineReason("");
      onStatusChange?.();
    } catch (err) {
      toast.error("Failed to decline proposal");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      await entities.ViewingAppointment.update(appointment.id, {
        status: "cancelled_by_viewer",
        cancelled_at: new Date().toISOString(),
        cancel_reason: cancelReason || "",
      });
      toast.success("Viewing cancelled");
      setCancelDialogOpen(false);
      setCancelReason("");
      onStatusChange?.();
    } catch (err) {
      toast.error("Failed to cancel viewing");
    } finally {
      setLoading(false);
    }
  };

  const isAwaitingViewer = appointment.status === "awaiting_viewer_confirmation";
  const isConfirmed = appointment.status === "confirmed";
  const isPending = appointment.status === "requested";
  const isDeclined = appointment.status === "declined";
  const isCancelled = appointment.status?.includes("cancelled");

  if (!appointment) return null;

  return (
    <div className={`rounded-2xl border p-5 space-y-4 ${statusConfig[appointment.status]?.color}`}>
      <div className="flex items-center gap-2 mb-3">
        <StatusIcon className="w-5 h-5 text-accent" />
        <h3 className="font-semibold text-foreground">Viewing Request</h3>
        <Badge variant="outline" className="ml-auto">{statusConfig[appointment.status]?.label}</Badge>
      </div>

      {/* Requested Time */}
      {(isPending || isAwaitingViewer) && (
        <div className="bg-white/50 rounded-lg p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1">You Requested</p>
          <p className="text-sm font-medium text-foreground">
            {format(requestedStart, "EEE, MMM d, yyyy h:mm a")}
          </p>
        </div>
      )}

      {/* Proposed Time (awaiting viewer) */}
      {isAwaitingViewer && confirmedStart && (
        <div className="bg-white/50 rounded-lg p-3 border-l-2 border-blue-400">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Owner Proposed</p>
          <p className="text-sm font-medium text-foreground">
            {format(confirmedStart, "EEE, MMM d, yyyy h:mm a")}
          </p>
          {appointment.owner_response_message && (
            <p className="text-xs text-muted-foreground mt-2 italic">"{appointment.owner_response_message}"</p>
          )}
        </div>
      )}

      {/* Confirmed Time */}
      {isConfirmed && confirmedStart && (
        <div className="bg-white/50 rounded-lg p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Confirmed Date & Time</p>
          <p className="text-sm font-medium text-foreground">
            {format(confirmedStart, "EEE, MMM d, yyyy h:mm a")}
          </p>
        </div>
      )}

      {/* Decline Reason */}
      {isDeclined && appointment.owner_response_message && (
        <div className="bg-white/50 rounded-lg p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Owner's Response</p>
          <p className="text-sm text-foreground">{appointment.owner_response_message}</p>
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div className="text-xs text-muted-foreground bg-white/50 rounded-lg p-2">
          Waiting for owner to review your request...
        </div>
      )}

      {isAwaitingViewer && (
        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => setAcceptDialogOpen(true)}
            disabled={loading}
            className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground text-sm"
          >
            <CheckCircle2 className="w-4 h-4 mr-1" /> Accept
          </Button>
          <Button
            onClick={() => setDeclineDialogOpen(true)}
            variant="outline"
            disabled={loading}
            className="flex-1 text-sm"
          >
            <XCircle className="w-4 h-4 mr-1" /> Decline
          </Button>
        </div>
      )}

      {(isConfirmed || isPending || isAwaitingViewer) && (
        <Button
          onClick={() => setCancelDialogOpen(true)}
          variant="outline"
          disabled={loading}
          className="w-full text-destructive hover:text-destructive text-sm"
        >
          Cancel Viewing
        </Button>
      )}

      {isDeclined && (
        <p className="text-xs text-muted-foreground text-center">
          You can request another viewing or contact the owner directly.
        </p>
      )}

      {isCancelled && (
        <p className="text-xs text-muted-foreground text-center">This viewing has been cancelled.</p>
      )}

      {/* Accept Proposal Dialog */}
      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Viewing</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Confirm this viewing appointment for{" "}
              <strong>{confirmedStart ? format(confirmedStart, "MMM d, yyyy 'at' h:mm a") : "—"}</strong>
            </p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setAcceptDialogOpen(false)} disabled={loading} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleAcceptProposal}
                disabled={loading}
                className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {loading ? "Confirming..." : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Decline Proposal Dialog */}
      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline Proposal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Tell the owner why you're declining (optional)..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              className="min-h-20 text-sm"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDeclineDialogOpen(false)} disabled={loading} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleDeclineProposal}
                disabled={loading}
                className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                {loading ? "Declining..." : "Decline"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Viewing</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Are you sure you want to cancel this viewing?
            </p>
            <Textarea
              placeholder="Tell the owner why you're cancelling (optional)..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="min-h-20 text-sm"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={loading} className="flex-1">
                Keep It
              </Button>
              <Button
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                {loading ? "Cancelling..." : "Cancel Viewing"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}