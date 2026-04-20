/**
 * AddressAutocomplete — reusable address picker using Nominatim (OpenStreetMap)
 * Free, no API key required. Debounced search, keyboard navigation.
 *
 * Props:
 *   value         — current street address string
 *   onChange      — called with { street_address, city, neighborhood, province_or_state, country, postal_or_zip, latitude, longitude }
 *   placeholder   — input placeholder
 *   countryFilter — optional ISO country code to bias results e.g. "ca" or "us"
 *   className     — extra classes for the input
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";

// Nominatim country code map
const COUNTRY_CODES = { Canada: "ca", "United States": "us", USA: "us" };

function parseNominatimResult(result) {
  const a = result.address || {};

  const street_number = a.house_number || "";
  const street_name = a.road || a.pedestrian || a.footway || "";
  const street_address = [street_number, street_name].filter(Boolean).join(" ");

  const city =
    a.city || a.town || a.village || a.municipality || a.county || "";
  const neighborhood =
    a.neighbourhood || a.suburb || a.quarter || "";
  const province_or_state = a.state || a.province || "";
  const country = a.country || "";
  const postal_or_zip = a.postcode || "";
  const latitude = parseFloat(result.lat);
  const longitude = parseFloat(result.lon);
  const display = result.display_name || "";

  return {
    street_address,
    city,
    neighborhood,
    province_or_state,
    country,
    postal_or_zip,
    latitude,
    longitude,
    display,
  };
}

export default function AddressAutocomplete({
  value = "",
  onChange,
  placeholder = "Start typing an address...",
  countryFilter,
  className = "",
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Sync external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback(async (q) => {
    if (!q || q.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    try {
      let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6`;
      if (countryFilter) url += `&countrycodes=${countryFilter}`;
      else url += `&countrycodes=ca,us`; // Default to Canada + USA

      const res = await fetch(url, {
        headers: { "Accept-Language": "en" },
      });
      const data = await res.json();
      setResults(data);
      setOpen(data.length > 0);
      setActiveIndex(-1);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [countryFilter]);

  const handleInput = (e) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 400);
  };

  const handleSelect = (result) => {
    const parsed = parseNominatimResult(result);
    setQuery(parsed.street_address || parsed.display.split(",")[0]);
    setOpen(false);
    setResults([]);
    onChange?.(parsed);
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className={`pl-9 ${className}`}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {results.map((result, i) => {
            const parsed = parseNominatimResult(result);
            const line1 = parsed.street_address || result.display_name.split(",")[0];
            const line2 = [parsed.city, parsed.province_or_state, parsed.country]
              .filter(Boolean).join(", ");
            return (
              <li
                key={result.place_id}
                onMouseDown={() => handleSelect(result)}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border last:border-0 ${
                  i === activeIndex ? "bg-accent/10" : "hover:bg-muted/50"
                }`}
              >
                <MapPin className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{line1}</p>
                  <p className="text-xs text-muted-foreground truncate">{line2}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
