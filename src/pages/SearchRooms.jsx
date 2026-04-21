import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Skeleton } from "@/components/ui/skeleton";
import { SelectItem } from "@/components/ui/select";
import MobileDrawerSelect from "@/components/ui/mobile-drawer-select";
import { Search, Map, Bell, Bookmark, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import ListingCard from "@/components/listings/ListingCard";
import MapView from "@/components/search/MapView";
import SearchLayout from "@/components/search/SearchLayout";
import SaveSearchButton from "@/components/search/SaveSearchButton";
import ActiveFilterChips from "@/components/search/ActiveFilterChips";
import { useAuth } from "@/lib/AuthContext";
import { useCountry } from "@/lib/CountryContext";
import { matchesParkingFilter } from "@/lib/parkingHelpers";
import usePullToRefresh from "@/hooks/usePullToRefresh";


export default function SearchRooms() {
  const urlParams = new URLSearchParams(window.location.search);
  const [cityInput, setCityInput] = useState(urlParams.get("city") || "");
  const { country: currentCountry } = useCountry();
  // Initialize with country from URL param, or read from localStorage as fallback
  const storedCountry = localStorage.getItem('minest-country') || '';
  const [filters, setFilters] = useState({
    city: urlParams.get("city") || "",
    country: urlParams.get("country") || storedCountry || "",
    sort: "-created_at",
  });

  const { user, navigateToLogin } = useAuth();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState("grid"); // grid or map
  const [showAlertNudge, setShowAlertNudge] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [rentPeriodTab, setRentPeriodTab] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 12;

  // Reset to page 1 when filters or sort change
  useEffect(() => { setCurrentPage(1); }, [filters, rentPeriodTab]);

  // Sync global country switcher into filter whenever it changes
  useEffect(() => {
    if (currentCountry) {
      setFilters(prev => ({
        ...prev,
        country: currentCountry,
        // Reset province when country changes
        province_or_state: prev.country !== currentCountry ? "" : prev.province_or_state,
      }));
    }
  }, [currentCountry]);

  // Debounce city input to avoid firing query on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, city: cityInput }));
    }, 400);
    return () => clearTimeout(timer);
  }, [cityInput]);

  // Show alert nudge after user has a city filter set and has browsed for a moment
  useEffect(() => {
    if (!filters.city || nudgeDismissed || !user) return;
    const t = setTimeout(() => setShowAlertNudge(true), 4000);
    return () => clearTimeout(t);
  }, [filters.city, nudgeDismissed, user]);

  // Build filter query for the API
  const filterQuery = useMemo(() => {
    const q = { status: "active" };
    if (filters.country) q.country = filters.country;
    if (filters.province_or_state) q.province_or_state = filters.province_or_state;
    if (filters.city) q.city = { $regex: filters.city, $options: "i" };
    if (filters.listing_type) q.listing_type = filters.listing_type;
    if (filters.property_type) q.property_type = filters.property_type;
    if (filters.furnishing) q.furnishing = filters.furnishing;
    if (filters.rent_period) q.rent_period = filters.rent_period;
    if (filters.bills_included) q.bills_included = true;
    if (filters.parking_available) q.parking_available = true;
    if (filters.internet_included) q.internet_included = true;
    if (filters.pets_allowed) q.pets_allowed = true;
    if (filters.smoking_allowed) q.smoking_allowed = true;
    if (filters.student_friendly) q.student_friendly = true;
    if (filters.lgbtq_friendly) q.lgbtq_friendly = true;
    if (filters.couples_allowed) q.couples_allowed = true;
    if (filters.price_min) q.rent_normalized_monthly = { ...q.rent_normalized_monthly, $gte: Number(filters.price_min) };
    if (filters.price_max) q.rent_normalized_monthly = { ...q.rent_normalized_monthly, $lte: Number(filters.price_max) };
    return q;
  }, [filters]);

  const { data: allListings = [], isLoading, error, refetch } = useQuery({
    queryKey: ["listings", filterQuery, filters.sort],
    queryFn: async () => {
      try {
        const results = await entities.Listing.filter(filterQuery, filters.sort, 100);
        return results;
      } catch (err) {
        console.error("Listing fetch error:", err);
        return []; // Return empty on error instead of hanging
      }
    },
    staleTime: 30000,
    retry: 0, // Don't retry — show results (or empty) immediately
  });

  // Log errors for debugging
  React.useEffect(() => {
    if (error) {
      console.error("Listing fetch error:", error);
    }
  }, [error]);

  // Apply parking and rent period filters, then sort boosted/featured listings to the top
  const listings = useMemo(() => {
    const now = new Date();

    const filtered = allListings.filter(listing => {
      const parkingMatch = matchesParkingFilter(listing, filters.parking_filter || "any");
      const listingPeriod = listing.rent_period || "monthly";
      const periodMatch = rentPeriodTab === "all" || listingPeriod === rentPeriodTab;
      return parkingMatch && periodMatch;
    });

    // Separate boosted and non-boosted
    const boosted = filtered.filter(l => l.is_boosted && l.boost_end_at && new Date(l.boost_end_at) > now);
    const nonBoosted = filtered.filter(l => !(l.is_boosted && l.boost_end_at && new Date(l.boost_end_at) > now));

    // Randomly shuffle boosted listings (Fisher-Yates) so no single user dominates
    for (let i = boosted.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [boosted[i], boosted[j]] = [boosted[j], boosted[i]];
    }

    // Sort non-boosted by selected sort
    nonBoosted.sort((a, b) => {
      if (filters.sort === "rent_normalized_monthly") return (a.rent_normalized_monthly || a.monthly_rent || 0) - (b.rent_normalized_monthly || b.monthly_rent || 0);
      if (filters.sort === "-rent_normalized_monthly") return (b.rent_normalized_monthly || b.monthly_rent || 0) - (a.rent_normalized_monthly || a.monthly_rent || 0);
      return new Date(b.created_at || b.created_date) - new Date(a.created_at || a.created_date);
    });

    return [...boosted, ...nonBoosted];
  }, [allListings, filters.parking_filter, filters.sort, rentPeriodTab]);

  const totalPages = Math.ceil(listings.length / PAGE_SIZE);
  const paginatedListings = listings.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Real-time subscription for new listings
  useEffect(() => {
    const unsubscribe = entities.Listing.subscribe((event) => {
      if (event.type === "create" && event.data?.status === "active") {
        refetch();
      }
    });
    return () => unsubscribe();
  }, [refetch]);

  // Favorites with TanStack optimistic updates
  const favQueryKey = ["favorites", user?.id];
  const { data: favorites = [] } = useQuery({
    queryKey: favQueryKey,
    queryFn: () => user ? entities.Favorite.filter({ user_id: user.id }) : [],
    enabled: !!user,
  });

  const favIds = new Set(favorites.map(f => f.listing_id));

  const favMutation = useMutation({
    mutationFn: async (listing) => {
      const existing = favorites.find(f => f.listing_id === listing.id);
      if (existing) {
        await entities.Favorite.delete(existing.id);
        return { removed: listing.id };
      } else {
        await entities.Favorite.create({
          user_id: user.id,
          listing_id: listing.id,
          listing_title: listing.title,
          listing_cover_photo: listing.cover_photo_url,
          listing_city: listing.city,
        });
        return { added: listing.id };
      }
    },
    onMutate: async (listing) => {
      await queryClient.cancelQueries({ queryKey: favQueryKey });
      const previous = queryClient.getQueryData(favQueryKey) ?? [];
      const isFav = previous.some(f => f.listing_id === listing.id);
      queryClient.setQueryData(favQueryKey, isFav
        ? previous.filter(f => f.listing_id !== listing.id)
        : [...previous, { listing_id: listing.id, user_id: user.id }]
      );
      return { previous };
    },
    onError: (_err, _listing, context) => {
      if (context?.previous) queryClient.setQueryData(favQueryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: favQueryKey }),
  });

  const handleToggleFavorite = (listing) => {
    if (!user) { navigateToLogin(window.location.href); return; }
    favMutation.mutate(listing);
  };

  const { pulling, refreshing, pullDistance, threshold } = usePullToRefresh(async () => {
    await refetch();
  });

  // Count active filters
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([k, v]) => {
      if (k === "sort") return false;
      return v && v !== "" && v !== false;
    }).length;
  }, [filters]);

  // Remove single filter
  const handleRemoveFilter = (key) => {
    setFilters(prev => {
      const updated = { ...prev, [key]: "" };
      if (key === "price_min" || key === "price_max") {
        updated[key] = "";
      }
      return updated;
    });
  };

  // Clear all filters
  const handleClearAllFilters = () => {
    setCityInput("");
    setFilters({ city: "", country: "", sort: "-created_at" });
  };

  const resultsContent = (
    <>
      {/* Page Header */}
       <div className="mb-3 sm:mb-8">
         <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-2 sm:mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Find a Place</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
              Browse available places across Canada and the USA
            </p>
          </div>
          {user && (
            <div className="flex items-center gap-2 shrink-0">
              <SaveSearchButton filters={filters} searchType="room_search" />
              <Link to="/saved-searches" className="text-xs text-accent hover:underline flex items-center gap-1 shrink-0 h-9 px-3 rounded-md hover:bg-accent/5 transition-colors">
                <Bookmark className="w-4 h-4" /> 
                <span className="hidden sm:inline">Saved Searches</span>
                <span className="sm:hidden">Saved</span>
              </Link>
            </div>
          )}
        </div>

        {/* Alert nudge banner */}
        {showAlertNudge && !nudgeDismissed && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-accent/5 border border-accent/20 rounded-xl px-4 py-3 mb-4">
            <div className="flex items-start sm:items-center gap-2 text-sm">
              <Bell className="w-4 h-4 text-accent flex-shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <span className="text-foreground font-medium block sm:inline">
                  Get alerts for new listings in {filters.city}?
                </span>
                <span className="text-muted-foreground text-xs sm:text-sm sm:ml-2">We'll notify you instantly.</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <SaveSearchButton filters={filters} searchType="room_search" />
              <button onClick={() => { setNudgeDismissed(true); setShowAlertNudge(false); }} className="text-muted-foreground hover:text-foreground p-1 flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results header + controls */}
      <div className="flex flex-col gap-3 mb-4 pb-4 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">
              {isLoading && !error ? "Loading listings..." : error ? "0 listings found" : `${listings.length} listing${listings.length !== 1 ? "s" : ""} found`}
            </p>
            {!isLoading && !error && totalPages > 1 && (
              <p className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
            )}
            {filters.city && (
              <p className="text-xs text-muted-foreground">
                in {filters.city}
                {filters.province_or_state && `, ${filters.province_or_state}`}
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-2 shrink-0 w-full sm:w-auto">
            <MobileDrawerSelect value={rentPeriodTab} onValueChange={setRentPeriodTab} className="w-full sm:w-40 h-9" title="Rent Period">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
            </MobileDrawerSelect>
            <MobileDrawerSelect value={filters.sort || "-created_at"} onValueChange={(v) => setFilters(prev => ({ ...prev, sort: v }))} className="w-full sm:w-40 h-9" title="Sort By">
              <SelectItem value="-created_at">Newest</SelectItem>
              <SelectItem value="rent_normalized_monthly">Price: Low to High</SelectItem>
              <SelectItem value="-rent_normalized_monthly">Price: High to Low</SelectItem>
              <SelectItem value="-is_featured">Featured First</SelectItem>
            </MobileDrawerSelect>
            <div className="hidden sm:flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-3 h-9 text-sm font-medium transition-colors ${
                  viewMode === "grid"
                    ? "bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:text-foreground"
                }`}
                title="Grid view"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/>
                  <rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/>
                </svg>
                Grid
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`flex items-center gap-1.5 px-3 h-9 text-sm font-medium transition-colors border-l border-border ${
                  viewMode === "map"
                    ? "bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:text-foreground"
                }`}
                title="Map view"
              >
                <Map className="w-4 h-4" />
                Map
              </button>
            </div>
          </div>
        </div>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <ActiveFilterChips
            filters={filters}
            onRemoveFilter={handleRemoveFilter}
            onClearAll={handleClearAllFilters}
          />
        )}
      </div>

      {/* Results grid or map */}
      {viewMode === "map" ? (
        <div className="h-96 w-full rounded-2xl overflow-hidden border border-border">
          {isLoading && !error ? (
            <Skeleton className="w-full h-full" />
          ) : listings.length === 0 ? (
            <div className="flex items-center justify-center h-full bg-muted">
              <p className="text-muted-foreground">No listings to display on map</p>
            </div>
          ) : (
            <MapView listings={listings} filters={filters} />
          )}
        </div>
      ) : (
        <>
          {isLoading && !error ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 w-full">
              {Array(6).fill(0).map((_, i) => (
                <div key={i} className="rounded-2xl border border-border overflow-hidden">
                  <Skeleton className="aspect-video" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-12 sm:py-16">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Search className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">No rooms found</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mb-4 max-w-xs mx-auto">Try adjusting your filters or searching a different city.</p>
              <Button variant="outline" size="sm" onClick={() => setFilters({ city: "", country: "", sort: "-created_at" })} className="h-9">
                Clear all filters
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 w-full">
                {paginatedListings.map(listing => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    isFavorited={favIds.has(listing.id)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 sm:gap-2 mt-8 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="gap-1 h-9 px-3"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .reduce((acc, p, idx, arr) => {
                      if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === "..." ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground text-sm">…</span>
                      ) : (
                        <Button
                          key={item}
                          variant={currentPage === item ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(item)}
                          className="h-9 w-9 p-0"
                        >
                          {item}
                        </Button>
                      )
                    )
                  }

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="gap-1 h-9 px-3"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </>
        )}
    </>
  );

  return (
    <SearchLayout
      filters={filters}
      onFiltersChange={setFilters}
      activeFilterCount={activeFilterCount}
    >
      {/* Pull-to-refresh indicator */}
      {(pulling || refreshing) && (
        <div
          className="flex items-center justify-center lg:hidden overflow-hidden transition-all duration-200"
          style={{ height: refreshing ? 48 : Math.min(pullDistance, 48) }}
        >
          <Loader2 className={`w-5 h-5 text-accent ${refreshing ? "animate-spin" : ""}`} style={{ opacity: pullDistance / threshold }} />
        </div>
      )}
      {resultsContent}
    </SearchLayout>
  );
}