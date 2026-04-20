import React, { useState } from "react";
import { listingUrl } from '@/lib/listingHelpers';
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, MapPin, Wifi, Car, Sparkles, ShieldCheck, Bed, Bath, CreditCard, Mail } from "lucide-react";
import { formatRentPrice, formatEquivalentMonthly, getCurrencyByCountry } from "@/lib/pricingHelpers";
import { getParkingCardDisplay } from "@/lib/parkingHelpers";
import ShareButton from "@/components/common/ShareButton.jsx";
import TenantRentalRequestModal from "@/components/payments/TenantRentalRequestModal";

import { useAuth } from "@/lib/AuthContext";
import SignInRequiredModal from "@/components/modals/SignInRequiredModal";
import { useCountry } from "@/lib/CountryContext";

export default function ListingCard({ listing, isFavorited, onToggleFavorite }) {
  const { user, navigateToLogin, logout } = useAuth();
  const { country, convertPrice } = useCountry();
  const currency = getCurrencyByCountry(country);
  const [openOffer, setOpenOffer] = useState(false);
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  // Build amenity list (limit to 2 core amenities for cleanliness)
  const amenities = [];
  if (listing.internet_included) amenities.push({ icon: Wifi, label: "Internet" });
  if (getParkingCardDisplay(listing)) amenities.push({ icon: Car, label: "Parking" });
  if (listing.bills_included) amenities.push({ label: "Bills Incl." });
  if (listing.furnishing === "furnished") amenities.push({ label: "Furnished" });

  // Room type label
  const roomTypeLabel = listing.listing_type?.replace(/_/g, " ") || "Room";

  const handleOpenRequest = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      setSignInModalOpen(true);
      return;
    }
    setOpenOffer(true);
  };

  return (
    <>
    <Link to={`/listing/${listing.slug || listing.id}`} className="block group">
      <div className="h-full rounded-2xl border border-border bg-card overflow-hidden hover:shadow-md transition-all duration-300 hover:border-accent/30 flex flex-col">
        
        {/* Image Container */}
        <div className="relative aspect-video bg-muted overflow-hidden flex-shrink-0">
          {listing.cover_photo_url ? (
            <img
              src={listing.cover_photo_url}
              alt={listing.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
              No image
            </div>
          )}

          {/* Status Badges - Top Left */}
          <div className="absolute top-3 left-3 flex gap-2">
            {listing.is_featured && (
              <Badge className="bg-accent text-accent-foreground text-xs font-semibold gap-1">
                <Sparkles className="w-3 h-3" /> Featured
              </Badge>
            )}
            {listing.is_boosted && (
              <Badge className="bg-secondary text-secondary-foreground text-xs font-medium">
                Boosted
              </Badge>
            )}
          </div>

          {/* Badges - Bottom Left */}
          <div className="absolute bottom-3 left-3 flex gap-1 flex-wrap">
            {listing.verification_badges?.length > 0 && (
              <Badge variant="outline" className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm text-xs gap-1">
                <ShieldCheck className="w-3 h-3 text-accent" /> Verified
              </Badge>
            )}
            {listing.payments_enabled && (
              <Badge className="bg-secondary/20 text-secondary border-secondary/30 text-xs gap-1">
                <CreditCard className="w-3 h-3" /> Pay Online
              </Badge>
            )}
          </div>

          {/* Buttons - Top Right */}
          <div className="absolute top-3 right-3 flex gap-2">
            <ShareButton 
              path={listingUrl(listing)}
              title={listing.title}
            />
            {onToggleFavorite && (
              <Button
                variant="ghost"
                size="icon"
                className="w-11 h-11 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-900 rounded-full shadow-sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleFavorite(listing);
                }}
              >
                <Heart
                  className={`w-4 h-4 transition-colors ${
                    isFavorited
                      ? "fill-destructive text-destructive"
                      : "text-foreground/50 group-hover:text-foreground/80"
                  }`}
                />
              </Button>
            )}
          </div>
        </div>

        {/* Content - Scrollable if needed */}
        <div className="p-4 flex flex-col gap-3 flex-grow">
          
          {/* Price - DOMINANT */}
          <div>
            <div className="text-2xl font-bold text-accent leading-tight">
              {formatRentPrice(
                listing.rent_amount || listing.monthly_rent,
                listing.rent_period || "monthly",
                currency,
                convertPrice
              )}
            </div>
            {listing.rent_period && listing.rent_period !== "monthly" && (
              <div className="text-xs text-muted-foreground mt-1">
                ≈ {formatEquivalentMonthly(listing.rent_amount, listing.rent_period, currency, convertPrice)}
              </div>
            )}
            {listing.price_history && listing.price_history.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                was {listing.currency_code} {listing.price_history[listing.price_history.length - 1].previous_amount}
              </div>
            )}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-accent transition-colors text-sm sm:text-base">
            {listing.title}
          </h3>

          {/* Location */}
          <div className="flex items-start gap-2 text-sm text-muted-foreground min-w-0">
            <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="line-clamp-1">
              {[listing.city, listing.province_or_state].filter(Boolean).join(", ")}
            </span>
          </div>

          {/* Key Details - 2 columns for room type + key amenity */}
          <div className="flex gap-2 text-xs flex-wrap">
            {/* Room Type */}
            <Badge variant="outline" className="capitalize flex items-center gap-1">
              <Bed className="w-3 h-3" />
              {roomTypeLabel}
            </Badge>

            {/* Bathroom if available */}
            {listing.bathroom_type && (
              <Badge variant="outline" className="capitalize flex items-center gap-1">
                <Bath className="w-3 h-3" />
                {listing.bathroom_type === "private" ? "Private bath" : "Shared bath"}
              </Badge>
            )}
          </div>

          {/* Amenities - subtle chips */}
          {amenities.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
              {amenities.slice(0, 2).map((a, i) => (
                <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                  {a.icon && <a.icon className="w-3 h-3 flex-shrink-0" />}
                  <span>{a.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Send Rental Request Button */}
          {listing.payments_enabled && (
            <div className="mt-auto pt-2 border-t border-border/50">
              <Button
                onClick={handleOpenRequest}
                variant="outline"
                size="sm"
                className="w-full text-xs gap-1.5"
              >
                <Mail className="w-3 h-3" /> Send Rental Request
              </Button>
            </div>
          )}
          </div>
          </div>
          </Link>

          {/* Rental Request Modal - always rendered, controlled by open prop */}
          <TenantRentalRequestModal
            open={openOffer}
            onOpenChange={setOpenOffer}
            listing={listing}
          />

          {/* Sign In Required Modal */}
          <SignInRequiredModal
            open={signInModalOpen}
            onOpenChange={setSignInModalOpen}
            title="Sign in to send a rental request"
            description="Create an account or sign in to send a rental request and discuss terms with the host."
            listingId={listing.id}
          />
          </>
          );
          }