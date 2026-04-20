import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Zap, ArrowLeft, Clock, CheckCircle2, XCircle, PlusCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import BoostModal from "@/components/listings/BoostModal";

function BoostCard({ listing, onBoost }) {
  const now = new Date();
  const boostEnd = listing.boost_end_at ? new Date(listing.boost_end_at) : null;
  const daysLeft = boostEnd ? Math.ceil((boostEnd - now) / (1000 * 60 * 60 * 24)) : null;
  const isExpired = daysLeft !== null && daysLeft <= 0;
  const isBoosted = listing.is_boosted && !isExpired;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
          {listing.cover_photo_url ? (
            <img src={listing.cover_photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No img</div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <Link to={`/listing/${listing.slug || listing.id}`} className="font-semibold text-foreground hover:text-accent line-clamp-1">
            {listing.title}
          </Link>
          <div className="text-sm text-muted-foreground mb-2">{listing.city}, {listing.province_or_state}</div>

          {!isBoosted && !isExpired && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <XCircle className="w-4 h-4" /> Not boosted
            </div>
          )}

          {isExpired && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 w-fit">
              <Clock className="w-3 h-3" /> Boost Expired
            </div>
          )}

          {isBoosted && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary/20 text-secondary w-fit">
                <Zap className="w-3 h-3" /> Boosted & Featured — {daysLeft}d remaining
              </div>
              <div className="text-xs text-muted-foreground">
                Expires: {boostEnd.toLocaleDateString()} at {boostEnd.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          )}
        </div>

        <Button
          size="sm"
          variant={isBoosted ? "outline" : "default"}
          className={!isBoosted ? "bg-accent hover:bg-accent/90 text-accent-foreground" : ""}
          onClick={() => onBoost(listing)}
          disabled={isBoosted}
          title={isBoosted ? `Boost active until ${boostEnd.toLocaleDateString()}` : ""}
        >
          <Zap className="w-3.5 h-3.5 mr-1" />
          {isBoosted ? "Active" : "Boost"}
        </Button>
      </div>
    </div>
  );
}

export default function BoostManager() {
  const { user, navigateToLogin, logout } = useAuth();
  const [boostModalOpen, setBoostModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["my-listings-boost", user?.id],
    queryFn: () => entities.Listing.filter({ owner_user_id: user.id }, "-created_at", 50),
    enabled: !!user,
  });

  const activeListings = listings.filter(l => l.status === "active");
  const now = new Date();
  const activeBoosted = listings.filter(l => l.is_boosted && l.boost_end_at && new Date(l.boost_end_at) > now);
  const boostedListings = listings.filter(l => l.is_boosted);

  const handleBoost = (listing) => {
    setSelectedListing(listing);
    setBoostModalOpen(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-2">
        <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Boost Manager</h1>
      </div>
      <p className="text-muted-foreground mb-8 ml-8">Boosting a listing makes it featured and increases visibility</p>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{activeListings.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Active Listings</div>
        </div>
        <div className="bg-secondary/10 border border-secondary/30 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Zap className="w-4 h-4 text-secondary" />
            <div className="text-2xl font-bold text-secondary">{activeBoosted.length}</div>
          </div>
          <div className="text-xs text-muted-foreground">Currently Boosted & Featured</div>
        </div>
      </div>

      {/* Active Boosts */}
      {boostedListings.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-accent" /> Active Boosts
          </h2>
          <div className="space-y-3">
            {boostedListings.map(l => (
              <BoostCard key={l.id} listing={l} onBoost={handleBoost} />
            ))}
          </div>
        </div>
      )}

      {/* All Listings */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">All Active Listings</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : activeListings.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-muted-foreground mb-4">No active listings to boost.</p>
            <Link to="/create-listing">
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <PlusCircle className="w-4 h-4 mr-1" /> Create a Listing
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {activeListings.map(l => (
              <BoostCard key={l.id} listing={l} onBoost={handleBoost} />
            ))}
          </div>
        )}
      </div>

      {selectedListing && (
        <BoostModal
          listing={selectedListing}
          open={boostModalOpen}
          onOpenChange={setBoostModalOpen}
        />
      )}
    </div>
  );
}