import React, { useState } from "react";
import { entities, uploadFile } from '@/api/entities';
import { compressImage } from '@/lib/imageCompression';
import { generateSeekerSlug } from '@/lib/listingHelpers';
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, Upload, X, Loader2 } from "lucide-react";

const PROVINCES = ["Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Nova Scotia", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan"];
const WORK_STATUS = ["employed", "student", "freelancer", "unemployed", "other"];

export default function SeekerOnboarding() {
  const { user, navigateToLogin, logout } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    headline: "",
    about_me: "",
    preferred_country: "Canada",
    preferred_province_or_state: "",
    preferred_cities: [],
    min_budget: "",
    max_budget: "",
    move_in_date: "",
    work_status: "",
    student_status: false,
    smoking: "non-smoker",
    pets: "no",
    cleanliness_level: "moderate",
    sleep_schedule: "regular",
    social_level: "balanced",
    guest_frequency: "occasionally",
    noise_tolerance: "moderate",
    photos: [],
  });
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddCity = (e) => {
    if (e.key === "Enter" && e.target.value.trim()) {
      const city = e.target.value.trim();
      if (!formData.preferred_cities.includes(city)) {
        setFormData(prev => ({
          ...prev,
          preferred_cities: [...prev.preferred_cities, city]
        }));
      }
      e.target.value = "";
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (formData.photos.length >= 4) {
      toast.error("Maximum 4 photos allowed.");
      return;
    }
    setUploadingPhoto(true);
    const compressedFile = await compressImage(file);
    const { file_url } = await uploadFile(compressedFile, 'profile-photos');
    setUploadingPhoto(false);
    setFormData(prev => ({ ...prev, photos: [...prev.photos, file_url] }));
    toast.success("Photo uploaded.");
    e.target.value = "";
  };

  const removePhoto = (index) => {
    setFormData(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }));
  };

  const validateStep = () => {
    if (step === 1) {
      if (!formData.headline.trim()) { toast.error("Headline is required."); return false; }
      if (!formData.about_me.trim()) { toast.error("About You is required."); return false; }
      if (formData.photos.length === 0) { toast.error("At least one profile photo is required."); return false; }
    }
    if (step === 2) {
      if (!formData.preferred_province_or_state) { toast.error("Please select a province."); return false; }
      if (formData.preferred_cities.length === 0) { toast.error("Please add at least one preferred city."); return false; }
      if (!formData.min_budget) { toast.error("Min budget is required."); return false; }
      if (!formData.max_budget) { toast.error("Max budget is required."); return false; }
      if (!formData.move_in_date) { toast.error("Move-in date is required."); return false; }
    }
    if (step === 3) {
      if (!formData.work_status) { toast.error("Work status is required."); return false; }
    }
    return true;
  };

  const handleNext = () => {
    setAttempted(true);
    if (!validateStep()) return;
    setStep(step + 1);
  };

  const handleSave = async () => {
    if (!validateStep()) return;

    setSaving(true);
    try {
      const existing = await entities.SeekerProfile.filter({
        owner_user_id: user.id
      });

      const payload = {
        ...formData,
        avatar_url: formData.photos[0] || undefined,
      };

      // Generate slug from headline + id
      const slug = generateSeekerSlug(formData.headline, existing[0]?.id || 'new');

      if (existing.length > 0) {
        await entities.SeekerProfile.update(existing[0].id, payload);
      } else {
        const tempId = crypto.randomUUID();
        await entities.SeekerProfile.create({
          slug: generateSeekerSlug(formData.headline, tempId),
          owner_user_id: user.id,
          ...payload,
        });
      }

      toast.success("Profile saved!");
      navigate("/search");
    } catch (err) {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { title: "About You" },
    { title: "Location & Budget" },
    { title: "Lifestyle" },
    { title: "Living Habits" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            {steps.map((s, i) => (
              <React.Fragment key={i}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    i < step ? "bg-accent text-white" : i === step - 1 ? "bg-accent text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </div>
                {i < steps.length - 1 && <div className={`flex-1 h-1 ${i < step - 1 ? "bg-accent" : "bg-muted"}`} />}
              </React.Fragment>
            ))}
          </div>
          <h2 className="text-2xl font-bold text-foreground">{steps[step - 1].title}</h2>
          <p className="text-sm text-muted-foreground mt-1">Step {step} of {steps.length}</p>
        </div>

        {/* Form */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-6 mb-6">
          {step === 1 && (
            <>
              <div>
                <Label htmlFor="headline">Headline *</Label>
                <Input
                  id="headline"
                  placeholder="e.g., Young professional looking for quiet room"
                  value={formData.headline}
                  className={`mt-1 ${attempted && !formData.headline?.trim() ? "border-destructive" : ""}`}
                  onChange={(e) => handleChange("headline", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="about_me">About You *</Label>
                <Textarea
                  id="about_me"
                  placeholder="Tell roommates about yourself..."
                  value={formData.about_me}
                  onChange={(e) => handleChange("about_me", e.target.value)}
                  className="mt-2 min-h-32"
                />
              </div>

              {/* Profile Photos (required) */}
              <div>
                <Label>Profile Photos <span className="text-destructive">*</span> <span className="text-muted-foreground font-normal">(at least 1, up to 4)</span></Label>
                <div className="mt-2 grid grid-cols-4 gap-3">
                  {formData.photos.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-border group">
                      <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" aria-label={`Photo ${i + 1}`} />
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                  {formData.photos.length < 4 && (
                    <label className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-accent/50 transition-colors bg-muted/30">
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
                      {uploadingPhoto ? (
                        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                          <span className="text-xs text-muted-foreground">Add</span>
                        </>
                      )}
                    </label>
                  )}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <Label htmlFor="province">Province *</Label>
                <Select value={formData.preferred_province_or_state} onValueChange={(v) => handleChange("preferred_province_or_state", v)}>
                  <SelectTrigger id="province" className="mt-2">
                    <SelectValue placeholder="Select province..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="cities">Preferred Cities *</Label>
                <Input
                  id="cities"
                  placeholder="Type city and press Enter..."
                  onKeyDown={handleAddCity}
                  className="mt-2"
                />
                <div className="flex flex-wrap gap-2 mt-3">
                  {formData.preferred_cities.map(city => (
                    <div key={city} className="bg-accent text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
                      {city}
                      <button onClick={() => setFormData(p => ({ ...p, preferred_cities: p.preferred_cities.filter(c => c !== city) }))} className="text-white/70 hover:text-white">×</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="min">Min Budget ($) *</Label>
                  <Input
                    id="min"
                    type="number"
                    min="0"
                    value={formData.min_budget}
                    onChange={(e) => handleChange("min_budget", Math.max(0, Number(e.target.value)) || "")}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="max">Max Budget ($) *</Label>
                  <Input
                    id="max"
                    type="number"
                    min="0"
                    value={formData.max_budget}
                    onChange={(e) => handleChange("max_budget", e.target.value < 0 ? "" : e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="move_in">Move-in Date *</Label>
                <Input
                  id="move_in"
                  type="date"
                  value={formData.move_in_date}
                  onChange={(e) => handleChange("move_in_date", e.target.value)}
                  className="mt-2"
                />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <Label htmlFor="work">Work Status *</Label>
                <Select value={formData.work_status} onValueChange={(v) => handleChange("work_status", v)}>
                  <SelectTrigger id="work" className="mt-2">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="student">Student?</Label>
                <input
                  id="student"
                  type="checkbox"
                  checked={formData.student_status}
                  onChange={(e) => handleChange("student_status", e.target.checked)}
                  className="w-5 h-5"
                />
              </div>

              <div>
                <Label htmlFor="smoking">Smoking *</Label>
                <Select value={formData.smoking} onValueChange={(v) => handleChange("smoking", v)}>
                  <SelectTrigger id="smoking" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="non-smoker">Non-smoker</SelectItem>
                    <SelectItem value="smoker">Smoker</SelectItem>
                    <SelectItem value="occasional">Occasional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="pets">Pets *</Label>
                <Select value={formData.pets} onValueChange={(v) => handleChange("pets", v)}>
                  <SelectTrigger id="pets" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No pets</SelectItem>
                    <SelectItem value="cat">Cat</SelectItem>
                    <SelectItem value="dog">Dog</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="clean">Cleanliness Level *</Label>
                <Select value={formData.cleanliness_level} onValueChange={(v) => handleChange("cleanliness_level", v)}>
                  <SelectTrigger id="clean" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="very_clean">Very Clean</SelectItem>
                    <SelectItem value="clean">Clean</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="relaxed">Relaxed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div>
                <Label htmlFor="sleep">Sleep Schedule *</Label>
                <Select value={formData.sleep_schedule} onValueChange={(v) => handleChange("sleep_schedule", v)}>
                  <SelectTrigger id="sleep" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="early_bird">Early Bird</SelectItem>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="night_owl">Night Owl</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="social">Social Level *</Label>
                <Select value={formData.social_level} onValueChange={(v) => handleChange("social_level", v)}>
                  <SelectTrigger id="social" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="introvert">Introvert</SelectItem>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="extrovert">Extrovert</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="guests">Guest Frequency *</Label>
                <Select value={formData.guest_frequency} onValueChange={(v) => handleChange("guest_frequency", v)}>
                  <SelectTrigger id="guests" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rarely">Rarely</SelectItem>
                    <SelectItem value="occasionally">Occasionally</SelectItem>
                    <SelectItem value="frequently">Frequently</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="noise">Noise Tolerance *</Label>
                <Select value={formData.noise_tolerance} onValueChange={(v) => handleChange("noise_tolerance", v)}>
                  <SelectTrigger id="noise" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quiet">Quiet</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="flexible">Flexible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="gap-2">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          )}
          <div className="flex-1" />
          {step < steps.length ? (
            <Button onClick={handleNext} className="gap-2">
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? "Saving..." : "Complete Profile"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}