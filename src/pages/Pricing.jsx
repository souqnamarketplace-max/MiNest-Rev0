import React from "react";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Star, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useCountry } from "@/lib/CountryContext";

import { APP_CONFIG } from "@/lib/config";

// CAD prices are ~1.35x USD, rounded to clean numbers
const CAD_MULTIPLIER = 1.35;
function toCAD(usdPrice) {
  return Math.ceil(usdPrice * CAD_MULTIPLIER * 100) / 100;
}

export default function Pricing() {
  const navigate = useNavigate();
  const { user, navigateToLogin, logout } = useAuth();
  const { country, currency } = useCountry();
  const isCAD = currency === "CAD";

  const boostPrice = isCAD
    ? `$${toCAD(APP_CONFIG.boostPricing["7_days"]).toFixed(2)} CAD`
    : `$${APP_CONFIG.boostPricing["7_days"]} USD`;

  const verifyPrice = isCAD
    ? `$${toCAD(APP_CONFIG.verificationPricing.identity).toFixed(2)} CAD`
    : `$${APP_CONFIG.verificationPricing.identity} USD`;

  const plans = [
    {
      name: "Free",
      price: "$0",
      desc: "Perfect for getting started",
      features: ["Create up to 3 listings", "Browse all rooms", "Basic messaging", "Save favorites", "Roommate agreement generator"],
      cta: "Get Started",
      accent: false,
    },
    {
      name: "Boost",
      price: boostPrice,
      period: "/ 7 days",
      desc: "Get more visibility for your listing",
      features: ["Priority in search results", "Boosted badge on listing", "3x more views", "Analytics dashboard", "All Free features"],
      cta: "Boost a Listing",
      accent: true,
    },
    {
      name: "Verified",
      price: verifyPrice,
      period: "one-time",
      desc: "Build trust with verified status",
      features: ["ID verification badge", "Increased trust score", "Priority support", "Stand out in search", "All Free features"],
      cta: "Get Verified",
      accent: false,
    },
  ];

  const handleGetVerified = () => {
    if (!user) {
      navigateToLogin(window.location.href);
      return;
    }
    navigate("/verification-flow?type=identity");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">Simple, Transparent Pricing</h1>
        <p className="text-muted-foreground mt-3 max-w-xl mx-auto">Most features are free. Pay only when you want extra visibility or verification.</p>
      </div>
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
            {plan.name === "Verified" ? (
              <Button 
                onClick={handleGetVerified}
                className={`w-full ${plan.accent ? "bg-accent hover:bg-accent/90 text-accent-foreground" : ""}`} 
                variant={plan.accent ? "default" : "outline"}
              >
                {plan.cta}
              </Button>
            ) : (
              <Link to="/dashboard">
                <Button className={`w-full ${plan.accent ? "bg-accent hover:bg-accent/90 text-accent-foreground" : ""}`} variant={plan.accent ? "default" : "outline"}>
                  {plan.cta}
                </Button>
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}