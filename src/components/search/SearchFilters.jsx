import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RotateCcw, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import {
  LISTING_TYPES, PROPERTY_TYPES, FURNISHING_OPTIONS,
  FLOOR_LEVEL_OPTIONS, LAUNDRY_OPTIONS, AC_HEATING_OPTIONS,
} from "@/lib/config";
import { getRegionsForCountry } from "@/lib/geoHelpers";
import { getCurrencyByCountry } from "@/lib/pricingHelpers";
import { useCountry } from "@/lib/CountryContext";

const defaultFilters = {
  country: "", province_or_state: "", city: "",
  listing_type: "", property_type: "", furnishing: "",
  price_min: "", price_max: "", rent_period: "",
  bills_included: false, parking_available: false,
  internet_included: false, pets_allowed: false,
  smoking_allowed: false, student_friendly: false,
  lgbtq_friendly: false, couples_allowed: false,
  laundry: "", floor_level: "", ac_heating: "",
  parking_filter: "",
  checkin_date: "", checkout_date: "",
  booking_mode: "",
  sort: "-created_at",
};

function SearchFiltersComponent({ filters, onFiltersChange }) {
  const { country } = useCountry();
  const [cityInput, setCityInput] = useState(filters.city || "");
  const [showMore, setShowMore] = useState(false);
  const debounceTimer = useRef(null);

  const currentFilters = useMemo(() => ({
    ...defaultFilters,
    ...filters,
    country: filters.country || country || "",
  }), [filters, country]);

  const isDaily = currentFilters.rent_period === "daily";
  const isWeekly = currentFilters.rent_period === "weekly";

  const regions = useMemo(() =>
    currentFilters.country ? getRegionsForCountry(currentFilters.country) : [],
    [currentFilters.country]
  );

  useEffect(() => { setCityInput(filters.city || ""); }, [filters.city]);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { updateFilter("city", cityInput); }, 300);
    return () => clearTimeout(debounceTimer.current);
  }, [cityInput]);

  const updateFilter = useCallback((key, value) => {
    const updated = { ...currentFilters, [key]: value };
    if (key === "country") updated.province_or_state = "";
    // Reset daily-specific fields when switching away from daily
    if (key === "rent_period" && value !== "daily") {
      updated.checkin_date = "";
      updated.checkout_date = "";
      updated.booking_mode = "";
    }
    onFiltersChange(updated);
  }, [currentFilters, onFiltersChange]);

  const resetFilters = useCallback(() => onFiltersChange(defaultFilters), [onFiltersChange]);

  const budgetLabel = useMemo(() => {
    const curr = getCurrencyByCountry(currentFilters.country || country);
    if (isDaily) return `Budget (${curr}/night)`;
    if (isWeekly) return `Budget (${curr}/week)`;
    return `Budget (${curr})`;
  }, [currentFilters.country, country, isDaily, isWeekly]);

  return (
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
            <SelectContent>{regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <Input placeholder="City" value={cityInput} onChange={(e) => setCityInput(e.target.value)}
          autoComplete="off" name="search_filter_city" />
      </div>

      {/* Type */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Room Type</h4>
        <Select value={currentFilters.listing_type} onValueChange={(v) => updateFilter("listing_type", v)}>
          <SelectTrigger><SelectValue placeholder="Any type" /></SelectTrigger>
          <SelectContent>{LISTING_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={currentFilters.property_type} onValueChange={(v) => updateFilter("property_type", v)}>
          <SelectTrigger><SelectValue placeholder="Property type" /></SelectTrigger>
          <SelectContent>{PROPERTY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
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

      {/* Daily-specific: Date range + booking mode */}
      {isDaily && (
        <div className="space-y-3 bg-accent/5 border border-accent/20 rounded-xl p-3">
          <h4 className="text-sm font-semibold text-accent flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Daily rental filters
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Check-in</label>
              <Input type="date" className="mt-1 h-8 text-xs"
                value={currentFilters.checkin_date}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => updateFilter("checkin_date", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Check-out</label>
              <Input type="date" className="mt-1 h-8 text-xs"
                value={currentFilters.checkout_date}
                min={currentFilters.checkin_date || new Date().toISOString().split('T')[0]}
                onChange={(e) => updateFilter("checkout_date", e.target.value)} />
            </div>
          </div>
          <Select value={currentFilters.booking_mode} onValueChange={(v) => updateFilter("booking_mode", v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any booking type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="inquiry">Inquiry only</SelectItem>
              <SelectItem value="booking_required">Instant booking</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Budget */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">{budgetLabel}</h4>
        <div className="flex gap-2">
          <Input type="number" min="0"
            placeholder={isDaily ? "Min/night" : isWeekly ? "Min/week" : "Min"}
            value={currentFilters.price_min}
            onChange={(e) => updateFilter("price_min", e.target.value < 0 ? "" : e.target.value)}
            autoComplete="off" name="search_filter_price_min" />
          <Input type="number" min="0"
            placeholder={isDaily ? "Max/night" : isWeekly ? "Max/week" : "Max"}
            value={currentFilters.price_max}
            onChange={(e) => updateFilter("price_max", e.target.value < 0 ? "" : e.target.value)}
            autoComplete="off" name="search_filter_price_max" />
        </div>
      </div>

      {/* Furnishing */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Furnishing</h4>
        <Select value={currentFilters.furnishing} onValueChange={(v) => updateFilter("furnishing", v)}>
          <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
          <SelectContent>{FURNISHING_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Parking */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Parking</h4>
        <Select value={currentFilters.parking_filter || ""} onValueChange={(v) => updateFilter("parking_filter", v)}>
          <SelectTrigger><SelectValue placeholder="Any parking" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="available">Parking available</SelectItem>
            <SelectItem value="free_included">Free parking</SelectItem>
            <SelectItem value="paid_available">Paid parking</SelectItem>
            <SelectItem value="not_available">No parking</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* More filters toggle */}
      <button onClick={() => setShowMore(!showMore)}
        className="flex items-center gap-1 text-sm text-accent hover:underline w-full justify-center py-1">
        {showMore ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        {showMore ? "Fewer filters" : "More filters"}
      </button>

      {showMore && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Property Features</h4>
          <Select value={currentFilters.laundry} onValueChange={(v) => updateFilter("laundry", v)}>
            <SelectTrigger><SelectValue placeholder="Laundry" /></SelectTrigger>
            <SelectContent>{LAUNDRY_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={currentFilters.floor_level} onValueChange={(v) => updateFilter("floor_level", v)}>
            <SelectTrigger><SelectValue placeholder="Floor level" /></SelectTrigger>
            <SelectContent>{FLOOR_LEVEL_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={currentFilters.ac_heating} onValueChange={(v) => updateFilter("ac_heating", v)}>
            <SelectTrigger><SelectValue placeholder="AC / Heating" /></SelectTrigger>
            <SelectContent>{AC_HEATING_OPTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

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
  );
}

export default React.memo(SearchFiltersComponent);
