import React, { useState } from "react";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { isQuebec } from "@/lib/geoHelpers";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, BookmarkPlus, Inbox, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

function buildSearchName(filters) {
  const parts = [];
  if (filters.city) parts.push(filters.city);
  if (filters.province_or_state) parts.push(filters.province_or_state);
  if (filters.max_price || filters.price_max) {
    const max = filters.max_price || filters.price_max;
    parts.push(`under $${max}`);
  }
  if (filters.listing_type) {
    const labels = { private_room: "Private Room", shared_room: "Shared Room", entire_place: "Entire Place" };
    parts.push(labels[filters.listing_type] || filters.listing_type);
  }
  return parts.length > 0 ? parts.join(" · ") : "My Search";
}

function buildFilterSummary(filters) {
  const parts = [];
  if (filters.city) parts.push(filters.city);
  if (filters.province_or_state) parts.push(filters.province_or_state);
  if (filters.country) parts.push(filters.country);
  const min = filters.min_price || filters.price_min;
  const max = filters.max_price || filters.price_max;
  if (min && max) parts.push(`$${min}–$${max}`);
  else if (max) parts.push(`up to $${max}`);
  else if (min) parts.push(`from $${min}`);
  if (filters.listing_type) {
    const labels = { private_room: "Private Room", shared_room: "Shared Room", entire_place: "Entire Place" };
    parts.push(labels[filters.listing_type] || filters.listing_type);
  }
  if (filters.furnishing) parts.push(filters.furnishing);
  if (filters.parking || filters.parking_available) parts.push("Parking");
  if (filters.pets_allowed) parts.push("Pets OK");
  return parts.join(" · ") || "All listings";
}

/**
 * SaveSearchModal
 * Props:
 *   searchType: "rooms" | "roommates" (passed from the search page)
 */
export default function SaveSearchModal({ open, onOpenChange, filters = {}, searchType = "rooms", onSaved }) {
  const { user, navigateToLogin } = useAuth();
  const [name, setName] = useState(buildSearchName(filters));
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [frequency, setFrequency] = useState("daily");
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifyPush, setNotifyPush] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const filterSummary = buildFilterSummary(filters);
  const entityLabel = searchType === "roommates" ? "roommates" : "rooms";

  // Quebec block
  if (isQuebec(filters.province_or_state)) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cannot Save Search</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            MiNest does not currently operate in Quebec. Please search in another province.
          </p>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogContent>
      </Dialog>
    );
  }

  const handleSave = async () => {
    if (!user) {
      navigateToLogin(window.location.href);
      return;
    }
    if (alertsEnabled && !notifyInApp && !notifyPush) {
      toast.error("Turn on at least one notification channel.");
      return;
    }
    setSaving(true);

    // Build clean filter payload — pack search criteria into filters JSONB column
    const filterData = {
      country: filters.country || null,
      province_or_state: filters.province_or_state || null,
      city: filters.city || null,
      min_price: filters.min_price || filters.price_min ? Number(filters.min_price || filters.price_min) : null,
      max_price: filters.max_price || filters.price_max ? Number(filters.max_price || filters.price_max) : null,
      listing_type: filters.listing_type || null,
      furnishing: filters.furnishing || null,
      parking: !!(filters.parking || filters.parking_available),
      pets_allowed: !!filters.pets_allowed,
      smoking_allowed: !!filters.smoking_allowed,
      student_friendly: !!filters.student_friendly,
    };

    const payload = {
      user_id: user.id,
      name: name.trim() || buildSearchName(filters),
      search_type: searchType === "roommates" ? "roommates" : "rooms",
      filters: filterData,
      frequency: frequency,
      notify_in_app: notifyInApp,
      notify_push: notifyPush,
      alerts_enabled: alertsEnabled,
      is_active: true,
    };

    try {
      await entities.SavedSearch.create(payload);
      setSaving(false);
      setSaved(true);
      toast.success('Search saved!');
      onSaved?.();
    } catch (err) {
      setSaving(false);
      console.error('Save search error:', err);
      toast.error('Could not save search. Please try again.');
    }
  };

  if (saved) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
              <Bell className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-lg">Search Saved!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {alertsEnabled
                  ? `You'll be notified when new matching ${entityLabel} appear.`
                  : "Your search is saved. Enable alerts anytime from Saved Searches."}
              </p>
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Done</Button>
              <Link to="/saved-searches" className="flex-1">
                <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">View Searches</Button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setSaved(false); onOpenChange(v); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookmarkPlus className="w-5 h-5 text-accent" />
            Save Search
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filter summary chip */}
          <div className="bg-muted/50 rounded-lg px-3 py-2">
            <p className="text-xs text-muted-foreground mb-0.5">Search criteria</p>
            <p className="text-sm font-medium text-foreground line-clamp-2">{filterSummary}</p>
          </div>

          {/* Custom name */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Name (optional)</Label>
            <Input
              placeholder="e.g. Calgary Downtown under $900"
              id="search-name" name="search_name" value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
          </div>

          {/* Alert toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-accent flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Notify me of new matches</p>
                <p className="text-xs text-muted-foreground">Get alerts when new {entityLabel} match</p>
              </div>
            </div>
            <Switch checked={alertsEnabled} onCheckedChange={setAlertsEnabled} />
          </div>

          {/* Frequency — only when alerts on */}
          {alertsEnabled && (
            <>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Alert frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily digest</SelectItem>
                    <SelectItem value="weekly">Weekly summary (Mondays)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Channels: in-app + push toggles */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Notify me via</Label>
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Inbox className="w-4 h-4 text-accent" />
                    <div>
                      <p className="text-xs font-medium">In-app notification</p>
                      <p className="text-[10px] text-muted-foreground">Bell icon in the header</p>
                    </div>
                  </div>
                  <Switch checked={notifyInApp} onCheckedChange={setNotifyInApp} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-accent" />
                    <div>
                      <p className="text-xs font-medium">Push to phone</p>
                      <p className="text-[10px] text-muted-foreground">Requires permission</p>
                    </div>
                  </div>
                  <Switch checked={notifyPush} onCheckedChange={setNotifyPush} />
                </div>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Search"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}