/**
 * pricingHelpers.js — Price formatting with live currency conversion
 * All prices in DB are stored in CAD.
 * When country = "United States", prices are converted to USD using live rate.
 */

/**
 * Format rent price with period and currency label
 * @param {number} amount - Rent amount (stored in CAD in DB)
 * @param {string} period - "monthly", "weekly", or "daily"
 * @param {string} currency - "CAD" or "USD"
 * @param {Function} convertPrice - conversion function from CountryContext
 * @returns {string} e.g. "$1,058 USD / month" or "$1,450 CAD / month"
 */
export function formatRentPrice(amount, period = "monthly", currency = "CAD", convertPrice = null) {
  if (!amount) return "—";
  const periodLabel = {
    monthly: "month",
    weekly: "week",
    daily: "day",
  }[period] || "month";

  // Convert price if convertPrice function provided
  const displayAmount = convertPrice ? convertPrice(amount) : Math.round(amount);
  const currencyLabel = currency === "CAD" ? " CAD" : currency === "USD" ? " USD" : ` ${currency}`;
  return `$${displayAmount.toLocaleString()}${currencyLabel} / ${periodLabel}`;
}

/**
 * Format a raw amount with currency label (no period)
 */
export function formatAmount(amount, currency = "CAD", convertPrice = null) {
  if (!amount) return "—";
  const displayAmount = convertPrice ? convertPrice(amount) : Math.round(amount);
  const currencyLabel = currency === "CAD" ? " CAD" : currency === "USD" ? " USD" : ` ${currency}`;
  return `$${displayAmount.toLocaleString()}${currencyLabel}`;
}

/**
 * Calculate normalized monthly equivalent
 */
export function getNormalizedMonthlyPrice(amount, period = "monthly") {
  if (!amount) return 0;
  if (period === "weekly") return amount * 4.33;
  if (period === "daily") return amount * 30;
  return amount;
}

/**
 * Get period shorthand
 */
export function getPeriodShort(period = "monthly") {
  const map = { monthly: "mo", weekly: "wk", daily: "day" };
  return map[period] || "mo";
}

/**
 * Show equivalent monthly price
 */
export function formatEquivalentMonthly(amount, period = "monthly", currency = "CAD", convertPrice = null) {
  if (period === "monthly") return null;
  const normalized = getNormalizedMonthlyPrice(amount, period);
  return formatAmount(Math.round(normalized), currency, convertPrice);
}

/**
 * Get currency code based on country
 */
export function getCurrencyByCountry(country) {
  if (country === "United States") return "USD";
  if (country === "Canada") return "CAD";
  return "CAD";
}
