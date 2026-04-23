// Vercel Edge Middleware — intercepts social media crawler requests
// and returns HTML with correct OG meta tags for listings

const SUPABASE_URL = 'https://qqrefnvhxggrovziogfj.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SITE_URL = 'https://minest-xi.vercel.app'; // Update when you add a custom domain

// Social media crawler user agents
const CRAWLER_AGENTS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'WhatsApp',
  'LinkedInBot',
  'Slackbot',
  'TelegramBot',
  'Pinterest',
  'Discordbot',
  'Googlebot',
  'bingbot',
];

export const config = {
  matcher: '/listing/:path*',
};

export default async function middleware(request) {
  const userAgent = request.headers.get('user-agent') || '';
  const isCrawler = CRAWLER_AGENTS.some((agent) => userAgent.toLowerCase().includes(agent.toLowerCase()));

  // If not a crawler, let the SPA handle it normally
  if (!isCrawler) {
    return;
  }

  // Extract the listing slug from the URL
  const url = new URL(request.url);
  const slug = url.pathname.replace('/listing/', '');

  if (!slug) return;

  try {
    // Fetch listing data from Supabase directly
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
    const query = isUuid ? `id=eq.${slug}` : `slug=eq.${slug}`;
    
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?${query}&select=id,slug,title,description,rent_amount,monthly_rent,rent_period,city,province_or_state,cover_photo_url,photos&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const listings = await res.json();
    const listing = listings?.[0];

    if (!listing) return; // Let the SPA handle 404s

    const title = listing.title || 'Room for Rent';
    const price = listing.rent_amount || listing.monthly_rent || 0;
    const period = listing.rent_period === 'daily' ? '/day' : listing.rent_period === 'weekly' ? '/wk' : '/mo';
    const priceStr = price > 0 ? ` — $${Math.round(price)}${period}` : '';
    const location = [listing.city, listing.province_or_state].filter(Boolean).join(', ');
    const image = listing.cover_photo_url || listing.photos?.[0] || `${SITE_URL}/og-cover.jpg`;
    const description = listing.description
      ? listing.description.slice(0, 200).trimEnd() + '...'
      : `Room for rent in ${location}. Browse verified rooms on MiNest.`;
    const listingUrl = `${SITE_URL}/listing/${listing.slug || listing.id}`;

    // Return HTML with OG meta tags for the crawler
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}${priceStr} | Room in ${escapeHtml(location)} | MiNest</title>
  <meta name="description" content="${escapeHtml(description)}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${listingUrl}" />
  <meta property="og:title" content="${escapeHtml(title)}${priceStr}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="MiNest" />
  <meta property="og:locale" content="en_CA" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}${priceStr}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
  <meta name="twitter:site" content="@minestca" />

  <!-- Redirect real users to the SPA -->
  <meta http-equiv="refresh" content="0;url=${listingUrl}" />
  <link rel="canonical" href="${listingUrl}" />
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <p>Price: $${Math.round(price)}${period}</p>
  <p>Location: ${escapeHtml(location)}</p>
  <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" />
  <a href="${listingUrl}">View on MiNest</a>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (err) {
    // On error, let the SPA handle the request normally
    console.error('OG middleware error:', err.message);
    return;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
