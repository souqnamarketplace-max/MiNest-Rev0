import React, { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";
import { MapPin, Bed, Bath, Heart, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useCountry } from "@/lib/CountryContext";
import { getCurrencyByCountry, formatRentPrice, getPeriodShort } from "@/lib/pricingHelpers";

// Fix default markers
delete L.Icon.Default.prototype._getIconUrl;

// Geocode cache
const geocodeCache = {};
async function geocodeCity(city, province) {
  const key = `${city},${province}`;
  if (geocodeCache[key]) return geocodeCache[key];
  try {
    const query = encodeURIComponent(`${city}, ${province}`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`);
    const data = await res.json();
    if (data.length > 0) {
      const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      geocodeCache[key] = coords;
      return coords;
    }
  } catch {}
  return null;
}

// Color config by listing type
const TYPE_COLORS = {
  private_room: { bg: "#16a34a", border: "#15803d", label: "Private" },
  shared_room: { bg: "#2563eb", border: "#1d4ed8", label: "Shared" },
  entire_place: { bg: "#ea580c", border: "#c2410c", label: "Entire" },
};

const PERIOD_SHORT = { monthly: "/mo", weekly: "/wk", daily: "/nt" };

// Create a price label icon (custom HTML marker)
function createPriceIcon(listing, currency, convertPrice, isActive = false, isHovered = false) {
  const typeColor = TYPE_COLORS[listing.listing_type] || TYPE_COLORS.private_room;
  const price = convertPrice
    ? convertPrice(listing.rent_amount || listing.monthly_rent || 0)
    : Math.round(listing.rent_amount || listing.monthly_rent || 0);
  const period = PERIOD_SHORT[listing.rent_period] || "/mo";
  const priceText = `$${price.toLocaleString()}${period}`;

  const scale = isActive ? 1.1 : isHovered ? 1.05 : 1;
  const zIndex = isActive ? 1000 : isHovered ? 500 : 1;
  const shadow = isActive ? "0 4px 12px rgba(0,0,0,0.3)" : isHovered ? "0 2px 8px rgba(0,0,0,0.2)" : "0 1px 4px rgba(0,0,0,0.15)";
  const bg = isActive ? "#0f172a" : typeColor.bg;
  const textColor = "#fff";

  return L.divIcon({
    className: "price-marker",
    html: `<div style="
      background: ${bg};
      color: ${textColor};
      padding: 4px 8px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      box-shadow: ${shadow};
      transform: scale(${scale});
      transition: all 0.15s ease;
      cursor: pointer;
      border: 2px solid ${isActive ? '#fff' : 'rgba(255,255,255,0.3)'};
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.2;
      z-index: ${zIndex};
      position: relative;
    ">${priceText}</div>
    <div style="
      width: 0; height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 6px solid ${bg};
      margin: -1px auto 0;
    "></div>`,
    iconSize: [80, 36],
    iconAnchor: [40, 36],
    popupAnchor: [0, -38],
  });
}

// Cluster icon
function createClusterIcon(count) {
  const size = count > 50 ? 48 : count > 20 ? 42 : count > 10 ? 38 : 32;
  return L.divIcon({
    className: "cluster-marker",
    html: `<div style="
      background: #0f172a;
      color: #fff;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${count > 99 ? 11 : 13}px;
      font-weight: 700;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      border: 3px solid rgba(255,255,255,0.5);
      font-family: system-ui, -apple-system, sans-serif;
    ">${count > 99 ? "99+" : count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Simple clustering function (distance-based)
function clusterListings(listings, zoom) {
  // At very high zoom, never cluster
  if (zoom >= 15) return { markers: listings, clusters: [] };

  // Distance threshold decreases as zoom increases (tighter clusters when zoomed in)
  const thresholds = {
    3: 8, 4: 5, 5: 3, 6: 2, 7: 1.5, 8: 1, 9: 0.5,
    10: 0.2, 11: 0.1, 12: 0.05, 13: 0.02, 14: 0.01,
  };
  const gridSize = thresholds[Math.min(zoom, 14)] || 0.01;

  const grid = {};
  listings.forEach(l => {
    const key = `${Math.round(l._lat / gridSize) * gridSize},${Math.round(l._lng / gridSize) * gridSize}`;
    if (!grid[key]) grid[key] = [];
    grid[key].push(l);
  });

  const markers = [];
  const clusters = [];

  Object.values(grid).forEach(group => {
    if (group.length === 1) {
      markers.push(group[0]);
    } else {
      const avgLat = group.reduce((s, l) => s + l._lat, 0) / group.length;
      const avgLng = group.reduce((s, l) => s + l._lng, 0) / group.length;
      clusters.push({ lat: avgLat, lng: avgLng, count: group.length, listings: group });
    }
  });

  return { markers, clusters };
}

// Map controller
function MapController({ filters, resolvedListings, onBoundsChange, onZoomChange }) {
  const map = useMap();

  useMapEvents({
    moveend: () => {
      if (onBoundsChange) {
        const bounds = map.getBounds();
        onBoundsChange(bounds);
      }
    },
    zoomend: () => {
      if (onZoomChange) onZoomChange(map.getZoom());
    },
  });

  useEffect(() => {
    if (!map) return;

    const geocodeAndFly = async (query, zoom) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=ca,us`
        );
        const data = await res.json();
        if (data[0]) {
          if (data[0].boundingbox) {
            const [s, n, w, e] = data[0].boundingbox.map(parseFloat);
            map.fitBounds([[s, w], [n, e]], { padding: [30, 30], maxZoom: zoom });
          } else {
            map.flyTo([parseFloat(data[0].lat), parseFloat(data[0].lon)], zoom, { animate: true, duration: 1 });
          }
        }
      } catch {}
    };

    if (filters?.city) {
      const q = filters.province_or_state
        ? `${filters.city}, ${filters.province_or_state}, ${filters.country || 'Canada'}`
        : `${filters.city}, Canada`;
      geocodeAndFly(q, 13);
    } else if (filters?.province_or_state) {
      geocodeAndFly(`${filters.province_or_state}, ${filters.country || 'Canada'}`, 7);
    } else if (filters?.country === 'United States') {
      map.flyTo([39.5, -98.35], 4, { animate: true, duration: 1 });
    } else if (resolvedListings.length > 0) {
      const bounds = resolvedListings.map(l => [l._lat, l._lng]);
      if (bounds.length === 1) {
        map.flyTo(bounds[0], 13, { animate: true, duration: 1 });
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    } else {
      map.flyTo([56.1304, -106.3468], 4, { animate: true, duration: 1 });
    }
  }, [filters?.city, filters?.province_or_state, filters?.country, resolvedListings.length]);

  return null;
}

