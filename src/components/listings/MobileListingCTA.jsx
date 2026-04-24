import React from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Heart, Calendar, Eye, Share2 } from "lucide-react";
import { getCurrencyByCountry } from "@/lib/pricingHelpers";
import { useCountry } from "@/lib/CountryContext";

export default function MobileListingCTA({
  listing, user, onMessage, onFavorite, onBook, onViewing, onShare,
  isFavorited, isOwner
}) {
  const { country, convertPrice } = useCountry();
  const currency = getCurrencyByCountry(country);

  if (isOwner) return null;
  if (listing?.status === "rented") return null;

  const isDaily = listing?.rent_period === "daily";
  const hasViewing = listing?.viewing_enabled;
  const price = listing?.rent_amount || listing?.monthly_rent || 0;
  const period = listing?.rent_period === "daily" ? "/day" : listing?.rent_period === "weekly" ? "/wk" : "/mo";

  return (
    <div className="fixed bottom-0 left-0 right-0 lg:hidden z-50">
      {/* Gradient fade above the bar */}
      <div className="h-6 bg-gradient-to-t from-background to-transparent pointer-events-none" />

      <div className="bg-card border-t border-border px-4 py-3 safe-area-inset-bottom">
        {/* Top row: Price + Share & Favorite */}
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <span className="text-lg font-bold text-accent">
              ${Math.round(price).toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground ml-1">{currency}{period}</span>
          </div>
          <div className="flex items-center gap-1">
            {onShare && (
              <Button variant="ghost" size="icon" className="w-9 h-9 rounded-full" onClick={onShare}>
                <Share2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="w-9 h-9 rounded-full" onClick={onFavorite}>
              <Heart className={`w-4 h-4 ${isFavorited ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
            </Button>
          </div>
        </div>

        {/* Bottom row: Action buttons */}
        <div className="flex gap-2">
          {/* Primary action: Book or Message */}
          {isDaily && onBook ? (
            <Button
              className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold h-11 text-sm"
              onClick={onBook}
            >
              <Calendar className="w-4 h-4 mr-1.5" />
              Book Now
            </Button>
          ) : (
            <Button
              className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold h-11 text-sm"
              onClick={onMessage}
            >
              <MessageSquare className="w-4 h-4 mr-1.5" />
              Message
            </Button>
          )}

          {/* Secondary action: Viewing */}
          {hasViewing && onViewing && (
            <Button
              variant="outline"
              className="flex-1 font-semibold h-11 text-sm"
              onClick={onViewing}
            >
              <Eye className="w-4 h-4 mr-1.5" />
              View
            </Button>
          )}

          {/* If daily listing, also show Message as secondary */}
          {isDaily && onBook && (
            <Button
              variant="outline"
              className="flex-1 font-semibold h-11 text-sm"
              onClick={onMessage}
            >
              <MessageSquare className="w-4 h-4 mr-1.5" />
              Ask
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
