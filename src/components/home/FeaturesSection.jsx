import React from "react";
import { Shield, Search, Users, Heart, Star, Zap } from "lucide-react";

const features = [
  { icon: Search, title: "Smart Search", desc: "Filter by price, location, amenities, and lifestyle preferences to find exactly what you need." },
  { icon: Users, title: "Compatibility Matching", desc: "Our matching engine scores roommate compatibility based on lifestyle, habits, and preferences." },
  { icon: Shield, title: "Verified Profiles", desc: "ID verification, reviews, and trust badges help you feel safe before making contact." },
  { icon: Heart, title: "Save & Compare", desc: "Favorite listings, save searches, and get notified when new matches appear." },
  { icon: Star, title: "Premium Listings", desc: "Boost your listing for more visibility, or feature it at the top of search results." },
  { icon: Zap, title: "Instant Messaging", desc: "Connect directly with hosts or seekers through our built-in messaging system." },
];

export default function FeaturesSection() {
  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            Everything you need to find your next home
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A modern marketplace designed for trust, speed, and compatibility.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={i}
              className="group p-6 rounded-2xl border border-border bg-card hover:shadow-lg hover:border-accent/30 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                <f.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}