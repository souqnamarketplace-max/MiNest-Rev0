import React, { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SlidersHorizontal, X, ChevronDown } from "lucide-react";
import MobileDrawerSelect from "@/components/ui/mobile-drawer-select";
import { useCountry } from "@/lib/CountryContext";
import { getRegionsForCountry } from "@/lib/geoHelpers";
import { LISTING_TYPES, PROPERTY_TYPES, FURNISHING_OPTIONS, LAUNDRY_OPTIONS, FLOOR_LEVEL_OPTIONS, AC_HEATING_OPTIONS } from "@/lib/config";

export default function SearchLayout({ filters, onFiltersChange, children, activeFilterCount = 0 }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const { country } = useCountry();

  const regions = useMemo(() => getRegionsForCountry(filters.country || country), [filters.country, country]);

  const updateFilter = (key, value) => {
    onFiltersChange(prev => {
      const next = { ...prev, [key]: value };
      if (key === "country") {
        next.province_or_state = "";
        next.city = "";
      }
      return next;
    });
  };

  const advancedCount = [
    filters.furnishing, filters.laundry, filters.floor_level, filters.ac_heating,
    filters.parking_status, filters.bills_included, filters.internet_included,
    filters.pets_allowed, filters.smoking_allowed, filters.student_friendly,
    filters.lgbtq_friendly, filters.couples_allowed, filters.booking_mode,
  ].filter(Boolean).length;

  const clearAdvanced = () => {
    onFiltersChange(prev => ({
      ...prev,
      furnishing: "", laundry: "", floor_level: "", ac_heating: "",
      parking_status: "", bills_included: false, internet_included: false,
      pets_allowed: false, smoking_allowed: false, student_friendly: false,
      lgbtq_friendly: false, couples_allowed: false, booking_mode: "",
      price_min: "", price_max: "",
    }));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ─── Top Filter Bar ─── */}
      <div className="bg-card border-b border-border sticky top-16 z-30">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6">
          {/* Desktop: horizontal pills */}
          <div className="hidden lg:flex items-center gap-2 py-3">
            <MobileDrawerSelect
              value={filters.country || country || ""}
              onValueChange={(v) => updateFilter("country", v)}
              className="w-40 h-9"
              title="Country"
            >
              <SelectItem value="Canada">🍁 Canada</SelectItem>
              <SelectItem value="United States">🇺🇸 United States</SelectItem>
            </MobileDrawerSelect>

            <MobileDrawerSelect
              value={filters.province_or_state || ""}
              onValueChange={(v) => updateFilter("province_or_state", v)}
              className="w-44 h-9"
              title="Province / State"
            >
              <SelectItem value="">All</SelectItem>
              {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </MobileDrawerSelect>

            <div className="relative">
              <Input
                placeholder="City"
                value={filters.city || ""}
                onChange={(e) => updateFilter("city", e.target.value)}
                className="w-36 h-9 text-sm"
              />
            </div>

            <div className="w-px h-6 bg-border mx-1" />

            <MobileDrawerSelect
              value={filters.listing_type || ""}
              onValueChange={(v) => updateFilter("listing_type", v)}
              className="w-36 h-9"
              title="Room Type"
            >
              <SelectItem value="">Any type</SelectItem>
              {LISTING_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </MobileDrawerSelect>

            <MobileDrawerSelect
              value={filters.property_type || ""}
              onValueChange={(v) => updateFilter("property_type", v)}
              className="w-36 h-9"
              title="Property"
            >
              <SelectItem value="">Any property</SelectItem>
              {PROPERTY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </MobileDrawerSelect>

            <div className="flex items-center gap-1">
              <Input
                type="number"
                placeholder="Min $"
                value={filters.price_min || ""}
                onChange={(e) => updateFilter("price_min", e.target.value)}
                className="w-24 h-9 text-sm"
              />
              <span className="text-muted-foreground text-xs">–</span>
              <Input
                type="number"
                placeholder="Max $"
                value={filters.price_max || ""}
                onChange={(e) => updateFilter("price_max", e.target.value)}
                className="w-24 h-9 text-sm"
              />
            </div>

            <div className="w-px h-6 bg-border mx-1" />

            {/* More Filters button */}
            <Button
              variant={advancedCount > 0 ? "default" : "outline"}
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => setMoreOpen(true)}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              More
              {advancedCount > 0 && (
                <span className="bg-white/20 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {advancedCount}
                </span>
              )}
            </Button>

            {(activeFilterCount > 0) && (
              <button
                onClick={clearAdvanced}
                className="text-xs text-muted-foreground hover:text-foreground ml-1"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Mobile: compact filter row */}
          <div className="flex lg:hidden items-center gap-2 py-2.5 overflow-x-auto scrollbar-none">
            <MobileDrawerSelect
              value={filters.country || country || ""}
              onValueChange={(v) => updateFilter("country", v)}
              className="w-32 h-9 shrink-0"
              title="Country"
            >
              <SelectItem value="Canada">🍁 Canada</SelectItem>
              <SelectItem value="United States">🇺🇸 US</SelectItem>
            </MobileDrawerSelect>

            <Input
              placeholder="City"
              value={filters.city || ""}
              onChange={(e) => updateFilter("city", e.target.value)}
              className="w-28 h-9 text-sm shrink-0"
            />

            <MobileDrawerSelect
              value={filters.listing_type || ""}
              onValueChange={(v) => updateFilter("listing_type", v)}
              className="w-32 h-9 shrink-0"
              title="Type"
            >
              <SelectItem value="">Any type</SelectItem>
              {LISTING_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </MobileDrawerSelect>

            <Button
              variant={advancedCount > 0 ? "default" : "outline"}
              size="sm"
              className="h-9 gap-1 shrink-0"
              onClick={() => setMoreOpen(true)}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {advancedCount > 0 && (
                <span className="bg-white/20 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {advancedCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Content Area ─── */}
      <div className="flex-1">
        {children}
      </div>

      {/* ─── Advanced Filters Drawer ─── */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="right" className="w-full sm:w-96 overflow-y-auto p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg">More Filters</SheetTitle>
              {advancedCount > 0 && (
                <button onClick={clearAdvanced} className="text-xs text-accent hover:underline">
                  Clear all
                </button>
              )}
            </div>
          </SheetHeader>

          <div className="px-6 py-5 space-y-6">
            {/* Budget */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Budget</Label>
              <div className="flex items-center gap-2">
                <Input type="number" placeholder="Min" value={filters.price_min || ""}
                  onChange={(e) => updateFilter("price_min", e.target.value)} className="h-9" />
                <span className="text-muted-foreground">–</span>
                <Input type="number" placeholder="Max" value={filters.price_max || ""}
                  onChange={(e) => updateFilter("price_max", e.target.value)} className="h-9" />
              </div>
            </div>

            {/* Province */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Province / State</Label>
              <Select value={filters.province_or_state || ""} onValueChange={(v) => updateFilter("province_or_state", v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Property Type */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Property Type</Label>
              <Select value={filters.property_type || ""} onValueChange={(v) => updateFilter("property_type", v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  {PROPERTY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Furnishing */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Furnishing</Label>
              <Select value={filters.furnishing || ""} onValueChange={(v) => updateFilter("furnishing", v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  {FURNISHING_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Laundry */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Laundry</Label>
              <Select value={filters.laundry || ""} onValueChange={(v) => updateFilter("laundry", v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  {LAUNDRY_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Floor */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Floor Level</Label>
              <Select value={filters.floor_level || ""} onValueChange={(v) => updateFilter("floor_level", v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  {FLOOR_LEVEL_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* AC/Heating */}
            <div>
              <Label className="text-sm font-medium mb-2 block">AC / Heating</Label>
              <Select value={filters.ac_heating || ""} onValueChange={(v) => updateFilter("ac_heating", v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  {AC_HEATING_OPTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Toggle amenities */}
            <div className="space-y-3 pt-2 border-t border-border">
              <Label className="text-sm font-medium block">Amenities & Preferences</Label>
              {[
                { key: "bills_included", label: "Bills Included" },
                { key: "internet_included", label: "Internet Included" },
                { key: "pets_allowed", label: "Pets Allowed" },
                { key: "smoking_allowed", label: "Smoking Allowed" },
                { key: "student_friendly", label: "Student Friendly" },
                { key: "lgbtq_friendly", label: "LGBTQ+ Friendly" },
                { key: "couples_allowed", label: "Couples Allowed" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="text-sm text-foreground">{label}</Label>
                  <Switch
                    checked={!!filters[key]}
                    onCheckedChange={(v) => updateFilter(key, v || false)}
                  />
                </div>
              ))}
            </div>
          </div>

          <SheetFooter className="sticky bottom-0 px-6 py-4 border-t border-border bg-card">
            <Button className="w-full h-11" onClick={() => setMoreOpen(false)}>
              Show Results
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
