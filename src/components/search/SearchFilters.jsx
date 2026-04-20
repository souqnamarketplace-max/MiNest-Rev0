import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RotateCcw } from "lucide-react";
import { LISTING_TYPES, PROPERTY_TYPES, FURNISHING_OPTIONS } from "@/lib/config";
import { getRegionsForCountry } from "@/lib/geoHelpers";
import { getNormalizedMonthlyPrice, getCurrencyByCountry } from "@/lib/pricingHelpers";
import { useCountry } from "@/lib/CountryContext";
import { matchesParkingFilter } from "@/lib/parkingHelpers";

const defaultFilters = {
  country: "", province_or_state: "", city: "",
  listing_type: "", property_type: "", furnishing: "",
  price_min: "", price_max: "",
  bills_included: false, parking_available: false, internet_included: false,
  pets_allowed: false, smoking_allowed: false, student_friendly: false,
  lgbtq_friendly: false, couples_allowed: false,
  sort: "-created_at",
};

function SearchFiltersComponent({ filters, onFiltersChange }) {
  const { country } = useCountry();
  const [cityInput, setCityInput] = useState(filters.city || "");
  const debounceTimer = useRef(null);
  
  // Memoize currentFilters to prevent focus loss
  // Use global country as fallback if filter country not set
  const currentFilters = useMemo(() => ({
    ...defaultFilters,
    ...filters,
    // If no country filter set, display the global country
    country: filters.country || country || "",
  }), [filters, country]);
  const regions = useMemo(() => currentFilters.country ? getRegionsForCountry(currentFilters.country) : [], [currentFilters.country]);

  // Sync cityInput with filter prop when filters change
  useEffect(() => {
    setCityInput(filters.city || "");
  }, [filters.city]);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      updateFilter("city", cityInput);
    }, 300);
    return () => clearTimeout(debounceTimer.current);
  }, [cityInput]);

  const updateFilter = useCallback((key, value) => {
    const updated = { ...currentFilters, [key]: value };
    if (key === "country") { updated.province_or_state = ""; }
    onFiltersChange(updated);
  }, [currentFilters, onFiltersChange]);

  const resetFilters = useCallback(() => onFiltersChange(defaultFilters), [onFiltersChange]);

  const activeCount = useMemo(() => Object.entries(currentFilters).filter(
    ([k, v]) => v && v !== "" && v !== false && k !== "sort" && defaultFilters[k] !== v
  ).length, [currentFilters]);

  const filterContent = useMemo(() => (
    <div className="space-y-5">
      {/* Location */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Location</h4>
        <Select value={currentFilters.country || country} onValueChange={(v) => updateFilter("country", v)}>
          <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Canada">🇨🇦 Canada</SelectItem>
            <SelectItem value="United States">🇺🇸 United States</SelectItem>
          </SelectContent>
        </Select>
        {regions.length > 0 && (
          <Select value={currentFilters.province_or_state} onValueChange={(v) => updateFilter("province_or_state", v)}>
            <SelectTrigger><SelectValue placeholder="Province / State" /></SelectTrigger>
            <SelectContent>
              {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Input
          placeholder="City"
          value={cityInput}
          onChange={(e) => setCityInput(e.target.value)}
          autoComplete="off"
          name="search_filter_city"
        />
      </div>

      {/* Type */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Room Type</h4>
        <Select value={currentFilters.listing_type} onValueChange={(v) => updateFilter("listing_type", v)}>
          <SelectTrigger><SelectValue placeholder="Any type" /></SelectTrigger>
          <SelectContent>
            {LISTING_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={currentFilters.property_type} onValueChange={(v) => updateFilter("property_type", v)}>
          <SelectTrigger><SelectValue placeholder="Property type" /></SelectTrigger>
          <SelectContent>
            {PROPERTY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Rent Period */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Rent Period</h4>
        <Select value={currentFilters.rent_period} onValueChange={(v) => updateFilter("rent_period", v)}>
          <SelectTrigger><SelectValue placeholder="Any period" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Price - context aware based on rent period & country */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">
          Budget ({getCurrencyByCountry(currentFilters.country || country)}) {currentFilters.rent_period && `· ${currentFilters.rent_period}`}
        </h4>
        <div className="flex gap-2">
          <Input 
            type="number" 
            min="0"
            placeholder={`Min ${getCurrencyByCountry(currentFilters.country || country)}${currentFilters.rent_period === "daily" ? "/day" : currentFilters.rent_period === "weekly" ? "/week" : ""}`} 
            value={currentFilters.price_min} 
            onChange={(e) => updateFilter("price_min", e.target.value < 0 ? "" : e.target.value)}
            autoComplete="off"
            name="search_filter_price_min"
          />
          <Input 
            type="number" 
            min="0"
            placeholder={`Max ${getCurrencyByCountry(currentFilters.country || country)}${currentFilters.rent_period === "daily" ? "/day" : currentFilters.rent_period === "weekly" ? "/week" : ""}`} 
            value={currentFilters.price_max} 
            onChange={(e) => updateFilter("price_max", e.target.value < 0 ? "" : e.target.value)}
            autoComplete="off"
            name="search_filter_price_max"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {!currentFilters.rent_period 
            ? "Enter your budget" 
            : currentFilters.rent_period === "monthly"
            ? "Enter monthly budget"
            : currentFilters.rent_period === "weekly"
            ? "Enter weekly budget"
            : "Enter daily budget"}
        </p>
      </div>

      {/* Furnishing */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Furnishing</h4>
        <Select value={currentFilters.furnishing} onValueChange={(v) => updateFilter("furnishing", v)}>
          <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
          <SelectContent>
            {FURNISHING_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Parking Filter */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Parking</h4>
        <Select value={currentFilters.parking_filter || "any"} onValueChange={(v) => updateFilter("parking_filter", v)}>
          <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any parking</SelectItem>
            <SelectItem value="available">Parking available</SelectItem>
            <SelectItem value="free_included">Free parking</SelectItem>
            <SelectItem value="paid_available">Paid parking</SelectItem>
            <SelectItem value="not_available">No parking</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Toggles */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Amenities & Preferences</h4>
        {[
          { key: "bills_included", label: "Bills Included" },
          { key: "internet_included", label: "Internet Included" },
          { key: "pets_allowed", label: "Pets Allowed" },
          { key: "smoking_allowed", label: "Smoking Allowed" },
          { key: "student_friendly", label: "Student Friendly" },
          { key: "lgbtq_friendly", label: "LGBTQ+ Friendly" },
          { key: "couples_allowed", label: "Couples Allowed" },
        ].map(toggle => (
          <div key={toggle.key} className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground">{toggle.label}</Label>
            <Switch checked={currentFilters[toggle.key]} onCheckedChange={(v) => updateFilter(toggle.key, v)} />
          </div>
        ))}
      </div>

      {/* Sort */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Sort By</h4>
        <Select value={currentFilters.sort} onValueChange={(v) => updateFilter("sort", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="-created_at">Newest</SelectItem>
            <SelectItem value="rent_normalized_monthly">Price: Low to High</SelectItem>
            <SelectItem value="-rent_normalized_monthly">Price: High to Low</SelectItem>
            <SelectItem value="-is_featured">Featured First</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button variant="outline" className="w-full" onClick={resetFilters}>
        <RotateCcw className="w-4 h-4 mr-2" /> Reset Filters
      </Button>
    </div>
  ), [currentFilters, regions, updateFilter, resetFilters]);

  return filterContent;
}

export default React.memo(SearchFiltersComponent);

function Badge({ children, variant, className }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
      variant === "secondary" ? "bg-muted text-muted-foreground" : "bg-accent/10 text-accent"
    } ${className || ""}`}>
      {children}
    </span>
  );
}