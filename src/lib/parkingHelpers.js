/**
 * Parking display and formatting helpers
 */

export function getParkingLabel(status) {
  switch (status) {
    case "free_included":
      return "Free parking";
    case "paid_available":
      return "Paid parking";
    case "not_available":
      return "No parking";
    default:
      return "Not specified";
  }
}

export function formatParkingType(type) {
  if (!type) return "";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Compact parking display for listing cards
 * Returns: "Free parking", "Paid parking", "No parking", or null if not available
 */
export function getParkingCardDisplay(listing) {
  const status = listing.parking_status || "not_available";

  if (status === "not_available") {
    return null;
  }

  if (status === "free_included") {
    const type = listing.parking_type ? formatParkingType(listing.parking_type) : null;
    return type ? `Free ${type.toLowerCase()} parking` : "Free parking";
  }

  if (status === "paid_available") {
    const price = listing.parking_price;
    const period = listing.parking_price_period || "monthly";
    const shortPeriod = period === "monthly" ? "/mo" : period === "weekly" ? "/wk" : "/day";
    return `Paid parking (${listing.currency_code || "CAD"}${price}${shortPeriod})`;
  }

  return null;
}

/**
 * Full parking display for listing detail page
 */
export function getParkingDetailDisplay(listing) {
  const status = listing.parking_status || "not_available";
  const currency = listing.currency_code || "CAD";

  let display = {
    label: "",
    type: "",
    price: "",
    notes: "",
  };

  if (status === "free_included") {
    display.label = "Free parking included";
    if (listing.parking_type) {
      display.type = formatParkingType(listing.parking_type);
    }
  } else if (status === "paid_available") {
    display.label = "Paid parking available";
    if (listing.parking_type) {
      display.type = formatParkingType(listing.parking_type);
    }
    if (listing.parking_price) {
      const period = listing.parking_price_period || "monthly";
      const periodLabel =
        period === "monthly" ? "month" : period === "weekly" ? "week" : "day";
      display.price = `${currency}${listing.parking_price}/${periodLabel}`;
    }
  } else {
    display.label = "No parking available";
  }

  if (listing.parking_notes) {
    display.notes = listing.parking_notes;
  }

  return display;
}

/**
 * Filter matching: does listing match parking filter?
 */
export function matchesParkingFilter(listing, filter) {
  if (!filter || filter === "any") return true;

  const status = listing.parking_status || "not_available";

  switch (filter) {
    case "free_included":
      return status === "free_included";
    case "paid_available":
      return status === "paid_available";
    case "not_available":
      return status === "not_available";
    case "available":
      return status === "free_included" || status === "paid_available";
    default:
      return true;
  }
}

/**
 * Safe fallback for legacy listings without parking_status
 * Returns a sensible default display without breaking layout
 */
export function getSafeParkingDisplay(listing) {
  // If parking_status exists, use it
  if (listing.parking_status) {
    return getParkingCardDisplay(listing);
  }

  // Fallback to old field for backward compatibility
  if (listing.parking_available === true) {
    return "Parking available";
  }

  // Default: don't show anything if no data
  return null;
}