import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { entities, invokeLLM } from '@/api/entities';
import AddressAutocomplete from '@/components/ui/AddressAutocomplete';
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function ListingEditModal({ listing, open, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: listing?.title || "",
    description: listing?.description || "",
    city: listing?.city || "",
    province_or_state: listing?.province_or_state || "",
    street_address: listing?.street_address || "",
    rent_amount: listing?.rent_amount || listing?.monthly_rent || "",
    status: listing?.status || "active",
    is_featured: listing?.is_featured || false,
    listing_type: listing?.listing_type || "private_room",
    furnishing: listing?.furnishing || "",
    minimum_stay_months: listing?.minimum_stay_months || "",
  });
  const [saving, setSaving] = useState(false);
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    await entities.Listing.update(listing.id, {
      ...form,
      rent_amount: form.rent_amount ? Number(form.rent_amount) : undefined,
      minimum_stay_months: form.minimum_stay_months ? Number(form.minimum_stay_months) : undefined,
    });
    setSaving(false);
    toast.success("Listing updated");
    onSaved?.();
    onClose();
  };

  if (!listing) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Listing — Admin Override</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <Label className="text-xs flex-1">Title</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-accent hover:bg-accent/10 h-6 px-1.5 whitespace-nowrap flex-shrink-0"
                onClick={async () => {
                  if (!form.title?.trim()) {
                    toast.error("Write a title first to rewrite");
                    return;
                  }
                  setGeneratingTitle(true);
                  const res = await invokeLLM({
                    prompt: `Rewrite this room listing title to be more compelling and catchy. Return ONLY the new title text, no quotes, no labels, no markdown, max 60 characters. Original: "${form.title}"`,
                  });
                  set("title", res);
                  setGeneratingTitle(false);
                }}
                disabled={generatingTitle}
              >
                {generatingTitle ? <Loader2 className="w-2.5 h-2.5 animate-spin mr-0.5" /> : "✨"}
              </Button>
            </div>
            <Input value={form.title} onChange={e => set("title", e.target.value.slice(0, 80))} maxLength={80} />
          <p className="text-xs text-muted-foreground text-right mt-0.5">{form.title?.length || 0}/80</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["draft", "pending_review", "active", "rented", "paused", "expired", "rejected", "removed"].map(s => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Listing Type</Label>
              <Select value={form.listing_type} onValueChange={v => set("listing_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="private_room">Private Room</SelectItem>
                  <SelectItem value="shared_room">Shared Room</SelectItem>
                  <SelectItem value="entire_place">Entire Place</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Rent Amount</Label>
              <Input type="number" value={form.rent_amount} onChange={e => set("rent_amount", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Min Stay (months)</Label>
              <Input type="number" value={form.minimum_stay_months} onChange={e => set("minimum_stay_months", e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Street Address</Label>
            <AddressAutocomplete
            value={form.street_address}
            placeholder="Start typing an address..."
            onChange={(parsed) => {
              if (parsed.street_address) set('street_address', parsed.street_address);
              if (parsed.city) set('city', parsed.city);
              if (parsed.province_or_state) set('province_or_state', parsed.province_or_state);
            }}
          />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">City</Label>
              <Input value={form.city} onChange={e => set("city", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Province / State</Label>
              <Input value={form.province_or_state} onChange={e => set("province_or_state", e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Furnishing</Label>
            <Select value={form.furnishing || ""} onValueChange={v => set("furnishing", v)}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="furnished">Furnished</SelectItem>
                <SelectItem value="unfurnished">Unfurnished</SelectItem>
                <SelectItem value="partially_furnished">Partially Furnished</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <Label className="text-xs flex-1">Description</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-accent hover:bg-accent/10 h-6 px-1.5 whitespace-nowrap flex-shrink-0"
                onClick={async () => {
                  if (!form.description?.trim()) {
                    toast.error("Write a description first to rewrite");
                    return;
                  }
                  setGeneratingDescription(true);
                  const res = await invokeLLM({
                    prompt: `Rewrite this room listing description to be more compelling and engaging. Return ONLY the rewritten description text, no labels, no markdown. Original: "${form.description}"`,
                  });
                  set("description", res);
                  setGeneratingDescription(false);
                }}
                disabled={generatingDescription}
              >
                {generatingDescription ? <Loader2 className="w-2.5 h-2.5 animate-spin mr-0.5" /> : "✨"}
              </Button>
            </div>
            <Textarea value={form.description} onChange={e => set("description", e.target.value.slice(0, 1000))} rows={4} maxLength={1000} />
          <p className="text-xs text-muted-foreground text-right mt-0.5">{form.description?.length || 0}/1000</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="featured"
              checked={form.is_featured}
              onChange={e => set("is_featured", e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="featured" className="text-sm cursor-pointer">Mark as Featured</Label>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}