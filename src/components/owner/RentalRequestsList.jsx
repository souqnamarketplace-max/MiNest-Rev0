import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Mail, MessageSquare, Loader2, X } from "lucide-react";
import { formatDate } from "@/lib/geoHelpers";
import { toast } from "sonner";
import RentalOfferModal from "@/components/payments/RentalOfferModal.jsx";

export default function RentalRequestsList() {
  const { user, navigateToLogin, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [messagingTenantId, setMessagingTenantId] = useState(null);
  const [decliningId, setDecliningId] = useState(null);
  const [sentOfferRequestIds, setSentOfferRequestIds] = useState(new Set());

  const { data: listings = [] } = useQuery({
    queryKey: ["my-listings-for-requests", user?.id],
    queryFn: () => entities.Listing.filter({ owner_user_id: user.id }, "-created_at", 100),
    enabled: !!user,
  });

  const { data: agreements = [] } = useQuery({
    queryKey: ["rental-requests", user?.id, listings.map(l => l.id).join(",")],
    queryFn: async () => {
      if (!user?.id || listings.length === 0) return [];
      // Get rental agreements for this owner's listings
      const allAgreements = await entities.RentalAgreement.filter({
        owner_user_id: user.id,
      }, "-created_at", 100);
      return allAgreements;
    },
    enabled: !!user && listings.length > 0,
  });

  const pendingRequests = agreements.filter(a => a.status === "pending_tenant");

  // Check if an offer has already been sent for a given tenant+listing
  // An offer exists if there's an agreement with status !== "pending_tenant" for same listing+tenant
  // OR if the request itself already has a sent offer tracked in agreements
  const hasOfferBeenSent = (req) => {
    return agreements.some(a =>
      a.listing_id === req.listing_id &&
      a.tenant_user_id === req.tenant_user_id &&
      a.id !== req.id &&
      ["accepted", "declined", "expired", "canceled"].includes(a.status) === false &&
      a.status !== "pending_tenant"
    ) || req.offer_sent === true;
  };

  const getListing = (listingId) => listings.find(l => l.id === listingId);

  const handleOpenOffer = (agreement, listing) => {
    setSelectedRequest({ agreement, listing });
    setOfferModalOpen(true);
  };

  const handleOfferModalChange = (open) => {
    setOfferModalOpen(open);
    // If modal closed and we had a selected request, mark it as offer-sent
    if (!open && selectedRequest) {
      setSentOfferRequestIds(prev => new Set([...prev, selectedRequest.agreement.id]));
    }
  };

  const handleMessageTenant = async (tenantUserId, listingTitle) => {
    setMessagingTenantId(tenantUserId);
    try {
      const convos = await entities.Conversation.filter({
        participant_ids: user.id,
      });
      let convo = convos.find(c => c.participant_ids?.includes(tenantUserId));
      if (!convo) {
        convo = await entities.Conversation.create({
          participant_ids: [user.id, tenantUserId],
          participant_names: [user.full_name || user.email, tenantUserId.split("@")[0]],
          listing_title: listingTitle,
        });
      }
      navigate(`/messages?id=${convo.id}`);
    } catch (err) {
      toast.error("Failed to open messaging.");
    } finally {
      setMessagingTenantId(null);
    }
  };

  const handleDeclineRequest = async (requestId) => {
    setDecliningId(requestId);
    try {
      await entities.RentalAgreement.update(requestId, { status: "declined" });
      queryClient.setQueryData(
        ["rental-requests", user?.id, listings.map(l => l.id).join(",")],
        (old) => (old || []).map(a => a.id === requestId ? { ...a, status: "declined" } : a)
      );
      toast.success("Request declined.");
    } catch (err) {
      toast.error("Failed to decline request.");
    } finally {
      setDecliningId(null);
    }
  };

  if (pendingRequests.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <Mail className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground font-medium">No rental requests yet</p>
        <p className="text-sm text-muted-foreground mt-1">Tenants will send interest requests for your listings here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pendingRequests.map((req) => {
        const listing = getListing(req.listing_id);
        if (!listing) return null;

        const tenantProfile = null; // Could fetch if needed

        const offerSent = sentOfferRequestIds.has(req.id);

        return (
          <div key={req.id} className="bg-card rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground">{listing.title}</div>
                <div className="text-sm text-muted-foreground">
                  {listing.city}, {listing.province_or_state}
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    Interested Tenant: {req.tenant_user_id.split("@")[0]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Requested {formatDate(req.created_date)}
                  </span>
                </div>
              </div>
              <Badge className="bg-secondary/10 text-secondary flex-shrink-0">Pending</Badge>
            </div>

            {/* Tenant Details */}
            <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">Tenant Email:</span> {req.tenant_user_id}
              </div>
              {req.created_date && (
                <div>
                  <span className="text-muted-foreground">Requested:</span> {formatDate(req.created_date)}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
                onClick={() => handleOpenOffer(req, listing)}
              >
                <FileText className="w-4 h-4" /> {offerSent ? "Update Rental Offer" : "Send Rental Offer"}
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 gap-2"
                onClick={() => handleMessageTenant(req.tenant_user_id, listing.title)}
                disabled={messagingTenantId === req.tenant_user_id}
              >
                {messagingTenantId === req.tenant_user_id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageSquare className="w-4 h-4" />
                )}
                Message Tenant
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleDeclineRequest(req.id)}
                disabled={decliningId === req.id}
                title="Decline request"
              >
                {decliningId === req.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        );
      })}

      {/* Rental Offer Modal */}
      {selectedRequest && (
        <RentalOfferModal
          open={offerModalOpen}
          onOpenChange={handleOfferModalChange}
          listing={selectedRequest.listing}
          tenantUserId={selectedRequest.agreement.tenant_user_id}
          tenantName={selectedRequest.agreement.tenant_user_id.split("@")[0]}
          agreement={selectedRequest.agreement}
        />
      )}
    </div>
  );
}