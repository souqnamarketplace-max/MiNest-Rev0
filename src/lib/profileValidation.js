/**
 * Profile validation utilities
 * Enforces mandatory profile fields for all users
 */

const MANDATORY_FIELDS = {
  all: ["full_name", "phone", "city", "avatar_url"],  // All users must have these
  seeker: ["headline"],  // Seekers additionally need headline
};

export function isProfileComplete(profile, userType = "lister") {
  if (!profile) return false;
  for (const field of MANDATORY_FIELDS.all) {
    if (!profile[field]?.toString().trim()) return false;
  }
  if (userType === "seeker" || userType === "both") {
    for (const field of MANDATORY_FIELDS.seeker) {
      if (!profile[field]?.toString().trim()) return false;
    }
  }
  return true;
}

export function getMissingFields(profile, userType = "lister") {
  const missing = [];
  for (const field of MANDATORY_FIELDS.all) {
    if (!profile?.[field]?.toString().trim()) missing.push(field);
  }
  if (userType === "seeker" || userType === "both") {
    for (const field of MANDATORY_FIELDS.seeker) {
      if (!profile?.[field]?.toString().trim()) missing.push(field);
    }
  }
  return missing;
}

export function formatFieldName(field) {
  const names = {
    full_name: "Full Name",
    phone: "Phone",
    city: "City",
    avatar_url: "Profile Photo",
    headline: "Headline",
  };
  return names[field] || field;
}
