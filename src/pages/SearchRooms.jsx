import React, { useState, useMemo, useEffect, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Skeleton } from "@/components/ui/skeleton";
import { SelectItem } from "@/components/ui/select";
import MobileDrawerSelect from "@/components/ui/mobile-drawer-select";
import { Search, Map, Bell, Bookmark, X, ChevronLeft, ChevronRight, Loader2, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import ListingCard from "@/components/listings/ListingCard";
const MapView = lazy(() => import("@/components/search/MapView"));
import SearchLayout from "@/components/search/SearchLayout";
import SaveSearchButton from "@/components/search/SaveSearchButton";
import ActiveFilterChips from "@/components/search/ActiveFilterChips";
import BrandedLoader from "@/components/common/BrandedLoader";
import { useAuth } from "@/lib/AuthContext";
import { useCountry } from "@/lib/CountryContext";
import { matchesParkingFilter } from "@/lib/parkingHelpers";
import usePullToRefresh from "@/hooks/usePullToRefresh";

export default function SearchRooms() {
  const location = useLocation();
  const urlParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [cityInput, setCityInput] = useState(urlParams.get("city") || "");
  const { country: currentCountry } = useCountry();
  const storedCountry = localStorage.getItem('minest-country') || '';
  const hostFilter = urlParams.get("host") || "";

  const [filters, setFilters] = useState({
    city: urlParams.get("city") || "",
    country: hostFilter ? "" : (urlParams.get("country") || storedCountry || ""),
    sort: "-created_at",
  });

  const { user, navigateToLogin } = useAuth();
  const queryClient = useQueryClient();
  const [mobileMapOpen, setMobileMapOpen] = useState(false);

  // Lock body scroll when mobile map overlay is open
  useEffect(() => {
    if (mobileMapOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [mobileMapOpen]);

  const [showAlertNudge, setShowAlertNudge] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [rentPeriodTab, setRentPeriodTab] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredListingId, setHoveredListingId] = useState(null);
  const [locationDetected, setLocationDetected] = useState(() => {
    // If user cleared filters this session, don't auto-detect again
    try { return sessionStorage.getItem('minest-filters-cleared') === '1'; }
    catch { return false; }
  });
  const PAGE_SIZE = 12;

  // ==========================================
  // LAYER 1: Remember last search in localStorage
  // ==========================================
  useEffect(() => {
    // Save current search to localStorage whenever city/province changes
    if (filters.city) localStorage.setItem('minest-last-city', filters.city);
    if (filters.province_or_state) localStorage.setItem('minest-last-province', filters.province_or_state);
  }, [filters.city, filters.province_or_state]);

  // ==========================================
  // LAYER 2: Seeker profile preferred location
  // ==========================================
  const { data: seekerProfile } = useQuery({
    queryKey: ["seeker-profile-location", user?.id],
    queryFn: async () => {
      const profiles = await entities.SeekerProfile.filter({ owner_user_id: user.id });
      return profiles[0] || null;
    },
    enabled: !!user,
    staleTime: 300000, // 5 min — location prefs rarely change
  });

  // ==========================================
  // LAYER 3: Browser geolocation (one-time)
  // ==========================================
  useEffect(() => {
    // Skip if URL params already set, or if user already searched, or if location was detected
    if (urlParams.get("city") || filters.city || locationDetected) return;

    // Priority 1: Check last search from localStorage
    const lastCity = localStorage.getItem('minest-last-city');
    const lastProvince = localStorage.getItem('minest-last-province');
    if (lastCity) {
      setCityInput(lastCity);
      setFilters(prev => ({
        ...prev,
        city: lastCity,
        province_or_state: lastProvince || prev.province_or_state,
      }));
      setLocationDetected(true);
      return;
    }

    // Priority 2: Check seeker profile preferred location
    if (seekerProfile?.preferred_cities?.length > 0) {
      const preferredCity = seekerProfile.preferred_cities[0];
      setCityInput(preferredCity);
      setFilters(prev => ({
        ...prev,
        city: preferredCity,
        province_or_state: seekerProfile.preferred_province_or_state || prev.province_or_state,
      }));
      setLocationDetected(true);
      return;
    }

    // Priority 3: Browser geolocation — only if user hasn't declined before
    const geoDeclined = localStorage.getItem('minest-geo-declined');
    if (geoDeclined) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            // Reverse geocode to get city name
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=10`
            );
            const data = await res.json();
            const city = data?.address?.city || data?.address?.town || data?.address?.village || "";
            const province = data?.address?.state || "";
            if (city) {
              setCityInput(city);
              setFilters(prev => ({ ...prev, city, province_or_state: province }));
              localStorage.setItem('minest-last-city', city);
              localStorage.setItem('minest-last-province', province);
            }
          } catch {}
          setLocationDetected(true);
        },
        () => {
          // User declined — remember so we don't ask again
          localStorage.setItem('minest-geo-declined', 'true');
          setLocationDetected(true);
        },
        { timeout: 5000, maximumAge: 300000 }
      );
    }
  }, [seekerProfile, locationDetected]);

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
    if (hostFilter) q.owner_user_id = hostFilter;
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
  }, [filters, hostFilter]);

  const { data: allListings = [], isLoading, error, refetch } = useQuery({
    queryKey: ["listings", filterQuery, filters.sort],
    queryFn: async () => {
      try {
        return await entities.Listing.filter(filterQuery, filters.sort, 5000);
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
      if (filters.sort === "rent_normalized_monthly" || filters.sort === "-rent_normalized_monthly") {
        // Normalize all rent amounts to monthly equivalent for fair comparison
        const normalize = (listing) => {
          const amount = Number(listing.rent_amount) || Number(listing.monthly_rent) || 0;
          if (!amount) return listing.rent_normalized_monthly || 0;
          const period = listing.rent_period || 'monthly';
          if (period === 'daily') return amount * 30;
          if (period === 'weekly') return amount * 4.33;
          return listing.rent_normalized_monthly || amount;
        };
        const aNorm = normalize(a);
        const bNorm = normalize(b);
        return filters.sort === "rent_normalized_monthly" ? aNorm - bNorm : bNorm - aNorm;
      }
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

  // Real-time subscription removed — listings don't need live updates.
  // New listings show on next search or page refresh. This saves one WebSocket channel per user.

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
    if (key === "city") {
      localStorage.removeItem('minest-last-city');
      setCityInput("");
    }
    if (key === "province_or_state") localStorage.removeItem('minest-last-province');
    setLocationDetected(true);
    try { sessionStorage.setItem('minest-filters-cleared', '1'); } catch {}
  };

  const handleClearAllFilters = () => {
    setCityInput("");
    setFilters({ city: "", country: "", province_or_state: "", sort: "-created_at" });
    localStorage.removeItem('minest-last-city');
    localStorage.removeItem('minest-last-province');
    setLocationDetected(true);
    try { sessionStorage.setItem('minest-filters-cleared', '1'); } catch {}
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  // Listing grid content
  const listingGrid = (
    <>
      {isLoading && !error ? (
        <BrandedLoader messages={["Finding rooms near you...", "Checking availability...", "Almost ready..."]} />
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
          <div className="grid gap-3 sm:gap-4 w-full grid-cols-1 sm:grid-cols-2">
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

      {/* ─── Desktop: 50/50 Split (List | Map) ─── */}
      <div className="hidden lg:flex h-[calc(100vh-130px)]">
        {/* Left: Scrollable listing list */}
        <div className="w-1/2 xl:w-[55%] overflow-y-auto px-4 xl:px-6 py-4">
          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            {hostFilter ? (
              <div>
                <h2 className="text-lg font-bold text-foreground">Listings by this Host</h2>
                <p className="text-xs text-muted-foreground">
                  {allListings.length} listing{allListings.length !== 1 ? "s" : ""}
                  <Link to="/search" className="ml-2 text-accent hover:underline">← All listings</Link>
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isLoading ? "Loading..." : `${listings.length} listing${listings.length !== 1 ? "s" : ""} found`}
                {totalPages > 1 && <span className="ml-1">· Page {currentPage} of {totalPages}</span>}
              </p>
            )}
            <div className="flex items-center gap-2">
              <MobileDrawerSelect value={rentPeriodTab} onValueChange={setRentPeriodTab} className="w-28 h-8 text-xs" title="Period">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
              </MobileDrawerSelect>
              <MobileDrawerSelect value={filters.sort || "-created_at"} onValueChange={(v) => setFilters(prev => ({ ...prev, sort: v }))} className="w-32 h-8 text-xs" title="Sort">
                <SelectItem value="-created_at">Newest</SelectItem>
                <SelectItem value="rent_normalized_monthly">Price: Low</SelectItem>
                <SelectItem value="-rent_normalized_monthly">Price: High</SelectItem>
                <SelectItem value="-is_featured">Featured</SelectItem>
              </MobileDrawerSelect>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="mb-3">
              <ActiveFilterChips filters={filters} onRemoveFilter={handleRemoveFilter} onClearAll={handleClearAllFilters} />
            </div>
          )}

          {/* Listings */}
          {isLoading ? (
            <BrandedLoader messages={["Finding rooms near you...", "Checking availability...", "Almost ready..."]} />
          ) : listings.length === 0 ? (
            <div className="text-center py-16">
              <Search className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-base font-semibold mb-1">No rooms found</h3>
              <p className="text-sm text-muted-foreground mb-4">Try adjusting your filters.</p>
              <Button variant="outline" size="sm" onClick={handleClearAllFilters}>Clear filters</Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
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

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 mt-6 mb-4">
                  <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="h-8 px-2">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .reduce((acc, p, idx, arr) => {
                      if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) => item === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground text-xs">…</span>
                    ) : (
                      <Button key={item} variant={currentPage === item ? "default" : "outline"} size="sm"
                        onClick={() => handlePageChange(item)} className="h-8 w-8 p-0 text-xs">{item}</Button>
                    ))
                  }
                  <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="h-8 px-2">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Sticky Map */}
        <div className="w-1/2 xl:w-[45%] sticky top-0">
          {listings.length > 0 ? (
            <Suspense fallback={<div className="w-full h-full bg-muted/30 flex items-center justify-center"><div className="w-6 h-6 border-2 border-muted border-t-accent rounded-full animate-spin" /></div>}>
              <MapView listings={listings} filters={filters} activeListingId={hoveredListingId}
                onListingHover={setHoveredListingId} />
            </Suspense>
          ) : (
            <div className="w-full h-full bg-muted/30 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">No listings to show on map</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Mobile: Grid + floating map button ─── */}
      <div className="lg:hidden px-4 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          {hostFilter ? (
            <div>
              <h2 className="text-lg font-bold">Listings by this Host</h2>
              <p className="text-xs text-muted-foreground">
                {allListings.length} listing{allListings.length !== 1 ? "s" : ""}
                <Link to="/search" className="ml-2 text-accent hover:underline">← All</Link>
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Loading..." : `${listings.length} listing${listings.length !== 1 ? "s" : ""}`}
            </p>
          )}
          <div className="flex items-center gap-1.5">
            <MobileDrawerSelect value={rentPeriodTab} onValueChange={setRentPeriodTab} className="w-24 h-8 text-xs" title="Period">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
            </MobileDrawerSelect>
            <MobileDrawerSelect value={filters.sort || "-created_at"} onValueChange={(v) => setFilters(prev => ({ ...prev, sort: v }))} className="w-28 h-8 text-xs" title="Sort">
              <SelectItem value="-created_at">Newest</SelectItem>
              <SelectItem value="rent_normalized_monthly">Low $</SelectItem>
              <SelectItem value="-rent_normalized_monthly">High $</SelectItem>
            </MobileDrawerSelect>
          </div>
        </div>

        {activeFilterCount > 0 && (
          <div className="mb-3">
            <ActiveFilterChips filters={filters} onRemoveFilter={handleRemoveFilter} onClearAll={handleClearAllFilters} />
          </div>
        )}

        {listingGrid}
      </div>

      {/* Mobile floating map button */}
      {!mobileMapOpen && (
        <button onClick={() => setMobileMapOpen(true)}
          className="lg:hidden fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-5 py-3 rounded-full shadow-xl flex items-center gap-2 text-sm font-semibold hover:scale-105 active:scale-95 transition-transform">
          <Map className="w-4 h-4" /> Map
        </button>
      )}

      {/* Mobile full-screen map overlay */}
      {mobileMapOpen && (
        <div className="lg:hidden fixed inset-0 z-[100] bg-background">
          <div className="absolute top-0 left-0 right-0 z-[600] bg-card/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">{listings.length} listings</span>
            <button onClick={() => setMobileMapOpen(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground text-background text-xs font-medium">
              <List className="w-3.5 h-3.5" /> List
            </button>
          </div>
          <div className="w-full h-full pt-12">
            {listings.length > 0 && <Suspense fallback={<div className="w-full h-full flex items-center justify-center"><div className="w-6 h-6 border-2 border-muted border-t-accent rounded-full animate-spin" /></div>}><MapView listings={listings} filters={filters} isMobile={true}
              onListingHover={setHoveredListingId} /></Suspense>}
          </div>
        </div>
      )}
    </SearchLayout>
  );
}
