import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { entities, uploadFile, invokeLLM } from '@/api/entities';
import { validateListingAddress, normalizeProvince } from '@/lib/addressValidation';
import { supabase } from '@/lib/supabase';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, ArrowRight, Upload, X, Check, Loader2, Info } from "lucide-react";
import {
  LISTING_TYPES, PROPERTY_TYPES, FURNISHING_OPTIONS, BATHROOM_TYPES,
  GENDER_OPTIONS, APP_CONFIG, FLOOR_LEVEL_OPTIONS, LAUNDRY_OPTIONS,
  KITCHEN_ACCESS_OPTIONS, AC_HEATING_OPTIONS, BEDS_IN_ROOM_OPTIONS,
  TOTAL_BEDROOMS_OPTIONS, CURRENT_ROOMMATES_OPTIONS, BOOKING_MODE_OPTIONS,
  CANCELLATION_POLICY_OPTIONS, CHECKIN_TIME_OPTIONS, CHECKOUT_TIME_OPTIONS,
} from "@/lib/config";
import { getRegionsForCountry, isQuebec, getCurrencyForCountry, generateSlug } from "@/lib/geoHelpers";
import { compressImage } from "@/lib/imageCompression";
import { toast } from "sonner";
import ParkingSection from "@/components/listings/ParkingSection";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { prepareParkingDataForSubmit } from "@/lib/parkingValidation";
import { useProfileCheck, ProfileIncompleteWarning } from "@/components/ProfileGate";
import { notifyListingCreated } from "@/lib/notificationService";

const STEPS = ["Basics", "Location", "Pricing", "Details", "Preferences", "Viewings", "Photos", "Review"];

