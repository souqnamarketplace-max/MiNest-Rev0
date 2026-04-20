/**
 * generateSitemap — Dynamically generates sitemap.xml
 * Publicly accessible at /functions/generateSitemap
 * Uses service role so no user auth is needed.
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

function cityToSlug(city) {
  return city.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const STATIC_PAGES = [
  { url: "/", priority: "1.0", changefreq: "daily" },
  { url: "/search", priority: "0.9", changefreq: "daily" },
  { url: "/roommates", priority: "0.8", changefreq: "daily" },
  { url: "/how-it-works", priority: "0.6", changefreq: "monthly" },
  { url: "/pricing", priority: "0.6", changefreq: "monthly" },
  { url: "/roommate-agreement", priority: "0.5", changefreq: "monthly" },
  { url: "/safety", priority: "0.4", changefreq: "monthly" },
  { url: "/contact", priority: "0.4", changefreq: "monthly" },
  { url: "/terms", priority: "0.2", changefreq: "yearly" },
  { url: "/privacy", priority: "0.2", changefreq: "yearly" },
];

function escapeXml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const BASE = "https://minest.ca";
  const now = new Date().toISOString().split("T")[0];

  let listings = [];
  try {
    listings = await base44.asServiceRole.entities.Listing.filter(
      { status: "active" },
      "-updated_date",
      1000
    );
  } catch (_e) {
    // If listings can't be fetched, still return static pages
  }

  // Filter to only indexable listings
  const indexable = listings.filter((l) => {
    if (!l.title || l.title.trim().length < 5) return false;
    const hasPhoto = l.cover_photo_url || (l.photos && l.photos.length > 0);
    if (!hasPhoto) return false;
    if (l.expires_at && new Date(l.expires_at) < new Date()) return false;
    return true;
  });

  // City pages — only cities with 2+ qualifying listings
  const cityCount = {};
  for (const l of indexable) {
    if (l.city) cityCount[l.city.toLowerCase()] = (cityCount[l.city.toLowerCase()] || 0) + 1;
  }

  const seenCities = new Set();
  const cityUrls = [];
  for (const l of indexable) {
    if (!l.city) continue;
    const key = l.city.toLowerCase();
    if (!seenCities.has(key) && cityCount[key] >= 2) {
      seenCities.add(key);
      const count = cityCount[key];
      const priority = count >= 10 ? "0.9" : count >= 5 ? "0.8" : "0.7";
      cityUrls.push({ url: `/rooms-for-rent/${cityToSlug(l.city)}`, priority, changefreq: "daily", lastmod: now });
    }
  }

  // Listing pages
  const listingUrls = indexable.map((l) => ({
    url: `/listing/${l.id}`,
    priority: "0.7",
    changefreq: "weekly",
    lastmod: (l.updated_date || l.created_date || now).split("T")[0],
  }));

  const allUrls = [
    ...STATIC_PAGES.map((p) => ({ ...p, lastmod: now })),
    ...cityUrls,
    ...listingUrls,
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map((u) => `  <url>
    <loc>${escapeXml(BASE + u.url)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});