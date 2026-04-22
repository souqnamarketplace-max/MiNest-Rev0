/**
 * Walk Score integration via Supabase Edge Function proxy.
 * The Edge Function handles the API call server-side (no CORS issues).
 */

import { supabase } from "@/lib/supabase";

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/walk-score`;

/**
 * Fetch Walk Score via the Edge Function proxy.
 * Optionally saves scores to the listing record if listing_id is provided.
 */
export async function fetchWalkScore(lat, lon, address, listing_id = null) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ lat, lon, address, listing_id }),
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.warn("Walk Score fetch error:", err.message);
    return null;
  }
}

/**
 * Fetch and save Walk Score for a listing.
 */
export async function fetchAndSaveWalkScore(listing) {
  if (!listing.latitude || !listing.longitude) return null;

  const address = [
    listing.street_address,
    listing.city,
    listing.province_or_state,
    listing.postal_or_zip,
    listing.country,
  ].filter(Boolean).join(", ");

  return fetchWalkScore(listing.latitude, listing.longitude, address, listing.id);
}

/**
 * Get transit score label for display
 */
export function getTransitLabel(score) {
  if (score == null) return null;
  if (score >= 70) return "Excellent Transit";
  if (score >= 50) return "Good Transit";
  if (score >= 25) return "Some Transit";
  return "Minimal Transit";
}
