import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Bell, Search, Home, MessageSquare, Shield, Mail, Smartphone, Clock, Star, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { getSoundPreferences, setSoundEnabled, setMessageSoundEnabled, setNotifSoundEnabled } from "@/lib/soundService";

const DEFAULT_PREFS = {
  seeker_alerts_enabled: true,
  lister_alerts_enabled: true,
  message_alerts_enabled: true,
  system_alerts_enabled: true,
  email_enabled: true,
  push_enabled: false,
  alert_frequency: "instant",
  quiet_hours_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "08:00",
  saved_search_email_enabled: true,
  saved_search_push_enabled: true,
  message_email_enabled: false,
  message_push_enabled: true,
  favorite_updates_email_enabled: true,
  favorite_updates_push_enabled: true,
  listing_alerts_email_enabled: true,
  listing_alerts_push_enabled: true,
  verification_email_enabled: true,
  verification_push_enabled: true,
  system_email_enabled: false,
  system_push_enabled: false,
};

function Section({ icon: Icon, label, description, emailKey, pushKey, form, toggle, userHasEmail, userHasPush }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-accent" />
        </div>
        <div>
          <p className="font-medium text-foreground text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-6 pl-12">
        {emailKey && (
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={!!form[emailKey] && userHasEmail} onCheckedChange={() => toggle(emailKey)} disabled={!userHasEmail} />
            <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> Email</span>
          </label>
        )}
        {pushKey && (
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={!!form[pushKey] && userHasPush} onCheckedChange={() => toggle(pushKey)} disabled={!userHasPush} />
            <span className="text-xs text-muted-foreground flex items-center gap-1"><Smartphone className="w-3 h-3" /> Push</span>
          </label>
        )}
      </div>
    </div>
  );
}

