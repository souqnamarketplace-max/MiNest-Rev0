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

const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "MiNest",
  url: "https://minest.ca",
  logo: "https://minest.ca/og-cover.jpg",
  sameAs: [],
  description: "MiNest is Canada's trusted shared housing platform — find rooms, discover compatible roommates, and pay rent securely online.",
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
    // Ensure canonical points to root on homepage
    let canonical = document.querySelector("link[rel='canonical']");
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", "https://minest.ca/");
  }, []);

  return (
    <div>
      <SchemaInjector id="__org_schema" schema={ORG_SCHEMA} />
      <SchemaInjector id="__website_schema" schema={WEBSITE_SCHEMA} />
      <ConversionHero />
      <SocialProofBar />
      <ActionCards />
      <FeaturedListingsPreview />
      <PopularCities />
      <MarketStatsSection />
      <HowItWorks />
      <TrustSection />
      <ClosingCTA />
    </div>
  );
}