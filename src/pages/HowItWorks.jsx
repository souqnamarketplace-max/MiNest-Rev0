import React from "react";
import HowItWorksSection from "@/components/home/HowItWorksSection";
import CTASection from "@/components/home/CTASection";

export default function HowItWorks() {
  return (
    <div>
      <div className="bg-primary py-16 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-primary-foreground">How MiNest Works</h1>
        <p className="text-primary-foreground/70 mt-2 max-w-xl mx-auto px-4">Whether you're searching for a room or listing one, MiNest makes it simple, safe, and fast.</p>
      </div>
      <HowItWorksSection />
      <CTASection />
    </div>
  );
}