export default function NotificationPreferences() {
  const { user, navigateToLogin, logout } = useAuth();
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["notif-prefs", user?.id],
    queryFn: async () => {
      const results = await entities.NotificationPreference.filter({ user_id: user.id });
      return results[0] || DEFAULT_PREFS;
    },
    enabled: !!user,
  });

  const { data: userProfile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: () => entities.UserProfile.filter({ user_id: user.id }).then((r) => r[0] || null),
    enabled: !!user,
  });

  const [form, setForm] = useState(null);
  const [soundPrefs, setSoundPrefs] = useState(() => getSoundPreferences());

  useEffect(() => {
    if (prefs && !form) setForm({ ...DEFAULT_PREFS, ...prefs });
  }, [prefs]);

  const toggleSoundPref = (key, setter) => {
    const newVal = !soundPrefs[key];
    setter(newVal);
    setSoundPrefs((p) => ({ ...p, [key]: newVal }));
  };

  const userRole = userProfile?.user_type_intent || "seeker";
  const userHasEmail = !!form?.email_enabled;
  const userHasPush = !!form?.push_enabled;

  const toggle = (key) => setForm((prev) => ({ ...prev, [key]: !prev[key] }));
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    // Validate quiet hours if enabled
    if (form.quiet_hours_enabled && form.quiet_hours_start && form.quiet_hours_end) {
      if (form.quiet_hours_start >= form.quiet_hours_end) {
        toast.error("Quiet hours start time must be before end time");
        return;
      }
    }
    try {
      if (form.id) {
        // Strip client-only fields not in DB schema before saving
        const { id: _id, digest_mode, ...dbForm } = form;
        await entities.NotificationPreference.update(form.id, dbForm);
      } else {
        const { digest_mode: _dm, ...dbCreateForm } = form;
        const created = await entities.NotificationPreference.create({ ...dbCreateForm, user_id: user.id });
        setForm(created);
      }
      queryClient.invalidateQueries({ queryKey: ["notif-prefs", user?.id] });
      toast.success("Preferences saved");
    } catch (err) {
      console.error("Save preferences error:", err);
      toast.error("Failed to save preferences. Please try again.");
    }
  };

  // Redirect unauthenticated users
  if (!user && !isLoading) {
    navigateToLogin(window.location.href);
    return null;
  }

  if (isLoading || !form) return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center text-muted-foreground">
      <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin mx-auto mb-3" />
      Loading preferences...
    </div>
  );

  const isSeeker = userRole === "seeker" || userRole === "both";
  const isLister = userRole === "lister" || userRole === "both";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Bell className="w-6 h-6 text-accent" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notification Preferences</h1>
          <p className="text-sm text-muted-foreground capitalize">Role: {userRole}</p>
        </div>
      </div>

      {/* ── Global Channels ─────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Delivery Channels</h2>
        <div className="space-y-2">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <Bell className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="font-medium text-sm text-foreground">In-App Alerts</p>
                <p className="text-xs text-muted-foreground">Bell icon, notification center, toast popups</p>
              </div>
            </div>
            <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-1 rounded-full">Always on</span>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <Mail className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="font-medium text-sm text-foreground">Email Notifications</p>
                <p className="text-xs text-muted-foreground">Important alerts sent to your inbox</p>
              </div>
            </div>
            <Switch checked={!!form.email_enabled} onCheckedChange={() => toggle("email_enabled")} />
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <p className="font-medium text-sm text-foreground">Push Notifications</p>
                <p className="text-xs text-muted-foreground">Instant alerts to your device (requires device registration)</p>
              </div>
            </div>
            <Switch checked={!!form.push_enabled} onCheckedChange={() => toggle("push_enabled")} />
          </div>
        </div>
      </div>

      {/* ── Delivery Mode ───────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Delivery Mode</h2>
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <Star className="w-4 h-4 text-accent" />
            <div>
              <p className="font-medium text-sm text-foreground">Frequency</p>
              <p className="text-xs text-muted-foreground">How often non-critical email alerts are sent</p>
            </div>
          </div>
          <Select value={form.alert_frequency || ""} onValueChange={(v) => set("alert_frequency", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="instant">Instant — send each alert immediately</SelectItem>
              <SelectItem value="daily_digest">Daily Digest — one summary email per day</SelectItem>
              <SelectItem value="important_only">Important Only — critical alerts only</SelectItem>
            </SelectContent>
          </Select>
          {form.alert_frequency === "daily_digest" && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              Daily digest emails are sent each morning with all your queued notifications from the previous day. Critical alerts (security, messages, verification) are still sent instantly.
            </p>
          )}
        </div>
      </div>

      {/* ── Per-Category ────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Alert Categories</h2>
        <div className="space-y-2">
          <Section icon={MessageSquare} label="Messages" description="New messages and contact requests"
            emailKey="message_email_enabled" pushKey="message_push_enabled"
            form={form} toggle={toggle} userHasEmail={userHasEmail} userHasPush={userHasPush} />

          {isSeeker && (
            <Section icon={Search} label="Saved Search Matches" description="New listings matching your saved searches"
              emailKey="saved_search_email_enabled" pushKey="saved_search_push_enabled"
              form={form} toggle={toggle} userHasEmail={userHasEmail} userHasPush={userHasPush} />
          )}

          {isSeeker && (
            <Section icon={Home} label="Saved & Favorite Updates" description="Price drops and updates on favorited listings"
              emailKey="favorite_updates_email_enabled" pushKey="favorite_updates_push_enabled"
              form={form} toggle={toggle} userHasEmail={userHasEmail} userHasPush={userHasPush} />
          )}

          {isLister && (
            <Section icon={Home} label="My Listing Alerts" description="Expiry reminders, boost updates, seeker matches"
              emailKey="listing_alerts_email_enabled" pushKey="listing_alerts_push_enabled"
              form={form} toggle={toggle} userHasEmail={userHasEmail} userHasPush={userHasPush} />
          )}

          <Section icon={Shield} label="Verification & Account" description="Verification status updates"
            emailKey="verification_email_enabled" pushKey="verification_push_enabled"
            form={form} toggle={toggle} userHasEmail={userHasEmail} userHasPush={userHasPush} />

          <Section icon={Bell} label="System & Security" description="Security alerts and system notices"
            emailKey="system_email_enabled" pushKey="system_push_enabled"
            form={form} toggle={toggle} userHasEmail={userHasEmail} userHasPush={userHasPush} />
        </div>
      </div>

      {/* ── Sound Alerts ────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Sound Alerts</h2>
        <div className="space-y-2">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <Volume2 className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="font-medium text-sm text-foreground">Sound Alerts</p>
                <p className="text-xs text-muted-foreground">Play sounds for in-app notifications</p>
              </div>
            </div>
            <Switch checked={soundPrefs.soundEnabled} onCheckedChange={() => toggleSoundPref("soundEnabled", setSoundEnabled)} />
          </div>
          {soundPrefs.soundEnabled && (
            <>
              <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between pl-6">
                <div>
                  <p className="font-medium text-sm text-foreground">Message Sounds</p>
                  <p className="text-xs text-muted-foreground">Chime for new messages</p>
                </div>
                <Switch checked={soundPrefs.messageSoundEnabled} onCheckedChange={() => toggleSoundPref("messageSoundEnabled", setMessageSoundEnabled)} />
              </div>
              <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between pl-6">
                <div>
                  <p className="font-medium text-sm text-foreground">Notification Sounds</p>
                  <p className="text-xs text-muted-foreground">Subtle tone for room matches and alerts</p>
                </div>
                <Switch checked={soundPrefs.notifSoundEnabled} onCheckedChange={() => toggleSoundPref("notifSoundEnabled", setNotifSoundEnabled)} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Quiet Hours ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quiet Hours</h2>
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-accent" />
              <div>
                <p className="font-medium text-sm text-foreground">Enable Quiet Hours</p>
                <p className="text-xs text-muted-foreground">Suppress non-critical push notifications at night</p>
              </div>
            </div>
            <Switch checked={!!form.quiet_hours_enabled} onCheckedChange={() => toggle("quiet_hours_enabled")} />
          </div>
          {form.quiet_hours_enabled && (
            <div className="flex items-center gap-4 pt-1">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">From</label>
                <Input type="time" value={form.quiet_hours_start || "22:00"} onChange={(e) => set("quiet_hours_start", e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Until</label>
                <Input type="time" value={form.quiet_hours_end || "08:00"} onChange={(e) => set("quiet_hours_end", e.target.value)} />
              </div>
            </div>
          )}
        </div>
      </div>

      <Button onClick={handleSave} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
        Save Preferences
      </Button>
    </div>
  );
}