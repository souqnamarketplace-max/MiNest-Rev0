import React, { useState } from "react";
import { entities } from '@/api/entities';
import { Button } from "@/components/ui/button";
import { Home, Search, ArrowRight } from "lucide-react";

const OPTIONS = [
  {
    value: "seeker",
    icon: Search,
    title: "I'm looking for a room",
    description: "Browse listings, contact hosts, and find your perfect place.",
    color: "border-secondary/60 hover:border-secondary bg-secondary/5",
    selectedColor: "border-secondary bg-secondary/10 ring-2 ring-secondary/30",
  },
  {
    value: "lister",
    icon: Home,
    title: "I'm renting out a room",
    description: "Post your listing and find great roommates or tenants.",
    color: "border-accent/60 hover:border-accent bg-accent/5",
    selectedColor: "border-accent bg-accent/10 ring-2 ring-accent/30",
  },
  {
    value: "both",
    icon: null,
    title: "Both",
    description: "I want to search for rooms and post my own listing.",
    color: "border-border hover:border-primary/40 bg-muted/30",
    selectedColor: "border-primary bg-primary/5 ring-2 ring-primary/20",
  },
];

export default function WelcomeModal({ user, onComplete }) {
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      // Check if profile already exists
      const existing = await entities.UserProfile.filter({ user_id: user.id });
      if (existing.length > 0) {
        await entities.UserProfile.update(existing[0].id, { user_type_intent: selected });
      } else {
        await entities.UserProfile.create({
          user_id: user.id,
          display_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
          email: user.email,  // keep email for display
          user_type_intent: selected,
          onboarding_completed: true,
        });
      }
      onComplete(selected);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-card rounded-3xl border border-border shadow-2xl w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🏠</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Welcome to MiNest!</h1>
          <p className="text-muted-foreground text-sm">What brings you here? We'll personalize your experience.</p>
        </div>

        {/* Options */}
        <div className="space-y-3 mb-8">
          {OPTIONS.map((opt) => {
            const isSelected = selected === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => setSelected(opt.value)}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${isSelected ? opt.selectedColor : opt.color}`}
              >
                <div className="flex items-center gap-3">
                  {Icon ? (
                    <div className="w-10 h-10 rounded-xl bg-background/80 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-foreground" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-background/80 flex items-center justify-center flex-shrink-0 text-lg">
                      🔄
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-foreground text-sm">{opt.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{opt.description}</div>
                  </div>
                  {isSelected && (
                    <div className="ml-auto w-5 h-5 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* CTA */}
        <Button
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold h-11"
          disabled={!selected || saving}
          onClick={handleContinue}
        >
          {saving ? "Setting up..." : "Get Started"} <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}