import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cleanParkingData } from "@/lib/parkingValidation";

const PARKING_TYPES = [
  { value: "garage", label: "Garage" },
  { value: "driveway", label: "Driveway" },
  { value: "street", label: "Street" },
  { value: "covered", label: "Covered" },
  { value: "underground", label: "Underground" },
  { value: "carport", label: "Carport" },
  { value: "other", label: "Other" },
];

export default function ParkingSection({ parking, onUpdate }) {
  const handleStatusChange = (status) => {
    // Clean and clear dependent fields based on new status
    const updated = cleanParkingData(parking, status);
    onUpdate(updated);
  };

  const handleTypeChange = (type) => {
    onUpdate({ ...parking, parking_type: type });
  };

  const handlePriceChange = (price) => {
    onUpdate({ ...parking, parking_price: price });
  };

  const handlePeriodChange = (period) => {
    onUpdate({ ...parking, parking_price_period: period });
  };

  const handleNotesChange = (notes) => {
    onUpdate({ ...parking, parking_notes: notes });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-foreground">Parking</h3>

      {/* Main status selector */}
      <div className="space-y-2">
        <Label className="font-medium">Availability</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { value: "free_included", label: "Free parking included" },
            { value: "paid_available", label: "Paid parking available" },
            { value: "not_available", label: "No parking available" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => handleStatusChange(option.value)}
              className={`px-3 py-2.5 rounded-lg border-2 transition-all text-sm font-medium ${
                parking.parking_status === option.value
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-transparent text-foreground hover:border-accent/50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conditional fields for free parking */}
      {parking.parking_status === "free_included" && (
        <>
          <div>
            <Label>Parking Type *</Label>
            <Select value={parking.parking_type || ""} onValueChange={handleTypeChange}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {PARKING_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Additional Notes (optional)</Label>
            <Textarea
              className="mt-1 min-h-[60px]"
              placeholder="e.g., One spot only, street permit required..."
              value={parking.parking_notes || ""}
              onChange={(e) => handleNotesChange(e.target.value)}
            />
          </div>
        </>
      )}

      {/* Conditional fields for paid parking */}
      {parking.parking_status === "paid_available" && (
        <>
          <div>
            <Label>Parking Type *</Label>
            <Select value={parking.parking_type || ""} onValueChange={handleTypeChange}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {PARKING_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3 items-end">
            <div className="col-span-2">
              <Label>Price *</Label>
              <Input
                type="number"
                className="mt-1"
                placeholder="e.g., 75"
                value={parking.parking_price || ""}
                onChange={(e) => handlePriceChange(Math.max(0, Number(e.target.value)) || "")}
                min="0"
              />
            </div>
            <div>
              <Label>Period *</Label>
              <Select
                value={parking.parking_price_period || "monthly"}
                onValueChange={handlePeriodChange}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Additional Notes (optional)</Label>
            <Textarea
              className="mt-1 min-h-[60px]"
              placeholder="e.g., One spot only, underground stall near elevator..."
              value={parking.parking_notes || ""}
              onChange={(e) => handleNotesChange(e.target.value)}
            />
          </div>
        </>
      )}

      {/* No parking — optionally show notes field only */}
      {parking.parking_status === "not_available" && (
        <div className="text-sm text-muted-foreground">
          No parking information to configure.
        </div>
      )}
    </div>
  );
}