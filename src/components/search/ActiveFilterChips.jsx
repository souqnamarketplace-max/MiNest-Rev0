import React from "react";
import { X } from "lucide-react";
import { LISTING_TYPES, PROPERTY_TYPES, FURNISHING_OPTIONS } from "@/lib/config";

/**
 * Displays active filters as removable chips
 * Allows quick removal without reopening filter panel
 */
export default function ActiveFilterChips({ filters, onRemoveFilter, onClearAll }) {
  if (!filters || Object.keys(filters).length === 0) return null;

  // Map filter keys to display labels
  const getFilterLabel = (key, value) => {
    if (!value || value === "" || value === false) return null;
    if (key === "sort") return null;

    const labelMap = {
      country: () => value,
      province_or_state: () => value,
      city: () => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase(),
      listing_type: () => {
        const type = LISTING_TYPES.find(t => t.value === value);
        return type?.label || value;
      },
      property_type: () => {
        const type = PROPERTY_TYPES.find(t => t.value === value);
        return type?.label || value;
      },
      furnishing: () => {
        const furn = FURNISHING_OPTIONS.find(f => f.value === value);
        return furn?.label || value;
      },
      price_min: () => `$${value}+`,
      price_max: () => `Up to $${value}`,
      parking_filter: () => {
        const labels = {
          available: "Parking available",
          free_included: "Free parking",
          paid_available: "Paid parking",
          not_available: "No parking",
        };
        return labels[value] || value;
      },
      bills_included: () => "Bills included",
      internet_included: () => "Internet",
      pets_allowed: () => "Pets OK",
      smoking_allowed: () => "Smoking OK",
      student_friendly: () => "Student friendly",
      lgbtq_friendly: () => "LGBTQ+ friendly",
      couples_allowed: () => "Couples OK",
    };

    return labelMap[key] ? labelMap[key]() : null;
  };

  const chips = Object.entries(filters)
    .map(([key, value]) => ({
      key,
      label: getFilterLabel(key, value),
    }))
    .filter(c => c.label !== null);

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {chips.map(chip => (
        <div
          key={chip.key}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium border border-accent/20 hover:bg-accent/15 transition-colors group"
        >
          <span>{chip.label}</span>
          <button
            onClick={() => onRemoveFilter(chip.key)}
            className="text-accent/60 hover:text-accent transition-colors ml-1 group-hover:opacity-100"
            aria-label={`Remove ${chip.label} filter`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {chips.length > 0 && (
        <button
          onClick={onClearAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-2 underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}