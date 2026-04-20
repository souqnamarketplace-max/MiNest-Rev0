import React, { useState, useEffect } from "react";
import { entities } from '@/api/entities';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Save } from "lucide-react";
import { toast } from "sonner";

export default function BoostSettingsPanel() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    price_per_day_cad: "",
    price_per_day_usd: "",
    min_days: 1,
    max_days: 30,
    is_active: true,
  });

  useEffect(() => {
    entities.BoostSettings.list().then((results) => {
      if (results.length > 0) {
        const s = results[0];
        setSettings(s);
        setForm({
          price_per_day_cad: s.price_per_day_cad ?? s.price_per_day ?? "",
          price_per_day_usd: s.price_per_day_usd ?? "",
          min_days: s.min_days ?? 1,
          max_days: s.max_days ?? 30,
          is_active: s.is_active ?? true,
        });
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!form.price_per_day_cad || isNaN(form.price_per_day_cad) || Number(form.price_per_day_cad) <= 0) {
      toast.error("Please enter a valid CAD price per day.");
      return;
    }
    if (!form.price_per_day_usd || isNaN(form.price_per_day_usd) || Number(form.price_per_day_usd) <= 0) {
      toast.error("Please enter a valid USD price per day.");
      return;
    }

    setSaving(true);
    const data = {
      price_per_day_cad: Number(form.price_per_day_cad),
      price_per_day_usd: Number(form.price_per_day_usd),
      min_days: Number(form.min_days),
      max_days: Number(form.max_days),
      is_active: form.is_active,
    };

    if (settings) {
      await entities.BoostSettings.update(settings.id, data);
    } else {
      const created = await entities.BoostSettings.create(data);
      setSettings(created);
    }

    toast.success("Boost settings saved!");
    setSaving(false);
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">Loading boost settings...</div>;

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-5 h-5 text-accent" />
        <h2 className="text-lg font-semibold text-foreground">Boost Pricing Settings</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Price Per Day (CAD 🇨🇦)</Label>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="e.g. 2.99"
            value={form.price_per_day_cad}
            onChange={(e) => setForm({ ...form, price_per_day_cad: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Price Per Day (USD 🇺🇸)</Label>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="e.g. 1.99"
            value={form.price_per_day_usd}
            onChange={(e) => setForm({ ...form, price_per_day_usd: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Minimum Days</Label>
          <Input
            type="number"
            min="1"
            value={form.min_days}
            onChange={(e) => setForm({ ...form, min_days: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Maximum Days</Label>
          <Input
            type="number"
            min="1"
            value={form.max_days}
            onChange={(e) => setForm({ ...form, max_days: e.target.value })}
          />
        </div>
      </div>

      {(form.price_per_day_cad > 0 || form.price_per_day_usd > 0) && (
        <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 text-sm text-foreground space-y-1">
          {form.price_per_day_cad > 0 && (
            <div><span className="font-medium">CAD:</span> 7d = <strong>CA${(form.price_per_day_cad * 7).toFixed(2)}</strong> · 14d = <strong>CA${(form.price_per_day_cad * 14).toFixed(2)}</strong> · 30d = <strong>CA${(form.price_per_day_cad * 30).toFixed(2)}</strong></div>
          )}
          {form.price_per_day_usd > 0 && (
            <div><span className="font-medium">USD:</span> 7d = <strong>US${(form.price_per_day_usd * 7).toFixed(2)}</strong> · 14d = <strong>US${(form.price_per_day_usd * 14).toFixed(2)}</strong> · 30d = <strong>US${(form.price_per_day_usd * 30).toFixed(2)}</strong></div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="rounded"
          />
          Boosting is enabled for users
        </label>
      </div>

      <Button onClick={handleSave} disabled={saving} className="bg-accent hover:bg-accent/90 text-accent-foreground">
        <Save className="w-4 h-4 mr-1" />
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}