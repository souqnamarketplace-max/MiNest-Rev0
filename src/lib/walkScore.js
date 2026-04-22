/**
 * Walk Score API integration for MiNest
 * API docs: https://www.walkscore.com/professional/api.php
 */

const WALKSCORE_API_KEY = "36011d3f704d69a365906d5452beff19";

/**
 * Fetch Walk Score, Transit Score, and Bike Score for a location.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude  
 * @param {string} address - Full street address
 * @returns {Promise<{walkscore: number, transit: {score: number}, bike: {score: number}} | null>}
 */
export async function fetchWalkScore(lat, lon, address) {
  try {
    const params = new URLSearchParams({
      format: "json",
      lat: String(lat),
      lon: String(lon),
      address: address,
      wsapikey: WALKSCORE_API_KEY,
      transit: "1",
      bike: "1",
    });

    // Walk Score API doesn't support CORS, so we use a proxy approach
    // Option 1: Direct call (works server-side or with CORS proxy)
    // Option 2: JSONP callback (Walk Score supports this)
    const url = `https://api.walkscore.com/score?${params.toString()}`;
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.status !== 1) return null;
    
    return {
      walk_score: data.walkscore ?? null,
      transit_score: data.transit?.score ?? null,
      bike_score: data.bike?.score ?? null,
      walk_description: data.description ?? null,
      transit_description: data.transit?.description ?? null,
      bike_description: data.bike?.description ?? null,
    };
  } catch (err) {
    console.warn("Walk Score API error:", err.message);
    return null;
  }
}

/**
 * Fetch and save Walk Score for a listing.
 * Updates the listing record in Supabase with the scores.
 */
export async function fetchAndSaveWalkScore(listing, supabase) {
  if (!listing.latitude || !listing.longitude) return null;
  
  const address = [
    listing.street_address,
    listing.city,
    listing.province_or_state,
    listing.postal_or_zip,
    listing.country,
  ].filter(Boolean).join(", ");

  const scores = await fetchWalkScore(listing.latitude, listing.longitude, address);
  if (!scores) return null;

  // Save to DB
  const { error } = await supabase
    .from("listings")
    .update({
      walk_score: scores.walk_score,
      transit_score: scores.transit_score,
      bike_score: scores.bike_score,
    })
    .eq("id", listing.id);

  if (error) {
    console.warn("Failed to save Walk Score:", error.message);
  }

  return scores;
}

/**
 * Batch fetch Walk Scores for multiple listings.
 * Rate limited to avoid hitting API limits (5000/day).
 * @param {Array} listings - Array of listing objects
 * @param {object} supabase - Supabase client
 * @param {number} delayMs - Delay between requests (ms)
 */
export async function batchFetchWalkScores(listings, supabase, delayMs = 500) {
  const results = [];
  for (const listing of listings) {
    if (listing.walk_score != null) {
      results.push({ id: listing.id, skipped: true });
      continue;
    }
    const scores = await fetchAndSaveWalkScore(listing, supabase);
    results.push({ id: listing.id, scores });
    // Rate limit
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
  }
  return results;
}

/**
 * Get score label for display
 */
export function getScoreLabel(score) {
  if (score == null) return null;
  if (score >= 90) return "Excellent Transit";
  if (score >= 70) return "Excellent Transit"; 
  if (score >= 50) return "Good Transit";
  if (score >= 25) return "Some Transit";
  return "Minimal Transit";
}
