import React from "react";
import { Badge } from "@/components/ui/badge";
import { Users, Cigarette, Heart, PawPrint, Sparkles, Volume2, Home } from "lucide-react";

const preferenceConfig = {
  gender_preference: { icon: Users, label: "Gender Preference" },
  cleanliness_preference: { icon: Sparkles, label: "Cleanliness" },
  noise_tolerance: { icon: Volume2, label: "Noise Level" },
  smoking_allowed: { icon: Cigarette, label: "Smoking" },
  pets_allowed: { icon: PawPrint, label: "Pets" },
  lgbtq_friendly: { icon: Heart, label: "LGBTQ+ Friendly" },
};

export default function PreferenceChips({ listing, seeker }) {
  const preferences = [];

  // Host preferences
  if (listing?.gender_preference && listing.gender_preference !== "any") {
    preferences.push({
      label: `Prefers ${listing.gender_preference} roommates`,
      variant: "secondary",
      icon: Users,
    });
  }

  if (listing?.cleanliness_preference) {
    preferences.push({
      label: `${listing.cleanliness_preference} household`,
      variant: "secondary",
      icon: Sparkles,
    });
  }

  if (listing?.couples_allowed) {
    preferences.push({
      label: "Couples welcome",
      variant: "outline",
      icon: Heart,
    });
  }

  if (listing?.lgbtq_friendly) {
    preferences.push({
      label: "LGBTQ+ friendly",
      variant: "outline",
      icon: Heart,
    });
  }

  // Seeker compatibility (if user has seeker profile)
  if (seeker) {
    const compatFlags = [];
    if (seeker.gender === listing?.gender_preference || listing?.gender_preference === "any") compatFlags.push("✓ Gender match");
    if (seeker.cleanliness_level === listing?.cleanliness_preference) compatFlags.push("✓ Cleanliness align");
    if (seeker.age && listing?.age_preference_min && listing?.age_preference_max) {
      if (seeker.age >= listing.age_preference_min && seeker.age <= listing.age_preference_max) compatFlags.push("✓ Age fit");
    }
  }

  if (preferences.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">Host Preferences</h3>
      <div className="flex flex-wrap gap-2">
        {preferences.map((pref, i) => (
          <Badge key={i} variant={pref.variant} className="text-xs flex items-center gap-1">
            {pref.icon && <pref.icon className="w-3 h-3" />}
            {pref.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}