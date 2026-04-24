/**
 * JurisdictionPicker — a two-dropdown control for selecting the country
 * and province/state that will govern a rental agreement.
 *
 * Auto-detects from a listing when provided; user can override.
 * Highlights when their choice differs from the listing's location.
 */
import React, { useEffect, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, MapPin } from "lucide-react";
import {
  COUNTRIES,
  getJurisdictionsForCountry,
  detectJurisdictionFromListing,
  findJurisdiction,
} from "@/lib/jurisdictions";

export default function JurisdictionPicker({
  country,               // 'CA' | 'US'
  jurisdictionCode,      // e.g. 'ON' or 'CA' (state/province code)
  onChange,              // (next: { country, jurisdictionCode, jurisdictionName }) => void
  listing,               // optional — used to auto-detect initial value
  className = "",
  compact = false,       // if true, render inline; otherwise render as labelled section
}) {
  const jurisdictions = useMemo(() => getJurisdictionsForCountry(country), [country]);
  const selectedJurisdiction = useMemo(
    () => findJurisdiction(country, jurisdictionCode),
    [country, jurisdictionCode]
  );

  // Auto-detect on first mount if nothing selected yet and a listing is provided
  useEffect(() => {
    if (country && jurisdictionCode) return;  // already chosen
    if (!listing) return;
    const detected = detectJurisdictionFromListing(listing);
    if (detected.country && detected.jurisdiction) {
      onChange({
        country: detected.country,
        jurisdictionCode: detected.jurisdiction.code,
        jurisdictionName: detected.jurisdiction.name,
      });
    } else if (detected.country) {
      onChange({ country: detected.country, jurisdictionCode: "", jurisdictionName: "" });
    }
    // Only run when listing arrives / initial values are empty.
     
  }, [listing]);

  const handleCountry = (newCountry) => {
    // When country changes, clear the jurisdiction (previous code is invalid for new country)
    onChange({ country: newCountry, jurisdictionCode: "", jurisdictionName: "" });
  };

  const handleJurisdiction = (code) => {
    const j = findJurisdiction(country, code);
    onChange({
      country,
      jurisdictionCode: code,
      jurisdictionName: j?.name || code,
    });
  };

  // Compare selection to listing location to surface a gentle warning if they differ
  const listingDetected = useMemo(() => detectJurisdictionFromListing(listing), [listing]);
  const mismatch =
    listing &&
    listingDetected.country &&
    (listingDetected.country !== country ||
      (listingDetected.jurisdiction?.code && listingDetected.jurisdiction.code !== jurisdictionCode));

  const containerClass = compact
    ? `grid grid-cols-2 gap-3 ${className}`
    : `space-y-3 ${className}`;

  return (
    <div className={containerClass}>
      {!compact && (
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <MapPin className="w-3.5 h-3.5" />
          Governing jurisdiction
        </div>
      )}

      <div className={compact ? "" : "grid grid-cols-2 gap-3"}>
        {/* Country */}
        <div>
          {!compact && (
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
              Country
            </label>
          )}
          <Select value={country || ""} onValueChange={handleCountry}>
            <SelectTrigger aria-label="Country">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  <span className="inline-flex items-center gap-2">
                    <span>{c.flag}</span>
                    <span>{c.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Province / State */}
        <div>
          {!compact && (
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
              {country === "CA" ? "Province / Territory" : country === "US" ? "State" : "Region"}
            </label>
          )}
          <Select
            value={jurisdictionCode || ""}
            onValueChange={handleJurisdiction}
            disabled={!country}
          >
            <SelectTrigger aria-label="Jurisdiction">
              <SelectValue placeholder={country ? "Select…" : "Select country first"} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {jurisdictions.map((j) => (
                <SelectItem key={j.code} value={j.code}>
                  {j.name}
                  {j.requiresStandardForm && (
                    <span className="ml-2 text-[10px] text-accent">
                      · Official form {j.requiresStandardForm}
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Context badge about the selected jurisdiction (not legal advice) */}
      {selectedJurisdiction && !compact && (
        <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 leading-relaxed">
          <span className="font-semibold text-foreground">{selectedJurisdiction.name}</span>
          {selectedJurisdiction.requiresStandardForm && (
            <span> — standard form required: <span className="font-mono">{selectedJurisdiction.requiresStandardForm}</span>.</span>
          )}
          {selectedJurisdiction.depositMax && (
            <span> Security deposit limit: {selectedJurisdiction.depositMax}.</span>
          )}
          {selectedJurisdiction.leadNotice && (
            <span> Lead-paint disclosure required for pre-1978 buildings.</span>
          )}
          {selectedJurisdiction.floodDisclosure && (
            <span> Flood-zone disclosure required.</span>
          )}
          {selectedJurisdiction.bedbugDisclosure && (
            <span> Bedbug history disclosure required.</span>
          )}
        </div>
      )}

      {/* Mismatch warning */}
      {mismatch && (
        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            This differs from the listing&apos;s location
            {listingDetected.jurisdiction
              ? ` (${listingDetected.jurisdiction.name}, ${listingDetected.country})`
              : ` (${listingDetected.country || "unknown"})`}
            . Only change this if the rental is actually governed by a different jurisdiction.
          </span>
        </div>
      )}
    </div>
  );
}
