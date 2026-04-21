import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entities, invokeFunction, invokeLLM } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save, AlertCircle, Loader2 } from "lucide-react";
import {
  PROPERTY_TYPES, FURNISHING_OPTIONS, BATHROOM_TYPES,
  FLOOR_LEVEL_OPTIONS, LAUNDRY_OPTIONS, KITCHEN_ACCESS_OPTIONS,
  AC_HEATING_OPTIONS, TOTAL_BEDROOMS_OPTIONS, CURRENT_ROOMMATES_OPTIONS,
  BEDS_IN_ROOM_OPTIONS, BOOKING_MODE_OPTIONS, CANCELLATION_POLICY_OPTIONS,
  CHECKIN_TIME_OPTIONS, CHECKOUT_TIME_OPTIONS,
} from "@/lib/config";
import { toast } from "sonner";

export default function EditListing() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [changes, setChanges] = useState({});
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      if (isUuid) {
        return await entities.Listing.get(id);
      } else {
        const listings = await entities.Listing.filter({ slug: id });
        return listings[0] || null;
      }
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (listing) {
      if (listing.owner_user_id !== user?.id) {
        toast.error("You can only edit your own listings");
        navigate(-1);
        return;
      }
      setFormData(listing);
    }
  }, [listing, user, navigate]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setChanges(prev => ({ ...prev, [field]: value }));
  };

  const isDaily = formData.rent_period === "daily";
  const isSharedRoom = formData.listing_type === "shared_room";
  const isEntirePlace = formData.listing_type === "entire_place";
  const isPrivateRoom = formData.listing_type === "private_room";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAttempted(true);

    const editErrors = [];
    if (!formData.title?.trim()) editErrors.push('Title is required');
    if (!formData.rent_amount || Number(formData.rent_amount) <= 0) editErrors.push('Rent amount must be greater than 0');

    if (editErrors.length > 0) {
      editErrors.forEach(e => toast.error(e));
      return;
    }

    setIsSubmitting(true);
    try {
      const oldPrice = listing.rent_amount || listing.monthly_rent;
      const newPrice = formData.rent_amount || formData.monthly_rent;
      const priceHistoryEntry = oldPrice !== newPrice
        ? { amount: newPrice, period: formData.rent_period || "monthly", changed_at: new Date().toISOString(), previous_amount: oldPrice }
        : null;

      const emptyToNull = (val) => (val === "" || val === undefined) ? null : val;

      const updateData = {
        ...changes,
        ...(changes.available_from !== undefined && { available_from: changes.available_from || null }),
        ...(changes.available_until !== undefined && { available_until: changes.available_until || null }),
        ...(changes.move_in_date !== undefined && { move_in_date: changes.move_in_date || null }),
        // Sanitize enum fields
        ...(changes.bathroom_type !== undefined && { bathroom_type: emptyToNull(changes.bathroom_type) }),
        ...(changes.furnishing !== undefined && { furnishing: emptyToNull(changes.furnishing) }),
        ...(changes.property_type !== undefined && { property_type: emptyToNull(changes.property_type) }),
        ...(changes.floor_level !== undefined && { floor_level: emptyToNull(changes.floor_level) }),
        ...(changes.laundry !== undefined && { laundry: emptyToNull(changes.laundry) }),
        ...(changes.kitchen_access !== undefined && { kitchen_access: emptyToNull(changes.kitchen_access) }),
        ...(changes.ac_heating !== undefined && { ac_heating: emptyToNull(changes.ac_heating) }),
        ...(changes.booking_mode !== undefined && { booking_mode: emptyToNull(changes.booking_mode) }),
        ...(changes.cancellation_policy !== undefined && { cancellation_policy: emptyToNull(changes.cancellation_policy) }),
        ...(changes.cleanliness_preference !== undefined && { cleanliness_preference: emptyToNull(changes.cleanliness_preference) }),
      };

      if (priceHistoryEntry) {
        updateData.price_history = [...(listing.price_history || []), priceHistoryEntry];
      }

      await entities.Listing.update(listing.id, updateData);

      try {
        await invokeFunction('listings/updated', {
          listing_id: listing.id,
          old_data: listing,
          new_data: { ...listing, ...updateData }
        });
      } catch {}

      toast.success("Listing updated successfully");
      queryClient.invalidateQueries({ queryKey: ["listing", id] });
      navigate(`/listing/${formData?.slug || listing.id}`);
    } catch (error) {
      console.error("Error updating listing:", error?.message || error);
      toast.error(error?.message || "Failed to update listing.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  if (!listing) return <div className="flex items-center justify-center min-h-screen"><p>Listing not found</p></div>;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-accent hover:underline mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-3xl font-bold text-foreground mb-8">Edit Listing</h1>

        <form onSubmit={handleSubmit} className="space-y-6 bg-card border border-border rounded-2xl p-6">
          {/* Title */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <Label className="flex-1">Title</Label>
              <Button type="button" variant="ghost" size="sm"
                className="text-xs text-accent hover:bg-accent/10 h-7 px-2"
                onClick={async () => {
                  if (!formData.title?.trim()) { toast.error("Write a title first"); return; }
                  setGeneratingTitle(true);
                  const res = await invokeLLM({ prompt: `Rewrite this title to be compelling. Return ONLY text, max 60 chars. Original: "${formData.title}"` });
                  handleChange("title", typeof res === 'string' ? res : res?.text || res);
                  setGeneratingTitle(false);
                }}
                disabled={generatingTitle}
              >
                {generatingTitle ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : "✨"}
                {generatingTitle ? "Rewriting..." : "AI Rewrite"}
              </Button>
            </div>
            <Input value={formData.title || ""} onChange={(e) => handleChange("title", e.target.value.slice(0, 80))}
              required className={`mt-1 ${attempted && !formData.title?.trim() ? "border-destructive" : ""}`} maxLength={80} />
            <p className="text-xs text-muted-foreground text-right mt-1">{(formData.title || "").length}/80</p>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <Label className="flex-1">Description</Label>
              <Button type="button" variant="ghost" size="sm"
                className="text-xs text-accent hover:bg-accent/10 h-7 px-2"
                onClick={async () => {
                  if (!formData.description?.trim()) { toast.error("Write a description first"); return; }
                  setGeneratingDescription(true);
                  const res = await invokeLLM({ prompt: `Rewrite this description to be engaging. Return ONLY text. Original: "${formData.description}"` });
                  handleChange("description", typeof res === 'string' ? res : res?.text || res);
                  setGeneratingDescription(false);
                }}
                disabled={generatingDescription}
              >
                {generatingDescription ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : "✨"}
                {generatingDescription ? "Rewriting..." : "AI Rewrite"}
              </Button>
            </div>
            <Textarea value={formData.description || ""} onChange={(e) => handleChange("description", e.target.value.slice(0, 1000))} className="mt-1 h-32" maxLength={1000} />
            <p className="text-xs text-muted-foreground text-right mt-1">{(formData.description || "").length}/1000</p>
          </div>

          {/* Rent */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Rent Amount</Label>
              <Input type="number" min="0" value={formData.rent_amount || ""} onChange={(e) => handleChange("rent_amount", Math.max(0, parseFloat(e.target.value)) || "")} required className="mt-2" />
            </div>
            <div>
              <Label>Rent Period</Label>
              <Select value={formData.rent_period || "monthly"} onValueChange={(v) => handleChange("rent_period", v)}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Property Details */}
          <div className="space-y-4 border-t border-border pt-6">
            <h3 className="font-semibold text-foreground">Property Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Property Type</Label>
                <Select value={formData.property_type || ""} onValueChange={(v) => handleChange("property_type", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{PROPERTY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Furnishing</Label>
                <Select value={formData.furnishing || ""} onValueChange={(v) => handleChange("furnishing", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{FURNISHING_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {isPrivateRoom && (
              <div>
                <Label>Bathroom</Label>
                <Select value={formData.bathroom_type || ""} onValueChange={(v) => handleChange("bathroom_type", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{BATHROOM_TYPES.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <Label>Total Bedrooms</Label>
                <Select value={formData.total_bedrooms?.toString() || ""} onValueChange={(v) => handleChange("total_bedrooms", Number(v))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{TOTAL_BEDROOMS_OPTIONS.map(b => <SelectItem key={b.value} value={b.value.toString()}>{b.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {!isEntirePlace && (
                <div>
                  <Label>Current Roommates</Label>
                  <Select value={formData.current_roommates?.toString() ?? ""} onValueChange={(v) => handleChange("current_roommates", Number(v))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{CURRENT_ROOMMATES_OPTIONS.map(r => <SelectItem key={r.value} value={r.value.toString()}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Room Size (sq ft)</Label>
                <Input className="mt-1" type="number" min="0" placeholder="Optional" value={formData.room_size_sqft || ""} onChange={(e) => handleChange("room_size_sqft", Number(e.target.value) || null)} />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <Label>Laundry</Label>
                <Select value={formData.laundry || ""} onValueChange={(v) => handleChange("laundry", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{LAUNDRY_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kitchen Access</Label>
                <Select value={formData.kitchen_access || ""} onValueChange={(v) => handleChange("kitchen_access", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{KITCHEN_ACCESS_OPTIONS.map(k => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Floor Level</Label>
                <Select value={formData.floor_level || ""} onValueChange={(v) => handleChange("floor_level", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{FLOOR_LEVEL_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>AC / Heating</Label>
                <Select value={formData.ac_heating || ""} onValueChange={(v) => handleChange("ac_heating", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{AC_HEATING_OPTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Amenities */}
          <div className="space-y-3 border-t border-border pt-6">
            <h3 className="font-semibold text-foreground">Amenities</h3>
            {[
              { key: "bills_included", label: "Bills Included" },
              { key: "internet_included", label: "Internet Included" },
              { key: "pets_allowed", label: "Pets Allowed" },
              { key: "smoking_allowed", label: "Smoking Allowed" },
              { key: "student_friendly", label: "Student Friendly" },
              { key: "couples_allowed", label: "Couples Allowed" },
              { key: "lgbtq_friendly", label: "LGBTQ+ Friendly" },
            ].map(amenity => (
              <label key={amenity.key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData[amenity.key] || false}
                  onChange={(e) => handleChange(amenity.key, e.target.checked)} className="rounded border-input" />
                <span className="text-sm text-muted-foreground">{amenity.label}</span>
              </label>
            ))}
          </div>

          {/* Daily rental settings */}
          {isDaily && (
            <div className="space-y-4 border-t border-border pt-6">
              <h3 className="font-semibold text-foreground">Daily Rental Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cleaning Fee</Label>
                  <Input type="number" min="0" className="mt-1" value={formData.cleaning_fee || ""} onChange={(e) => handleChange("cleaning_fee", Number(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Booking Mode</Label>
                  <Select value={formData.booking_mode || "inquiry"} onValueChange={(v) => handleChange("booking_mode", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{BOOKING_MODE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Check-in Time</Label>
                  <Select value={formData.checkin_time || "15:00"} onValueChange={(v) => handleChange("checkin_time", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{CHECKIN_TIME_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Check-out Time</Label>
                  <Select value={formData.checkout_time || "11:00"} onValueChange={(v) => handleChange("checkout_time", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{CHECKOUT_TIME_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {formData.booking_mode === "booking_required" && (
                <div>
                  <Label>Cancellation Policy</Label>
                  <Select value={formData.cancellation_policy || "flexible"} onValueChange={(v) => handleChange("cancellation_policy", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{CANCELLATION_POLICY_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Price History */}
          {listing.price_history && listing.price_history.length > 0 && (
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-accent mb-1">Price History</p>
                <p className="text-muted-foreground">{listing.price_history.length} price change{listing.price_history.length !== 1 ? "s" : ""}. Favorited users will be notified.</p>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3">
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              <Save className="w-4 h-4" /> {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
