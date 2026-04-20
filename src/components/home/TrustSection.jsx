import React from "react";
import { Shield, Lock, Flag, Zap } from "lucide-react";

export default function TrustSection() {
  const items = [
    { icon: Shield, label: "Verified users and profiles" },
    { icon: Lock, label: "No contact details shared until you're ready" },
    { icon: Flag, label: "Report and block system" },
    { icon: Zap, label: "Built-in scam protection" },
  ];

  return (
    <div className="bg-muted/30 py-16 sm:py-24 border-y border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-12">
          Why MiNest is Safer
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-accent/10 mb-4">
                  <Icon className="w-6 h-6 text-accent" />
                </div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}