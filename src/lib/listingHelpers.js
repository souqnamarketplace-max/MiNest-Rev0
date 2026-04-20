/**
 * Returns the SEO-friendly URL for a listing.
 * Uses slug if available, falls back to id.
 */
export function listingUrl(listing) {
  if (!listing) return '/search';
  const slug = listing.slug?.trim();
  return `/listing/${slug || listing.id}`;
}

/**
 * Returns the edit URL for a listing.
 */
export function listingEditUrl(listing) {
  if (!listing) return '/dashboard';
  const slug = listing.slug?.trim();
  return `/listing/${slug || listing.id}/edit`;
}

/**
 * Generates a URL-safe slug from a seeker headline and id
 */
export function generateSeekerSlug(headline, id) {
  const base = (headline || 'roommate-seeker')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50);
  const suffix = id ? id.slice(0, 8) : '';
  return `${base}-${suffix}`.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Returns the SEO-friendly URL for a seeker profile.
 * Uses slug if available, falls back to id.
 */
export function seekerUrl(seeker) {
  if (!seeker) return '/roommates';
  const slug = seeker.slug?.trim();
  return `/seeker/${slug || seeker.id}`;
}
