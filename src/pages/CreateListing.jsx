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
import { ArrowLeft, ArrowRight, Upload, X, Check, Loader2 } from "lucide-react";
import { LISTING_TYPES, PROPERTY_TYPES, FURNISHING_OPTIONS, BATHROOM_TYPES, GENDER_OPTIONS, APP_CONFIG } from "@/lib/config";
import { getRegionsForCountry, isQuebec, getCurrencyForCountry, generateSlug } from "@/lib/geoHelpers";
import { compressImage } from "@/lib/imageCompression";
import { toast } from "sonner";
import ParkingSection from "@/components/listings/ParkingSection";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { prepareParkingDataForSubmit } from "@/lib/parkingValidation";
import { useProfileCheck, ProfileIncompleteWarning } from "@/components/ProfileGate";

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
    listing_type: "",
    title: "",
    description: "",
    country: "",
    province_or_state: "",
    city: "",
    neighborhood: "",
    street_address: "",
    postal_or_zip: "",
    latitude: null,
    longitude: null,
    rent_amount: "",
    rent_period: "monthly",
    currency_code: "CAD",
    deposit_amount: "",
    bills_included: false,
    available_from: "",
    minimum_stay_months: "",
    maximum_stay_months: "",
    property_type: "",
    furnishing: "",
    bathroom_type: "",
    parking_status: "not_available",
    parking_type: "",
    parking_price: "",
    parking_price_period: "monthly",
    parking_notes: "",
    internet_included: false,
    pets_allowed: false,
    smoking_allowed: false,
    couples_allowed: false,
    student_friendly: false,
    lgbtq_friendly: false,
    gender_preference: "any",
    age_preference_min: "",
    age_preference_max: "",
    occupation_preference: "",
    cleanliness_preference: "",
    photos: [],
    cover_photo_url: "",
    viewing_enabled: true,
    minimum_notice_hours: 24,
    viewing_duration_minutes: 30,
    owner_viewing_instructions: "",
  });

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
    setForm(updated);
  };

  const regions = form.country ? getRegionsForCountry(form.country) : [];

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
    if (form.parking_status === "free_included" && !form.parking_type) {
      toast.error("Please select a parking type for free parking.");
      return;
    }
    if (form.parking_status === "paid_available") {
      if (!form.parking_type) {
        toast.error("Please select a parking type for paid parking.");
        return;
      }
      if (!form.parking_price || Number(form.parking_price) <= 0) {
        toast.error("Please enter a valid parking price greater than 0.");
        return;
      }
      if (!form.parking_price_period) {
        toast.error("Please select a parking price period.");
        return;
      }
    }

    setSaving(true);
    let lat = form.latitude;
    let lng = form.longitude;

    if (!lat || !lng) {
      const coords = await geocodeAddress();
      if (!coords && status === "active") {
        setSaving(false);
        return;
      }
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
      }
    }

    const rent_amount = Number(form.rent_amount) || 0;
    const rent_period = form.rent_period || "monthly";
    const rent_normalized_monthly = rent_period === "weekly"
      ? rent_amount * 4.33
      : rent_period === "daily"
      ? rent_amount * 30
      : rent_amount;

    const parkingData = prepareParkingDataForSubmit(form);

    const data = {
      ...form,
      available_from: form.available_from || null,
      owner_user_id: user.id,
      slug: generateSlug(form.title + "-" + form.city),
      rent_amount,
      rent_period,
      rent_normalized_monthly,
      deposit_amount: Number(form.deposit_amount) || 0,
      minimum_stay_months: Number(form.minimum_stay_months) || 0,
      maximum_stay_months: Number(form.maximum_stay_months) || 0,
      age_preference_min: Number(form.age_preference_min) || 0,
      age_preference_max: Number(form.age_preference_max) || 0,
      latitude: lat || null,
      longitude: lng || null,
      photo_count: form.photos.length,
      status,
      ...parkingData,
    };

    const finalStatus = await determineListingStatus(status);
    const expiresAt = (finalStatus === 'active' || finalStatus === 'pending_review')
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const finalData = { ...data, status: finalStatus, expires_at: expiresAt };
    await entities.Listing.create(finalData);

    if (finalStatus === "draft") {
      toast.success("Draft saved!");
    } else if (finalStatus === "pending_review") {
      toast.success("Listing submitted for review! We'll notify you once it's approved.", { duration: 5000 });
    } else {
      toast.success("Listing published successfully!");
    }
    navigate("/dashboard");
    setSaving(false);
  };

  const geocodeAddress = async () => {
    if (!form.street_address || !form.city || !form.postal_or_zip) {
      toast.error("Street address, city, and postal code are required for geocoding.");
      return null;
    }
    const fullAddress = `${form.street_address}, ${form.city}, ${form.province_or_state}, ${form.postal_or_zip}, ${form.country}`;
    const query = encodeURIComponent(fullAddress);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`);
    const data = await res.json();
    if (data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      setForm(prev => ({ ...prev, latitude: lat, longitude: lng }));
      toast.success("Address geocoded successfully!");
      return { lat, lng };
    } else {
      toast.error("Could not find coordinates for this address. Please check and try again.");
      return null;
    }
  };

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
      if (isQuebec(form.province_or_state)) errors.push("This platform is not yet available in Quebec");
      return errors;
    }
    if (step === 2) {
      const errors = [];
      const amount = Number(form.rent_amount);
      if (!form.rent_amount || amount <= 0) errors.push("Rent Amount must be greater than 0");
      if (!form.rent_period) errors.push("Rent Period is required");
      return errors;
    }
    return [];
  };

  const canNext = () => getStepErrors().length === 0;

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
                i === step
                  ? "bg-accent text-white font-semibold"
                  : i < step
                  ? "bg-accent/10 text-accent cursor-pointer"
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
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <Label>Room Type *</Label>
              <Select value={form.listing_type} onValueChange={(v) => update("listing_type", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{LISTING_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <Label className="flex-1">Title *</Label>
                <Button
                  type="button" variant="ghost" size="sm"
                  className="text-xs text-accent hover:bg-accent/10 h-7 px-2 whitespace-nowrap flex-shrink-0"
                  onClick={async () => {
                    if (!form.title.trim()) { toast.error("Write a title first to rewrite"); return; }
                    setGeneratingTitle(true);
                    const res = await invokeLLM({
                      prompt: `Rewrite this room listing title to be more compelling and catchy. Return ONLY the new title text, no quotes, no labels, no markdown, max 60 characters. Original: "${form.title}"`,
                    });
                    update("title", typeof res === 'string' ? res : res?.text || res);
                    setGeneratingTitle(false);
                  }}
                  disabled={generatingTitle}
                  aria-label="AI Rewrite title"
                >
                  {generatingTitle ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : "✨"}
                  {generatingTitle ? "Rewriting..." : "AI Rewrite"}
                </Button>
              </div>
              <Input
                className={`mt-1 ${fieldError(form.title) ? "border-destructive" : ""}`}
                id="listing-title" name="title"
                placeholder="e.g., Bright room near downtown"
                value={form.title}
                onChange={(e) => update("title", e.target.value.slice(0, 80))}
                maxLength={80}
              />
              <p className="text-xs text-muted-foreground text-right mt-1">{form.title?.length || 0}/80</p>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <Label className="flex-1">Description</Label>
                <Button
                  type="button" variant="ghost" size="sm"
                  className="text-xs text-accent hover:bg-accent/10 h-7 px-2 whitespace-nowrap flex-shrink-0"
                  onClick={async () => {
                    if (!form.description.trim()) { toast.error("Write a description first to rewrite"); return; }
                    setGeneratingDescription(true);
                    const res = await invokeLLM({
                      prompt: `Rewrite this room listing description to be more compelling and engaging. Return ONLY the rewritten description text, no labels, no markdown. Original: "${form.description}"`,
                    });
                    update("description", typeof res === 'string' ? res : res?.text || res);
                    setGeneratingDescription(false);
                  }}
                  disabled={generatingDescription}
                  aria-label="AI Rewrite description"
                >
                  {generatingDescription ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : "✨"}
                  {generatingDescription ? "Rewriting..." : "AI Rewrite"}
                </Button>
              </div>
              <Textarea
                className="min-h-[120px]" id="listing-description" name="description"
                placeholder="Describe your room..."
                value={form.description}
                onChange={(e) => update("description", e.target.value.slice(0, 1000))}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground text-right mt-1">{form.description?.length || 0}/1000</p>
            </div>
          </div>
        )}

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
                {isQuebec(form.province_or_state) && (
                  <p className="text-destructive text-sm mt-1">This platform is not yet available in Quebec.</p>
                )}
              </div>
            )}

            {form.province_or_state && !isQuebec(form.province_or_state) && (
              <>
                <div>
                  <Label>Street Address <span className="text-destructive">*</span></Label>
                  <AddressAutocomplete
                    value={form.street_address}
                    placeholder="e.g., 123 Main Street"
                    countryFilter={form.country === 'Canada' ? 'ca' : form.country === 'USA' ? 'us' : undefined}
                    onChange={(parsed) => {
                      const parsedProvince = normalizeProvince(parsed.province_or_state);
                      // Only accept if matches selected province
                      if (parsedProvince && parsedProvince !== form.province_or_state) {
                        toast.error(`This address is in ${parsedProvince}, not ${form.province_or_state}. Please enter an address in ${form.province_or_state}.`);
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
                  <p className="text-xs text-muted-foreground mt-1">🔍 Search your address — city, postal code will auto-fill automatically</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>City <span className="text-destructive">*</span></Label>
                    <Input
                      className={`mt-1 ${fieldError(form.city) ? "border-destructive" : ""}`}
                      value={form.city}
                      onChange={(e) => update("city", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Neighborhood</Label>
                    <Input className="mt-1" value={form.neighborhood} onChange={(e) => update("neighborhood", e.target.value)} />
                  </div>
                </div>

                <div>
                  <Label>Postal / ZIP Code <span className="text-destructive">*</span></Label>
                  <Input
                    className={`mt-1 ${fieldError(form.postal_or_zip) ? "border-destructive" : ""}`}
                    value={form.postal_or_zip}
                    placeholder={form.country === 'Canada' ? 'e.g. T3P 1C5' : 'e.g. 90210'}
                    onChange={(e) => update("postal_or_zip", e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 items-end">
              <div>
                <Label>Rent Amount ({form.currency_code}) *</Label>
                <Input
                  className={`mt-1 ${attempted && (!form.rent_amount || Number(form.rent_amount) <= 0) ? "border-destructive" : ""}`}
                  type="number" min="0"
                  value={form.rent_amount}
                  onChange={(e) => update("rent_amount", Math.max(0, Number(e.target.value)) || "")}
                />
              </div>
              <div>
                <Label>Rent Period *</Label>
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
                <Label>Deposit</Label>
                <Input className="mt-1" type="number" min="0" value={form.deposit_amount} onChange={(e) => update("deposit_amount", Math.max(0, Number(e.target.value)) || "")} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Bills Included</Label>
              <Switch checked={form.bills_included} onCheckedChange={(v) => update("bills_included", v)} />
            </div>
            <div>
              <Label>Available From</Label>
              <Input className="mt-1" type="date" value={form.available_from} onChange={(e) => update("available_from", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Min Stay ({form.rent_period === "weekly" ? "weeks" : form.rent_period === "daily" ? "days" : "months"})</Label>
                <Input className="mt-1" type="number" min="0" value={form.minimum_stay_months} onChange={(e) => update("minimum_stay_months", Math.max(0, Number(e.target.value)) || "")} />
              </div>
              <div>
                <Label>Max Stay ({form.rent_period === "weekly" ? "weeks" : form.rent_period === "daily" ? "days" : "months"})</Label>
                <Input className="mt-1" type="number" min="0" value={form.maximum_stay_months} onChange={(e) => update("maximum_stay_months", Math.max(0, Number(e.target.value)) || "")} />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Property Type</Label>
                <Select value={form.property_type} onValueChange={(v) => update("property_type", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{PROPERTY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Furnishing</Label>
                <Select value={form.furnishing} onValueChange={(v) => update("furnishing", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{FURNISHING_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Bathroom</Label>
              <Select value={form.bathroom_type} onValueChange={(v) => update("bathroom_type", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{BATHROOM_TYPES.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
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

        {step === 4 && (
          <div className="space-y-4">
            {[
              ["pets_allowed", "Pets Allowed"],
              ["smoking_allowed", "Smoking Allowed"],
              ["couples_allowed", "Couples Allowed"],
              ["student_friendly", "Student Friendly"],
              ["lgbtq_friendly", "LGBTQ+ Friendly"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label>{label}</Label>
                <Switch checked={form[key]} onCheckedChange={(v) => update(key, v)} />
              </div>
            ))}
            <div>
              <Label>Gender Preference</Label>
              <Select value={form.gender_preference} onValueChange={(v) => update("gender_preference", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{GENDER_OPTIONS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cleanliness Preference</Label>
              <Select value={form.cleanliness_preference} onValueChange={(v) => update("cleanliness_preference", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {["Very Clean", "Clean", "Average", "Relaxed"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900 mb-4">
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
                      <SelectItem value="6">6 hours</SelectItem>
                      <SelectItem value="12">12 hours</SelectItem>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="48">48 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Default Viewing Duration (minutes)</Label>
                  <Select value={String(form.viewing_duration_minutes)} onValueChange={(v) => update("viewing_duration_minutes", parseInt(v))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 min</SelectItem>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="45">45 min</SelectItem>
                      <SelectItem value="60">60 min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Viewing Instructions (optional)</Label>
                  <Textarea
                    className="mt-1 min-h-[80px]"
                    placeholder="e.g., Park on the street, ring bell #3, or provide any special instructions..."
                    value={form.owner_viewing_instructions}
                    onChange={(e) => update("owner_viewing_instructions", e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        )}

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
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
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

        {step === 7 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Review Your Listing</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="capitalize">{form.listing_type?.replace(/_/g, " ")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Title</span><span>{form.title}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span>{[form.city, form.province_or_state, form.country].filter(Boolean).join(", ")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Rent</span><span>{form.rent_amount} {form.currency_code}/{form.rent_period === "monthly" ? "mo" : form.rent_period === "weekly" ? "wk" : "day"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Available</span><span>{form.available_from || "Flexible"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Photos</span><span>{form.photos.length}</span></div>
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
            <Button variant="outline" onClick={() => handlePublish("draft")} disabled={saving}>
              Save Draft
            </Button>
          )}
          {step < 7 ? (
            <Button
              onClick={handleNext}
              disabled={false}
              aria-label={`Next: ${STEPS[step + 1] || "Review"}`}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              Next <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => handlePublish("active")}
              disabled={saving}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {saving ? "Publishing..." : "Publish Listing"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