export default function CreateListing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isComplete, missingFields } = useProfileCheck("lister");

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [generatingTitle, setGeneratingTitle] = useState(false);

  const [form, setForm] = useState({
    // Step 0 - Basics
    listing_type: "",
    title: "",
    description: "",
    // Step 1 - Location
    country: "",
    province_or_state: "",
    city: "",
    neighborhood: "",
    street_address: "",
    postal_or_zip: "",
    latitude: null,
    longitude: null,
    // Step 2 - Pricing
    rent_amount: "",
    rent_period: "monthly",
    currency_code: "CAD",
    deposit_amount: "",
    bills_included: false,
    available_from: "",
    available_until: "",
    minimum_stay_months: "",
    maximum_stay_months: "",
    // Daily-specific
    cleaning_fee: "",
    checkin_time: "15:00",
    checkout_time: "11:00",
    booking_mode: "inquiry",
    cancellation_policy: "flexible",
    // Step 3 - Details
    property_type: "",
    furnishing: "",
    bathroom_type: "",
    beds_in_room: "",
    total_bedrooms: "",
    current_roommates: "",
    room_size_sqft: "",
    laundry: "",
    kitchen_access: "",
    floor_level: "",
    ac_heating: "",
    parking_status: "not_available",
    parking_type: "",
    parking_price: "",
    parking_price_period: "monthly",
    parking_notes: "",
    internet_included: false,
    // Step 4 - Preferences
    pets_allowed: false,
    smoking_allowed: false,
    couples_allowed: false,
    student_friendly: false,
    lgbtq_friendly: false,
    gender_preference: "any",
    cleanliness_preference: "",
    // Step 5 - Viewings
    viewing_enabled: true,
    minimum_notice_hours: 24,
    viewing_duration_minutes: 30,
    owner_viewing_instructions: "",
    // Step 6 - Photos
    photos: [],
    cover_photo_url: "",
  });

  // Helpers
  const isSharedRoom = form.listing_type === "shared_room";
  const isPrivateRoom = form.listing_type === "private_room";
  const isEntirePlace = form.listing_type === "entire_place";
  const isDaily = form.rent_period === "daily";
  const isWeekly = form.rent_period === "weekly";
  const isMonthly = form.rent_period === "monthly";

  const update = (key, value) => {
    const updated = { ...form, [key]: value };
    if (key === "country") {
      updated.province_or_state = "";
      updated.city = "";
      updated.neighborhood = "";
      updated.street_address = "";
      updated.postal_or_zip = "";
      updated.latitude = null;
      updated.longitude = null;
      updated.currency_code = getCurrencyForCountry(value);
    }
    if (key === "province_or_state") {
      updated.city = "";
      updated.neighborhood = "";
      updated.street_address = "";
      updated.postal_or_zip = "";
      updated.latitude = null;
      updated.longitude = null;
    }
    // Auto-set values based on listing type
    if (key === "listing_type") {
      if (value === "shared_room") {
        updated.bathroom_type = "shared";
        updated.couples_allowed = false;
      } else if (value === "entire_place") {
        updated.bathroom_type = "private";
        updated.kitchen_access = "private";
        updated.gender_preference = "any";
        updated.cleanliness_preference = "";
      } else {
        // private_room - reset auto-sets
        updated.bathroom_type = "";
      }
    }
    // Daily auto-sets
    if (key === "rent_period") {
      if (value === "daily") {
        updated.bills_included = true;
      }
    }
    setForm(updated);
  };

  const regions = form.country ? getRegionsForCountry(form.country) : [];

  // Photo handling
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (form.photos.length + files.length > APP_CONFIG.maxPhotos) {
      toast.error(`Max ${APP_CONFIG.maxPhotos} photos allowed`);
      return;
    }
    setUploading(true);
    const urls = [];
    for (const file of files) {
      if (file.size > APP_CONFIG.maxImageSizeBytes) {
        toast.error(`${file.name} exceeds ${APP_CONFIG.maxImageSizeMB}MB limit`);
        continue;
      }
      const compressedFile = await compressImage(file);
      const { file_url } = await uploadFile(compressedFile, 'listing-photos');
      urls.push(file_url);
    }
    const newPhotos = [...form.photos, ...urls];
    setForm(prev => ({
      ...prev,
      photos: newPhotos,
      cover_photo_url: prev.cover_photo_url || newPhotos[0] || "",
    }));
    setUploading(false);
  };

  const removePhoto = (idx) => {
    const newPhotos = form.photos.filter((_, i) => i !== idx);
    setForm(prev => ({
      ...prev,
      photos: newPhotos,
      cover_photo_url: newPhotos[0] || "",
    }));
  };

  // Listing status
  const determineListingStatus = async (requestedStatus) => {
    if (requestedStatus === "draft") return "draft";
    try {
      const { data: existing } = await supabase
        .from("listings")
        .select("id, status")
        .eq("owner_user_id", user.id)
        .in("status", ["active", "rented", "paused", "expired"])
        .limit(1);
      if (existing && existing.length > 0) return "active";
      return "pending_review";
    } catch {
      return "pending_review";
    }
  };

  // Publish
  const handlePublish = async (status = "active") => {
    if (isQuebec(form.province_or_state)) {
      toast.error("This platform is not yet available in Quebec.");
      return;
    }
    if (!form.title || !form.listing_type) {
      toast.error("Please fill in the required fields.");
      return;
    }
    if (form.photos.length < 4) {
      toast.error("Please upload at least 4 photos.");
      return;
    }

    setSaving(true);
    let lat = form.latitude;
    let lng = form.longitude;

    if (!lat || !lng) {
      const coords = await geocodeAddress();
      if (!coords && status === "active") { setSaving(false); return; }
      if (coords) { lat = coords.lat; lng = coords.lng; }
    }

    const rent_amount = Number(form.rent_amount) || 0;
    const rent_period = form.rent_period || "monthly";
    const rent_normalized_monthly = rent_period === "weekly"
      ? rent_amount * 4.33
      : rent_period === "daily"
      ? rent_amount * 30
      : rent_amount;

    const parkingData = prepareParkingDataForSubmit(form);
    const emptyToNull = (val) => (val === "" || val === undefined) ? null : val;

    const data = {
      ...form,
      available_from: form.available_from || null,
      available_until: form.available_until || null,
      move_in_date: form.available_from || null,
      owner_user_id: user.id,
      slug: generateSlug(form.title + "-" + form.city),
      rent_amount,
      rent_period,
      rent_normalized_monthly,
      deposit_amount: Number(form.deposit_amount) || 0,
      cleaning_fee: Number(form.cleaning_fee) || 0,
      minimum_stay_months: Number(form.minimum_stay_months) || 0,
      maximum_stay_months: Number(form.maximum_stay_months) || 0,
      room_size_sqft: Number(form.room_size_sqft) || null,
      total_bedrooms: Number(form.total_bedrooms) || null,
      current_roommates: form.current_roommates !== "" ? Number(form.current_roommates) : null,
      beds_in_room: Number(form.beds_in_room) || null,
      latitude: lat || null,
      longitude: lng || null,
      photo_count: form.photos.length,
      status,
      // CHECK-constrained columns: empty string → null
      bathroom_type: emptyToNull(form.bathroom_type),
      furnishing: emptyToNull(form.furnishing),
      property_type: emptyToNull(form.property_type),
      floor_level: emptyToNull(form.floor_level),
      laundry: emptyToNull(form.laundry),
      kitchen_access: emptyToNull(form.kitchen_access),
      ac_heating: emptyToNull(form.ac_heating),
      booking_mode: emptyToNull(form.booking_mode),
      cancellation_policy: emptyToNull(form.cancellation_policy),
      cleanliness_preference: emptyToNull(form.cleanliness_preference),
      checkin_time: isDaily ? form.checkin_time : null,
      checkout_time: isDaily ? form.checkout_time : null,
      blocked_dates: [],
      ...parkingData,
    };

    const finalStatus = await determineListingStatus(status);
    const expiresAt = (finalStatus === 'active' || finalStatus === 'pending_review')
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const finalData = { ...data, status: finalStatus, expires_at: expiresAt };

    try {
      const created = await entities.Listing.create(finalData);
      if (finalStatus === "draft") toast.success("Draft saved!");
      else if (finalStatus === "pending_review") toast.success("Listing submitted for review!", { duration: 5000 });
      else toast.success("Listing published successfully!");
      // Notify admin about new listing
      if (finalStatus !== "draft") {
        notifyListingCreated({ listingTitle: form.title, listingId: created?.id, ownerName: user?.user_metadata?.full_name });
      }
      navigate("/dashboard");
    } catch (err) {
      console.error("Publish error:", err);
      toast.error(err?.message || "Failed to publish listing. Please check all fields.");
    }
    setSaving(false);
  };

  const geocodeAddress = async () => {
    if (!form.street_address || !form.city || !form.postal_or_zip) {
      toast.error("Street address, city, and postal code are required.");
      return null;
    }
    const fullAddress = `${form.street_address}, ${form.city}, ${form.province_or_state}, ${form.postal_or_zip}, ${form.country}`;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fullAddress)}&format=json&limit=1`);
      const data = await res.json();
      if (data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setForm(prev => ({ ...prev, latitude: lat, longitude: lng }));
        return { lat, lng };
      }
    } catch {}
    toast.error("Could not geocode address. Please check and try again.");
    return null;
  };

  // Validation
  const fieldError = (val) => attempted && !val?.toString().trim();

  const getStepErrors = () => {
    if (step === 0) {
      const errors = [];
      if (!form.listing_type) errors.push("Room Type is required");
      if (!form.title?.trim()) errors.push("Title is required");
      return errors;
    }
    if (step === 1) {
      const errors = validateListingAddress(form);
      if (isQuebec(form.province_or_state)) errors.push("Not available in Quebec");
      return errors;
    }
    if (step === 2) {
      const errors = [];
      if (!form.rent_amount || Number(form.rent_amount) <= 0) errors.push("Rent Amount must be greater than 0");
      if (!form.rent_period) errors.push("Rent Period is required");
      if (isDaily && form.booking_mode === "booking_required" && !form.cancellation_policy) {
        errors.push("Cancellation policy is required for booking mode");
      }
      return errors;
    }
    if (step === 3) {
      const errors = [];
      if (!form.property_type) errors.push("Property Type is required");
      if (!form.furnishing) errors.push("Furnishing is required");
      if (isPrivateRoom && !form.bathroom_type) errors.push("Bathroom Type is required");
      return errors;
    }
    return [];
  };

  const handleNext = () => {
    const errors = getStepErrors();
    if (errors.length > 0) {
      setAttempted(true);
      errors.forEach(e => toast.error(e));
      return;
    }
    setAttempted(false);
    setStep(step + 1);
  };

  // Stay unit label
  const stayUnit = isDaily ? "days" : isWeekly ? "weeks" : "months";
  const currencyLabel = form.currency_code || "CAD";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-2">Post a Room</h1>
      <ProfileIncompleteWarning userType="lister" missingFields={missingFields} />

      {/* Steps indicator */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <button
              onClick={() => i < step && setStep(i)}
              aria-label={`Go to step ${i + 1}: ${s}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                i === step ? "bg-accent text-white font-semibold"
                : i < step ? "bg-accent/10 text-accent cursor-pointer"
                : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="w-3 h-3 inline mr-1" /> : null}{s}
            </button>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-card rounded-2xl border border-border p-6 mb-6 min-h-[300px]">

        {/* ============ STEP 0: BASICS ============ */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <Label>Room Type <span className="text-destructive">*</span></Label>
              <Select value={form.listing_type} onValueChange={(v) => update("listing_type", v)}>
                <SelectTrigger className={`mt-1 ${attempted && !form.listing_type ? "border-destructive" : ""}`}>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>{LISTING_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              {form.listing_type && (
                <p className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded-lg p-2">
                  {isSharedRoom && "You're sharing a bedroom with another person. Common areas and bathroom are shared."}
                  {isPrivateRoom && "You're renting out a private bedroom. Common areas are shared with housemates."}
                  {isEntirePlace && "You're offering the full apartment/house. Tenant gets their own private space."}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <Label className="flex-1">Title <span className="text-destructive">*</span></Label>
                <Button type="button" variant="ghost" size="sm"
                  className="text-xs text-accent hover:bg-accent/10 h-7 px-2 whitespace-nowrap"
                  onClick={async () => {
                    if (!form.title.trim()) { toast.error("Write a title first"); return; }
                    setGeneratingTitle(true);
                    const res = await invokeLLM({ prompt: `Rewrite this room listing title to be more compelling. Return ONLY the new title, max 60 chars. Original: "${form.title}"` });
                    update("title", typeof res === 'string' ? res : res?.text || res);
                    setGeneratingTitle(false);
                  }}
                  disabled={generatingTitle}
                >
                  {generatingTitle ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : "✨"}
                  {generatingTitle ? "Rewriting..." : "AI Rewrite"}
                </Button>
              </div>
              <Input
                className={`mt-1 ${fieldError(form.title) ? "border-destructive" : ""}`}
                placeholder="e.g., Bright room near downtown" value={form.title}
                onChange={(e) => update("title", e.target.value.slice(0, 80))} maxLength={80}
              />
              <p className="text-xs text-muted-foreground text-right mt-1">{form.title?.length || 0}/80</p>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <Label className="flex-1">Description</Label>
                <Button type="button" variant="ghost" size="sm"
                  className="text-xs text-accent hover:bg-accent/10 h-7 px-2 whitespace-nowrap"
                  onClick={async () => {
                    if (!form.description.trim()) { toast.error("Write a description first"); return; }
                    setGeneratingDescription(true);
                    const res = await invokeLLM({ prompt: `Rewrite this room description to be more engaging. Return ONLY the text. Original: "${form.description}"` });
                    update("description", typeof res === 'string' ? res : res?.text || res);
                    setGeneratingDescription(false);
                  }}
                  disabled={generatingDescription}
                >
                  {generatingDescription ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : "✨"}
                  {generatingDescription ? "Rewriting..." : "AI Rewrite"}
                </Button>
              </div>
              <Textarea className="min-h-[120px]" placeholder="Describe your room..."
                value={form.description} onChange={(e) => update("description", e.target.value.slice(0, 1000))} maxLength={1000}
              />
              <p className="text-xs text-muted-foreground text-right mt-1">{form.description?.length || 0}/1000</p>
            </div>
          </div>
        )}

        {/* ============ STEP 1: LOCATION ============ */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Country <span className="text-destructive">*</span></Label>
              <Select value={form.country} onValueChange={(v) => update("country", v)}>
                <SelectTrigger className={`mt-1 ${attempted && !form.country ? "border-destructive" : ""}`}>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Canada">🇨🇦 Canada</SelectItem>
                  <SelectItem value="USA">🇺🇸 USA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.country && (
              <div>
                <Label>Province / State <span className="text-destructive">*</span></Label>
                <Select value={form.province_or_state} onValueChange={(v) => update("province_or_state", v)}>
                  <SelectTrigger className={`mt-1 ${attempted && !form.province_or_state ? "border-destructive" : ""}`}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>{regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
                {isQuebec(form.province_or_state) && <p className="text-destructive text-sm mt-1">Not available in Quebec.</p>}
              </div>
            )}

            {form.province_or_state && !isQuebec(form.province_or_state) && (
              <>
                <div>
                  <Label>Street Address <span className="text-destructive">*</span></Label>
                  <AddressAutocomplete
                    value={form.street_address} placeholder="e.g., 123 Main Street"
                    countryFilter={form.country === 'Canada' ? 'ca' : form.country === 'USA' ? 'us' : undefined}
                    onChange={(parsed) => {
                      const parsedProvince = normalizeProvince(parsed.province_or_state);
                      if (parsedProvince && parsedProvince !== form.province_or_state) {
                        toast.error(`This address is in ${parsedProvince}, not ${form.province_or_state}.`);
                        return;
                      }
                      setForm(prev => ({
                        ...prev,
                        street_address: parsed.street_address || prev.street_address,
                        city: parsed.city || prev.city,
                        neighborhood: parsed.neighborhood || prev.neighborhood,
                        postal_or_zip: parsed.postal_or_zip || prev.postal_or_zip,
                        latitude: parsed.latitude || prev.latitude,
                        longitude: parsed.longitude || prev.longitude,
                      }));
                    }}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">🔍 Search your address — city and postal code auto-fill</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>City <span className="text-destructive">*</span></Label>
                    <Input className={`mt-1 ${fieldError(form.city) ? "border-destructive" : ""}`}
                      value={form.city} onChange={(e) => update("city", e.target.value)} />
                  </div>
                  <div><Label>Neighborhood</Label><Input className="mt-1" value={form.neighborhood} onChange={(e) => update("neighborhood", e.target.value)} /></div>
                </div>
                <div>
                  <Label>Postal / ZIP Code <span className="text-destructive">*</span></Label>
                  <Input className={`mt-1 ${fieldError(form.postal_or_zip) ? "border-destructive" : ""}`}
                    value={form.postal_or_zip} placeholder={form.country === 'Canada' ? 'e.g. T3P 1C5' : 'e.g. 90210'}
                    onChange={(e) => update("postal_or_zip", e.target.value)} />
                </div>
              </>
            )}
          </div>
        )}

        {/* ============ STEP 2: PRICING ============ */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 items-end">
              <div>
                <Label>Rent Amount ({currencyLabel}) <span className="text-destructive">*</span></Label>
                <Input className={`mt-1 ${attempted && (!form.rent_amount || Number(form.rent_amount) <= 0) ? "border-destructive" : ""}`}
                  type="number" min="0" value={form.rent_amount}
                  onChange={(e) => update("rent_amount", Math.max(0, Number(e.target.value)) || "")} />
              </div>
              <div>
                <Label>Rent Period <span className="text-destructive">*</span></Label>
                <Select value={form.rent_period} onValueChange={(v) => update("rent_period", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{isDaily ? "Damage Deposit" : "Security Deposit"}</Label>
                <Input className="mt-1" type="number" min="0" value={form.deposit_amount}
                  onChange={(e) => update("deposit_amount", Math.max(0, Number(e.target.value)) || "")} />
              </div>
            </div>

            {/* Bills included — auto for daily */}
            {isDaily ? (
              <div className="flex items-center justify-between bg-accent/5 rounded-lg p-3">
                <Label className="text-sm">Bills Included</Label>
                <span className="text-sm font-medium text-accent">Included (daily rental)</span>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <Label>Bills Included</Label>
                <Switch checked={form.bills_included} onCheckedChange={(v) => update("bills_included", v)} />
              </div>
            )}

            <div className={`grid ${isDaily ? 'grid-cols-2' : ''} gap-4`}>
              <div>
                <Label>Available From</Label>
                <Input className="mt-1" type="date" value={form.available_from} onChange={(e) => update("available_from", e.target.value)} />
              </div>
              {isDaily && (
                <div>
                  <Label>Available Until</Label>
                  <Input className="mt-1" type="date" value={form.available_until}
                    min={form.available_from || undefined}
                    onChange={(e) => update("available_until", e.target.value)} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Min Stay ({stayUnit})</Label>
                <Input className="mt-1" type="number" min="0" value={form.minimum_stay_months}
                  onChange={(e) => update("minimum_stay_months", Math.max(0, Number(e.target.value)) || "")} />
              </div>
              <div>
                <Label>Max Stay ({stayUnit})</Label>
                <Input className="mt-1" type="number" min="0" value={form.maximum_stay_months}
                  onChange={(e) => update("maximum_stay_months", Math.max(0, Number(e.target.value)) || "")} />
              </div>
            </div>

            {/* ===== DAILY-SPECIFIC FIELDS ===== */}
            {isDaily && (
              <div className="border-t border-border pt-4 space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Info className="w-4 h-4 text-accent" /> Daily Rental Settings
                </h3>

                <div>
                  <Label>Cleaning Fee ({currencyLabel})</Label>
                  <Input className="mt-1" type="number" min="0" value={form.cleaning_fee}
                    placeholder="One-time fee (optional)"
                    onChange={(e) => update("cleaning_fee", Math.max(0, Number(e.target.value)) || "")} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Check-in Time</Label>
                    <Select value={form.checkin_time} onValueChange={(v) => update("checkin_time", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CHECKIN_TIME_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Check-out Time</Label>
                    <Select value={form.checkout_time} onValueChange={(v) => update("checkout_time", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CHECKOUT_TIME_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Booking Mode</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {BOOKING_MODE_OPTIONS.map((opt) => (
                      <button key={opt.value} onClick={() => update("booking_mode", opt.value)}
                        className={`px-3 py-3 rounded-xl border-2 text-left transition-all ${
                          form.booking_mode === opt.value
                            ? "border-accent bg-accent/5"
                            : "border-border hover:border-accent/50"
                        }`}
                      >
                        <span className="text-sm font-medium text-foreground">{opt.label}</span>
                        <span className="text-xs text-muted-foreground block mt-0.5">{opt.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {form.booking_mode === "booking_required" && (
                  <div>
                    <Label>Cancellation Policy <span className="text-destructive">*</span></Label>
                    <div className="space-y-2 mt-2">
                      {CANCELLATION_POLICY_OPTIONS.map((opt) => (
                        <button key={opt.value} onClick={() => update("cancellation_policy", opt.value)}
                          className={`w-full px-3 py-2.5 rounded-lg border-2 text-left transition-all ${
                            form.cancellation_policy === opt.value
                              ? "border-accent bg-accent/5"
                              : "border-border hover:border-accent/50"
                          }`}
                        >
                          <span className="text-sm font-medium text-foreground">{opt.label}</span>
                          <span className="text-xs text-muted-foreground block">{opt.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============ STEP 3: DETAILS ============ */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Core property details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Property Type <span className="text-destructive">*</span></Label>
                <Select value={form.property_type} onValueChange={(v) => update("property_type", v)}>
                  <SelectTrigger className={`mt-1 ${attempted && !form.property_type ? "border-destructive" : ""}`}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>{PROPERTY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Furnishing <span className="text-destructive">*</span></Label>
                <Select value={form.furnishing} onValueChange={(v) => update("furnishing", v)}>
                  <SelectTrigger className={`mt-1 ${attempted && !form.furnishing ? "border-destructive" : ""}`}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>{FURNISHING_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Bathroom — conditional */}
            {isPrivateRoom ? (
              <div>
                <Label>Bathroom <span className="text-destructive">*</span></Label>
                <Select value={form.bathroom_type} onValueChange={(v) => update("bathroom_type", v)}>
                  <SelectTrigger className={`mt-1 ${attempted && !form.bathroom_type ? "border-destructive" : ""}`}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>{BATHROOM_TYPES.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                <Label className="text-sm">Bathroom</Label>
                <span className="text-sm font-medium">{isSharedRoom ? "Shared (shared room)" : "Private (entire place)"}</span>
              </div>
            )}

            {/* Beds in room — shared room only */}
            {isSharedRoom && (
              <div>
                <Label>Beds in Room</Label>
                <Select value={form.beds_in_room?.toString() || ""} onValueChange={(v) => update("beds_in_room", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="How many beds?" /></SelectTrigger>
                  <SelectContent>{BEDS_IN_ROOM_OPTIONS.map(b => <SelectItem key={b.value} value={b.value.toString()}>{b.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {/* Property info grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <Label>Total Bedrooms</Label>
                <Select value={form.total_bedrooms?.toString() || ""} onValueChange={(v) => update("total_bedrooms", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{TOTAL_BEDROOMS_OPTIONS.map(b => <SelectItem key={b.value} value={b.value.toString()}>{b.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {!isEntirePlace && (
                <div>
                  <Label>Current Roommates</Label>
                  <Select value={form.current_roommates?.toString() ?? ""} onValueChange={(v) => update("current_roommates", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{CURRENT_ROOMMATES_OPTIONS.map(r => <SelectItem key={r.value} value={r.value.toString()}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>{isEntirePlace ? "Total Sq Ft" : "Room Size (sq ft)"}</Label>
                <Input className="mt-1" type="number" min="0" placeholder="Optional"
                  value={form.room_size_sqft} onChange={(e) => update("room_size_sqft", Math.max(0, Number(e.target.value)) || "")} />
              </div>
            </div>

            {/* Amenity grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <Label>Laundry</Label>
                <Select value={form.laundry} onValueChange={(v) => update("laundry", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{LAUNDRY_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Kitchen — auto for entire place */}
              {isEntirePlace ? (
                <div className="flex items-center bg-muted/50 rounded-lg p-3 mt-6">
                  <span className="text-sm">Kitchen: <span className="font-medium">Private</span></span>
                </div>
              ) : (
                <div>
                  <Label>Kitchen Access</Label>
                  <Select value={form.kitchen_access} onValueChange={(v) => update("kitchen_access", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {KITCHEN_ACCESS_OPTIONS.filter(k => isSharedRoom ? k.value !== "private" : true)
                        .map(k => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Floor Level</Label>
                <Select value={form.floor_level} onValueChange={(v) => update("floor_level", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{FLOOR_LEVEL_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div>
                <Label>AC / Heating</Label>
                <Select value={form.ac_heating} onValueChange={(v) => update("ac_heating", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{AC_HEATING_OPTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Parking */}
            <div className="border-t border-border pt-6">
              <ParkingSection
                parking={{
                  parking_status: form.parking_status,
                  parking_type: form.parking_type,
                  parking_price: form.parking_price,
                  parking_price_period: form.parking_price_period,
                  parking_notes: form.parking_notes,
                }}
                onUpdate={(updated) => {
                  setForm(prev => ({
                    ...prev,
                    parking_status: updated.parking_status,
                    parking_type: updated.parking_type,
                    parking_price: updated.parking_price,
                    parking_price_period: updated.parking_price_period,
                    parking_notes: updated.parking_notes,
                  }));
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Internet Included</Label>
              <Switch checked={form.internet_included} onCheckedChange={(v) => update("internet_included", v)} />
            </div>
          </div>
        )}

        {/* ============ STEP 4: PREFERENCES ============ */}
        {step === 4 && (
          <div className="space-y-4">
            {[
              ["pets_allowed", "Pets Allowed", true],
              ["smoking_allowed", "Smoking Allowed", true],
              ["couples_allowed", "Couples Allowed", !isSharedRoom],
              ["student_friendly", "Student Friendly", true],
              ["lgbtq_friendly", "LGBTQ+ Friendly", true],
            ].filter(([_, __, show]) => show).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label>{label}</Label>
                <Switch checked={form[key]} onCheckedChange={(v) => update(key, v)} />
              </div>
            ))}

            {/* Couples auto-set notice for shared room */}
            {isSharedRoom && (
              <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                <Label className="text-sm">Couples Allowed</Label>
                <span className="text-sm text-muted-foreground">No (shared room)</span>
              </div>
            )}

            {/* Gender preference — hidden for entire place */}
            {!isEntirePlace && (
              <div>
                <Label>Gender Preference</Label>
                <Select value={form.gender_preference} onValueChange={(v) => update("gender_preference", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{GENDER_OPTIONS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {/* Cleanliness — hidden for entire place */}
            {!isEntirePlace && (
              <div>
                <Label>Cleanliness Preference</Label>
                <Select value={form.cleanliness_preference} onValueChange={(v) => update("cleanliness_preference", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {["Very Clean", "Clean", "Average", "Relaxed"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isEntirePlace && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                Gender preference and cleanliness preference are not shown for entire place listings since the tenant has their own private space.
              </div>
            )}
          </div>
        )}

        {/* ============ STEP 5: VIEWINGS ============ */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-900 dark:text-blue-200 mb-4">
              <p className="font-semibold mb-1">Schedule Viewings</p>
              <p className="text-xs">Let seekers request viewing appointments for your room.</p>
            </div>
            <div className="flex items-center justify-between">
              <Label>Enable Scheduled Viewings</Label>
              <Switch checked={form.viewing_enabled} onCheckedChange={(v) => update("viewing_enabled", v)} />
            </div>
            {form.viewing_enabled && (
              <>
                <div>
                  <Label>Minimum Notice (hours)</Label>
                  <Select value={String(form.minimum_notice_hours)} onValueChange={(v) => update("minimum_notice_hours", parseInt(v))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[6, 12, 24, 48].map(h => <SelectItem key={h} value={String(h)}>{h} hours</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Viewing Duration (minutes)</Label>
                  <Select value={String(form.viewing_duration_minutes)} onValueChange={(v) => update("viewing_duration_minutes", parseInt(v))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[15, 30, 45, 60].map(m => <SelectItem key={m} value={String(m)}>{m} min</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Viewing Instructions (optional)</Label>
                  <Textarea className="mt-1 min-h-[80px]" placeholder="e.g., Park on the street, ring bell #3..."
                    value={form.owner_viewing_instructions} onChange={(e) => update("owner_viewing_instructions", e.target.value)} />
                </div>
              </>
            )}
          </div>
        )}

        {/* ============ STEP 6: PHOTOS ============ */}
        {step === 6 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload at least 4 photos and up to {APP_CONFIG.maxPhotos} total (max {APP_CONFIG.maxImageSizeMB}MB each).
              {form.photos.length < 4 && <span className="text-destructive font-medium"> {4 - form.photos.length} more needed</span>}
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {form.photos.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-border group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                  {form.cover_photo_url === url && (
                    <span className="absolute bottom-1 left-1 text-[10px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full">Cover</span>
                  )}
                </div>
              ))}
              {form.photos.length < APP_CONFIG.maxPhotos && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-accent transition-colors">
                  <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">{uploading ? "Uploading..." : "Add"}</span>
                  <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" disabled={uploading} />
                </label>
              )}
            </div>
          </div>
        )}

        {/* ============ STEP 7: REVIEW ============ */}
        {step === 7 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Review Your Listing</h3>
            <div className="space-y-2 text-sm">
              {[
                ["Type", form.listing_type?.replace(/_/g, " ")],
                ["Title", form.title],
                ["Location", [form.city, form.province_or_state, form.country].filter(Boolean).join(", ")],
                ["Rent", `${form.rent_amount} ${currencyLabel}/${isMonthly ? "mo" : isWeekly ? "wk" : "night"}`],
                ["Property", PROPERTY_TYPES.find(p => p.value === form.property_type)?.label],
                ["Furnishing", FURNISHING_OPTIONS.find(f => f.value === form.furnishing)?.label],
                ["Bathroom", form.bathroom_type === "private" ? "Private" : "Shared"],
                form.total_bedrooms && ["Bedrooms", form.total_bedrooms],
                form.current_roommates !== "" && form.current_roommates !== null && ["Roommates", form.current_roommates],
                form.room_size_sqft && ["Size", `${form.room_size_sqft} sq ft`],
                form.laundry && ["Laundry", LAUNDRY_OPTIONS.find(l => l.value === form.laundry)?.label],
                form.floor_level && ["Floor", FLOOR_LEVEL_OPTIONS.find(f => f.value === form.floor_level)?.label],
                form.ac_heating && ["AC/Heat", AC_HEATING_OPTIONS.find(a => a.value === form.ac_heating)?.label],
                ["Available", form.available_from || "Flexible"],
                isDaily && form.available_until && ["Until", form.available_until],
                isDaily && ["Booking", form.booking_mode === "booking_required" ? "Required" : "Inquiry"],
                isDaily && form.cleaning_fee && ["Cleaning Fee", `${form.cleaning_fee} ${currencyLabel}`],
                ["Photos", form.photos.length],
              ].filter(Boolean).map(([label, value], i) => (
                <div key={i} className="flex justify-between py-1 border-b border-border/50 last:border-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="capitalize font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => step > 0 ? setStep(step - 1) : navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> {step === 0 ? "Cancel" : "Back"}
        </Button>
        <div className="flex gap-2">
          {step === 7 && (
            <Button variant="outline" onClick={() => handlePublish("draft")} disabled={saving}>Save Draft</Button>
          )}
          {step < 7 ? (
            <Button onClick={handleNext} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              Next <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => handlePublish("active")} disabled={saving} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              {saving ? "Publishing..." : "Publish Listing"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
