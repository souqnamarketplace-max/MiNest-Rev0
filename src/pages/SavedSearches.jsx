import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Bell, Search, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import SavedSearchCard from "@/components/search/SavedSearchCard";

export default function SavedSearches() {
  const { user, navigateToLogin, logout } = useAuth();
  const queryClient = useQueryClient();

  const { data: savedSearches = [], isLoading } = useQuery({
    queryKey: ["saved-searches", user?.id],
    queryFn: () => entities.SavedSearch.filter({ user_id: user.id }, "-created_at", 50),
    enabled: !!user?.id,
    staleTime: 20000,
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["saved-searches", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["saved-searches-check", user?.id] });
  };

  const roomSearches = savedSearches.filter((s) => s.search_type !== "roommate_search");
  const roommateSearches = savedSearches.filter((s) => s.search_type === "roommate_search");

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Saved Searches</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Get notified when new rooms match your criteria
          </p>
        </div>
        <Link to="/search">
          <Button size="sm" className="gap-1.5 bg-accent hover:bg-accent/90 text-accent-foreground">
            <Plus className="w-3.5 h-3.5" /> New Search
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : savedSearches.length === 0 ? (
        <div className="flex flex-col items-center text-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <Bell className="w-7 h-7 text-muted-foreground/40" />
          </div>
          <div>
            <p className="font-semibold text-foreground">No saved searches yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Save a search and we'll alert you when new rooms match your filters.
            </p>
          </div>
          <Link to="/search">
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5">
              <Search className="w-4 h-4" /> Start Searching
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {roomSearches.length > 0 && (
            <section>
              {roommateSearches.length > 0 && (
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Room Searches
                </h2>
              )}
              <div className="space-y-2">
                {roomSearches.map((s) => (
                  <SavedSearchCard key={s.id} search={s} onUpdated={refetch} onDeleted={refetch} />
                ))}
              </div>
            </section>
          )}

          {roommateSearches.length > 0 && (
            <section>
              {roomSearches.length > 0 && (
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Roommate Searches
                </h2>
              )}
              <div className="space-y-2">
                {roommateSearches.map((s) => (
                  <SavedSearchCard key={s.id} search={s} onUpdated={refetch} onDeleted={refetch} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}