import React, { useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, Eye, Flag, MoreVertical, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import RentalOfferModal from "@/components/payments/RentalOfferModal";
import { useAuth } from "@/lib/AuthContext";

export default function ConversationHeader({ conversation, onBack, onReport }) {
  const { user, navigateToLogin, logout } = useAuth();
  const [rentalOfferOpen, setRentalOfferOpen] = useState(false);

  const {
    other_user_avatar,
    other_user_display_name,
    other_user_email,
    primary_title,
    secondary_title,
    source_type,
    source_id,
    other_user_verified,
    listing_owner_id,
  } = conversation;

  // Show "Send Rental Offer" only if current user is the listing owner
  const isOwner = user?.id === listing_owner_id || user?.id === conversation.owner_user_id;

  const initials = (other_user_display_name || other_user_email)
    ?.split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase() || "U";

  const viewLink = source_type === "listing" ? `/listing/${source_id}` : `/seeker/${source_id}`;
  const viewLabel = source_type === "listing" ? "View Listing" : "View Profile";

  return (
    <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between z-10">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Mobile back button */}
        <Button variant="ghost" size="icon" aria-label="Options" onClick={onBack} className="md:hidden flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>

        {/* Avatar */}
        <Avatar className="w-10 h-10 flex-shrink-0">
          <AvatarImage src={other_user_avatar} />
          <AvatarFallback className="bg-accent/10 text-accent text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Title & Subtitle */}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-foreground truncate">
            {primary_title}
          </h2>
          <p className="text-xs text-muted-foreground truncate">
            {secondary_title}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link to={viewLink}>
          <Button variant="outline" size="sm" className="text-xs gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{viewLabel}</span>
            <span className="sm:hidden">View</span>
          </Button>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="w-8 h-8">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isOwner && source_type === "listing" && (
              <DropdownMenuItem onClick={() => setRentalOfferOpen(true)}>
                <FileText className="w-4 h-4 mr-2 text-accent" />
                Send Rental Offer
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onReport}>
              <Flag className="w-4 h-4 mr-2 text-destructive" />
              Report User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isOwner && source_type === "listing" && (
        <RentalOfferModal
          open={rentalOfferOpen}
          onOpenChange={setRentalOfferOpen}
          listing={{ id: source_id }}
          tenantUserId={other_user_email}
          tenantName={other_user_display_name || other_user_email}
        />
      )}
    </div>
  );
}