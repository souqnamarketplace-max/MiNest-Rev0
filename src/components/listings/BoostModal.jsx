import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Zap, Minus, Plus } from "lucide-react";
import { entities } from '@/api/entities';
import { toast } from "sonner";

export default function BoostModal({ listing, open, onOpenChange }) {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    if (!open) return;
    setLoadingSettings(true);
    entities.BoostSettings.list().then((results) => {
      if (results.length > 0) {
        const s = results[0];
        setSettings(s);
        setDays(Math.max(s.min_days ?? 1, Math.min(7, s.max_days ?? 30)));
      }
      setLoadingSettings(false);
    });
  }, [open]);

  const minDays = settings?.min_days ?? 1;
  const maxDays = settings?.max_days ?? 30;
  // Use the listing's currency to pick the right per-day price
  const listingCurrency = (listing?.currency_code || "CAD").toUpperCase();
  const pricePerDay = listingCurrency === "USD"
    ? (settings?.price_per_day_usd ?? settings?.price_per_day ?? 0)
    : (settings?.price_per_day_cad ?? settings?.price_per_day ?? 0);
  const currency = listingCurrency;
  // Price format: "$X.XX USD" or "$X.XX CAD"
  const totalPrice = (pricePerDay * days).toFixed(2);

  const handlePurchase = async () => {
    setLoading(true);
    try {
      toast.info('Boost payments will be available after Stripe setup. Your listing will be boosted manually for now.');
      onOpenChange(false);
    } catch {
      toast.error("Failed to create checkout session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Boost Your Listing</DialogTitle>
        </DialogHeader>

        {loadingSettings ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading pricing...</div>
        ) : !settings?.is_active ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Boosting is currently unavailable. Please try again later.</div>
        ) : (
          <>
            <div className="border-2 border-accent rounded-lg p-6 bg-accent/5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="bg-accent/10 p-2 rounded-lg">
                  <Zap className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Boost Listing</h3>
                  <p className="text-sm text-muted-foreground">${pricePerDay.toFixed(2)} {currency} / day</p>
                </div>
              </div>

              {/* Day selector */}
              <div className="flex items-center justify-between bg-background rounded-lg border border-border p-3">
                <span className="text-sm font-medium text-foreground">Number of days</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setDays(d => Math.max(minDays, d - 1))}
                    disabled={days <= minDays}
                    className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xl font-bold text-foreground w-8 text-center">{days}</span>
                  <button
                    onClick={() => setDays(d => Math.min(maxDays, d + 1))}
                    disabled={days >= maxDays}
                    className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick presets */}
              <div className="flex gap-2 flex-wrap">
                {[3, 7, 14, 30].filter(d => d >= minDays && d <= maxDays).map(preset => (
                  <button
                    key={preset}
                    onClick={() => setDays(preset)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      days === preset
                        ? "bg-accent text-accent-foreground border-accent"
                        : "border-border text-muted-foreground hover:border-accent hover:text-accent"
                    }`}
                  >
                    {preset}d
                  </button>
                ))}
              </div>

              <ul className="space-y-2">
                {[
                  "Appears higher in search results",
                  "Increased visibility to seekers",
                  "Featured badge on your listing",
                  `${days} days of boosted & featured status`
                ].map((feature, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Total */}
              <div className="border-t border-border pt-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total ({currency})</span>
                <span className="text-2xl font-bold text-accent">${totalPrice} {currency}</span>
              </div>

              <Button
                onClick={handlePurchase}
                disabled={loading}
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {loading ? "Processing..." : `Boost Now — $$${totalPrice} ${currency}`}
              </Button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
              <p className="font-semibold mb-1">Payment Secure</p>
              <p>We use Stripe to process payments safely. You will be redirected to complete checkout.</p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}