// Supabase Edge Function: walk-score
// Deploy: supabase functions deploy walk-score --no-verify-jwt --project-ref qqrefnvhxggrovziogfj

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WALKSCORE_API_KEY = "36011d3f704d69a365906d5452beff19";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { lat, lon, address, listing_id } = await req.json();

    if (!lat || !lon) {
      return new Response(
        JSON.stringify({ error: "lat and lon are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch from Walk Score API
    const params = new URLSearchParams({
      format: "json",
      lat: String(lat),
      lon: String(lon),
      address: address || "",
      wsapikey: WALKSCORE_API_KEY,
      transit: "1",
      bike: "1",
    });

    const wsResponse = await fetch(`https://api.walkscore.com/score?${params.toString()}`);
    const wsData = await wsResponse.json();

    if (wsData.status !== 1) {
      return new Response(
        JSON.stringify({ error: "Walk Score API error", status: wsData.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const scores = {
      walk_score: wsData.walkscore ?? null,
      transit_score: wsData.transit?.score ?? null,
      bike_score: wsData.bike?.score ?? null,
    };

    // If listing_id provided, save to DB using service role
    if (listing_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from("listings")
        .update({
          walk_score: scores.walk_score,
          transit_score: scores.transit_score,
          bike_score: scores.bike_score,
        })
        .eq("id", listing_id);
    }

    return new Response(
      JSON.stringify(scores),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
