// Supabase Edge Function: check-saved-searches
//
// Runs on a cron schedule (twice daily: 9am and 9pm UTC).
// For each active saved search whose frequency is due, finds new matches
// and fires in-app + push notifications.
//
// Deploy:
//   supabase functions deploy check-saved-searches --no-verify-jwt
//
// Schedule via pg_cron in SQL editor:
//   SELECT cron.schedule(
//     'check-saved-searches-daily',
//     '0 9 * * *',
//     $$ SELECT net.http_post(
//        url:='https://<PROJECT_REF>.supabase.co/functions/v1/check-saved-searches',
//        headers:='{"Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb
//     ) $$
//   );

// @ts-ignore Deno imports
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// @ts-ignore Deno imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-ignore Deno globals
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// @ts-ignore Deno globals
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

// --- Helpers --------------------------------------------------------------

/** Apply saved filters to a Supabase query builder. */
function applyFilters(query: any, filters: Record<string, any>, searchType: string) {
  if (searchType === "rooms") {
    if (filters.country) query = query.eq("country", filters.country);
    if (filters.city) query = query.eq("city", filters.city);
    if (filters.province_or_state) query = query.eq("province_or_state", filters.province_or_state);
    if (filters.listing_type) query = query.eq("listing_type", filters.listing_type);
    if (filters.max_price) query = query.lte("rent_normalized_monthly", Number(filters.max_price));
    if (filters.min_price) query = query.gte("rent_normalized_monthly", Number(filters.min_price));
    if (filters.pets_allowed === "true" || filters.pets_allowed === true) query = query.eq("pets_allowed", true);
    if (filters.furnishing) query = query.eq("furnishing", filters.furnishing);
    query = query.eq("status", "active");
  } else {
    // roommates (seeker_profiles)
    if (filters.country) query = query.eq("preferred_country", filters.country);
    if (filters.city) query = query.eq("preferred_city", filters.city);
    if (filters.max_price) query = query.lte("max_budget", Number(filters.max_price));
    if (filters.min_price) query = query.gte("min_budget", Number(filters.min_price));
    query = query.eq("status", "active");
  }
  return query;
}

/** Determine if a saved search is due for a check based on frequency + last_notified_at. */
function isDue(search: any, now: Date): boolean {
  if (!search.is_active) return false;
  if (!search.last_notified_at) return true;
  const last = new Date(search.last_notified_at).getTime();
  const hoursSince = (now.getTime() - last) / (1000 * 60 * 60);
  if (search.frequency === "daily") return hoursSince >= 20; // allow a small window
  if (search.frequency === "weekly") return hoursSince >= 7 * 24 - 4;
  return false;
}

/** Insert an in-app notification row. */
async function createInAppNotification(userId: string, search: any, matches: any[]) {
  const matchCount = matches.length;
  const first = matches[0];
  const title = `${matchCount} new ${search.search_type === "rooms" ? "room" : "roommate"}${matchCount !== 1 ? "s" : ""} matching "${search.name}"`;
  const subtitle = first?.title || first?.display_name || "Tap to view all";

  const searchPath = search.search_type === "rooms" ? "/search" : "/roommates";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(search.filters || {})) {
    if (v !== null && v !== undefined && v !== "") params.set(k, String(v));
  }
  const deepLink = `${searchPath}?${params.toString()}`;

  await admin.from("notifications").insert({
    user_id: userId,
    type: "saved_search_match",
    title,
    body: subtitle,
    data: {
      saved_search_id: search.id,
      match_count: matchCount,
      link: deepLink,
      sample_matches: matches.slice(0, 3).map((m: any) => ({
        id: m.id,
        title: m.title || m.display_name,
        slug: m.slug,
      })),
    },
    read: false,
  });
}

/** Fire an FCM push notification via the existing push-notifications function. */
async function firePushNotification(userId: string, search: any, matches: any[]) {
  const matchCount = matches.length;
  const title = `${matchCount} new match${matchCount !== 1 ? "es" : ""} for "${search.name}"`;
  const firstTitle = matches[0]?.title || matches[0]?.display_name || "";
  const body = firstTitle + (matchCount > 1 ? ` and ${matchCount - 1} more` : "");

  try {
    // Reuse the existing push-notifications edge function
    await admin.functions.invoke("push-notifications", {
      body: {
        user_id: userId,
        title,
        body,
        data: { saved_search_id: search.id, type: "saved_search_match" },
      },
    });
  } catch (err) {
    console.error(`Push notification failed for user ${userId}:`, err);
    // Non-fatal — in-app notification still worked
  }
}

// --- Main handler ---------------------------------------------------------

serve(async (req) => {
  try {
    const now = new Date();

    // Fetch all active saved searches
    const { data: allSearches, error: fetchErr } = await admin
      .from("saved_searches")
      .select("*")
      .eq("is_active", true);

    if (fetchErr) throw fetchErr;
    if (!allSearches || allSearches.length === 0) {
      return new Response(JSON.stringify({ checked: 0, notified: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let checked = 0;
    let notified = 0;
    const errors: string[] = [];

    for (const search of allSearches) {
      if (!isDue(search, now)) continue;
      checked++;

      try {
        // Query for new matches since last_notified_at (or last 24h if never notified)
        const since = search.last_notified_at
          ? new Date(search.last_notified_at).toISOString()
          : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const table = search.search_type === "rooms" ? "listings" : "seeker_profiles";
        let query = admin.from(table).select("*").gte("created_at", since);
        query = applyFilters(query, search.filters || {}, search.search_type);
        query = query.limit(10);

        const { data: matches, error: matchErr } = await query;
        if (matchErr) throw matchErr;

        if (!matches || matches.length === 0) {
          // No matches — still update last_notified_at so we don't re-check too soon
          await admin
            .from("saved_searches")
            .update({ last_notified_at: now.toISOString(), last_match_count: 0 })
            .eq("id", search.id);
          continue;
        }

        // Send notifications on the user's chosen channels
        if (search.notify_in_app) {
          await createInAppNotification(search.user_id, search, matches);
        }
        if (search.notify_push) {
          await firePushNotification(search.user_id, search, matches);
        }

        // Update last_notified_at and match count
        await admin
          .from("saved_searches")
          .update({
            last_notified_at: now.toISOString(),
            last_match_count: matches.length,
          })
          .eq("id", search.id);

        notified++;
      } catch (err: any) {
        errors.push(`search ${search.id}: ${err.message || err}`);
      }
    }

    return new Response(
      JSON.stringify({ checked, notified, total: allSearches.length, errors }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
