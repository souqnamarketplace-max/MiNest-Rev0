/**
 * GET /api/sitemap
 * Generates sitemap.xml dynamically from active listings.
 * Cached for 1 hour. City pages only generated for cities with 2+ listings.
 * SEO optimized: priority, changefreq, lastmod per URL type.
 */
import { getServiceClient } from './_lib/supabase.js';

const BASE_URL = 'https://minest.ca';

const STATIC_PAGES = [
  { url: '/',                     priority: '1.0', changefreq: 'daily' },
  { url: '/search',               priority: '0.9', changefreq: 'daily' },
  { url: '/roommates',            priority: '0.8', changefreq: 'daily' },
  { url: '/how-it-works',         priority: '0.6', changefreq: 'monthly' },
  { url: '/pricing',              priority: '0.6', changefreq: 'monthly' },
  { url: '/roommate-agreement',   priority: '0.5', changefreq: 'monthly' },
  { url: '/safety',               priority: '0.4', changefreq: 'monthly' },
  { url: '/contact',              priority: '0.4', changefreq: 'monthly' },
  { url: '/terms',                priority: '0.2', changefreq: 'yearly' },
  { url: '/privacy',              priority: '0.2', changefreq: 'yearly' },
];

function cityToSlug(city) {
  return city.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function escapeXml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = getServiceClient();
    const now = new Date().toISOString().split('T')[0];

    // Fetch active listings — only fields needed for sitemap
    const { data: listings } = await supabase
      .from('listings')
      .select('id, slug, title, city, cover_photo_url, photos, expires_at, updated_at, is_featured, is_boosted')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(5000); // Handle large catalogs

    // Filter to indexable listings (have photo, not expired, have title)
    const indexable = (listings || []).filter(l => {
      if (!l.title || l.title.trim().length < 5) return false;
      const hasPhoto = l.cover_photo_url || (l.photos && l.photos.length > 0);
      if (!hasPhoto) return false;
      if (l.expires_at && new Date(l.expires_at) < new Date()) return false;
      return true;
    });

    // Build city page URLs — only cities with 2+ listings
    const cityCount = {};
    for (const l of indexable) {
      if (l.city) {
        const key = l.city.toLowerCase();
        cityCount[key] = (cityCount[key] || 0) + 1;
      }
    }

    const seenCities = new Set();
    const cityUrls = [];
    for (const l of indexable) {
      if (!l.city) continue;
      const key = l.city.toLowerCase();
      if (!seenCities.has(key) && cityCount[key] >= 2) {
        seenCities.add(key);
        const count = cityCount[key];
        const priority = count >= 10 ? '0.9' : count >= 5 ? '0.8' : '0.7';
        cityUrls.push({
          url: `/rooms-for-rent/${cityToSlug(l.city)}`,
          priority,
          changefreq: 'daily',
          lastmod: now,
        });
      }
    }

    // Build listing URLs
    const listingUrls = indexable.map(l => ({
      url: `/listing/${l.slug || l.id}`,
      priority: l.is_featured ? '0.8' : '0.7',
      changefreq: 'weekly',
      lastmod: (l.updated_at || now).split('T')[0],
    }));

    const allUrls = [
      ...STATIC_PAGES.map(p => ({ ...p, lastmod: now })),
      ...cityUrls,
      ...listingUrls,
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${escapeXml(BASE_URL + u.url)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return res.status(200).send(xml);
  } catch (error) {
    console.error('[sitemap] error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
