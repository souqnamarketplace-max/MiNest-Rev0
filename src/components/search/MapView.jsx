import React, { useMemo, useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L, { Icon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatCurrency } from "@/lib/geoHelpers";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { useCountry } from "@/lib/CountryContext";
import { getCurrencyByCountry } from "@/lib/pricingHelpers";

// Fix default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const geocodeCache = {};

async function geocodeCity(city, province) {
  const key = `${city},${province}`;
  if (geocodeCache[key]) return geocodeCache[key];
  const query = encodeURIComponent(`${city}, ${province}`);
  const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`);
  const data = await res.json();
  if (data.length > 0) {
    const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    geocodeCache[key] = coords;
    return coords;
  }
  return null;
}


// Auto-zoom map based on filters
function MapController({ filters, resolvedListings }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const geocodeAndFly = async (query, zoom) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=ca,us`
        );
        const data = await res.json();
        if (data[0]) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          // Use bounding box if available for better zoom
          if (data[0].boundingbox) {
            const [s, n, w, e] = data[0].boundingbox.map(parseFloat);
            map.fitBounds([[s, w], [n, e]], { padding: [30, 30], maxZoom: zoom });
          } else {
            map.flyTo([lat, lng], zoom, { animate: true, duration: 1 });
          }
        }
      } catch {}
    };

    if (filters?.city) {
      // Zoom to city
      const q = filters.province_or_state
        ? `${filters.city}, ${filters.province_or_state}, ${filters.country || 'Canada'}`
        : `${filters.city}, Canada`;
      geocodeAndFly(q, 13);
    } else if (filters?.province_or_state) {
      // Zoom to province
      const q = `${filters.province_or_state}, ${filters.country || 'Canada'}`;
      geocodeAndFly(q, 7);
    } else if (filters?.country === 'United States') {
      map.flyTo([39.5, -98.35], 4, { animate: true, duration: 1 });
    } else if (resolvedListings.length > 0) {
      // Fit to all markers
      const bounds = resolvedListings.map(l => [l._lat, l._lng]);
      if (bounds.length === 1) {
        map.flyTo(bounds[0], 13, { animate: true, duration: 1 });
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    } else {
      // Default: Canada
      map.flyTo([56.1304, -106.3468], 4, { animate: true, duration: 1 });
    }
  }, [filters?.city, filters?.province_or_state, filters?.country, resolvedListings.length]);

  return null;
}

export default function MapView({ listings, filters }) {
  const { country, convertPrice } = useCountry();
  const currency = getCurrencyByCountry(country);
  const [resolvedListings, setResolvedListings] = useState([]);

  useEffect(() => {
    if (!listings || listings.length === 0) {
      setResolvedListings([]);
      return;
    }

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
      setResolvedListings(results.filter(Boolean));
    };

    resolve();
  }, [listings])

  const center = useMemo(() => {
    if (resolvedListings.length === 0) return [53.5, -113.5];
    const avgLat = resolvedListings.reduce((sum, l) => sum + l._lat, 0) / resolvedListings.length;
    const avgLng = resolvedListings.reduce((sum, l) => sum + l._lng, 0) / resolvedListings.length;
    return [avgLat, avgLng];
  }, [resolvedListings]);

  return (
    <div className="w-full h-full rounded-lg overflow-hidden border border-border isolation-isolate" style={{ touchAction: "none" }}>
      <MapContainer
        center={center}
        zoom={filters?.city ? 13 : filters?.province_or_state ? 7 : 5}
        touchZoom={true}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%", position: "relative", zIndex: 10, touchAction: "none" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        <MapController filters={filters} resolvedListings={resolvedListings} />
        {resolvedListings.map(listing => (
          <Marker
            key={listing.id}
            position={[listing._lat, listing._lng]}
            icon={new Icon({
              iconUrl: listing.is_featured
                ? "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png"
                : listing.is_boosted
                ? "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png"
                : "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
              shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41],
            })}
          >
            <Popup className="w-48">
              <Link to={`/listing/${listing.slug || listing.id}`} className="block">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm truncate">{listing.title}</h4>
                  <p className="text-lg font-bold text-accent">
                    {`$${listing.rent_amount || listing.monthly_rent ? convertPrice(listing.rent_amount || listing.monthly_rent).toLocaleString() : 0} ${currency}`}/mo
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {listing.city}, {listing.province_or_state}
                  </p>
                  <button className="text-xs text-accent hover:underline">View Details →</button>
                </div>
              </Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}