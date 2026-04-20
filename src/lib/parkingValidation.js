/**
 * BATCH 5 — Parking Validation and State Management
 * 
 * Enforce parking business rules and prevent invalid state combinations
 */

export function validateParkingState(form) {
  const errors = [];

  const status = form.parking_status || "not_available";

  // Free parking validation
  if (status === "free_included") {
    if (!form.parking_type) {
      errors.push("Please select a parking type for free parking");
    }
    // Ensure price fields are cleared
    if (form.parking_price) {
      errors.push("Free parking should not have a price");
    }
  }

  // Paid parking validation
  if (status === "paid_available") {
    if (!form.parking_type) {
      errors.push("Please select a parking type for paid parking");
    }
    if (!form.parking_price || Number(form.parking_price) <= 0) {
      errors.push("Parking price must be greater than 0");
    }
    if (!form.parking_price_period) {
      errors.push("Please select a parking price period");
    }
  }

  // Not available validation
  if (status === "not_available") {
    // No validation needed, all fields should be cleared
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Clean parking data based on status
 * Removes stale values when switching between states
 */
export function cleanParkingData(form, newStatus) {
  const cleaned = {
    parking_status: newStatus,
    parking_type: form.parking_type || "",
    parking_price: form.parking_price || "",
    parking_price_period: form.parking_price_period || "monthly",
    parking_notes: form.parking_notes || "",
  };

  // Clear based on new status
  if (newStatus === "not_available") {
    cleaned.parking_type = "";
    cleaned.parking_price = "";
    cleaned.parking_price_period = "monthly";
    cleaned.parking_notes = "";
  } else if (newStatus === "free_included") {
    cleaned.parking_price = "";
    cleaned.parking_price_period = "monthly";
  }

  return cleaned;
}

/**
 * Prepare parking data for database submission
 * Ensures no stale or contradictory data is saved
 */
export function prepareParkingDataForSubmit(form) {
  const status = form.parking_status || "not_available";

  let data = {
    parking_status: status,
  };

  if (status === "free_included") {
    data.parking_type = form.parking_type || "";
    data.parking_price = null;
    data.parking_price_period = null;
    data.parking_notes = form.parking_notes || "";
  } else if (status === "paid_available") {
    data.parking_type = form.parking_type || "";
    data.parking_price = form.parking_price ? Number(form.parking_price) : null;
    data.parking_price_period = form.parking_price_period || "monthly";
    data.parking_notes = form.parking_notes || "";
  } else {
    // not_available
    data.parking_type = null;
    data.parking_price = null;
    data.parking_price_period = null;
    data.parking_notes = "";
  }

  return data;
}