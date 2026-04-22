import React, { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, ArrowRight } from "lucide-react";
import ListingCard from "@/components/listings/ListingCard";

export default function CityListings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const city = params.get("city") || "";
  const province = params.get("province") || "";

  // Set dynamic page title and meta tags
  React.useEffect(() => {
    const title = city ? `Rooms in ${city}, ${province} | MiNest` : "Find Rooms | MiNest";
    const description = city
      ? `Browse available rooms for rent in ${city}, ${province}. Find your perfect room with verified listings and trusted hosts.`
      : "Search rooms and find your ideal roommate on MiNest.";
    
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    
    // Canonical URL
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.href = window.location.href;
    } else {
      const link = document.createElement("link");
      link.rel = "canonical";
      link.href = window.location.href;
      document.head.appendChild(link);
    }
  }, [city, province]);

  const { data: listings, isLoading } = useQuery({
    queryKey: ["listings-city", city, province],
    queryFn: async () => {
      if (!city || !province) return [];
      const results = await entities.Listing.filter({
        city,
        province_or_state: province,
        status: "active"
      });
      return results.sort((a, b) => b.view_count - a.view_count);
    },
    enabled: !!city && !!province
  });

  const { data: favorites } = useQuery({
    queryKey: ["favorites", user?.id],
    queryFn: async () => {
      if (!user?.email) return [];
      return await entities.Favorite.filter({ user_id: user.id });
    },
    enabled: !!user?.email
  });

  const stats = useMemo(() => ({
    total: listings?.length || 0,
    avgPrice: listings?.length ? Math.round(listings.reduce((sum, l) => sum + l.monthly_rent, 0) / listings.length) : 0
  }), [listings]);

  if (!city || !province) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">No city selected</h1>
        <p className="text-muted-foreground mt-2">Use the search to find rooms in a specific city.</p>
        <Link to="/search"><Button className="mt-4">Back to Search</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-r from-accent/10 to-secondary/10 border-b border-border py-8">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-5 h-5 text-accent" />
            <span className="text-sm text-muted-foreground">{city}, {province}</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Rooms for rent in {city}
          </h2>
          <p className="text-muted-foreground mb-4">
            {stats.total} listings available • Average ${stats.avgPrice}/month
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-80" />)}
          </div>
        ) : listings?.length === 0 ? (
          <div className="text-center py-12 bg-muted/30 rounded-lg">
            <p className="text-muted-foreground mb-4">No listings found in {city}</p>
            <Link to="/search"><Button variant="outline">Try another city</Button></Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map(listing => (
              <ListingCard
                key={listing.id}
                listing={listing}
                isFavorited={favorites?.some(f => f.listing_id === listing.id)}
                onToggleFavorite={async (listing) => {
                  if (!user) return;
                  const fav = favorites?.find(f => f.listing_id === listing.id);
                  if (fav) { await entities.Favorite.delete(fav.id); }
                  else { await entities.Favorite.create({ user_id: user.id, listing_id: listing.id, listing_title: listing.title, listing_cover_photo: listing.cover_photo_url, listing_city: listing.city }); }
                  refetchFavorites?.();
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      {listings?.length > 0 && (
        <div className="bg-accent/5 border-t border-border py-12">
          <div className="max-w-5xl mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">Looking to list?</h2>
            <p className="text-muted-foreground mb-6">Post your room and reach {listings.length}+ interested seekers.</p>
            <Link to="/create-listing">
              <Button className="gap-2">
                Create Listing <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}