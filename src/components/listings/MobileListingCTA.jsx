import React from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Heart, MapPin, Calendar } from "lucide-react";

export default function MobileListingCTA({ listing, user, onMessage, onFavorite, onBook, isFavorited, isOwner }) {
  if (isOwner) return null;

  const isDaily = listing?.rent_period === "daily";

  return (
    <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-card border-t border-border p-3 flex gap-2 z-40 safe-area-inset-bottom">
      <Button
        variant="outline"
        size="sm"
        className="flex-1 text-sm"
        onClick={onFavorite}
      >
        <Heart className={`w-4 h-4 mr-1 ${isFavorited ? "fill-destructive text-destructive" : ""}`} />
        Save
      </Button>
      {isDaily && onBook ? (
        <Button
          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm"
          onClick={onBook}
        >
          <Calendar className="w-4 h-4 mr-1" />
          Book
        </Button>
      ) : (
        <Button
          className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-sm"
          onClick={onMessage}
        >
          <MessageSquare className="w-4 h-4 mr-1" />
          Message
        </Button>
      )}
    </div>
  );
}