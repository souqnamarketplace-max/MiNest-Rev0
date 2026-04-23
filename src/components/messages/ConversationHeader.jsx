import React, { useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, Eye, Flag, MoreVertical, FileText, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import RentalOfferModal from "@/components/payments/RentalOfferModal";
import { useAuth } from "@/lib/AuthContext";

export default function ConversationHeader({ conversation, onBack, onReport }) {
  const { user } = useAuth();
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

  const isOwner = user?.id === listing_owner_id || user?.id === conversation.owner_user_id;

  const initials = (other_user_display_name || other_user_email)
    ?.split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase() || "U";

  const viewLink = source_type === "listing" ? `/listing/${source_id}` : `/seeker/${source_id}`;
  const viewLabel = source_type === "listing" ? "View Listing" : "View Profile";

  return (
    <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm z-10">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Mobile back button */}
          <button onClick={onBack} className="md:hidden flex-shrink-0 p-1.5 -ml-1 rounded-full hover:bg-muted/50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>

          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <Avatar className="w-10 h-10 ring-2 ring-border/50">
              <AvatarImage src={other_user_avatar} />
              <AvatarFallback className="bg-gradient-to-br from-accent/20 to-accent/5 text-accent text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Name & subtitle */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-foreground truncate">
                {primary_title}
              </h2>
              {other_user_verified && (
                <ShieldCheck className="w-3.5 h-3.5 text-accent flex-shrink-0" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {secondary_title}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Link to={viewLink}>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg border-border/60 hover:border-accent/30 hover:bg-accent/5">
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{viewLabel}</span>
              <span className="sm:hidden">View</span>
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg hover:bg-muted/50">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {isOwner && source_type === "listing" && (
                <DropdownMenuItem onClick={() => setRentalOfferOpen(true)} className="gap-2">
                  <FileText className="w-4 h-4 text-accent" />
                  Send Rental Offer
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onReport} className="gap-2 text-destructive focus:text-destructive">
                <Flag className="w-4 h-4" />
                Report User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
