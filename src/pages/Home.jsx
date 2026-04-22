import React, { useEffect } from "react";
import ConversionHero from "@/components/home/ConversionHero";
import SchemaInjector from "@/components/seo/SchemaInjector";
import SocialProofBar from "@/components/home/SocialProofBar";
import ActionCards from "@/components/home/ActionCards";
import HowItWorks from "@/components/home/HowItWorks";
import TrustSection from "@/components/home/TrustSection";
import FeaturedListingsPreview from "@/components/home/FeaturedListingsPreview";
import MarketStatsSection from "@/components/home/MarketStatsSection";
import PopularCities from "@/components/home/PopularCities";
import ClosingCTA from "@/components/home/ClosingCTA";
import AnimatedSection from "@/components/ui/AnimatedSection";

const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "MiNest",
  url: "https://minest.ca",
  logo: "https://minest.ca/og-cover.jpg",
  sameAs: [],
  description: "MiNest is a trusted shared housing platform — find rooms, discover compatible roommates, and pay rent securely online across Canada and the USA.",
};

const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "MiNest",
  url: "https://minest.ca",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://minest.ca/search?city={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

export default function Home() {
  useEffect(() => {
    document.title = "MiNest | Find Rooms, Roommates & Pay Rent Online — Canada & USA";
    let canonical = document.querySelector("link[rel='canonical']");
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", "https://minest.ca/");
  }, []);

  return (
    <div className="overflow-hidden">
      <SchemaInjector id="__org_schema" schema={ORG_SCHEMA} />
      <SchemaInjector id="__website_schema" schema={WEBSITE_SCHEMA} />

      {/* Hero — no animation wrapper, it has its own */}
      <ConversionHero />

      {/* Social proof — quick fade in */}
      <AnimatedSection variant="fadeIn" duration={0.5} delay={0.1}>
        <SocialProofBar />
      </AnimatedSection>

      {/* Action cards — slide up with slight delay */}
      <AnimatedSection variant="fadeUp" delay={0.05}>
        <ActionCards />
      </AnimatedSection>

      {/* Featured listings — slide up */}
      <AnimatedSection variant="fadeUp" delay={0.05}>
        <FeaturedListingsPreview />
      </AnimatedSection>

      {/* Popular cities — slide from left */}
      <AnimatedSection variant="slideLeft" delay={0.05}>
        <PopularCities />
      </AnimatedSection>

      {/* Market stats — scale up */}
      <AnimatedSection variant="scale" delay={0.05}>
        <MarketStatsSection />
      </AnimatedSection>

      {/* How it works — slide up */}
      <AnimatedSection variant="fadeUp" delay={0.05}>
        <HowItWorks />
      </AnimatedSection>

      {/* Trust section — fade in */}
      <AnimatedSection variant="fadeIn" delay={0.1} duration={0.8}>
        <TrustSection />
      </AnimatedSection>

      {/* Closing CTA — scale up for impact */}
      <AnimatedSection variant="scale" delay={0.1} duration={0.6}>
        <ClosingCTA />
      </AnimatedSection>
    </div>
  );
}
