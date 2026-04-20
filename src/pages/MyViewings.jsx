import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import {
  Calendar, MapPin, Clock, CheckCircle2, AlertCircle, XCircle, ArrowRight, Trash2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const STATUS_CONFIG = {
  requested: { icon: Clock, color: "bg-yellow-50 border-yellow-200", textColor: "text-yellow-700", label: "Pending" },
  approved: { icon: CheckCircle2, color: "bg-green-50 border-green-200", textColor: "text-green-700", label: "Approved" },
  confirmed: { icon: CheckCircle2, color: "bg-green-50 border-green-200", textColor: "text-green-700", label: "Confirmed" },
  awaiting_viewer_confirmation: { icon: Clock, color: "bg-blue-50 border-blue-200", textColor: "text-blue-700", label: "Awaiting Your Confirmation" },
  declined: { icon: XCircle, color: "bg-red-50 border-red-200", textColor: "text-red-700", label: "Declined" },
  cancelled_by_viewer: { icon: XCircle, color: "bg-gray-50 border-gray-200", textColor: "text-gray-700", label: "Cancelled" },
  cancelled_by_owner: { icon: XCircle, color: "bg-gray-50 border-gray-200", textColor: "text-gray-700", label: "Cancelled by Owner" },
  completed: { icon: CheckCircle2, color: "bg-slate-50 border-slate-200", textColor: "text-slate-700", label: "Completed" },
  no_show: { icon: AlertCircle, color: "bg-orange-50 border-orange-200", textColor: "text-orange-700", label: "No Show" },
  expired: { icon: AlertCircle, color: "bg-gray-50 border-gray-200", textColor: "text-gray-700", label: "Expired" },
};

function ViewingCard({ appointment, onCancel }) {
  const config = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.requested;
  const Icon = config.icon;
  const startTime = new Date(appointment.requested_start_at || appointment.confirmed_start_at);
  const endTime = new Date(appointment.requested_end_at || appointment.confirmed_end_at);

  return (
    <Card className={`${config.color} border-2 p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Link 
            to={`/listing/${appointment.listing_id}`}
            className="text-lg font-semibold text-foreground hover:text-accent line-clamp-2 transition-colors"
          >
            {appointment.listing_id}
          </Link>
          <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
            <MapPin className="w-3.5 h-3.5" />
            {/* Listing details would be shown here if we had them */}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${config.textColor} flex items-center gap-1`}>
            <Icon className="w-3.5 h-3.5" />
            {config.label}
          </Badge>
        </div>
      </div>

      {/* Timing */}
      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-2 text-foreground font-medium">
          <Calendar className="w-4 h-4" />
          {startTime.toLocaleDateString()}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          {startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – {endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div className="text-xs text-muted-foreground/70">
          Requested {formatDistanceToNow(new Date(appointment.created_date), { addSuffix: true })}
        </div>
      </div>

      {/* Message */}
      {appointment.viewer_message && (
        <div className="bg-white/50 rounded p-2 text-sm text-muted-foreground border border-current/10">
          <p className="font-medium text-foreground text-xs mb-1">Your message:</p>
          {appointment.viewer_message}
        </div>
      )}

      {/* Owner response */}
      {appointment.owner_response_message && (
        <div className="bg-white/50 rounded p-2 text-sm text-muted-foreground border border-current/10">
          <p className="font-medium text-foreground text-xs mb-1">Owner's response:</p>
          {appointment.owner_response_message}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-current/10">
        <Link to={`/listing/${appointment.listing_id}`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full gap-1">
            <ArrowRight className="w-3.5 h-3.5" /> View Listing
          </Button>
        </Link>
        {["requested", "approved", "awaiting_viewer_confirmation"].includes(appointment.status) && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onCancel(appointment.id)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function MyViewings() {
  const { user, navigateToLogin, logout } = useAuth();
  const [filter, setFilter] = useState("active");

  const { isLoading, data: appointments = [], refetch } = useQuery({
    queryKey: ["myViewings", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const appts = await entities.ViewingAppointment.filter({
        viewer_user_id: user.id
      }, "-created_at", 500);
      return appts;
    },
    enabled: !!user?.id,
  });

  // Refetch on mount and subscribe to changes
  useEffect(() => {
    if (!user?.id) return;
    refetch();
    
    const unsub = entities.ViewingAppointment.subscribe((event) => {
      refetch();
    });
    return unsub;
  }, [user?.id, refetch]);

  const activeAppointments = appointments.filter(a => 
    !["cancelled_by_viewer", "declined", "no_show", "expired"].includes(a.status)
  );

  const pastAppointments = appointments.filter(a =>
    ["cancelled_by_viewer", "declined", "no_show", "expired", "completed"].includes(a.status) || 
    new Date(a.requested_start_at) < new Date()
  );

  const handleCancel = async (appointmentId) => {
    if (!confirm("Cancel this viewing request?")) return;
    try {
      await entities.ViewingAppointment.update(appointmentId, {
        status: "cancelled_by_viewer",
        cancelled_at: new Date().toISOString(),
      });
      refetch();
    } catch (err) {
      console.error("Failed to cancel:", err);
    }
  };

  const displayAppointments = filter === "active" ? activeAppointments : pastAppointments;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">My Viewings</h1>
        <p className="text-muted-foreground">Track and manage all your viewing requests</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter("active")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === "active"
              ? "bg-accent text-accent-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          Upcoming ({activeAppointments.length})
        </button>
        <button
          onClick={() => setFilter("past")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === "past"
              ? "bg-accent text-accent-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          Past ({pastAppointments.length})
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : displayAppointments.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-foreground font-medium">
            {filter === "active" ? "No upcoming viewings" : "No past viewings"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {filter === "active"
              ? "Request a viewing from any listing to get started."
              : "Your completed and cancelled viewings will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayAppointments.map(appt => (
            <ViewingCard key={appt.id} appointment={appt} onCancel={handleCancel} />
          ))}
        </div>
      )}
    </div>
  );
}