/**
 * jurisdictions.js — Master list of Canadian and US jurisdictions with
 * jurisdiction-specific defaults used by rental agreements.
 *
 * NOTE: This file is DATA-ONLY. All values here are defaults and hints —
 * they DO NOT constitute legal advice. Jurisdictional clauses (Form 2229E
 * layout, state-specific disclosures, etc.) live in Zip 2 in /leaseClauses/.
 *
 * Sources for defaults (verify periodically, these change):
 * - Canadian deposit rules: various provincial tenancy boards
 * - US federal lead paint disclosure: EPA 40 CFR Part 745
 */

export const COUNTRIES = [
  { code: 'CA', name: 'Canada', flag: '🍁', currency: 'cad' },
  { code: 'US', name: 'United States', flag: '🇺🇸', currency: 'usd' },
];

// -------- CANADA --------
// 10 provinces + 3 territories
export const CA_PROVINCES = [
  { code: 'AB', name: 'Alberta',                    depositMax: '1x monthly rent',  depositInterest: true,  noticePeriodDays: 90, cannabisClauseRequired: true },
  { code: 'BC', name: 'British Columbia',           depositMax: '0.5x monthly rent',depositInterest: false, noticePeriodDays: 90, cannabisClauseRequired: true },
  { code: 'MB', name: 'Manitoba',                   depositMax: '0.5x monthly rent',depositInterest: true,  noticePeriodDays: 90, cannabisClauseRequired: true },
  { code: 'NB', name: 'New Brunswick',              depositMax: '1 week rent',      depositInterest: true,  noticePeriodDays: 90, cannabisClauseRequired: true },
  { code: 'NL', name: 'Newfoundland and Labrador',  depositMax: '0.75x monthly rent',depositInterest: false,noticePeriodDays: 90, cannabisClauseRequired: true },
  { code: 'NS', name: 'Nova Scotia',                depositMax: '0.5x monthly rent',depositInterest: true,  noticePeriodDays: 90, cannabisClauseRequired: true },
  { code: 'ON', name: 'Ontario',                    depositMax: '1x monthly rent (last month only)', depositInterest: true, noticePeriodDays: 90, cannabisClauseRequired: true, requiresStandardForm: '2229E' },
  { code: 'PE', name: 'Prince Edward Island',       depositMax: '1x monthly rent',  depositInterest: true,  noticePeriodDays: 60, cannabisClauseRequired: true },
  { code: 'QC', name: 'Québec',                     depositMax: 'Deposits prohibited (except key)', depositInterest: false, noticePeriodDays: 90, cannabisClauseRequired: true, requiresStandardForm: 'TAL' },
  { code: 'SK', name: 'Saskatchewan',               depositMax: '1x monthly rent',  depositInterest: true,  noticePeriodDays: 60, cannabisClauseRequired: true },
  { code: 'NT', name: 'Northwest Territories',      depositMax: '1x monthly rent',  depositInterest: true,  noticePeriodDays: 30, cannabisClauseRequired: true },
  { code: 'NU', name: 'Nunavut',                    depositMax: '1x monthly rent',  depositInterest: true,  noticePeriodDays: 30, cannabisClauseRequired: true },
  { code: 'YT', name: 'Yukon',                      depositMax: '1x monthly rent',  depositInterest: true,  noticePeriodDays: 90, cannabisClauseRequired: true },
];

// -------- USA --------
// 50 states + DC. Disclosure flags follow federal + common state laws.
// All pre-1978 properties require lead paint disclosure federally.
export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona',    bedbugDisclosure: true },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California', megansLawDisclosure: true, moldDisclosure: true, bedbugDisclosure: true, lateFeeMaxPct: 5, requiresRentControlNotice: ['San Francisco','Los Angeles','Oakland','Berkeley'] },
  { code: 'CO', name: 'Colorado',   bedbugDisclosure: true },
  { code: 'CT', name: 'Connecticut',depositBankDisclosure: true },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida',    floodDisclosure: true },
  { code: 'GA', name: 'Georgia',    floodDisclosure: true },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois',   bedbugDisclosure: true },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky',   moveInChecklist: true },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine',      bedbugDisclosure: true },
  { code: 'MD', name: 'Maryland',   moldDisclosure: true, depositBankDisclosure: true },
  { code: 'MA', name: 'Massachusetts', depositBankDisclosure: true, leadNotice: true },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana',    moveInChecklist: true },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey', depositBankDisclosure: true, floodDisclosure: true },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York',   bedbugDisclosure: true, depositBankDisclosure: true, requiresRentControlNotice: ['New York City'] },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon',     requiresRentControlNotice: ['Portland'] },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas',      floodDisclosure: true },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia',   moldDisclosure: true },
  { code: 'WA', name: 'Washington', moveInChecklist: true, moldDisclosure: true },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

// -------- LOOKUP HELPERS --------

/**
 * Get the list of jurisdictions for a given country code.
 * Returns [] if country unknown.
 */
export function getJurisdictionsForCountry(countryCode) {
  if (countryCode === 'CA') return CA_PROVINCES;
  if (countryCode === 'US') return US_STATES;
  return [];
}

/**
 * Look up a jurisdiction by country + code OR by country + name.
 * Tolerant of either a 2-letter code ("ON") or a full name ("Ontario").
 * Returns null if not found.
 */
export function findJurisdiction(countryCode, codeOrName) {
  if (!countryCode || !codeOrName) return null;
  const list = getJurisdictionsForCountry(countryCode);
  const needle = String(codeOrName).trim().toLowerCase();
  return list.find(j =>
    j.code.toLowerCase() === needle ||
    j.name.toLowerCase() === needle
  ) || null;
}

/**
 * Given a listing row (or a partial object with country / province_or_state),
 * returns the best-guess { country, jurisdiction } pair.
 * Accepts country as 'CA' / 'US' / 'Canada' / 'United States' (case-insensitive).
 */
export function detectJurisdictionFromListing(listing) {
  if (!listing) return { country: null, jurisdiction: null };
  const c = String(listing.country || '').trim().toLowerCase();
  let country = null;
  if (c === 'ca' || c === 'canada') country = 'CA';
  else if (c === 'us' || c === 'usa' || c === 'united states' || c === 'united states of america') country = 'US';
  if (!country) return { country: null, jurisdiction: null };
  const jurisdiction = findJurisdiction(country, listing.province_or_state);
  return { country, jurisdiction };
}

/**
 * Get sensible default deposit held-by text for a jurisdiction.
 */
export function defaultDepositHeldBy(countryCode, jurisdictionCode) {
  if (countryCode === 'CA') return 'Landlord (in a separate trust account where required by law)';
  if (countryCode === 'US') return 'Landlord (in compliance with state law)';
  return 'Landlord';
}

/**
 * Returns a human-readable form version string for the given jurisdiction.
 * Used to stamp the rental_agreements.form_version column.
 */
export function getFormVersion(countryCode, jurisdictionCode) {
  if (!countryCode) return 'v1';
  if (!jurisdictionCode) return `${countryCode}-generic-v1`;
  return `${countryCode}-${jurisdictionCode}-v1`;
}
