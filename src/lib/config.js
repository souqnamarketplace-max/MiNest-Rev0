// MiNest Global Configuration
export const APP_CONFIG = {
  name: "MiNest",
  domain: "MiNest.ca",
  tagline: "Smart room and roommate matching for modern renters",
  description: "MiNest helps people find the right room, roommate, and living match across Canada and the USA.",
  supportedCountries: ["Canada", "USA"],
  blockedRegions: ["Quebec", "QC"],
  defaultPaginationSize: 20,
  maxPhotos: 10,
  maxImageSizeMB: 5,
  maxImageSizeBytes: 5 * 1024 * 1024,
  currencies: { Canada: "CAD", USA: "USD" },
  boostPricing: { "7_days": 9.99, "14_days": 16.99, "30_days": 29.99 },
  verificationPricing: { identity: 4.99, background: 19.99 },
  adPlacementLimits: { perPage: 3 },
  quebecExclusionEnabled: true,
};

export const PROVINCES_CANADA = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick",
  "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia",
  "Nunavut", "Ontario", "Prince Edward Island", "Saskatchewan", "Yukon"
];

export const STATES_USA = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire",
  "New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio",
  "Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota",
  "Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia",
  "Wisconsin","Wyoming"
];

export const LISTING_TYPES = [
  { value: "private_room", label: "Private Room" },
  { value: "shared_room", label: "Shared Room" },
  { value: "entire_place", label: "Entire Place (Roommate Wanted)" },
];

export const PROPERTY_TYPES = [
  { value: "apartment", label: "Apartment" },
  { value: "house", label: "House" },
  { value: "condo", label: "Condo" },
  { value: "townhouse", label: "Townhouse" },
  { value: "basement", label: "Basement" },
  { value: "studio", label: "Studio" },
  { value: "other", label: "Other" },
];

export const FURNISHING_OPTIONS = [
  { value: "furnished", label: "Furnished" },
  { value: "unfurnished", label: "Unfurnished" },
  { value: "partially_furnished", label: "Partially Furnished" },
];

export const BATHROOM_TYPES = [
  { value: "private", label: "Private Bathroom" },
  { value: "shared", label: "Shared Bathroom" },
];

export const LIFESTYLE_OPTIONS = {
  cleanliness: ["Very Clean", "Clean", "Average", "Relaxed"],
  sleepSchedule: ["Early Bird", "Night Owl", "Flexible"],
  socialLevel: ["Very Social", "Moderate", "Quiet / Introverted"],
  guestFrequency: ["Never", "Rarely", "Sometimes", "Often"],
  smokingHabit: ["Non-Smoker", "Outdoor Only", "Smoker"],
  petPreference: ["No Pets", "Cat(s)", "Dog(s)", "Other Pets", "Any Pets OK"],
  workStatus: ["Full-Time", "Part-Time", "Student", "Remote Worker", "Freelancer", "Other"],
  noiseLevel: ["Very Quiet", "Moderate Noise OK", "Not Sensitive"],
};

export const GENDER_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-Binary" },
];

export const USER_ROLES = ["guest", "seeker", "lister", "both", "admin"];
export const LISTING_STATUSES = ["draft", "pending_review", "active", "paused", "expired", "rejected", "removed"];
export const ACCOUNT_STATUSES = ["active", "pending_review", "suspended", "banned"];