import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entities, uploadFile, invokeFunction, invokeLLM } from '@/api/entities';
import { supabase } from '@/lib/supabase';
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Save, LogOut, Loader2, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { getRegionsForCountry, getAvatarFallback } from "@/lib/geoHelpers";
import { isProfileComplete, getMissingFields, formatFieldName } from "@/lib/profileValidation";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { normalizeProvince } from "@/lib/addressValidation";
import { compressImage } from "@/lib/imageCompression";
import { toast } from "sonner";

export default function Profile() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [generatingBio, setGeneratingBio] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      // Soft delete - mark account as deleted and sign out
      const profiles = await entities.UserProfile.filter({ user_id: user.id });
      if (profiles[0]) {
        await entities.UserProfile.update(profiles[0].id, { account_status: 'deleted' });
      }
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (err) {
      toast.error("Failed to delete account. Please contact support.");
      setDeleting(false);
    }
  };

  const { data: profiles = [] } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => entities.UserProfile.filter({ user_id: user.id }),
    enabled: !!user,
  });

  const profile = profiles[0];
  const [form, setForm] = useState({
    full_name: "", display_name: "", bio: "",
    phone: "", country: "", province_or_state: "", city: "",
    postal_or_zip: "", avatar_url: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        display_name: profile.display_name || "",
        bio: profile.bio || "",
        phone: profile.phone || "",
        country: profile.country || "",
        province_or_state: profile.province_or_state || "",
        city: profile.city || "",
        postal_or_zip: profile.postal_or_zip || "",
        avatar_url: profile.avatar_url || "",
      });
    }
  }, [profile]);

  const update = (key, value) => {
    const updated = { ...form, [key]: value };
    if (key === "country") updated.province_or_state = "";
    setForm(updated);
  };

  const regions = form.country ? getRegionsForCountry(form.country) : [];

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressedFile = await compressImage(file);
    const { file_url } = await uploadFile(compressedFile, 'profile-photos');
    update("avatar_url", file_url);
  };

  const handleSave = async () => {
    setAttempted(true);
    // Validate mandatory fields
    const missing = [];
    if (!form.full_name?.trim()) missing.push("Full Name");
    if (!form.phone?.trim()) missing.push("Phone");
    if (!form.city?.trim()) missing.push("City");

    if (missing.length > 0) {
      toast.error(`Required fields: ${missing.join(", ")}`);
      return;
    }

    setSaving(true);
    if (profile) {
      await entities.UserProfile.update(profile.id, { ...form, email: user.email });
    } else {
      await entities.UserProfile.create({ ...form, user_id: user.id, email: user.email });
    }
    queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    toast.success("Profile saved!");
    setSaving(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">Your Profile</h1>

      <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="w-20 h-20">
              <AvatarImage src={form.avatar_url} />
              <AvatarFallback className="text-lg bg-accent/10 text-accent">
                {getAvatarFallback(form.display_name || form.full_name || user?.user_metadata?.full_name)}
              </AvatarFallback>
            </Avatar>
            {!form.avatar_url && <div className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white rounded-full text-xs flex items-center justify-center font-bold">*</div>}
          </div>
          <label className="cursor-pointer">
            <Button variant="outline" size="sm" asChild>
              <span><Upload className="w-4 h-4 mr-1" /> Upload Photo</span>
            </Button>
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </label>
        </div>

        <div>
          <Label>Full Name <span className="text-destructive">*</span></Label>
          <Input id="full-name" name="full_name" autoComplete="name" value={form.full_name} className={`mt-1 ${attempted && !form.full_name?.trim() ? "border-destructive" : ""}`} onChange={(e) => update("full_name", e.target.value)} placeholder="Your full name" />
        </div>

        <div><Label>Display Name</Label><Input className="mt-1" id="display-name" name="display_name" value={form.display_name} onChange={(e) => update("display_name", e.target.value)} /></div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <Label className="flex-1">Bio</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-accent hover:bg-accent/10 h-7 px-2 whitespace-nowrap flex-shrink-0"
              onClick={async () => {
                if (!form.bio?.trim()) {
                  toast.error("Write a bio first to rewrite");
                  return;
                }
                setGeneratingBio(true);
                const res = await invokeLLM({
                  prompt: `Rewrite this roommate profile bio to be more engaging and friendly. Return ONLY the rewritten bio text, no labels, no markdown, no quotes. Original: "${form.bio}"`,
                });
                update("bio", typeof res === 'string' ? res : res?.text || res);
                setGeneratingBio(false);
              }}
              disabled={generatingBio}
            >
              {generatingBio ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : "✨"}
              {generatingBio ? "Rewriting..." : "AI Rewrite"}
            </Button>
          </div>
          <Textarea className="mt-1" value={form.bio} onChange={(e) => update("bio", e.target.value.slice(0, 500))} placeholder="Tell roommates about yourself..." maxLength={500} />
          <p className="text-xs text-muted-foreground text-right mt-1">{form.bio?.length || 0}/500</p>
        </div>

        <div><Label>Phone <span className="text-destructive">*</span></Label><Input id="phone" name="phone" autoComplete="tel" value={form.phone} className={`mt-1 ${attempted && !form.phone?.trim() ? "border-destructive" : ""}`} onChange={(e) => update("phone", e.target.value)} placeholder="Required" /></div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Country</Label>
            <Select value={form.country} onValueChange={(v) => update("country", v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Canada">🇨🇦 Canada</SelectItem>
                <SelectItem value="USA">🇺🇸 USA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Province / State</Label>
            <Select value={form.province_or_state} onValueChange={(v) => update("province_or_state", v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>City <span className="text-destructive">*</span></Label>
            <AddressAutocomplete
              id="city" name="city" value={form.city}
              placeholder="Start typing your city..."
              countryFilter={form.country === 'Canada' ? 'ca' : form.country === 'United States' ? 'us' : undefined}
              onChange={(parsed) => {
                setForm(prev => ({
                  ...prev,
                  city: parsed.city || prev.city,
                  province_or_state: normalizeProvince(parsed.province_or_state) || prev.province_or_state,
                  postal_or_zip: parsed.postal_or_zip || prev.postal_or_zip,
                }));
              }}
              className="mt-1"
            />
          </div>
          <div><Label>Postal / ZIP</Label><Input className="mt-1" id="postal" name="postal_or_zip" autoComplete="postal-code" value={form.postal_or_zip} onChange={(e) => update("postal_or_zip", e.target.value)} /></div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={handleSave} disabled={saving} className="bg-accent hover:bg-accent/90 text-accent-foreground min-h-[44px]">
            <Save className="w-4 h-4 mr-1" /> {saving ? "Saving..." : "Save Profile"}
          </Button>
          <Button variant="outline" onClick={() => logout('/')} className="min-h-[44px]">
            <LogOut className="w-4 h-4 mr-1" /> Sign Out
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive min-h-[44px]">
                <Trash2 className="w-4 h-4 mr-1" /> Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your profile, listings, messages, and all associated data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                  {deleting ? "Deleting..." : "Yes, delete my account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}