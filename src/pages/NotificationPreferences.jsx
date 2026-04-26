/**
 * NotificationPreferences — push-only settings page.
 *
 * Five master toggles (messages / rentals / listings / saved searches
 * / marketing) plus quiet hours. Reads/writes
 * public.notification_preferences via supabase. The auth.users
 * trigger guarantees a row exists, so we never have to handle "row
 * not found" — `update().eq('user_id', auth.uid())` is sufficient.
 *
 * Critical notifications (security, signed agreements, payments,
 * admin alerts) are NEVER gated by these toggles — see
 * src/lib/notificationPreferences.js for the full list.
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import {
  getMyPreferences,
  updateMyPreferences,
} from "@/lib/notificationPreferences";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Bell,
  MessageSquare,
  Home,
  Search,
  Star,
  Megaphone,
  Moon,
  ArrowLeft,
  Loader2,
  ShieldCheck,
} from "lucide-react";

const CATEGORIES = [
  {
    key: "push_messages",
    icon: MessageSquare,
    title: "Direct messages",
    description: "When someone sends you a message.",
  },
  {
    key: "push_rentals",
    icon: Home,
    title: "Rental activity",
    description:
      "Renewal offers, termination requests, and other lease activity. Signed agreements and payment events always notify you regardless of this setting.",
  },
  {
    key: "push_listings",
    icon: Star,
    title: "Listing activity",
    description:
      "Inquiries, viewing requests, and updates on your listings or favorites.",
  },
  {
    key: "push_saved_searches",
    icon: Search,
    title: "Saved-search alerts",
    description: "When a new listing matches a search you've saved.",
  },
  {
    key: "push_marketing",
    icon: Megaphone,
    title: "Tips and announcements",
    description:
      "Occasional product news from MiNest. Off by default — turn on if you want to hear from us.",
  },
];

export default function NotificationPreferences() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState(null);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user?.id) return;
      setLoading(true);
      const row = await getMyPreferences(user.id);
      if (cancelled) return;
      setPrefs(row);
      setDraft(row);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  function onToggle(key, value) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function onTimeChange(key, value) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function onSave() {
    if (!user?.id || !draft) return;
    setSaving(true);
    const updated = await updateMyPreferences(user.id, draft);
    setSaving(false);
    if (updated) {
      setPrefs(updated);
      setDraft(updated);
      toast.success("Notification preferences saved");
    } else {
      toast.error("Couldn't save preferences. Try again?");
    }
  }

  const hasChanges =
    prefs && draft && CATEGORIES.some((c) => prefs[c.key] !== draft[c.key])
    || (prefs && draft && (
      prefs.quiet_hours_enabled !== draft.quiet_hours_enabled ||
      prefs.quiet_hours_start !== draft.quiet_hours_start ||
      prefs.quiet_hours_end !== draft.quiet_hours_end
    ));

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground">
          We couldn't load your preferences right now. Please refresh.
        </p>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-8 sm:py-12">
      <Link
        to="/notifications"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to notifications
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
          <Bell className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Notification preferences</h1>
          <p className="text-sm text-muted-foreground">
            Choose which push notifications you'd like to receive.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-3 mt-4 mb-6 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Security alerts, signed agreement confirmations, and payment events
          are always sent regardless of these settings.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Categories
        </h2>
        {CATEGORIES.map(({ key, icon: Icon, title, description }) => (
          <div
            key={key}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{title}</div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {description}
              </p>
            </div>
            <Switch
              checked={!!draft[key]}
              onCheckedChange={(v) => onToggle(key, v)}
              aria-label={title}
            />
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Quiet hours
        </h2>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <Moon className="w-4 h-4 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">Pause non-urgent notifications</div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                During this window we'll hold back non-urgent push
                notifications. Critical alerts still come through.
              </p>
            </div>
            <Switch
              checked={!!draft.quiet_hours_enabled}
              onCheckedChange={(v) => onToggle("quiet_hours_enabled", v)}
              aria-label="Enable quiet hours"
            />
          </div>

          {draft.quiet_hours_enabled && (
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border">
              <div>
                <Label htmlFor="quiet-start" className="text-xs">From</Label>
                <Input
                  id="quiet-start"
                  type="time"
                  value={(draft.quiet_hours_start || "22:00").slice(0, 5)}
                  onChange={(e) => onTimeChange("quiet_hours_start", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="quiet-end" className="text-xs">Until</Label>
                <Input
                  id="quiet-end"
                  type="time"
                  value={(draft.quiet_hours_end || "08:00").slice(0, 5)}
                  onChange={(e) => onTimeChange("quiet_hours_end", e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="sticky bottom-4 mt-8">
        <Button
          onClick={onSave}
          disabled={!hasChanges || saving}
          className="w-full"
          size="lg"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…
            </>
          ) : (
            "Save preferences"
          )}
        </Button>
      </div>
    </div>
  );
}
