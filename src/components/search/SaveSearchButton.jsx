import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Bookmark, BookmarkCheck } from "lucide-react";
import SaveSearchModal from "./SaveSearchModal";

/**
 * Compact "Save Search" button shown near filter bar.
 * Shows a filled bookmark if the current filters already match a saved search.
 */
export default function SaveSearchButton({ filters = {}, searchType = "room_search" }) {
  const { user, navigateToLogin, logout } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: savedSearches = [], refetch } = useQuery({
    queryKey: ["saved-searches-check", user?.id],
    queryFn: () => entities.SavedSearch.filter({ user_id: user.id, is_active: true }),
    enabled: !!user,
    staleTime: 30000,
  });

  // Check if current filters roughly match an existing saved search
  const alreadySaved = savedSearches.some((s) => {
    const cityMatch = !filters.city || s.city?.toLowerCase() === filters.city?.toLowerCase();
    const countryMatch = !filters.country || s.country === filters.country;
    const provinceMatch = !filters.province_or_state || s.province_or_state === filters.province_or_state;
    return cityMatch && countryMatch && provinceMatch;
  });

  return (
    <>
      <Button
        variant={alreadySaved ? "secondary" : "outline"}
        size="sm"
        className="gap-1.5 shrink-0"
        onClick={() => {
          if (!user) {
            navigateToLogin(window.location.href);
            return;
          }
          setModalOpen(true);
        }}
        title={alreadySaved ? "Similar search already saved" : "Save this search"}
      >
        {alreadySaved
          ? <><BookmarkCheck className="w-3.5 h-3.5" /><span className="hidden sm:inline">Saved</span></>
          : <><Bookmark className="w-3.5 h-3.5" /><span className="hidden sm:inline">Save Search</span></>
        }
      </Button>

      <SaveSearchModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        filters={filters}
        searchType={searchType}
        onSaved={() => refetch()}
      />
    </>
  );
}