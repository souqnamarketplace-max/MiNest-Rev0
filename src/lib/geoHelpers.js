import { APP_CONFIG, PROVINCES_CANADA, STATES_USA } from "./config";

export function isQuebec(region) {
  if (!region) return false;
  const normalized = region.trim().toLowerCase();
  return normalized === "quebec" || normalized === "qc" || normalized === "québec";
}

export function isValidCountry(country) {
  return APP_CONFIG.supportedCountries.includes(country);
}

export function isValidRegion(country, region) {
  if (!isValidCountry(country)) return false;
  if (isQuebec(region)) return false;
  if (country === "Canada") return PROVINCES_CANADA.includes(region);
  if (country === "USA") return STATES_USA.includes(region);
  return false;
}

export function getRegionsForCountry(country) {
  if (country === "Canada") return PROVINCES_CANADA;
  if (country === "USA") return STATES_USA;
  return [];
}

export function getCurrencyForCountry(country) {
  return APP_CONFIG.currencies[country] || "USD";
}

export function formatCurrency(amount, currency = "CAD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getDisplayName(user) {
  if (!user) return "Anonymous";
  if (user.display_name) return user.display_name;
  if (user.full_name) return user.full_name;
  if (user.full_name) return user.full_name.split(' ')[0];
  return "User";
}

export function getAvatarFallback(name) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export function formatDate(date) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });
}