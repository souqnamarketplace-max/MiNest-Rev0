import React from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useCountry } from "@/lib/CountryContext";
import { supabase } from "@/lib/supabase";

export default function SocialProofBar() {
  const { country } = useCountry();

  // Fetch active listings filtered by country
  const { data: listings = [] } = useQuery({
    queryKey: ["public-stats-listings", country],
    queryFn: async () => {
      const { data } = await supabase
        .from("listings")
        .select("id, city, country")
        .eq("status", "active")
        .eq("country", country)
        .limit(500);
      return data || [];
    },
    staleTime: 300000,
  });

  // Fetch rented listings filtered by country
  const { data: rentedCount = 0 } = useQuery({
    queryKey: ["public-stats-rented", country],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .in("status", ["rented", "archived"])
        .eq("country", country);
      return error ? 0 : (count || 0);
    },
    staleTime: 300000,
  });

  // Fetch seekers — filter by preferred country if available
  const { data: seekerCount = 0 } = useQuery({
    queryKey: ["public-stats-seekers", country],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("seeker_profiles")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .eq("preferred_country", country);
      if (error || count === 0) {
        // Fallback: count all active seekers if preferred_country column doesn't exist
        const { count: fallback } = await supabase
          .from("seeker_profiles")
          .select("id", { count: "exact", head: true })
          .eq("status", "active");
        return fallback || 0;
      }
      return count || 0;
    },
    staleTime: 300000,
  });

  const cities = new Set(listings.map(l => l.city).filter(Boolean)).size;
  const totalListings = listings.length;

  const fmt = (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}k+` : n > 0 ? `${n}+` : "—";

  const countryShort = country === "United States" ? "USA" : "Canada";

  const stats = [
    { label: `Rooms in ${countryShort}`, value: fmt(totalListings) },
    { label: "Rooms Rented", value: fmt(rentedCount) },
    { label: "Room Seekers Active", value: fmt(seekerCount) },
    { label: "Cities Covered", value: cities > 0 ? `${cities}+` : "—" },
  ];

  return (
    <div className="bg-muted/50 border-t border-b border-border py-8 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center"
            >
              <div className="text-2xl sm:text-3xl font-bold text-accent">{stat.value}</div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
