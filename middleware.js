import { NextResponse } from 'next/server';

const SUPABASE_URL = 'https://qqrefnvhxggrovziogfj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxcmVmbnZoeGdncm92emlvZ2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMTkzMzQsImV4cCI6MjA5MTg5NTMzNH0.5xrBzcFq9u48qEfx8hA6D-lkTlQdwUHGe7bCXZsVuZE';
const SITE_URL = 'https://minest-xi.vercel.app';

const CRAWLER_AGENTS = [
  'facebookexternalhit', 'Facebot', 'Twitterbot', 'WhatsApp',
  'LinkedInBot', 'Slackbot', 'TelegramBot', 'Pinterest',
  'Discordbot', 'Googlebot', 'bingbot',
];

export const config = {
  matcher: ['/listing/:path*', '/seeker/:path*'],
};

export default async function middleware(request) {
  const userAgent = request.headers.get('user-agent') || '';
  const isCrawler = CRAWLER_AGENTS.some(a => userAgent.toLowerCase().includes(a.toLowerCase()));

  if (!isCrawler) return NextResponse.next();

  const url = new URL(request.url);
  const pathname = url.pathname;

  try {
    if (pathname.startsWith('/listing/')) {
      return await handleListing(pathname.replace('/listing/', ''));
    } else if (pathname.startsWith('/seeker/')) {
      return await handleSeeker(pathname.replace('/seeker/', ''));
    }
  } catch (err) {
    console.error('OG middleware error:', err.message);
  }

  return NextResponse.next();
}

async function supabaseQuery(table, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}&limit=1`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  const data = await res.json();
  return data?.[0] || null;
}

async function handleListing(slug) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
  const query = isUuid ? `id=eq.${slug}` : `slug=eq.${slug}`;
  const listing = await supabaseQuery(
    'listings',
    `${query}&select=id,slug,title,description,rent_amount,monthly_rent,rent_period,city,province_or_state,cover_photo_url,photos`
  );

  if (!listing) return NextResponse.next();

  const title = listing.title || 'Room for Rent';
  const price = listing.rent_amount || listing.monthly_rent || 0;
  const period = listing.rent_period === 'daily' ? '/day' : listing.rent_period === 'weekly' ? '/wk' : '/mo';
  const priceStr = price > 0 ? ` — $${Math.round(price)}${period}` : '';
  const location = [listing.city, listing.province_or_state].filter(Boolean).join(', ');
  const image = listing.cover_photo_url || (listing.photos && listing.photos[0]) || `${SITE_URL}/og-cover.jpg`;
  const desc = listing.description ? listing.description.slice(0, 200).trimEnd() + '...' : `Room for rent in ${location}. Browse verified rooms on MiNest.`;
  const pageUrl = `${SITE_URL}/listing/${listing.slug || listing.id}`;

  return ogResponse({
    title: `${esc(title)}${priceStr}`,
    description: esc(desc),
    image: esc(image),
    url: pageUrl,
    extra: `<p>Price: $${Math.round(price)}${period}</p><p>Location: ${esc(location)}</p>`,
  });
}

async function handleSeeker(id) {
  const seeker = await supabaseQuery(
    'seeker_profiles',
    `id=eq.${id}&select=id,display_name,bio,preferred_cities,preferred_country,min_budget,max_budget,currency_code,move_in_date,lifestyle_type,avatar_url`
  );

  if (!seeker) return NextResponse.next();

  const name = seeker.display_name || 'Room Seeker';
  const cities = Array.isArray(seeker.preferred_cities) ? seeker.preferred_cities.join(', ') : (seeker.preferred_cities || '');
  const country = seeker.preferred_country || '';
  const budget = seeker.min_budget && seeker.max_budget
    ? `$${seeker.min_budget}–$${seeker.max_budget} ${seeker.currency_code || ''}`
    : '';
  const image = seeker.avatar_url || `${SITE_URL}/og-cover.jpg`;
  const desc = seeker.bio
    ? seeker.bio.slice(0, 200).trimEnd() + '...'
    : `${name} is looking for a room${cities ? ` in ${cities}` : ''}${budget ? `, budget ${budget}` : ''}. Connect on MiNest.`;
  const pageUrl = `${SITE_URL}/seeker/${seeker.id}`;

  return ogResponse({
    title: `${esc(name)} — Looking for a Room${cities ? ` in ${cities}` : ''}`,
    description: esc(desc),
    image: esc(image),
    url: pageUrl,
    extra: `${budget ? `<p>Budget: ${budget}</p>` : ''}${cities ? `<p>Cities: ${esc(cities)}</p>` : ''}`,
  });
}

function ogResponse({ title, description, image, url, extra = '' }) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${title} | MiNest</title>
<meta name="description" content="${description}"/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="${url}"/>
<meta property="og:title" content="${title}"/>
<meta property="og:description" content="${description}"/>
<meta property="og:image" content="${image}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:site_name" content="MiNest"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${title}"/>
<meta name="twitter:description" content="${description}"/>
<meta name="twitter:image" content="${image}"/>
<meta http-equiv="refresh" content="0;url=${url}"/>
<link rel="canonical" href="${url}"/>
</head>
<body>
<h1>${title}</h1>
<p>${description}</p>
${extra}
<img src="${image}" alt="${title}"/>
<a href="${url}">View on MiNest</a>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
  });
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