// Preview card component
function ListingPreview({ listing, currency, convertPrice, onClose }) {
  const price = formatRentPrice(
    listing.rent_amount || listing.monthly_rent,
    listing.rent_period || "monthly",
    currency,
    convertPrice
  );
  const roomType = listing.listing_type?.replace(/_/g, " ") || "Room";
  const typeColor = TYPE_COLORS[listing.listing_type] || TYPE_COLORS.private_room;

  return (
    <div className="bg-card rounded-xl border border-border shadow-xl overflow-hidden w-72 animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Image */}
      <div className="relative aspect-video bg-muted">
        {listing.cover_photo_url ? (
          <img src={listing.cover_photo_url} alt={listing.title}
            className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No image</div>
        )}
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose?.(); }}
          className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors">
          <X className="w-3 h-3" />
        </button>
        <div className="absolute bottom-2 left-2">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize text-white"
            style={{ background: typeColor.bg }}>
            {roomType}
          </span>
        </div>
      </div>

      {/* Content */}
      <Link to={`/listing/${listing.slug || listing.id}`} className="block p-3 space-y-1.5">
        <div className="text-lg font-bold text-accent">{price}</div>
        <h4 className="font-semibold text-foreground text-sm line-clamp-1">{listing.title}</h4>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{listing.city}, {listing.province_or_state}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
          {listing.bathroom_type && (
            <span className="flex items-center gap-1">
              <Bath className="w-3 h-3" />
              {listing.bathroom_type === "private" ? "Private bath" : "Shared bath"}
            </span>
          )}
          {listing.furnishing === "furnished" && <span>Furnished</span>}
          {listing.internet_included && <span>WiFi</span>}
        </div>
        <div className="text-xs text-accent font-medium pt-1">View details →</div>
      </Link>
    </div>
  );
}

