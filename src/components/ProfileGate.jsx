import React from "react";
import { useQuery } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { isProfileComplete, getMissingFields, formatFieldName } from "@/lib/profileValidation";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * ProfileGate: Wraps content and blocks it until profile is complete.
 * Shows a banner with required fields and link to complete profile.
 */
export function useProfileCheck(userType = "lister") {
  const { user, navigateToLogin, logout } = useAuth();
  const { data: profiles = [] } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => entities.UserProfile.filter({ user_id: user.id }),
    enabled: !!user,
  });

  const profile = profiles[0];
  const isComplete = isProfileComplete(profile, userType);
  const missingFields = !isComplete ? getMissingFields(profile, userType) : [];

  return { profile, isComplete, missingFields };
}

export function ProfileIncompleteWarning({ userType = "lister", missingFields }) {
  if (!missingFields || missingFields.length === 0) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-start gap-3 mb-6">
      <AlertCircle className="w-5 h-5 text-yellow-700 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-yellow-800">
          Complete Your Profile
        </p>
        <p className="text-xs text-yellow-700 mt-1">
          Missing required fields: {missingFields.map(f => formatFieldName(f)).join(", ")}
        </p>
      </div>
      <Link to="/profile" className="flex-shrink-0">
        <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white">
          Complete
        </Button>
      </Link>
    </div>
  );
}