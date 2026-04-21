import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Skeleton } from "@/components/ui/skeleton";
import { SelectItem } from "@/components/ui/select";
import MobileDrawerSelect from "@/components/ui/mobile-drawer-select";
import { Search, Map, Bell, Bookmark, X, ChevronLeft, ChevronRight, Loader2, List } from "lucide-react";
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
  const storedCountry = localStorage.getItem('minest-country') || '';

  const [filters, setFilters] = useState({
    city: urlParams.get("city") || "",
    country: urlParams.get("country") || storedCountry || "",
    sort: "-created_at",
  });

  const { user, navigateToLogin } = useAuth();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState("split"); // grid, map, split
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [showAlertNudge, setShowAlertNudge] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [rentPeriodTab, setRentPeriodTab] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredListingId, setHoveredListingId] = useState(null);
  const PAGE_SIZE = 12;

  useEffect(() => { setCurrentPage(1); }, [filters, rentPeriodTab]);

  useEffect(() => {
    if (currentCountry) {
      setFilters(prev => ({
        ...prev, country: currentCountry,
        province_or_state: prev.country !== currentCountry ? "" : prev.province_or_state,
      }));
    }
  }, [currentCountry]);

  useEffect(() => {
    const timer = setTimeout(() => { setFilters(prev => ({ ...prev, city: cityInput })); }, 400);
    return () => clearTimeout(timer);
  }, [cityInput]);

  useEffect(() => {
    if (!filters.city || nudgeDismissed || !user) return;
    const t = setTimeout(() => setShowAlertNudge(true), 4000);
    return () => clearTimeout(t);
  }, [filters.city, nudgeDismissed, user]);

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
    if (filters.internet_included) q.internet_included = true;
    if (filters.pets_allowed) q.pets_allowed = true;
    if (filters.smoking_allowed) q.smoking_allowed = true;
    if (filters.student_friendly) q.student_friendly = true;
    if (filters.lgbtq_friendly) q.lgbtq_friendly = true;
    if (filters.couples_allowed) q.couples_allowed = true;
    if (filters.laundry) q.laundry = filters.laundry;
    if (filters.floor_level) q.floor_level = filters.floor_level;
    if (filters.ac_heating) q.ac_heating = filters.ac_heating;
    if (filters.booking_mode) q.booking_mode = filters.booking_mode;
    // Price filtering: use rent_amount for daily/weekly, rent_normalized_monthly for monthly/all
    if (filters.rent_period === "daily" || filters.rent_period === "weekly") {
      if (filters.price_min) q.rent_amount = { ...q.rent_amount, $gte: Number(filters.price_min) };
      if (filters.price_max) q.rent_amount = { ...q.rent_amount, $lte: Number(filters.price_max) };
    } else {
      if (filters.price_min) q.rent_normalized_monthly = { ...q.rent_normalized_monthly, $gte: Number(filters.price_min) };
      if (filters.price_max) q.rent_normalized_monthly = { ...q.rent_normalized_monthly, $lte: Number(filters.price_max) };
    }
    return q;
  }, [filters]);

  const { data: allListings = [], isLoading, error, refetch } = useQuery({
    queryKey: ["listings", filterQuery, filters.sort],
    queryFn: async () => {
      try {
        return await entities.Listing.filter(filterQuery, filters.sort, 100);
      } catch {
        return [];
      }
    },
    staleTime: 30000,
    retry: 0,
  });

  const listings = useMemo(() => {
    const now = new Date();
    const filtered = allListings.filter(listing => {
      // Parking filter — skip if no filter set or "any"
      const pf = filters.parking_filter;
      const parkingMatch = !pf || pf === "" ? true : matchesParkingFilter(listing, pf);
      // Rent period tab
      const listingPeriod = listing.rent_period || "monthly";
      const periodMatch = rentPeriodTab === "all" || listingPeriod === rentPeriodTab;

      // Daily date availability filter
      let dateMatch = true;
      if (filters.checkin_date && filters.checkout_date && listing.rent_period === "daily") {
        const checkin = new Date(filters.checkin_date);
        const checkout = new Date(filters.checkout_date);
        // Check if listing is available in the requested range
        if (listing.available_from && new Date(listing.available_from) > checkin) dateMatch = false;
        if (listing.available_until && new Date(listing.available_until) < checkout) dateMatch = false;
        // Check blocked dates
        if (listing.blocked_dates && Array.isArray(listing.blocked_dates)) {
          const blockedSet = new Set(listing.blocked_dates);
          const cur = new Date(checkin);
          while (cur < checkout && dateMatch) {
            if (blockedSet.has(cur.toISOString().split('T')[0])) dateMatch = false;
            cur.setDate(cur.getDate() + 1);
          }
        }
      }

      return parkingMatch && periodMatch && dateMatch;
    });

    const boosted = filtered.filter(l => l.is_boosted && l.boost_end_at && new Date(l.boost_end_at) > now);
    const nonBoosted = filtered.filter(l => !(l.is_boosted && l.boost_end_at && new Date(l.boost_end_at) > now));

    for (let i = boosted.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [boosted[i], boosted[j]] = [boosted[j], boosted[i]];
    }

    nonBoosted.sort((a, b) => {
      if (filters.sort === "rent_normalized_monthly") return (a.rent_normalized_monthly || 0) - (b.rent_normalized_monthly || 0);
      if (filters.sort === "-rent_normalized_monthly") return (b.rent_normalized_monthly || 0) - (a.rent_normalized_monthly || 0);
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    return [...boosted, ...nonBoosted];
  }, [allListings, filters.parking_filter, filters.sort, rentPeriodTab]);

  const totalPages = Math.ceil(listings.length / PAGE_SIZE);
  const paginatedListings = listings.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Real-time subscription
  useEffect(() => {
    const unsub = entities.Listing.subscribe((event) => {
      if (event.type === "create" && event.data?.status === "active") refetch();
    });
    return () => unsub();
  }, [refetch]);

  // Favorites
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
      if (existing) { await entities.Favorite.delete(existing.id); return { removed: listing.id }; }
      else {
        await entities.Favorite.create({
          user_id: user.id, listing_id: listing.id,
          listing_title: listing.title, listing_cover_photo: listing.cover_photo_url, listing_city: listing.city,
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
    onError: (_err, _listing, ctx) => { if (ctx?.previous) queryClient.setQueryData(favQueryKey, ctx.previous); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: favQueryKey }),
  });

  const handleToggleFavorite = (listing) => {
    if (!user) { navigateToLogin(window.location.href); return; }
    favMutation.mutate(listing);
  };

  const { pulling, refreshing, pullDistance, threshold } = usePullToRefresh(async () => { await refetch(); });

  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([k, v]) => {
      if (k === "sort") return false;
      if (k === "parking_filter" && (!v || v === "" || v === "any")) return false;
      return v && v !== "" && v !== false;
    }).length;
  }, [filters]);

  const handleRemoveFilter = (key) => {
    setFilters(prev => ({ ...prev, [key]: "" }));
  };

  const handleClearAllFilters = () => {
    setCityInput("");
    setFilters({ city: "", country: "", sort: "-created_at" });
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  // Listing grid content
  const listingGrid = (
    <>
      {isLoading && !error ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border overflow-hidden">
              <Skeleton className="aspect-video" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
            <Search className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-2">No rooms found</h3>
          <p className="text-muted-foreground text-xs mb-4 max-w-xs mx-auto">Try adjusting your filters or searching a different city.</p>
          <Button variant="outline" size="sm" onClick={handleClearAllFilters}>Clear all filters</Button>
        </div>
      ) : (
        <>
          <div className={`grid gap-3 sm:gap-4 w-full ${
            viewMode === "split" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          }`}>
            {paginatedListings.map(listing => (
              <div key={listing.id}
                onMouseEnter={() => setHoveredListingId(listing.id)}
                onMouseLeave={() => setHoveredListingId(null)}
                className={`transition-all duration-150 rounded-2xl ${
                  hoveredListingId === listing.id ? "ring-2 ring-accent/30" : ""
                }`}
              >
                <ListingCard listing={listing} isFavorited={favIds.has(listing.id)} onToggleFavorite={handleToggleFavorite} />
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 sm:gap-2 mt-8 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="gap-1 h-9 px-3">
                <ChevronLeft className="w-4 h-4" /> <span className="hidden sm:inline">Previous</span>
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) => item === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground text-sm">…</span>
                ) : (
                  <Button key={item} variant={currentPage === item ? "default" : "outline"} size="sm"
                    onClick={() => handlePageChange(item)} className="h-9 w-9 p-0">{item}</Button>
                ))
              }
              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="gap-1 h-9 px-3">
                <span className="hidden sm:inline">Next</span> <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );

  const resultsContent = (
    <>
      {/* Page Header */}
      <div className="mb-3 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-2 sm:mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Find a Place</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Browse available places across Canada and the USA</p>
          </div>
          {user && (
            <div className="flex items-center gap-2 shrink-0">
              <SaveSearchButton filters={filters} searchType="room_search" />
              <Link to="/saved-searches" className="text-xs text-accent hover:underline flex items-center gap-1 shrink-0 h-9 px-3 rounded-md hover:bg-accent/5">
                <Bookmark className="w-4 h-4" /> <span className="hidden sm:inline">Saved</span>
              </Link>
            </div>
          )}
        </div>

        {/* Alert nudge */}
        {showAlertNudge && !nudgeDismissed && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-accent/5 border border-accent/20 rounded-xl px-4 py-3 mb-4">
            <div className="flex items-start sm:items-center gap-2 text-sm">
              <Bell className="w-4 h-4 text-accent flex-shrink-0 mt-0.5 sm:mt-0" />
              <span className="text-foreground font-medium">Get alerts for new listings in {filters.city}?</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <SaveSearchButton filters={filters} searchType="room_search" />
              <button onClick={() => { setNudgeDismissed(true); setShowAlertNudge(false); }}
                className="text-muted-foreground hover:text-foreground p-1"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 mb-4 pb-4 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {isLoading ? "Loading..." : `${listings.length} listing${listings.length !== 1 ? "s" : ""} found`}
            </p>
            {totalPages > 1 && <p className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</p>}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <MobileDrawerSelect value={rentPeriodTab} onValueChange={setRentPeriodTab} className="w-28 h-9" title="Period">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
            </MobileDrawerSelect>

            <MobileDrawerSelect value={filters.sort || "-created_at"} onValueChange={(v) => setFilters(prev => ({ ...prev, sort: v }))} className="w-36 h-9" title="Sort">
              <SelectItem value="-created_at">Newest</SelectItem>
              <SelectItem value="rent_normalized_monthly">Price: Low</SelectItem>
              <SelectItem value="-rent_normalized_monthly">Price: High</SelectItem>
              <SelectItem value="-is_featured">Featured</SelectItem>
            </MobileDrawerSelect>

            {/* Desktop view toggle */}
            <div className="hidden lg:flex rounded-lg border border-border overflow-hidden">
              {[
                { mode: "grid", icon: <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>, label: "Grid" },
                { mode: "split", icon: <><List className="w-4 h-4" /><Map className="w-3 h-3" /></>, label: "Split" },
                { mode: "map", icon: <Map className="w-4 h-4" />, label: "Map" },
              ].map(({ mode, icon, label }) => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`flex items-center gap-1 px-3 h-9 text-xs font-medium transition-colors ${
                    viewMode === mode ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"
                  } ${mode !== "grid" ? "border-l border-border" : ""}`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {activeFilterCount > 0 && (
          <ActiveFilterChips filters={filters} onRemoveFilter={handleRemoveFilter} onClearAll={handleClearAllFilters} />
        )}
      </div>

      {/* Results */}
      {viewMode === "map" ? (
        <div className="h-[calc(100vh-280px)] min-h-[500px] w-full rounded-2xl overflow-hidden">
          {isLoading ? <Skeleton className="w-full h-full" /> : (
            <MapView listings={listings} filters={filters} activeListingId={hoveredListingId}
              onListingHover={setHoveredListingId} />
          )}
        </div>
      ) : viewMode === "split" ? (
        <div className="hidden lg:flex gap-4 h-[calc(100vh-280px)] min-h-[500px]">
          {/* Left: scrollable listing cards */}
          <div className="w-1/2 overflow-y-auto pr-2 space-y-3 scrollbar-thin">
            {listingGrid}
          </div>
          {/* Right: sticky map */}
          <div className="w-1/2 sticky top-0 rounded-2xl overflow-hidden">
            <MapView listings={listings} filters={filters} activeListingId={hoveredListingId}
              onListingHover={setHoveredListingId} />
          </div>
        </div>
      ) : null}

      {/* Grid view (default on mobile, option on desktop) */}
      {(viewMode === "grid" || (viewMode === "split" && typeof window !== 'undefined' && window.innerWidth < 1024)) && (
        <div className="lg:hidden block">{listingGrid}</div>
      )}
      {viewMode === "grid" && (
        <div className="hidden lg:block">{listingGrid}</div>
      )}
    </>
  );

  return (
    <SearchLayout filters={filters} onFiltersChange={setFilters} activeFilterCount={activeFilterCount}>
      {/* Pull-to-refresh */}
      {(pulling || refreshing) && (
        <div className="flex items-center justify-center lg:hidden overflow-hidden transition-all duration-200"
          style={{ height: refreshing ? 48 : Math.min(pullDistance, 48) }}>
          <Loader2 className={`w-5 h-5 text-accent ${refreshing ? "animate-spin" : ""}`}
            style={{ opacity: pullDistance / threshold }} />
        </div>
      )}

      {resultsContent}

      {/* Mobile floating map button */}
      <button onClick={() => setMobileMapOpen(true)}
        className="lg:hidden fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-5 py-3 rounded-full shadow-xl flex items-center gap-2 text-sm font-semibold hover:scale-105 active:scale-95 transition-transform">
        <Map className="w-4 h-4" /> Map
      </button>

      {/* Mobile full-screen map overlay */}
      {mobileMapOpen && (
        <div className="lg:hidden fixed inset-0 z-[100] bg-background">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-[600] bg-card/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">{listings.length} listings</span>
            <button onClick={() => setMobileMapOpen(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground text-background text-xs font-medium">
              <List className="w-3.5 h-3.5" /> List
            </button>
          </div>
          {/* Map */}
          <div className="w-full h-full pt-12">
            <MapView listings={listings} filters={filters} isMobile={true}
              onListingHover={setHoveredListingId} />
          </div>
        </div>
      )}
    </SearchLayout>
  );
}
