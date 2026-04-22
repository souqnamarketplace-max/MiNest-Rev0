import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from '@/lib/supabase';
import { entities, invokeFunction } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  MapPin, Calendar, DollarSign, Bed, Bath, Car, Wifi, Heart, ShieldCheck, Sparkles, Users, MessageSquare, ArrowLeft, Flag, Home, Cigarette, PawPrint, GraduationCap, Share2, FileText, X, Clock, AlertCircle, Edit, CreditCard, Grid3x3
} from "lucide-react";
import { getParkingDetailDisplay, getParkingLabel } from "@/lib/parkingHelpers";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, getDisplayName } from "@/lib/geoHelpers";
import { formatRentPrice, getCurrencyByCountry } from "@/lib/pricingHelpers";
import { useCountry } from "@/lib/CountryContext";
import { useHaptic, HapticPatterns } from "@/lib/hapticFeedback";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import HostCard from "@/components/listings/HostCard";
import TrustBadges from "@/components/listings/TrustBadges";
import RentDetailsTable from "@/components/listings/RentDetailsTable";
import PreferenceChips from "@/components/listings/PreferenceChips";
import CompatibilityScore from "@/components/listings/CompatibilityScore";
import MobileListingCTA from "@/components/listings/MobileListingCTA";
import SignInRequiredModal from "@/components/modals/SignInRequiredModal";
import ViewingRequestModal from "@/components/modals/ViewingRequestModal";
import ViewerAppointmentStatus from "@/components/viewing/ViewerAppointmentStatus";
import BookingRequestModal from "@/components/bookings/BookingRequestModal";
import PhotoLightbox from "@/components/listings/PhotoLightbox";
import RentPaymentCTA from "@/components/payments/RentPaymentCTA";
import RentalOfferModal from "@/components/payments/RentalOfferModal";
import TenantRentalRequestModal from "@/components/payments/TenantRentalRequestModal";
import SchemaInjector from "@/components/seo/SchemaInjector";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import { buildListingSchema, buildBreadcrumbSchema, cityPageUrl, setPageMeta } from "@/lib/seoHelpers";
import { notifyReportFiled, notifyNewMessage } from "@/lib/notificationService";

