import React, { useState } from "react";
import { entities } from '@/api/entities';
import { isQuebec } from "@/lib/geoHelpers";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, BellOff, Trash2, Pencil, MapPin, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

function buildSummary(s) {
  // Filters may be stored as a JSONB column or as top-level fields (legacy)
  const f = s.filters || s;
  const parts = [];
  if (f.city) parts.push(f.city);
  if (f.province_or_state) parts.push(f.province_or_state);
  if (f.country) parts.push(f.country);
  if (f.min_price && f.max_price) parts.push(`$${f.min_price}–$${f.max_price}`);
  else if (f.max_price) parts.push(`up to $${f.max_price}`);
  if (f.listing_type) {
    const labels = { private_room: "Private Room", shared_room: "Shared Room", entire_place: "Entire Place" };
    parts.push(labels[f.listing_type] || f.listing_type);
  }
  if (f.furnishing) parts.push(f.furnishing);
  const flags = [];
  if (f.parking) flags.push("Parking");
  if (f.pets_allowed) flags.push("Pets");
  if (f.student_friendly) flags.push("Student");
  if (flags.length) parts.push(flags.join(", "));
  return parts.join(" · ") || "All listings";
}

export default function SavedSearchCard({ search, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(search.name || "");
  const [editFreq, setEditFreq] = useState(search.alert_frequency || "instant");
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const summary = buildSummary(search);
  const timeAgo = search.last_triggered_at
    ? formatDistanceToNow(new Date(search.last_triggered_at), { addSuffix: true })
    : null;

  const handleToggleAlerts = async () => {
    setToggling(true);
    await entities.SavedSearch.update(search.id, { alerts_enabled: !search.alerts_enabled });
    toast.success(search.alerts_enabled ? "Alerts paused" : "Alerts enabled");
    onUpdated?.();
    setToggling(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await entities.SavedSearch.delete(search.id);
    toast.success("Search deleted");
    onDeleted?.();
  };

  const handleSaveEdit = async () => {
    await entities.SavedSearch.update(search.id, {
      name: editName.trim() || search.name,
      alert_frequency: editFreq,
    });
    toast.success("Search updated");
    setEditing(false);
    onUpdated?.();
  };

  return (
    <div className={`bg-card rounded-xl border border-border p-4 transition-all ${!search.is_active ? "opacity-60" : ""}`}>
      {editing ? (
        <div className="space-y-3">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Search name"
            className="text-sm"
          />
          <Select value={editFreq} onValueChange={setEditFreq}>
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="instant">Instant alerts</SelectItem>
              <SelectItem value="daily_digest">Daily digest</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button size="sm" className="gap-1 bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSaveEdit}>
              <Check className="w-3.5 h-3.5" /> Save
            </Button>
            <Button size="sm" variant="ghost" className="gap-1" onClick={() => setEditing(false)}>
              <X className="w-3.5 h-3.5" /> Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${search.alerts_enabled ? "bg-accent/10" : "bg-muted"}`}>
            {search.alerts_enabled
              ? <Bell className="w-4 h-4 text-accent" />
              : <BellOff className="w-4 h-4 text-muted-foreground" />
            }
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground line-clamp-1">
              {search.name || summary}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 flex items-center gap-1">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {summary}
            </p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${search.alerts_enabled ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"}`}>
                {search.alerts_enabled ? (search.alert_frequency === "daily_digest" ? "Daily digest" : "Instant alerts") : "Alerts off"}
              </span>
              {timeAgo && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Last matched {timeAgo}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Switch
              checked={!!search.alerts_enabled}
              onCheckedChange={handleToggleAlerts}
              disabled={toggling}
              className="scale-75"
            />
            <Button
              size="icon"
              variant="ghost"
              className="w-7 h-7 text-muted-foreground hover:text-foreground"
              aria-label="Edit" onClick={() =>  { setEditName(search.name || ""); setEditFreq(search.alert_frequency || "instant"); setEditing(true); }}
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="w-7 h-7 text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
              title="Delete"
             aria-label="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}