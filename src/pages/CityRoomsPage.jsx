/**
 * CityRoomsPage — Dynamic SEO page for /rooms-for-rent-[city]
 * Generates unique, indexable city pages automatically for any city in Canada.
 */
import React, { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { entities } from '@/api/entities';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MapPin, ChevronRight, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ListingCard from "@/components/listings/ListingCard";
import {
  slugToCity, cityToSlug, cityPageUrl, getNearbyCities,
  generateCityContent, getCityProvince, setPageMeta, buildBreadcrumbSchema,
  generateCityFAQs, buildFAQSchema
} from "@/lib/seoHelpers";
import SchemaInjector from "@/components/seo/SchemaInjector";

export default function CityRoomsPage() {
  const { citySlug } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: favorites = [] } = useQuery({
    queryKey: ['city-favorites', user?.id],
    queryFn: () => entities.Favorite.filter({ user_id: user.id }, '-created_at', 100),
    enabled: !!user?.id,
  });

  const favIds = new Set(favorites.map(f => f.listing_id));

  const handleToggleFavorite = async (listing) => {
    if (!user) return;
    const fav = favorites.find(f => f.listing_id === listing.id);
    if (fav) {
      await entities.Favorite.delete(fav.id);
    } else {
      await entities.Favorite.create({
        user_id: user.id,
        listing_id: listing.id,
        listing_title: listing.title,
        listing_cover_photo: listing.cover_photo_url,
        listing_city: listing.city,
      });
    }
    qc.invalidateQueries({ queryKey: ['city-favorites'] });
  };
  const city = slugToCity(citySlug || "");
  const province = getCityProvince(citySlug || "");
  const { intro, market, lifestyle } = generateCityContent(city);
  const faqs = generateCityFAQs(city);
  const faqSchema = buildFAQSchema(faqs);
  const nearbyCities = getNearbyCities(citySlug || "");

  // Inject dynamic meta tags + JSON-LD
  useEffect(() => {
    const canonical = cityPageUrl(city);
    setPageMeta({
      title: `Rooms for Rent in ${city}${province ? `, ${province}` : ''} | Verified Listings | MiNest`,
      description: `Find verified rooms for rent in ${city}${province ? `, ${province}` : ''}. Browse private rooms, shared housing, and roommates updated daily. Free to search on MiNest.`,
      canonical,
      ogType: "website",
    });

    // Breadcrumb structured data
    const breadcrumb = buildBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Search Rooms", path: "/search" },
      { name: `Rooms for Rent in ${city}`, path: canonical },
    ]);
    let script = document.getElementById("__breadcrumb_ld");
    if (!script) {
      script = document.createElement("script");
      script.id = "__breadcrumb_ld";
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(breadcrumb);

    return () => {
      document.title = "MiNest | Find Rooms, Roommates & Pay Rent Online — Canada & USA";
    };
  }, [city, province]);

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["city-listings", citySlug],
    queryFn: async () => {
      const { supabase } = await import("@/lib/supabase");
      const { data } = await supabase
        .from("listings")
        .select("*")
        .eq("status", "active")
        .ilike("city", city)
        .order("updated_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!city,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allCities = [] } = useQuery({
    queryKey: ["all-active-cities"],
    queryFn: async () => {
      const all = await entities.Listing.filter({ status: "active" }, "-updated_at", 200);
      const seen = new Set();
      return all.reduce((acc, l) => {
        if (l.city && !seen.has(l.city.toLowerCase())) {
          seen.add(l.city.toLowerCase());
          acc.push(l.city);
        }
        return acc;
      }, []).sort();
    },
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <SchemaInjector id="__city_faq_ld" schema={faqSchema} />
      {/* Breadcrumb nav */}
      <nav aria-label="breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground mb-4 flex-wrap">
        <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to="/search" className="hover:text-foreground transition-colors">Rooms for Rent</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium">{city}</span>
      </nav>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-accent/10 via-background to-secondary/5 rounded-3xl border border-border p-6 sm:p-10 mb-8">
        <div className="flex items-center gap-2 text-accent text-sm font-semibold mb-2">
          <MapPin className="w-4 h-4" />
          {province}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
          Rooms for Rent in {city}
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed max-w-2xl">
          {intro}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to={`/search?city=${encodeURIComponent(city)}`}>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2">
              <Home className="w-4 h-4" /> Browse All Listings
            </Button>
          </Link>
          <Link to="/seeker-onboarding">
            <Button variant="outline" className="gap-2">Find Roommates in {city}</Button>
          </Link>
        </div>
      </div>

      {/* Listings */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">
            {isLoading ? "Loading listings..." : `${listings.length} Room${listings.length !== 1 ? "s" : ""} Available in ${city}`}
          </h2>
          <Link to={`/search?city=${encodeURIComponent(city)}`} className="text-sm text-accent hover:underline flex items-center gap-1">
            See all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16 bg-muted/30 rounded-2xl">
            <Home className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-semibold text-foreground mb-1">No listings in {city} yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Be the first to post a room for rent in {city}, or search nearby cities.
            </p>
            <Link to="/create-listing">
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">Post a Listing</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} isFavorited={favIds.has(listing.id)} onToggleFavorite={handleToggleFavorite} />
            ))}
          </div>
        )}
      </div>

      {/* SEO Content Block */}
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 mb-8 space-y-4">
        <h2 className="text-xl font-bold text-foreground">Renting in {city}</h2>
        <p className="text-muted-foreground leading-relaxed">{market}</p>
        <p className="text-muted-foreground leading-relaxed">{lifestyle}</p>
        <div className="grid sm:grid-cols-3 gap-4 pt-4 border-t border-border">
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">{listings.length}+</div>
            <div className="text-xs text-muted-foreground mt-1">Active Listings</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">Free</div>
            <div className="text-xs text-muted-foreground mt-1">To Browse & Message</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">Verified</div>
            <div className="text-xs text-muted-foreground mt-1">Hosts & Listings</div>
          </div>
        </div>
      </div>

      {/* Nearby Cities Internal Linking */}
      {nearbyCities.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-foreground mb-4">Browse Rooms in Nearby Cities</h2>
          <div className="flex flex-wrap gap-2">
            {nearbyCities.map((nearCity) => (
              <Link
                key={nearCity}
                to={cityPageUrl(nearCity)}
                className="inline-flex items-center gap-1 px-4 py-2 bg-card border border-border rounded-full text-sm text-foreground hover:border-accent hover:text-accent transition-colors"
              >
                <MapPin className="w-3 h-3" /> Rooms in {nearCity}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All Cities Grid */}
      {allCities.length > 1 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-foreground mb-4">All Cities on MiNest</h2>
          <div className="flex flex-wrap gap-2">
            {allCities
              .filter((c) => c.toLowerCase() !== city.toLowerCase())
              .map((c) => (
                <Link
                  key={c}
                  to={cityPageUrl(c)}
                  className="text-xs px-3 py-1.5 bg-muted rounded-full text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors"
                >
                  {c}
                </Link>
              ))}
          </div>
        </div>
      )}

      {/* FAQ Section */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-foreground mb-5">Frequently Asked Questions — Rooms for Rent in {city}</h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <details key={i} className="bg-card border border-border rounded-xl group" open={i === 0}>
              <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer font-semibold text-sm text-foreground list-none select-none">
                {faq.question}
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 group-open:rotate-90 transition-transform" />
              </summary>
              <p className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="bg-gradient-to-r from-accent/10 to-secondary/10 rounded-2xl border border-border p-6 text-center">
        <h3 className="font-bold text-foreground mb-2">Have a room to rent in {city}?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          List your room on MiNest for free and connect with verified tenants in {city}.
        </p>
        <Link to="/create-listing">
          <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">Post Your Listing — It's Free</Button>
        </Link>
      </div>
    </div>
  );
}