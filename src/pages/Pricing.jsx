import React from "react";
import { useQuery } from "@tanstack/react-query";
import { entities } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useCountry } from "@/lib/CountryContext";
import { APP_CONFIG } from "@/lib/config";

export default function Pricing() {
  const navigate = useNavigate();
  const { user, navigateToLogin } = useAuth();
  const { currency } = useCountry();
  const isCAD = currency === "CAD";

  // Fetch boost pricing from DB (admin-editable)
  const { data: boostSettings, isLoading: loadingBoost } = useQuery({
    queryKey: ["boost-settings-pricing"],
    queryFn: async () => {
      try {
        const results = await entities.BoostSettings.list();
        return results?.[0] || null;
      } catch { return null; }
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch verification pricing from DB (admin-editable)
  const { data: verifySettings, isLoading: loadingVerify } = useQuery({
    queryKey: ["verify-settings-pricing"],
    queryFn: async () => {
      try {
        const results = await entities.VerificationSettings.filter({ verification_type: "identity", is_active: true });
        return results?.[0] || null;
      } catch { return null; }
    },
    staleTime: 5 * 60 * 1000,
  });

  // Calculate prices — DB first, fallback to config
  const boostPricePerDay = isCAD
    ? (boostSettings?.price_per_day_cad ?? APP_CONFIG.boostPricing?.["7_days"] / 7 ?? 1.43)
    : (boostSettings?.price_per_day_usd ?? APP_CONFIG.boostPricing?.["7_days"] / 7 ?? 1.43);

  const boostMinDays = boostSettings?.min_days ?? 7;
  const boostTotal = (boostPricePerDay * boostMinDays).toFixed(2);

  const verifyPrice = isCAD
    ? (verifySettings?.price_cad ?? APP_CONFIG.verificationPricing?.identity ?? 4.99)
    : (verifySettings?.price_usd ?? APP_CONFIG.verificationPricing?.identity ?? 4.99);

  const plans = [
    {
      name: "Free",
      price: "$0",
      desc: "Perfect for getting started",
      features: [
        "Create up to 3 listings",
        "Browse all rooms",
        "Basic messaging",
        "Save favorites",
        "Schedule viewings",
      ],
      cta: "Get Started",
      accent: false,
    },
    {
      name: "Boost",
      price: `$${boostTotal}`,
      period: `/ ${boostMinDays} days`,
      desc: "Get more visibility for your listing",
      features: [
        "Priority in search results",
        "Boosted badge on listing",
        "3x more views",
        `$${boostPricePerDay.toFixed(2)} ${isCAD ? "CAD" : "USD"} per day`,
        "All Free features",
      ],
      cta: "Boost a Listing",
      accent: true,
    },
    {
      name: "Verified",
      price: `$${Number(verifyPrice).toFixed(2)}`,
      period: "one-time",
      desc: "Build trust with verified status",
      features: [
        "ID verification badge",
        "Increased trust score",
        "Priority support",
        "Stand out in search",
        "All Free features",
      ],
      cta: "Get Verified",
      accent: false,
    },
  ];

  const handleCta = (planName) => {
    if (!user) {
      navigateToLogin(window.location.pathname);
      return;
    }
    if (planName === "Verified") navigate("/verification-flow?type=identity");
    else navigate("/dashboard");
  };

  const isLoading = loadingBoost || loadingVerify;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">Simple, Transparent Pricing</h1>
        <p className="text-muted-foreground mt-3 max-w-xl mx-auto">Most features are free. Pay only when you want extra visibility or verification.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <div key={i} className={`rounded-2xl border p-6 ${plan.accent ? "border-accent bg-accent/5 shadow-lg" : "border-border bg-card"}`}>
              {plan.accent && (
                <div className="text-xs font-semibold text-accent uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Most Popular
                </div>
              )}
              <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
              <div className="mt-2">
                <span className="text-3xl font-extrabold text-foreground">{plan.price}</span>
                {plan.period && <span className="text-sm text-muted-foreground ml-1">{plan.period}</span>}
              </div>
              <p className="text-sm text-muted-foreground mt-2 mb-6">{plan.desc}</p>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleCta(plan.name)}
                className={`w-full ${plan.accent ? "bg-accent hover:bg-accent/90 text-accent-foreground" : ""}`}
                variant={plan.accent ? "default" : "outline"}
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
