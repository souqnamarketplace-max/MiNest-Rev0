import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  AlertCircle, Eye, EyeOff, Trash2, Star, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { invokeFunction } from '@/api/entities';

export default function ListingModerationCard({ listing, onActionComplete }) {
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState("");
  const [acting, setActing] = useState(false);

  const handleAction = async (action) => {
    if (!reason.trim() && ['reject', 'remove'].includes(action)) {
      toast.error("Please provide a reason for this action");
      return;
    }

    setActing(true);
    try {
      const response = await invokeFunction('listings/moderate', {
        listing_id: listing.id,
        action,
        reason
      });

      if (response.success) {
        toast.success(`Listing ${action}d`);
        setReason("");
        setExpanded(false);
        onActionComplete?.();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Action failed");
    } finally {
      setActing(false);
    }
  };

  const statusColor = {
    draft: "bg-slate-100 text-slate-700",
    pending_review: "bg-yellow-100 text-yellow-700",
    active: "bg-green-100 text-green-700",
    paused: "bg-orange-100 text-orange-700",
    rejected: "bg-red-100 text-red-700",
    removed: "bg-slate-200 text-slate-800"
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div
        className="bg-card p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-foreground truncate">{listing.title}</h3>
              <Badge className={statusColor[listing.status] || "bg-gray-100"}>
                {listing.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {listing.city}, {listing.province_or_state} • ${listing.rent_amount || listing.monthly_rent}/mo
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              By {listing.owner_user_id}
            </p>
          </div>
          <div className="flex-shrink-0">
            {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-4 bg-muted/20 space-y-4">
          {/* Preview */}
          {listing.cover_photo_url && (
            <div className="rounded-lg overflow-hidden w-full max-w-xs">
              <img src={listing.cover_photo_url} alt={listing.title} className="w-full h-32 object-cover" />
            </div>
          )}

          {/* Description */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Description</p>
            <p className="text-sm text-muted-foreground line-clamp-3">{listing.description}</p>
          </div>

          {/* Flags */}
          {listing.moderation_status === "flagged" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                <p className="font-semibold">Flagged for review</p>
                <p className="text-xs">{listing.moderation_notes}</p>
              </div>
            </div>
          )}

          {/* Reason textarea */}
          <div>
            <label className="text-sm font-semibold text-foreground block mb-2">Admin Notes</label>
            <Textarea
              placeholder="Reason for this action (required for reject/remove)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[80px] text-sm"
            />
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            {listing.status === 'pending_review' && (
              <>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleAction('approve')}
                  disabled={acting}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleAction('reject')}
                  disabled={acting || !reason.trim()}
                >
                  <XCircle className="w-4 h-4 mr-1" /> Reject
                </Button>
              </>
            )}

            {listing.status === 'active' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction('pause')}
                  disabled={acting}
                >
                  <EyeOff className="w-4 h-4 mr-1" /> Pause
                </Button>
                {!listing.is_featured && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction('feature')}
                    disabled={acting}
                  >
                    <Star className="w-4 h-4 mr-1" /> Feature
                  </Button>
                )}
              </>
            )}

            {listing.status === 'paused' && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleAction('resume')}
                disabled={acting}
              >
                <Eye className="w-4 h-4 mr-1" /> Resume
              </Button>
            )}

            {listing.status !== 'removed' && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleAction('remove')}
                disabled={acting || !reason.trim()}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Remove
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}