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

// ============================================
// NEW: Property detail options
// ============================================

export const FLOOR_LEVEL_OPTIONS = [
  { value: "basement", label: "Basement" },
  { value: "ground", label: "Ground Floor" },
  { value: "upper", label: "Upper Floor" },
];

export const LAUNDRY_OPTIONS = [
  { value: "in_unit", label: "In-Unit" },
  { value: "in_building", label: "In-Building" },
  { value: "none", label: "No Laundry" },
];

export const KITCHEN_ACCESS_OPTIONS = [
  { value: "private", label: "Private Kitchen" },
  { value: "shared", label: "Shared Kitchen" },
  { value: "limited", label: "Limited Access" },
];

export const AC_HEATING_OPTIONS = [
  { value: "central", label: "Central AC/Heat" },
  { value: "window_unit", label: "Window Unit" },
  { value: "radiator", label: "Radiator" },
  { value: "baseboard", label: "Baseboard" },
  { value: "none", label: "None" },
];

export const BEDS_IN_ROOM_OPTIONS = [
  { value: 1, label: "1 Bed" },
  { value: 2, label: "2 Beds" },
  { value: 3, label: "3 Beds" },
  { value: 4, label: "4 Beds" },
];

export const TOTAL_BEDROOMS_OPTIONS = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
  { value: 6, label: "6+" },
];

export const CURRENT_ROOMMATES_OPTIONS = [
  { value: 0, label: "0 (Empty)" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5+" },
];

// ============================================
// NEW: Daily rental / booking options
// ============================================

export const BOOKING_MODE_OPTIONS = [
  { value: "inquiry", label: "Inquiry Only", description: "Guests message you first, you arrange everything manually" },
  { value: "booking_required", label: "Booking Required", description: "Guests select dates and submit a booking request for your approval" },
];

export const CANCELLATION_POLICY_OPTIONS = [
  { value: "flexible", label: "Flexible", description: "Full refund if cancelled 24 hours before check-in" },
  { value: "moderate", label: "Moderate", description: "Full refund if cancelled 5 days before check-in" },
  { value: "strict", label: "Strict", description: "50% refund if cancelled 7 days before check-in" },
];

export const CHECKIN_TIME_OPTIONS = [
  { value: "12:00", label: "12:00 PM" },
  { value: "13:00", label: "1:00 PM" },
  { value: "14:00", label: "2:00 PM" },
  { value: "15:00", label: "3:00 PM" },
  { value: "16:00", label: "4:00 PM" },
  { value: "17:00", label: "5:00 PM" },
  { value: "18:00", label: "6:00 PM" },
];

export const CHECKOUT_TIME_OPTIONS = [
  { value: "08:00", label: "8:00 AM" },
  { value: "09:00", label: "9:00 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "12:00", label: "12:00 PM" },
];

export const BOOKING_STATUS_OPTIONS = [
  { value: "pending", label: "Pending", color: "yellow" },
  { value: "confirmed", label: "Confirmed", color: "green" },
  { value: "declined", label: "Declined", color: "red" },
  { value: "cancelled", label: "Cancelled", color: "gray" },
  { value: "completed", label: "Completed", color: "blue" },
  { value: "no_show", label: "No Show", color: "red" },
];

// ============================================
// Existing constants (unchanged)
// ============================================

export const USER_ROLES = ["guest", "seeker", "lister", "both", "admin"];
export const LISTING_STATUSES = ["draft", "pending_review", "active", "paused", "expired", "rejected", "removed"];
export const ACCOUNT_STATUSES = ["active", "pending_review", "suspended", "banned"];