// Legend component
function MapLegend() {
  return (
    <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur-sm rounded-lg border border-border shadow-lg p-2.5 z-[500] text-xs">
      <div className="flex items-center gap-3">
        {Object.entries(TYPE_COLORS).map(([type, config]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: config.bg }} />
            <span className="text-muted-foreground">{config.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MapView({ listings, filters, onListingHover, activeListingId, isMobile = false }) {
  const { country, convertPrice } = useCountry();
  const currency = getCurrencyByCountry(country);
  const [resolvedListings, setResolvedListings] = useState([]);
  const [selectedListing, setSelectedListing] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [zoom, setZoom] = useState(5);
  const [mobilePreviewIndex, setMobilePreviewIndex] = useState(0);

  // Resolve coordinates
  useEffect(() => {
    if (!listings || listings.length === 0) { setResolvedListings([]); return; }

    const resolve = async () => {
      const results = await Promise.all(
        listings.map(async (listing) => {
          if (listing.latitude && listing.longitude) {
            return { ...listing, _lat: listing.latitude, _lng: listing.longitude };
          }
          if (listing.city && listing.province_or_state) {
            const coords = await geocodeCity(listing.city, listing.province_or_state);
            if (coords) return { ...listing, _lat: coords.lat, _lng: coords.lng };
          }
          return null;
        })
      );
      setResolvedListings(results.filter(r => r && r._lat && r._lng && isFinite(r._lat) && isFinite(r._lng)));
    };
    resolve();
  }, [listings]);

  // Cluster pins based on zoom
  const { markers, clusters } = useMemo(() =>
    clusterListings(resolvedListings, zoom),
    [resolvedListings, zoom]
  );

  const center = useMemo(() => {
    if (resolvedListings.length === 0) return [53.5, -113.5];
    const avgLat = resolvedListings.reduce((s, l) => s + (l._lat || 0), 0) / resolvedListings.length;
    const avgLng = resolvedListings.reduce((s, l) => s + (l._lng || 0), 0) / resolvedListings.length;
    return [avgLat, avgLng];
  }, [resolvedListings]);

  // Sync active listing from parent (for split view hover)
  useEffect(() => {
    if (activeListingId) setHoveredId(activeListingId);
  }, [activeListingId]);

  const handleMarkerClick = useCallback((listing) => {
    setSelectedListing(listing);
    if (isMobile) {
      const idx = resolvedListings.findIndex(l => l.id === listing.id);
      if (idx >= 0) setMobilePreviewIndex(idx);
    }
  }, [isMobile, resolvedListings]);

  // Mobile swipe through listings
  const handleMobileNav = (dir) => {
    const newIdx = mobilePreviewIndex + dir;
    if (newIdx >= 0 && newIdx < resolvedListings.length) {
      setMobilePreviewIndex(newIdx);
      setSelectedListing(resolvedListings[newIdx]);
    }
  };

  return (
    <div className="w-full h-full relative rounded-xl overflow-hidden border border-border" style={{ touchAction: "none" }}>
      {/* Global styles for price markers */}
      <style>{`
        .price-marker { background: none !important; border: none !important; }
        .cluster-marker { background: none !important; border: none !important; }
        .leaflet-popup-content-wrapper { padding: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
        .leaflet-popup-content { margin: 0; min-width: 280px; }
        .leaflet-popup-tip { display: none; }
      `}</style>

      <MapContainer
        center={center}
        zoom={filters?.city ? 13 : filters?.province_or_state ? 7 : 5}
        touchZoom={true}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%", position: "relative", zIndex: 10 }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        />
        <MapController
          filters={filters}
          resolvedListings={resolvedListings}
          onZoomChange={setZoom}
        />

        {/* Individual markers with price labels */}
        {markers.map(listing => (
          <Marker
            key={listing.id}
            position={[listing._lat, listing._lng]}
            icon={createPriceIcon(
              listing, currency, convertPrice,
              selectedListing?.id === listing.id,
              hoveredId === listing.id
            )}
            eventHandlers={{
              click: () => handleMarkerClick(listing),
              mouseover: () => {
                setHoveredId(listing.id);
                onListingHover?.(listing.id);
              },
              mouseout: () => {
                setHoveredId(null);
                onListingHover?.(null);
              },
            }}
          >
            {!isMobile && (
              <Popup>
                <ListingPreview
                  listing={listing}
                  currency={currency}
                  convertPrice={convertPrice}
                  onClose={() => setSelectedListing(null)}
                />
              </Popup>
            )}
          </Marker>
        ))}

        {/* Cluster markers */}
        {clusters.map((cluster, i) => (
          <Marker
            key={`cluster-${i}`}
            position={[cluster.lat, cluster.lng]}
            icon={createClusterIcon(cluster.count)}
          />
        ))}
      </MapContainer>

      {/* Legend */}
      <MapLegend />

      {/* Listing count badge */}
      <div className="absolute top-4 left-4 bg-card/95 backdrop-blur-sm rounded-lg border border-border shadow-lg px-3 py-1.5 z-[500]">
        <span className="text-xs font-medium text-foreground">{resolvedListings.length} listing{resolvedListings.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Mobile bottom preview card */}
      {isMobile && selectedListing && (
        <div className="absolute bottom-0 left-0 right-0 z-[500] p-3 bg-gradient-to-t from-black/40 to-transparent">
          <div className="relative">
            {/* Nav arrows */}
            {mobilePreviewIndex > 0 && (
              <button onClick={() => handleMobileNav(-1)}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 z-10 w-8 h-8 bg-card rounded-full shadow-lg flex items-center justify-center">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {mobilePreviewIndex < resolvedListings.length - 1 && (
              <button onClick={() => handleMobileNav(1)}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 z-10 w-8 h-8 bg-card rounded-full shadow-lg flex items-center justify-center">
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            <Link to={`/listing/${selectedListing.slug || selectedListing.id}`}
              className="block bg-card rounded-xl border border-border shadow-xl overflow-hidden">
              <div className="flex gap-3 p-3">
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {selectedListing.cover_photo_url ? (
                    <img src={selectedListing.cover_photo_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No img</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-accent">
                    {formatRentPrice(selectedListing.rent_amount || selectedListing.monthly_rent, selectedListing.rent_period || "monthly", currency, convertPrice)}
                  </div>
                  <h4 className="font-semibold text-foreground text-sm line-clamp-1 mt-0.5">{selectedListing.title}</h4>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{selectedListing.city}, {selectedListing.province_or_state}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full capitalize text-white"
                      style={{ background: (TYPE_COLORS[selectedListing.listing_type] || TYPE_COLORS.private_room).bg }}>
                      {selectedListing.listing_type?.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              </div>
            </Link>

            {/* Close */}
            <button onClick={() => setSelectedListing(null)}
              className="absolute top-1 right-1 w-6 h-6 bg-card rounded-full shadow flex items-center justify-center">
              <X className="w-3 h-3" />
            </button>

            {/* Dots indicator */}
            <div className="flex justify-center gap-1 mt-2">
              {resolvedListings.slice(
                Math.max(0, mobilePreviewIndex - 2),
                Math.min(resolvedListings.length, mobilePreviewIndex + 3)
              ).map((l, i) => (
                <div key={l.id} className={`w-1.5 h-1.5 rounded-full ${
                  l.id === selectedListing.id ? "bg-accent" : "bg-white/50"
                }`} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
