import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Zap, CheckCircle2 } from "lucide-react";

export default function CompatibilityScore({ listing, seeker }) {
  const score = useMemo(() => {
    if (!seeker || !listing) return null;

    let points = 0;
    let total = 0;

    // Gender match
    if (listing.gender_preference && listing.gender_preference !== "any") {
      total += 1;
      if (seeker.gender === listing.gender_preference) points += 1;
    }

    // Budget match
    const rentAmount = Number(listing.rent_amount || listing.monthly_rent || 0);
    if (seeker.min_budget && seeker.max_budget && rentAmount > 0) {
      total += 1;
      if (rentAmount >= Number(seeker.min_budget) && rentAmount <= Number(seeker.max_budget)) points += 1;
    }

    // Cleanliness
    if (seeker.cleanliness_level && listing.cleanliness_preference) {
      total += 1;
      if (seeker.cleanliness_level === listing.cleanliness_preference) points += 1;
    }

    // Stay length
    if (seeker.stay_length_preference) {
      total += 1;
      const minMonths = listing.minimum_stay_months || 1;
      const maxMonths = listing.maximum_stay_months || 24;
      const seekerMonths = seeker.stay_length_preference === "short_term" ? 3 : seeker.stay_length_preference === "medium" ? 12 : 24;
      if (seekerMonths >= minMonths && seekerMonths <= maxMonths) points += 1;
    }

    // Pets
    if (seeker.pets && seeker.pets !== "none") {
      total += 1;
      if (listing.pets_allowed) points += 1;
    }

    // LGBTQ+ friendly
    if (seeker.gender === "non_binary" || seeker.gender === "lgbtq") {
      total += 1;
      if (listing.lgbtq_friendly) points += 1;
    }

    // Student status
    if (seeker.student_status) {
      total += 1;
      if (listing.student_friendly) points += 1;
    }

    if (total === 0) return null;
    return Math.round((points / total) * 100);
  }, [listing, seeker]);

  if (!score || score === null) return null;

  const getColor = () => {
    if (score >= 80) return "bg-green-50 border-green-200 text-green-700";
    if (score >= 60) return "bg-blue-50 border-blue-200 text-blue-700";
    if (score >= 40) return "bg-yellow-50 border-yellow-200 text-yellow-700";
    return "bg-orange-50 border-orange-200 text-orange-700";
  };

  const getMessage = () => {
    if (score >= 80) return "Great match! You align well with this listing.";
    if (score >= 60) return "Good match. Lifestyle preferences align well.";
    if (score >= 40) return "Fair match. Consider discussing key preferences.";
    return "Some differences. Talk to the host about your needs.";
  };

  return (
    <div className={`border rounded-lg p-4 ${getColor()}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold flex items-center gap-1">
          <Zap className="w-4 h-4" /> Compatibility
        </h3>
        <span className="text-lg font-bold">{score}%</span>
      </div>
      <div className="w-full bg-white/30 rounded-full h-2 mb-2">
        <div className="bg-current h-full rounded-full transition-all" style={{ width: `${score}%` }} />
      </div>
      <p className="text-xs opacity-90">{getMessage()}</p>
    </div>
  );
}