export default function ListingDetail() {
  const listingId = window.location.pathname.split("/listing/")[1];
  const { user, navigateToLogin, logout } = useAuth();
  const { country, convertPrice } = useCountry();
  const currency = getCurrencyByCountry(country);
  const navigate = useNavigate();
  const triggerHaptic = useHaptic();

  useEffect(() => {
    window.scrollTo(0, 0);
    // increment-views only works in production (Vercel serverless)
    // Skip in dev to avoid 404 errors
  }, [listingId]);

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriting, setFavoriting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const [viewingModalOpen, setViewingModalOpen] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [viewerAppointment, setViewerAppointment] = useState(null);
  const [refreshAppointment, setRefreshAppointment] = useState(0);
  const [rentalOfferOpen, setRentalOfferOpen] = useState(false);
  const [userProfile, setUserProfile] = useState(null);



  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", listingId],
    queryFn: async () => {
      // Support both UUID and slug in the URL
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(listingId);
      if (isUuid) {
        const listings = await entities.Listing.filter({ id: listingId });
        return listings[0] || null;
      } else {
        const listings = await entities.Listing.filter({ slug: listingId });
        return listings[0] || null;
      }
    },
    enabled: !!listingId,
  });

  // Inject SEO meta tags for listing
  useEffect(() => {
    if (!listing) return;
    const price = listing.rent_amount || listing.monthly_rent || 0;
    const period = listing.rent_period || "monthly";
    const periodSuffix = period === "daily" ? "/day" : period === "weekly" ? "/wk" : "/mo";
    const priceDisplay = price > 0 ? `$${Math.round(price).toLocaleString()}${periodSuffix}` : "";
    const loc = [listing.neighborhood, listing.city, listing.province_or_state].filter(Boolean).join(", ");
    const ogImg = listing.cover_photo_url || listing.photos?.[0] || "";
    setPageMeta({
      title: `${listing.title}${priceDisplay ? ` — ${priceDisplay}` : ""} | Room for Rent in ${loc} | MiNest`,
      description: `Room for rent in ${loc}. ${listing.description ? listing.description.slice(0, 140).trimEnd() + "..." : "Browse verified rooms and shared housing on MiNest."}`,
      canonical: `/listing/${listing.slug || listing.id}`,
      ogImage: ogImg,
      ogType: "website",
    });
    return () => {
      document.title = "MiNest | Find Rooms, Roommates & Pay Rent Online — Canada & USA";
    };
  }, [listing]);

  // Auto-fetch Walk Score if not yet populated
  useEffect(() => {
    if (!listing || listing.walk_score != null || !listing.latitude || !listing.longitude) return;
    (async () => {
      try {
        const { fetchAndSaveWalkScore } = await import("@/lib/walkScore");
        await fetchAndSaveWalkScore(listing);
        queryClient.invalidateQueries({ queryKey: ["listing", listingId] });
      } catch {}
    })();
  }, [listing?.id]);

  const { data: hostProfile } = useQuery({
    queryKey: ["hostProfile", listing?.owner_user_id],
    queryFn: async () => {
      const profiles = await entities.UserProfile.filter({ user_id: listing.owner_user_id });
      return profiles[0] || null;
    },
    enabled: !!listing?.owner_user_id,
  });

  const { data: seekerProfile } = useQuery({
    queryKey: ["seekerProfile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const profiles = await entities.SeekerProfile.filter({ owner_user_id: user.id });
      return profiles[0] || null;
    },
    enabled: !!user?.id,
  });

  const { data: userProfileData } = useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const profiles = await entities.UserProfile.filter({ user_id: user.id });
      return profiles[0] || null;
    },
    enabled: !!user?.id,
  });

  const { data: activeAgreement } = useQuery({
    queryKey: ["activeAgreement", listingId, user?.id],
    queryFn: async () => {
      if (!user?.id || !listing?.id) return null;
      const { data: agreements } = await supabase
        .from('rental_agreements')
        .select('*')
        .eq('listing_id', listing.id)
        .eq('tenant_user_id', user.id)
        .in('status', ['pending_tenant', 'accepted', 'active'])
        .order('created_at', { ascending: false })
        .limit(1);
      return agreements[0] || null;
    },
    enabled: !!user?.id && !!listing?.id,
  });

  useEffect(() => {
    setUserProfile(userProfileData);
  }, [userProfileData]);

  const { data: viewerAppointmentData } = useQuery({
    queryKey: ["viewerAppointment", listingId, user?.id, refreshAppointment],
    queryFn: async () => {
      if (!user?.id || !listing?.id) return null;
      const appts = await entities.ViewingAppointment.filter({
        listing_id: listing.id,
        viewer_user_id: user.id,
      });
      return appts[0] || null;
    },
    enabled: !!user?.id && !!listing?.id,
  });

  React.useEffect(() => {
    setViewerAppointment(viewerAppointmentData);
  }, [viewerAppointmentData]);

  const { data: favorites } = useQuery({
    queryKey: ["favorites", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const favs = await entities.Favorite.filter({ user_id: user.id });
      return favs;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (favorites) {
      setIsFavorited(favorites.some(f => f.listing_id === listing?.id || f.listing_id === listingId));
    }
  }, [favorites, listingId]);

  const handleContact = async (skipMessage = false) => {
    if (!user) {
      setSignInModalOpen(true);
      return;
    }
    setSending(true);
    try {
      // Fetch owner's profile to get their display name
      const ownerProfiles = await entities.UserProfile.filter({ user_id: listing.owner_user_id });
      const ownerName = ownerProfiles[0]?.display_name || ownerProfiles[0]?.full_name || listing.owner_user_id;

      // Use supabase directly to query array column correctly
      const { data: existingConvos } = await supabase
        .from('conversations')
        .select('*')
        .eq('listing_id', listing.id)
        .contains('participant_ids', [user.id, listing.owner_user_id])
        .limit(1);
      
      let convo = existingConvos?.[0];
      if (!convo) {
        convo = await entities.Conversation.create({
          participant_ids: [user.id, listing.owner_user_id],
          listing_id: listing.id,
          listing_title: listing.title,
          last_message_text: message || "",
          last_message_at: new Date().toISOString(),
        });
      }
      // Only create a message if there's text (desktop flow)
      if (message.trim()) {
        await entities.Message.create({
          conversation_id: convo.id,
          sender_user_id: user.id,
          content: message,
        });
        await entities.Conversation.update(convo.id, {
          last_message_text: message,
          last_message_at: new Date().toISOString(),
        });
        toast.success("Message sent!");
        // Notify the listing owner
        notifyNewMessage({ recipientId: listing.owner_user_id, senderName: user.full_name || user.email, messagePreview: message, conversationId: convo.id });
        setMessage("");
      }
      navigate(`/messages?id=${convo.id}`);
    } catch (err) {
      toast.error("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const handleFavorite = async () => {
    if (!user) {
      navigateToLogin(window.location.href);
      return;
    }
    if (favoriting) return;
    setFavoriting(true);
    try {
      if (isFavorited) {
        const fav = favorites.find(f => f.listing_id === listing?.id || f.listing_id === listingId);
        if (fav) await entities.Favorite.delete(fav.id);
        setIsFavorited(false);
        toast.success("Removed from favorites");
        triggerHaptic(HapticPatterns.LIGHT_TAP);
      } else {
        await entities.Favorite.create({
          user_id: user.id,
          listing_id: listing.id,
          listing_title: listing.title,
          listing_cover_photo: listing.cover_photo_url,
          listing_city: listing.city,
        });
        setIsFavorited(true);
        toast.success("Added to favorites");
        triggerHaptic(HapticPatterns.SUCCESS);
      }
    } catch (err) {
      toast.error("Failed to update favorites.");
      triggerHaptic(HapticPatterns.ERROR);
    } finally {
      setFavoriting(false);
    }
  };

  const handleReportSubmit = async () => {
    if (!reportReason) {
      toast.error("Please select a reason");
      return;
    }
    if (!user) {
      // Redirect to login, then return to this page
      navigateToLogin(window.location.href);
      return;
    }
    setReportSubmitting(true);
    try {
      await entities.Report.create({
        reporter_user_id: user.id,
        target_type: "listing",
        target_id: listingId,
        reason: reportReason,
        details: reportDetails,
        status: "pending"
      });
      toast.success("Report submitted. Thank you for helping us keep the community safe.");
      notifyReportFiled({ reporterName: user?.user_metadata?.full_name, targetType: 'listing', reason: reportReason });
      setReportOpen(false);
      setReportReason("");
      setReportDetails("");
    } catch (err) {
      toast.error("Failed to submit report.");
    } finally {
      setReportSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 rounded-2xl" />
        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="h-48 md:col-span-2" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-2">Listing not found</h2>
        <Link to="/search"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Search</Button></Link>
      </div>
    );
  }

  const photos = listing.photos?.length > 0 ? listing.photos : (listing.cover_photo_url ? [listing.cover_photo_url] : []);

  const amenityList = [
    { show: listing.internet_included, icon: Wifi, label: "Internet Included" },
    { show: listing.bills_included, icon: DollarSign, label: "Bills Included" },
    { show: listing.furnishing === "furnished", icon: Bed, label: "Furnished" },
    { show: listing.furnishing === "partially_furnished", icon: Bed, label: "Partially Furnished" },
    { show: listing.bathroom_type === "private", icon: Bath, label: "Private Bathroom" },
    { show: listing.pets_allowed, icon: PawPrint, label: "Pets Allowed" },
    { show: listing.smoking_allowed, icon: Cigarette, label: "Smoking Allowed" },
    { show: listing.student_friendly, icon: GraduationCap, label: "Student Friendly" },
    { show: listing.lgbtq_friendly, icon: Heart, label: "LGBTQ+ Friendly" },
    { show: listing.couples_allowed, icon: Users, label: "Couples Allowed" },
  ].filter(a => a.show);

  const isOwner = user?.id === listing?.owner_user_id;

  const handleScheduleViewingClick = () => {
    if (!user) {
      setSignInModalOpen(true);
      return;
    }
    setViewingModalOpen(true);
  };

  const handleRentalRequestClick = () => {
    if (!user) {
      setSignInModalOpen(true);
      return;
    }
    setRentalOfferOpen(true);
  };

  const handleBookingClick = () => {
    if (!user) {
      setSignInModalOpen(true);
      return;
    }
    setBookingModalOpen(true);
  };

  const listingSchema = listing ? buildListingSchema(listing, hostProfile) : null;
  const breadcrumbSchema = listing ? buildBreadcrumbSchema([
    { name: "Home", path: "/" },
    { name: "Search Rooms", path: "/search" },
    ...(listing.city ? [{ name: `Rooms in ${listing.city}`, path: cityPageUrl(listing.city) }] : []),
    { name: listing.title, path: `/listing/${listing.slug || listing.id}` },
  ]) : null;

  return (
    <div className="pb-24 lg:pb-0 overflow-x-hidden">
      {listingSchema && <SchemaInjector id="__listing_ld" schema={listingSchema} />}
      {breadcrumbSchema && <SchemaInjector id="__listing_breadcrumb_ld" schema={breadcrumbSchema} />}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 w-full">
        {/* Breadcrumbs */}
        {listing && (
          <Breadcrumbs items={[
            { name: "Home", path: "/" },
            { name: "Search", path: "/search" },
            ...(listing.city ? [{ name: `Rooms in ${listing.city}`, path: cityPageUrl(listing.city) }] : []),
            { name: listing.title, path: `/listing/${listing.slug || listing.id}` },
          ]} />
        )}

        {/* Hero Gallery */}
         {photos.length > 0 && (
          <div className="mb-6 w-full">
            {/* Main photo + side photos grid (desktop) */}
            <div className="relative rounded-2xl overflow-hidden bg-muted">
              {photos.length >= 3 ? (
                /* Grid layout for 3+ photos */
                <div className="grid grid-cols-1 sm:grid-cols-4 sm:grid-rows-2 gap-1 sm:gap-1.5 aspect-[16/9] sm:aspect-[2/1]">
                  {/* Main large photo */}
                  <div
                    className="sm:col-span-2 sm:row-span-2 relative cursor-pointer group"
                    onClick={() => { setSelectedPhoto(0); setLightboxOpen(true); }}
                  >
                    <img src={photos[0]} alt={`${listing.title} — main photo`}
                      className="w-full h-full object-cover group-hover:brightness-90 transition-all duration-300" loading="eager" />
                  </div>
                  {/* Side photos */}
                  {photos.slice(1, 5).map((p, i) => (
                    <div
                      key={i}
                      className="hidden sm:block relative cursor-pointer group"
                      onClick={() => { setSelectedPhoto(i + 1); setLightboxOpen(true); }}
                    >
                      <img src={p} alt={`${listing.title} — photo ${i + 2}`}
                        className="w-full h-full object-cover group-hover:brightness-90 transition-all duration-300" loading="lazy" />
                    </div>
                  ))}
                  {/* Show all photos button */}
                  <button
                    onClick={() => setLightboxOpen(true)}
                    className="absolute bottom-3 right-3 bg-white/95 dark:bg-black/80 text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold shadow-lg hover:bg-white dark:hover:bg-black transition-colors flex items-center gap-1.5 backdrop-blur-sm border border-border/50"
                  >
                    <Grid3x3 className="w-3.5 h-3.5" />
                    Show all {photos.length} photos
                  </button>
                </div>
              ) : (
                /* Single/double photo — simple view */
                <div
                  className="relative aspect-video cursor-pointer group"
                  onClick={() => setLightboxOpen(true)}
                >
                  <img src={photos[selectedPhoto]} alt={`${listing.title}`}
                    className="w-full h-full object-cover group-hover:brightness-90 transition-all duration-300" loading="eager" />
                  {photos.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
                      className="absolute bottom-3 right-3 bg-white/95 dark:bg-black/80 text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold shadow-lg flex items-center gap-1.5"
                    >
                      <Grid3x3 className="w-3.5 h-3.5" />
                      {photos.length} photos
                    </button>
                  )}
                </div>
              )}
              {/* Badges */}
              {listing.is_featured && (
                <div className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-accent text-accent-foreground px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 shadow-md">
                  <Sparkles className="w-3 h-3" /> Featured
                </div>
              )}
              {listing.is_boosted && (
                <div className="absolute top-3 left-28 sm:top-4 sm:left-40 bg-secondary text-secondary-foreground px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-semibold shadow-md">
                  Boosted
                </div>
              )}
            </div>
            {/* Thumbnail strip (mobile) */}
            {photos.length > 1 && (
              <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 sm:hidden">
                {photos.map((p, i) => (
                  <button 
                    key={i}
                    onClick={() => { setSelectedPhoto(i); setLightboxOpen(true); }}
                    className={`w-14 h-10 rounded-md overflow-hidden flex-shrink-0 border-2 transition-colors ${i === selectedPhoto ? "border-accent" : "border-transparent"}`}
                  >
                    <img src={p} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8 w-full">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6 w-full min-w-0">
            {/* Title & Badges */}
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex flex-wrap gap-2">
                  {listing.verification_badges?.length > 0 && (
                    <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">
                      <ShieldCheck className="w-3 h-3 mr-1" /> Verified Host
                    </Badge>
                  )}
                </div>
                {!isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleFavorite}
                    disabled={favoriting}
                    className="flex-shrink-0"
                  >
                    <Heart className={`w-5 h-5 ${isFavorited ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                  </Button>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2 break-words">{listing.title}</h1>
              <div className="text-2xl font-bold text-accent">
                {formatRentPrice(listing.rent_amount || listing.monthly_rent, listing.rent_period || "monthly", currency, convertPrice)}
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                {[listing.neighborhood, listing.city, listing.province_or_state].filter(Boolean).join(", ")}
              </div>
            </div>

            {/* Quick Info Grid */}
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 w-full">
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <Calendar className="w-5 h-5 mx-auto text-accent mb-1" />
                <div className="text-sm font-semibold">{listing.available_from ? formatDate(listing.available_from) : "Flexible"}</div>
                <div className="text-xs text-muted-foreground">Available</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <Home className="w-5 h-5 mx-auto text-accent mb-1" />
                <div className="text-sm font-semibold capitalize">{listing.property_type || "—"}</div>
                <div className="text-xs text-muted-foreground">Type</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <Bed className="w-5 h-5 mx-auto text-accent mb-1" />
                <div className="text-sm font-semibold">{listing.listing_type?.includes("room") ? "Room" : "Apt"}</div>
                <div className="text-xs text-muted-foreground">Living Space</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <Calendar className="w-5 h-5 mx-auto text-accent mb-1" />
                <div className="text-sm font-semibold">{listing.minimum_stay_months ? `${listing.minimum_stay_months}mo+` : "Flex"}</div>
                <div className="text-xs text-muted-foreground">Min Stay</div>
              </div>
            </div>


          {/* Walk / Transit / Bike Scores */}
          {(listing.walk_score != null || listing.transit_score != null || listing.bike_score != null) && (
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="font-semibold text-foreground mb-3">Transportation Scores</h3>
              <div className="grid grid-cols-3 gap-4">
                {listing.walk_score != null && (
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${listing.walk_score >= 70 ? "text-emerald-600" : listing.walk_score >= 50 ? "text-yellow-600" : "text-orange-500"}`}>
                      {listing.walk_score}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Walk Score</div>
                  </div>
                )}
                {listing.transit_score != null && (
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${listing.transit_score >= 70 ? "text-emerald-600" : listing.transit_score >= 50 ? "text-yellow-600" : "text-orange-500"}`}>
                      {listing.transit_score}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Transit Score</div>
                  </div>
                )}
                {listing.bike_score != null && (
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${listing.bike_score >= 70 ? "text-emerald-600" : listing.bike_score >= 50 ? "text-yellow-600" : "text-orange-500"}`}>
                      {listing.bike_score}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Bike Score</div>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-3 text-center">Scores provided by Walk Score®</p>
            </div>
          )}

          {/* Property Details */}
          {(listing.total_bedrooms || listing.current_roommates !== null || listing.room_size_sqft || listing.laundry || listing.kitchen_access || listing.floor_level || listing.ac_heating) && (
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="font-semibold text-foreground mb-3">Property Details</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {listing.total_bedrooms && <div className="flex items-center gap-2"><Bed className="w-4 h-4 text-accent" /><span>{listing.total_bedrooms} Bedroom{listing.total_bedrooms > 1 ? "s" : ""}</span></div>}
                {listing.current_roommates !== null && listing.current_roommates !== undefined && <div className="flex items-center gap-2"><Users className="w-4 h-4 text-accent" /><span>{listing.current_roommates} Roommate{listing.current_roommates !== 1 ? "s" : ""}</span></div>}
                {listing.room_size_sqft && <div className="flex items-center gap-2"><Home className="w-4 h-4 text-accent" /><span>{listing.room_size_sqft} sq ft</span></div>}
                {listing.beds_in_room && <div className="flex items-center gap-2"><Bed className="w-4 h-4 text-accent" /><span>{listing.beds_in_room} Bed{listing.beds_in_room > 1 ? "s" : ""} in Room</span></div>}
                {listing.laundry && <div className="flex items-center gap-2"><Home className="w-4 h-4 text-accent" /><span className="capitalize">{listing.laundry.replace(/_/g, " ")}</span></div>}
                {listing.kitchen_access && <div className="flex items-center gap-2"><Home className="w-4 h-4 text-accent" /><span className="capitalize">{listing.kitchen_access} Kitchen</span></div>}
                {listing.floor_level && <div className="flex items-center gap-2"><Home className="w-4 h-4 text-accent" /><span className="capitalize">{listing.floor_level} Floor</span></div>}
                {listing.ac_heating && <div className="flex items-center gap-2"><Home className="w-4 h-4 text-accent" /><span className="capitalize">{listing.ac_heating.replace(/_/g, " ")}</span></div>}
              </div>
            </div>
          )}
            {/* Rent Details Table */}
            <RentDetailsTable listing={listing} />

            {/* About the Room */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">About this room</h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{listing.description || "No description provided."}</p>
            </div>

            {/* Parking Details */}
            {listing.parking_status && listing.parking_status !== "not_available" && (
              <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Car className="w-4 h-4 text-accent" />
                  {getParkingLabel(listing.parking_status)}
                </h3>
                {(() => {
                  const details = getParkingDetailDisplay(listing);
                  return (
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {details.type && <div>Type: {details.type}</div>}
                      {details.price && <div>Cost: {details.price}</div>}
                      {details.notes && (
                        <div className="text-xs pt-1 border-t border-accent/10">
                          <span className="text-muted-foreground">Note: {details.notes}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Amenities */}
            {amenityList.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">What's included</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                   {amenityList.map((a, i) => (
                     <div key={i} className="flex items-center gap-2 text-sm text-foreground min-w-0">
                       <a.icon className="w-4 h-4 text-accent flex-shrink-0" />
                       <span className="truncate">{a.label}</span>
                     </div>
                   ))}
                 </div>
              </div>
            )}

            {/* Host Section */}
            <div className="pt-4 border-t border-border">
              <h2 className="text-lg font-semibold mb-4">About the host</h2>
              <HostCard hostProfile={hostProfile} listing={listing} />
            </div>

            {/* Host Preferences */}
            {(listing.gender_preference !== "any" || listing.cleanliness_preference) && (
              <div>
                <PreferenceChips listing={listing} seeker={seekerProfile} />
              </div>
            )}

            {/* Internal Link to City Page */}
            {listing.city && (
              <div className="pt-2">
                <Link
                  to={cityPageUrl(listing.city)}
                  className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                >
                  <MapPin className="w-3 h-3" /> Browse more rooms for rent in {listing.city}
                </Link>
              </div>
            )}

            {/* Owner Actions / Report Section */}
            <div className="flex gap-2 pt-4 border-t border-border">
              {isOwner ? (
                <Link to={`/listing/${listing?.slug || listingId}/edit`}>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Edit className="w-4 h-4" /> Edit Listing
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setReportOpen(true)}>
                  <Flag className="w-4 h-4 mr-2" /> Report Listing
                </Button>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
            {/* Compatibility Score */}
            {seekerProfile && !isOwner && (
              <CompatibilityScore listing={listing} seeker={seekerProfile} />
            )}

            {/* Trust Badges */}
            <TrustBadges hostProfile={hostProfile} listing={listing} />

            {/* Viewer Appointment Status */}
            {!isOwner && viewerAppointment && (
              <ViewerAppointmentStatus 
                appointment={viewerAppointment}
                onStatusChange={() => setRefreshAppointment(r => r + 1)}
              />
            )}

            {/* Book This Place CTA — daily rental listings only */}
            {!isOwner && listing.rent_period === "daily" && (
              <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 rounded-2xl border border-green-500/30 p-5 space-y-3">
                <div className="flex items-start gap-2">
                  <Calendar className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-foreground">Book this place</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Select your dates and request a booking from the host.
                    </p>
                  </div>
                </div>
                {listing.checkin_time && listing.checkout_time && (
                  <div className="text-xs bg-green-500/10 rounded-lg p-2 text-green-700 dark:text-green-400">
                    Check-in after {listing.checkin_time} · Check-out before {listing.checkout_time}
                  </div>
                )}
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
                  onClick={handleBookingClick}
                >
                  <Calendar className="w-4 h-4 mr-2" /> Request Booking
                </Button>
                {listing.cancellation_policy && (
                  <p className="text-xs text-muted-foreground text-center capitalize">
                    {listing.cancellation_policy} cancellation policy
                  </p>
                )}
              </div>
            )}

            {/* Schedule Viewing CTA or Edit Existing */}
            {listing.viewing_enabled && !isOwner && (
              <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-2xl border border-accent/30 p-5 space-y-3">
                <div className="flex items-start gap-2">
                  <Clock className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {viewerAppointment ? "Update Your Viewing" : "Schedule a Viewing"}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {viewerAppointment 
                        ? "Change the date, time, or message for your viewing request" 
                        : "Request a viewing appointment inside MiNest"}
                    </p>
                  </div>
                </div>
                {viewerAppointment && (
                  <div className="text-xs bg-accent/20 rounded-lg p-2 text-accent">
                    Current request: {new Date(viewerAppointment.requested_start_at).toLocaleDateString()} at {new Date(viewerAppointment.requested_start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
                <Button 
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
                  onClick={handleScheduleViewingClick}
                >
                  <Calendar className="w-4 h-4 mr-2" /> 
                  {viewerAppointment ? "Update Request" : "Request a Viewing"}
                </Button>
              </div>
            )}

            {/* Rental Request CTA (if payments enabled and no active agreement) */}
            {!isOwner && listing.payments_enabled && !activeAgreement && (
              <div className="bg-secondary/10 border border-secondary/20 rounded-2xl p-5 space-y-3">
                <div className="flex items-start gap-2">
                  <FileText className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-foreground">Ready to move in?</h3>
                    <p className="text-xs text-muted-foreground mt-1">Send a rental request to discuss terms and sign an agreement.</p>
                  </div>
                </div>
                <Button 
                  className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold"
                  onClick={handleRentalRequestClick}
                >
                  <FileText className="w-4 h-4 mr-2" /> Send Rental Request
                </Button>
              </div>
            )}

            {/* Contact Card */}
            {!isOwner && (
              <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
                <h3 className="font-semibold text-foreground">Interested?</h3>
                <Textarea
                  placeholder="Hi! I'd like to learn more about your room..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[80px] text-sm"
                />
                <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold" onClick={handleContact} disabled={sending || !message.trim()}>
                  <MessageSquare className="w-4 h-4 mr-2" /> {sending ? "Sending..." : "Send Message"}
                </Button>
              </div>
            )}

            {/* Mark as Rented / Re-activate — Owner only */}
            {isOwner && listing.status !== "rented" && (
              <Button
                variant="outline"
                className="w-full text-sm gap-2 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={async () => {
                  if (!window.confirm("Mark this listing as rented? It will be hidden from search after 7 days.")) return;
                  await entities.Listing.update(listing.id, { status: "rented" });
                  queryClient.invalidateQueries({ queryKey: ["listing", id] });
                  toast.success("Listing marked as rented. It will auto-archive in 7 days.");
                }}
              >
                Mark as Rented
              </Button>
            )}
            {isOwner && listing.status === "rented" && (
              <div className="space-y-2">
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-400 text-center">
                  This listing is marked as <strong>rented</strong>. It will auto-archive in 7 days.
                </div>
                <Button
                  variant="outline"
                  className="w-full text-sm gap-2"
                  onClick={async () => {
                    await entities.Listing.update(listing.id, { status: "active" });
                    queryClient.invalidateQueries({ queryKey: ["listing", id] });
                    toast.success("Listing re-activated and visible in search.");
                  }}
                >
                  Re-activate Listing
                </Button>
              </div>
            )}

            {/* Rented banner for visitors */}
            {!isOwner && listing.status === "rented" && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
                <Badge className="bg-red-600 text-white text-sm font-bold px-4 py-1.5 mb-2">Rented</Badge>
                <p className="text-sm text-muted-foreground">This listing has been rented and is no longer available.</p>
              </div>
            )}

            {/* Info Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-900">
              <p className="font-semibold mb-1">Safe to message</p>
              <p className="text-xs leading-relaxed">Your contact info stays private until you're both ready to connect.</p>
            </div>

            {/* Rent Payment CTA (tenant) or Setup Prompt (owner) */}
            {isOwner ? (
              <div className="bg-muted/50 border border-border rounded-2xl p-4 text-center space-y-2">
                <CreditCard className="w-6 h-6 mx-auto text-accent mb-2" aria-label="payments" />
                <h4 className="font-semibold text-sm mb-1">
                  {listing.payments_enabled ? "Rent Payments Enabled" : "Accept Rent Payments"}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {listing.payments_enabled
                    ? "Send a rental offer to a tenant to start the agreement process."
                    : "Let tenants pay rent securely through MiNest."}
                </p>
                {listing.payments_enabled ? (
                  <Button
                    size="sm"
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-xs gap-1"
                    onClick={() => setRentalOfferOpen(true)}
                  >
                    <FileText className="w-3 h-3" /> Send Rental Offer
                  </Button>
                ) : null}
                <Link to="/owner-payment-setup">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    {listing.payments_enabled ? "Manage Payment Plan" : "Set Up Payments"}
                  </Button>
                </Link>
              </div>
            ) : (
              <RentPaymentCTA listing={listing} />
            )}

          </div>
        </div>
      </div>

      {/* More from this host */}
      <MoreFromHost listing={listing} hostProfile={hostProfile} />

      {/* Mobile CTA */}
      <MobileListingCTA
        listing={listing}
        user={user}
        onMessage={() => handleContact(true)}
        onBook={listing.rent_period === "daily" ? handleBookingClick : undefined}
        onFavorite={handleFavorite}
        isFavorited={isFavorited}
        isOwner={isOwner}
      />

      {/* Sign In Required Modal */}
      <SignInRequiredModal
        open={signInModalOpen}
        onOpenChange={setSignInModalOpen}
        title="Sign in to continue"
        description="Create an account or sign in to message hosts, schedule viewings, or send rental requests."
        listingId={listingId}
      />

      {/* Viewing Request Modal */}
      <ViewingRequestModal
        open={viewingModalOpen}
        onOpenChange={setViewingModalOpen}
        listing={listing}
        existingAppointment={viewerAppointment}
        onSuccess={() => setRefreshAppointment(r => r + 1)}
      />

      {/* Booking Request Modal (daily rentals) */}
      {!isOwner && listing && listing.rent_period === "daily" && (
        <BookingRequestModal
          open={bookingModalOpen}
          onOpenChange={setBookingModalOpen}
          listing={listing}
          onSuccess={() => toast.success("Booking request sent!")}
        />
      )}

      {/* Photo Lightbox */}
      <PhotoLightbox 
        photos={photos}
        initialIndex={selectedPhoto}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />

      {/* Rental Request Modal (tenant) */}
      {!isOwner && listing && (
        <TenantRentalRequestModal
          open={rentalOfferOpen}
          onOpenChange={setRentalOfferOpen}
          listing={listing}
        />
      )}

      {/* Rental Offer Modal (owner sends to tenant) */}
      {isOwner && listing && (
        <RentalOfferModal
          open={rentalOfferOpen}
          onOpenChange={setRentalOfferOpen}
          listing={listing}
          tenantUserId={null}
          tenantName={null}
        />
      )}

      {/* Report Modal */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report This Listing</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="report-reason" className="text-sm font-semibold block mb-2">Reason</label>
              <select
id="select-field"                 value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
              >
                <option value="">Select a reason...</option>
                <option value="spam">Spam</option>
                <option value="scam">Scam</option>
                <option value="inappropriate">Inappropriate Content</option>
                <option value="fake_listing">Fake Listing</option>
                <option value="harassment">Harassment</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="report-details" className="text-sm font-semibold block mb-2">Details</label>
              <Textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Provide details about why you're reporting this listing..."
                className="min-h-24"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReportOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleReportSubmit}
                disabled={reportSubmitting || !reportReason}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                {reportSubmitting ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── More from this host ──────────────────────────────────────────────────────
function MoreFromHost({ listing, hostProfile }) {
  const { data: hostListings = [] } = useQuery({
    queryKey: ["host-listings", listing?.owner_user_id],
    queryFn: async () => {
      const results = await entities.Listing.filter({ owner_user_id: listing.owner_user_id, status: "active" });
      // Exclude current listing
      return (results || []).filter(l => l.id !== listing.id).slice(0, 4);
    },
    enabled: !!listing?.owner_user_id,
    staleTime: 5 * 60 * 1000,
  });

  if (hostListings.length === 0) return null;

  const hostName = hostProfile?.display_name || hostProfile?.full_name || "This Host";

  return (
    <div className="mt-8 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground">More from {hostName}</h2>
        <Link
          to={`/search?host=${listing.owner_user_id}`}
          className="text-sm text-accent hover:underline font-medium"
        >
          View all {hostListings.length + 1} listings →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {hostListings.map((l) => (
          <Link key={l.id} to={`/listing/${l.slug || l.id}`} className="group">
            <div className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-all hover:border-accent/30">
              <div className="aspect-video bg-muted overflow-hidden">
                {l.cover_photo_url ? (
                  <img src={l.cover_photo_url} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No image</div>
                )}
              </div>
              <div className="p-3 space-y-1">
                <p className="font-bold text-accent text-sm">${l.rent_amount || l.monthly_rent}/{l.rent_period === "daily" ? "day" : "mo"}</p>
                <p className="text-xs font-medium text-foreground line-clamp-1">{l.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{l.city}{l.province_or_state ? `, ${l.province_or_state}` : ''}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}