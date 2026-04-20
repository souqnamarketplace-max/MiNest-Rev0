/**
 * Address validation helpers for MiNest listings.
 * Validates that city, province, postal code and street all match.
 */

// Canadian postal code first letter → province
const POSTAL_TO_PROVINCE = {
  A: 'Newfoundland and Labrador',
  B: 'Nova Scotia',
  C: 'Prince Edward Island',
  E: 'New Brunswick',
  G: 'Quebec', H: 'Quebec', J: 'Quebec',
  K: 'Ontario', L: 'Ontario', M: 'Ontario', N: 'Ontario', P: 'Ontario',
  R: 'Manitoba',
  S: 'Saskatchewan',
  T: 'Alberta',
  V: 'British Columbia',
  X: 'Northwest Territories',
  Y: 'Yukon',
};

// Normalize province name to canonical form
const PROVINCE_NORMALIZE = {
  'british columbia': 'British Columbia',
  'bc': 'British Columbia',
  'alberta': 'Alberta',
  'ab': 'Alberta',
  'saskatchewan': 'Saskatchewan',
  'sk': 'Saskatchewan',
  'manitoba': 'Manitoba',
  'mb': 'Manitoba',
  'ontario': 'Ontario',
  'on': 'Ontario',
  'quebec': 'Quebec',
  'québec': 'Quebec',
  'qc': 'Quebec',
  'new brunswick': 'New Brunswick',
  'nb': 'New Brunswick',
  'nova scotia': 'Nova Scotia',
  'ns': 'Nova Scotia',
  'prince edward island': 'Prince Edward Island',
  'pei': 'Prince Edward Island',
  'pe': 'Prince Edward Island',
  'newfoundland and labrador': 'Newfoundland and Labrador',
  'newfoundland': 'Newfoundland and Labrador',
  'nl': 'Newfoundland and Labrador',
  'northwest territories': 'Northwest Territories',
  'nt': 'Northwest Territories',
  'nunavut': 'Nunavut',
  'nu': 'Nunavut',
  'yukon': 'Yukon',
  'yt': 'Yukon',
};

export function normalizeProvince(province) {
  if (!province) return '';
  return PROVINCE_NORMALIZE[province.toLowerCase().trim()] || province;
}

/**
 * Validates Canadian postal code format
 */
export function isValidCanadianPostal(postal) {
  if (!postal) return false;
  const clean = postal.replace(/\s/g, '').toUpperCase();
  return /^[ABCEGHJKLMNPRSTVXY][0-9][ABCEGHJKLMNPRSTVWXYZ][0-9][ABCEGHJKLMNPRSTVWXYZ][0-9]$/.test(clean);
}

/**
 * Validates US ZIP code format
 */
export function isValidUSZip(zip) {
  if (!zip) return false;
  return /^\d{5}(-\d{4})?$/.test(zip.trim());
}

/**
 * Gets the expected province from a Canadian postal code
 */
export function getProvinceFromPostal(postal) {
  if (!postal) return null;
  const first = postal.replace(/\s/g, '').toUpperCase()[0];
  return POSTAL_TO_PROVINCE[first] || null;
}

/**
 * Validates that postal code matches province for Canadian addresses
 */
export function validatePostalMatchesProvince(postal, province) {
  if (!postal || !province) return { valid: true }; // Skip if either missing
  const clean = postal.replace(/\s/g, '').toUpperCase();
  if (!isValidCanadianPostal(clean)) {
    return { valid: false, error: 'Invalid Canadian postal code format (e.g. T3P 1C5)' };
  }
  const expectedProvince = getProvinceFromPostal(clean);
  const normalizedInput = normalizeProvince(province);
  if (expectedProvince && normalizedInput && expectedProvince !== normalizedInput) {
    return {
      valid: false,
      error: `Postal code ${clean} belongs to ${expectedProvince}, not ${normalizedInput}. Please use the address search to auto-fill.`,
    };
  }
  return { valid: true };
}

/**
 * Full address validation for CreateListing step 1
 * Returns array of error strings (empty = valid)
 */
export function validateListingAddress(form) {
  const errors = [];

  if (!form.country) { errors.push('Country is required'); return errors; }
  if (!form.province_or_state) errors.push('Province / State is required');
  if (!form.street_address?.trim()) errors.push('Street Address is required');
  if (!form.city?.trim()) errors.push('City is required');
  if (!form.postal_or_zip?.trim()) errors.push('Postal / ZIP Code is required');

  if (errors.length > 0) return errors;

  // Canadian-specific validation
  if (form.country === 'Canada') {
    const postalCheck = validatePostalMatchesProvince(form.postal_or_zip, form.province_or_state);
    if (!postalCheck.valid) errors.push(postalCheck.error);

    // Check province is valid Canadian province
    const normalized = normalizeProvince(form.province_or_state);
    if (!normalized) errors.push('Please select a valid Canadian province');
  }

  // US-specific validation
  if (form.country === 'United States') {
    if (!isValidUSZip(form.postal_or_zip)) {
      errors.push('Please enter a valid US ZIP code (e.g. 90210)');
    }
  }

  return errors;
}
