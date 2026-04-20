import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { entities, invokeFunction, invokeLLM } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, AlertCircle, Loader2 } from "lucide-react";
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

  // Fetch listing
  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: () => entities.Listing.get(id),
    enabled: !!id,
  });

  useEffect(() => {
    if (listing) {
      // Check ownership
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAttempted(true);
    const editErrors = [];
    if (!formData.title?.trim()) editErrors.push('Title is required');
    if (!formData.rent_amount || Number(formData.rent_amount) <= 0) editErrors.push('Rent amount must be greater than 0');
    if (editErrors.length > 0) { editErrors.forEach(e => toast.error(e)); return; }
    setIsSubmitting(true);

    try {
      // Track price change for history
      const oldPrice = listing.rent_amount || listing.monthly_rent;
      const newPrice = formData.rent_amount || formData.monthly_rent;
      const priceHistoryEntry = oldPrice !== newPrice ? {
        amount: newPrice,
        period: formData.rent_period || "monthly",
        changed_at: new Date().toISOString(),
        previous_amount: oldPrice
      } : null;

      const updateData = { 
        ...changes,
        // Fix: convert empty date strings to null to avoid DB type errors
        ...(changes.available_from !== undefined && { available_from: changes.available_from || null }),
        ...(changes.move_in_date !== undefined && { move_in_date: changes.move_in_date || null }),
      };
      if (priceHistoryEntry) {
        updateData.price_history = [...(listing.price_history || []), priceHistoryEntry];
      }

      // Update listing
      await entities.Listing.update(id, updateData);

      // Trigger notification function
      await invokeFunction('listings/updated', {
        listing_id: id,
        old_data: listing,
        new_data: { ...listing, ...updateData }
      });

      toast.success("Listing updated successfully");
      queryClient.invalidateQueries({ queryKey: ["listing", id] });
      navigate(`/listing/${formData?.slug || id}`);
    } catch (error) {
      console.error("Error updating listing:", error?.message || error);
      toast.error(error?.message || "Failed to update listing. Please check all fields.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>;
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-accent hover:bg-accent/10 h-7 px-2 whitespace-nowrap flex-shrink-0"
                onClick={async () => {
                  if (!formData.title?.trim()) {
                    toast.error("Write a title first to rewrite");
                    return;
                  }
                  setGeneratingTitle(true);
                  const res = await invokeLLM({
                    prompt: `Rewrite this room listing title to be more compelling and catchy. Return ONLY the new title text, no quotes, no labels, no markdown, max 60 characters. Original: "${formData.title}"`,
                  });
                  handleChange("title", typeof res === 'string' ? res : res?.text || res);
                  setGeneratingTitle(false);
                }}
                disabled={generatingTitle}
              >
                {generatingTitle ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : "✨"}
                {generatingTitle ? "Rewriting..." : "AI Rewrite"}
              </Button>
            </div>
            <Input
              id="edit-title" name="title" value={formData.title || ""}
              onChange={(e) => handleChange("title", e.target.value.slice(0, 80))}
              required
              className={`mt-1 ${attempted && !formData.title?.trim() ? "border-destructive" : ""}`}
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground text-right mt-1">{(formData.title || "").length}/80</p>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <Label className="flex-1">Description</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-accent hover:bg-accent/10 h-7 px-2 whitespace-nowrap flex-shrink-0"
                onClick={async () => {
                  if (!formData.description?.trim()) {
                    toast.error("Write a description first to rewrite");
                    return;
                  }
                  setGeneratingDescription(true);
                  const res = await invokeLLM({
                    prompt: `Rewrite this room listing description to be more compelling and engaging. Return ONLY the rewritten description text, no labels, no markdown. Original: "${formData.description}"`,
                  });
                  handleChange("description", typeof res === 'string' ? res : res?.text || res);
                  setGeneratingDescription(false);
                }}
                disabled={generatingDescription}
              >
                {generatingDescription ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : "✨"}
                {generatingDescription ? "Rewriting..." : "AI Rewrite"}
              </Button>
            </div>
            <Textarea
              value={formData.description || ""}
              onChange={(e) => handleChange("description", e.target.value.slice(0, 1000))}
              className="mt-1 h-32"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right mt-1">{(formData.description || "").length}/1000</p>
          </div>

          {/* Rent Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Rent Amount</Label>
              <Input
                type="number"
                min="0"
                value={formData.rent_amount || formData.monthly_rent || ""}
                onChange={(e) => handleChange("rent_amount", Math.max(0, parseFloat(e.target.value)) || "")}
                required
                className="mt-2"
              />
            </div>
            <div>
              <Label>Rent Period</Label>
              <Select value={formData.rent_period || "monthly"} onValueChange={(v) => handleChange("rent_period", v)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Amenities */}
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground">Amenities</h3>
            {[
              { key: "bills_included", label: "Bills Included" },
              { key: "internet_included", label: "Internet Included" },
              { key: "pets_allowed", label: "Pets Allowed" },
              { key: "smoking_allowed", label: "Smoking Allowed" },
              { key: "student_friendly", label: "Student Friendly" },
              { key: "couples_allowed", label: "Couples Allowed" },
              { key: "lgbtq_friendly", label: "LGBTQ+ Friendly" }
            ].map(amenity => (
              <label key={amenity.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData[amenity.key] || false}
                  onChange={(e) => handleChange(amenity.key, e.target.checked)}
                  className="rounded border-input"
                />
                <span className="text-sm text-muted-foreground">{amenity.label}</span>
              </label>
            ))}
          </div>

          {/* Price History Notice */}
          {listing.price_history && listing.price_history.length > 0 && (
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-accent mb-1">Price History</p>
                <p className="text-muted-foreground">
                  This listing has {listing.price_history.length} price change{listing.price_history.length !== 1 ? "s" : ""}. Users who favorited this listing will be notified of price changes.
                </p>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3">
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              <Save className="w-4 h-4" /> {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}