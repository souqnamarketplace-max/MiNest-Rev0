/**
 * BATCH 5 — VALIDATION + UX CLARITY
 * 
 * Validation rules for rent pricing
 */

export function validateRentAmount(amount) {
  if (amount === undefined || amount === null || amount === '') {
    return { valid: false, error: 'Rent amount is required' };
  }
  const num = Number(amount);
  if (isNaN(num)) {
    return { valid: false, error: 'Rent must be a number' };
  }
  if (num < 0) {
    return { valid: false, error: 'Rent cannot be negative' };
  }
  if (num === 0) {
    return { valid: false, error: 'Rent must be greater than 0' };
  }
  return { valid: true };
}

export function validateRentPeriod(period) {
  const validPeriods = ['monthly', 'weekly', 'daily'];
  if (!period || !validPeriods.includes(period)) {
    return { valid: false, error: 'Invalid rent period' };
  }
  return { valid: true };
}

export function validatePricing(amount, period) {
  const amountCheck = validateRentAmount(amount);
  if (!amountCheck.valid) return amountCheck;

  const periodCheck = validateRentPeriod(period);
  if (!periodCheck.valid) return periodCheck;

  return { valid: true };
}

/**
 * Prevent confusion: ensure price is never shown without unit
 * Always format with formatRentPrice() from pricingHelpers
 */
export function getSafeRentDisplay(listing) {
  const amount = listing.rent_amount || listing.monthly_rent;
  const period = listing.rent_period || 'monthly';
  const currency = listing.currency_code || 'CAD';
  
  if (!amount) {
    return { display: '—', safe: true, amount, period, currency };
  }

  return {
    display: `${currency}${amount} / ${period}`,
    safe: true,
    amount,
    period,
    currency,
  };
}