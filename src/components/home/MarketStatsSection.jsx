/**
 * Public-safe market stats section for the home page.
 * Shows aggregated, anonymous insights — no personal data, no owner/tenant info.
 */
import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { MapPin, TrendingUp, Home, DollarSign } from "lucide-react";
import { useCountry } from "@/lib/CountryContext";
import { formatAmount } from "@/lib/pricingHelpers";

export default function MarketStatsSection() {
  const { country, currency, convertPrice } = useCountry();

  const { data: listings = [] } = useQuery({
    queryKey: ["market-stats-listings", country],
    queryFn: () => entities.Listing.filter({ status: "active", country: country }, "-created_at", 500),
    staleTime: 300000,
    enabled: !!country,
  });

  // Top cities by listing count
  const topCities = useMemo(() => {
    const cities = {};
    listings.forEach(l => {
      if (!l.city) return;
      cities[l.city] = (cities[l.city] || 0) + 1;
    });
    return Object.entries(cities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([city, count]) => ({ city, count }));
  }, [listings]);

  // Average rent by listing type
  const rentByType = useMemo(() => {
    const data = {};
    listings.forEach(l => {
      const t = l.listing_type;
      if (!t || !l.rent_normalized_monthly) return;
      if (!data[t]) data[t] = { total: 0, count: 0 };
      data[t].total += l.rent_normalized_monthly;
      data[t].count += 1;
    });
    const labels = { private_room: "Private Room", shared_room: "Shared Room", entire_place: "Entire Place" };
    return Object.entries(data).map(([type, d]) => ({
      type: labels[type] || type,
      avg: Math.round(d.total / d.count),
      count: d.count,
    })).sort((a, b) => a.avg - b.avg);
  }, [listings]);

  // Overall avg rent
  const avgRent = useMemo(() => {
    const withRent = listings.filter(l => l.rent_normalized_monthly);
    if (!withRent.length) return null;
    return Math.round(withRent.reduce((s, l) => s + l.rent_normalized_monthly, 0) / withRent.length);
  }, [listings]);

  // Furnished breakdown
  const furnishedPct = useMemo(() => {
    if (!listings.length) return null;
    const furnished = listings.filter(l => l.furnishing === "furnished").length;
    return Math.round((furnished / listings.length) * 100);
  }, [listings]);

  if (listings.length === 0) return null;

  const maxCityCount = topCities[0]?.count || 1;

  return (
    <section className="py-16 sm:py-24 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-3">{`Market Insights in ${country === "United States" ? "the USA" : "Canada"}`}</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Live data from active listings on MiNest — updated in real time.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Top Cities */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center gap-2 mb-5">
              <MapPin className="w-4 h-4 text-accent" />
              <h3 className="font-semibold text-foreground">Most Active Cities</h3>
            </div>
            <div className="space-y-3">
              {topCities.map(({ city, count }) => (
                <div key={city} className="flex items-center gap-3">
                  <span className="text-sm text-foreground font-medium w-28 truncate">{city}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((count / maxCityCount) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-12 text-right">{count} listings</span>
                </div>
              ))}
            </div>
          </div>

          {/* Avg Rent by Type */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center gap-2 mb-5">
              <DollarSign className="w-4 h-4 text-accent" />
              <h3 className="font-semibold text-foreground">Average Monthly Rent</h3>
            </div>
            <div className="space-y-4">
              {rentByType.map(({ type, avg, count }) => (
                <div key={type}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-foreground font-medium">{type}</span>
                    <span className="font-bold text-accent">{formatAmount(avg, currency, convertPrice)}/mo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="h-full bg-secondary rounded-full"
                        style={{ width: `${Math.round((avg / (rentByType[rentByType.length - 1]?.avg || avg)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{count} listings</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats Row */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-4 h-4 text-accent" />
              <h3 className="font-semibold text-foreground">Platform Highlights</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Avg Monthly Rent", value: avgRent ? formatAmount(avgRent, currency, convertPrice) : "—" },
                { label: "Furnished Rooms", value: furnishedPct !== null ? `${furnishedPct}%` : "—" },
                { label: "Pets Allowed", value: listings.length ? `${Math.round((listings.filter(l => l.pets_allowed).length / listings.length) * 100)}%` : "—" },
                { label: "Bills Included", value: listings.length ? `${Math.round((listings.filter(l => l.bills_included).length / listings.length) * 100)}%` : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-muted/40 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-foreground">{value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Listing Type Share */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center gap-2 mb-5">
              <Home className="w-4 h-4 text-accent" />
              <h3 className="font-semibold text-foreground">Listing Types Available</h3>
            </div>
            <div className="space-y-3">
              {rentByType.map(({ type, count }, i) => {
                const pct = Math.round((count / listings.length) * 100);
                const colors = ["bg-accent", "bg-secondary", "bg-primary"];
                return (
                  <div key={type} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${colors[i % 3]}`} />
                    <span className="text-sm text-foreground flex-1">{type}</span>
                    <span className="text-sm font-semibold text-foreground">{pct}%</span>
                    <span className="text-xs text-muted-foreground">({count})</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-4 border-t border-border pt-3">
              Based on {listings.length} active listings
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}