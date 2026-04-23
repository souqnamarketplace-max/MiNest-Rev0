import { seekerUrl } from '@/lib/listingHelpers';
import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { supabase } from '@/lib/supabase';
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { Search, MapPin, User, Briefcase, DollarSign, MessageSquare, ShieldCheck, PlusCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency, getAvatarFallback } from "@/lib/geoHelpers";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCountry } from '@/lib/CountryContext';
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import ShareButton from "@/components/common/ShareButton";
import SignInRequiredModal from "@/components/modals/SignInRequiredModal";

export default function SearchRoommates() {
  const { country: globalCountry } = useCountry();
  const { user, navigateToLogin, logout } = useAuth();
  const [city, setCity] = useState("");
  const [country, setCountry] = useState(globalCountry || "Canada");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const PAGE_SIZE = 12;

  const filterQuery = useMemo(() => {
    const q = { status: "active" };
    if (country) q.preferred_country = country;
    if (city) q.preferred_cities = city;
    if (budgetMin) q.min_budget = { $gte: Number(budgetMin) };
    if (budgetMax) q.max_budget = { $lte: Number(budgetMax) };
    return q;
  }, [city, country, budgetMin, budgetMax]);

  const { data: allSeekers = [], isLoading, error } = useQuery({
    queryKey: ["seekers", filterQuery],
    queryFn: () => entities.SeekerProfile.filter(filterQuery, "-created_at", 200),
    staleTime: 30000,
  });

  // Log errors for debugging
  React.useEffect(() => {
    if (error) {
      console.error("Seeker fetch error:", error);
    }
  }, [error]);

  // Reset to page 1 on filter change
  useEffect(() => { setCurrentPage(1); }, [city, country, budgetMin, budgetMax]);
  useEffect(() => { setCountry(globalCountry || "Canada"); }, [globalCountry]);

  const totalPages = Math.ceil(allSeekers.length / PAGE_SIZE);
  const seekers = allSeekers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Find a Roommate</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Browse people looking for rooms</p>
        </div>
        <Button
          className="bg-accent hover:bg-accent/90 text-accent-foreground w-full sm:w-auto flex-shrink-0"
          onClick={() => user ? window.location.href = '/seeker-onboarding' : navigateToLogin("/seeker-onboarding")}
        >
          <PlusCircle className="w-4 h-4 mr-1" /> Post Your Profile
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-2xl border border-border p-4 mb-6 sm:mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className="w-full" />
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Country" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Canada">🍁 Canada</SelectItem>
              <SelectItem value="United States">🇺🇸 United States</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" placeholder="Min budget" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} className="w-full" />
          <Input type="number" placeholder="Max budget" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} className="w-full" />
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="rounded-2xl border p-5"><Skeleton className="h-40" /></div>
          ))}
        </div>
      ) : seekers.length === 0 ? (
        <div className="text-center py-20">
          <User className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-1">No roommate seekers found</h3>
          <p className="text-muted-foreground">Try different filters.</p>
        </div>
      ) : (
      <>
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {seekers.map(seeker => (
            <Link key={seeker.id} to={`/seeker/${seeker.id}`} className="bg-card rounded-2xl border border-border p-4 sm:p-5 hover:shadow-lg transition-shadow block cursor-pointer w-full">
              <div className="flex items-start gap-3 mb-4 relative">
                <Avatar className="w-12 h-12 flex-shrink-0">
                   <AvatarImage src={seeker.avatar_url} loading="lazy" decoding="async" />
                   <AvatarFallback className="bg-accent/10 text-accent">
                     {getAvatarFallback(seeker.headline || "S")}
                   </AvatarFallback>
                 </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground line-clamp-1">{seeker.headline || "Roommate Seeker"}</h3>
                  {seeker.preferred_cities?.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" /> {seeker.preferred_cities[0]}{seeker.preferred_cities.length > 1 ? ` +${seeker.preferred_cities.length - 1} more` : ""}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {seeker.verification_badges?.length > 0 && (
                    <ShieldCheck className="w-5 h-5 text-accent" />
                  )}
                  <ShareButton 
                    path={seekerUrl(seeker)}
                    title={seeker.headline || "Check out this roommate seeker"}
                  />
                </div>
              </div>
              {seeker.bio && (
                <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{seeker.bio}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {seeker.lifestyle_tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {seeker.lifestyle_tags.slice(0, 3).map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs capitalize">{tag.replace(/_/g, " ")}</Badge>
                  ))}
                </div>
              )}
              {seeker.min_budget && seeker.max_budget && (
                  <Badge variant="secondary" className="text-xs">
                    <DollarSign className="w-3 h-3 mr-0.5" />
                    {seeker.min_budget}-{seeker.max_budget} {seeker.currency_code}
                  </Badge>
                )}
                {seeker.work_status && (
                  <Badge variant="secondary" className="text-xs">
                    <Briefcase className="w-3 h-3 mr-0.5" /> {seeker.work_status}
                  </Badge>
                )}
                {seeker.move_in_date && (
                  <Badge variant="outline" className="text-xs">Move: {seeker.move_in_date}</Badge>
                )}
              </div>
              <Button 
                variant="outline" 
                className="w-full" 
                size="sm"
                onClick={async () => {
                  if (!user) {
                    setSignInModalOpen(true);
                    return;
                  }
                  try {
                    // Fetch seeker's profile to get display name
                    const seekerProfiles = await entities.UserProfile.filter({ user_id: seeker.owner_user_id });
                    const seekerName = seekerProfiles[0]?.display_name || seekerProfiles[0]?.full_name || seeker.headline || "Seeker";

                    // Find or create conversation - filter by both participants to keep conversations separate
                    let conv = null;
                    try {
                      const { data: existingConvos } = await supabase
                        .from('conversations')
                        .select('*')
                        .contains('participant_ids', [user.id, seeker.owner_user_id])
                        .limit(1);
                      conv = existingConvos?.[0];
                    } catch {}
                    
                    if (!conv) {
                      conv = await entities.Conversation.create({
                        participant_ids: [user.id, seeker.owner_user_id],
                        source_type: "seeker",
                        source_id: seeker.id,
                        status: "active"
                      });
                    }
                    window.location.href = `/messages?id=${conv.id}`;
                  } catch (err) {
                    toast.error("Failed to open chat");
                  }
                }}
              >
                <MessageSquare className="w-3.5 h-3.5 mr-1" /> Contact
              </Button>
            </Link>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 sm:gap-2 mt-8 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="gap-1 h-9 px-3"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Previous</span>
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                item === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground text-sm">…</span>
                ) : (
                  <Button
                    key={item}
                    variant={currentPage === item ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(item)}
                    className="h-9 w-9 p-0"
                  >
                    {item}
                  </Button>
                )
              )
            }

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="gap-1 h-9 px-3"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </>
      )}

      {/* Sign In Required Modal */}
      <SignInRequiredModal
        open={signInModalOpen}
        onOpenChange={setSignInModalOpen}
        title="Sign in to contact a roommate"
        description="Create an account or sign in to start messaging with roommate seekers."
        action="message"
      />
    </div>
  );
}