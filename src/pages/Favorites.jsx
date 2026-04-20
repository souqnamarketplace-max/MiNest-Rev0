import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Heart, Trash2, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency } from "@/lib/geoHelpers";
import { toast } from "sonner";

export default function Favorites() {
  const { user, navigateToLogin, logout } = useAuth();
  const queryClient = useQueryClient();

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ["favorites", user?.id],
    queryFn: () => entities.Favorite.filter({ user_id: user.id }, "-created_at", 50),
    enabled: !!user,
  });

  // Fetch slugs for all favorited listings in one batch
  const { data: listingSlugs = {} } = useQuery({
    queryKey: ["favorite-slugs", favorites.map(f => f.listing_id).join(",")],
    queryFn: async () => {
      if (!favorites.length) return {};
      const ids = favorites.map(f => f.listing_id);
      const { supabase } = await import("@/lib/supabase");
      const { data } = await supabase
        .from("listings")
        .select("id, slug")
        .in("id", ids);
      return Object.fromEntries((data || []).map(l => [l.id, l.slug]));
    },
    enabled: favorites.length > 0,
  });

  const handleRemove = async (fav) => {
    await entities.Favorite.delete(fav.id);
    queryClient.invalidateQueries({ queryKey: ["favorites"] });
    toast.success("Removed from favorites");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">Your Favorites</h1>

      {isLoading ? (
        <div className="space-y-3">{Array(3).fill(0).map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : favorites.length === 0 ? (
        <div className="text-center py-20">
          <Heart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-1">No saved rooms yet</h3>
          <p className="text-muted-foreground mb-4">Browse rooms and tap the heart to save them here.</p>
          <Link to="/search"><Button className="bg-accent text-accent-foreground">Browse Rooms</Button></Link>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map(fav => (
            <div key={fav.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                {fav.listing_cover_photo ? (
                  <img src={fav.listing_cover_photo} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No img</div>}
              </div>
              <div className="flex-1 min-w-0">
                <Link to={`/listing/${listingSlugs[fav.listing_id] || fav.listing_id}`} className="font-semibold text-foreground hover:text-accent line-clamp-1">
                  {fav.listing_title}
                </Link>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="w-3 h-3" /> {fav.listing_city}
                </div>
                {fav.listing_price && (
                  <span className="text-sm font-semibold text-accent">{formatCurrency(fav.listing_price)}/mo</span>
                )}
              </div>
              <Button variant="ghost" size="icon" aria-label="Remove from favorites" className="text-destructive" onClick={() => handleRemove(fav)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}