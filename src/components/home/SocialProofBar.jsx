import React from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { entities } from '@/api/entities';

export default function SocialProofBar() {
  const { data: listings = [] } = useQuery({
    queryKey: ["public-stats-listings"],
    queryFn: () => entities.Listing.filter({ status: "active" }, "-created_at", 500),
    staleTime: 300000,
  });

  const { data: rented = [] } = useQuery({
    queryKey: ["public-stats-rented"],
    queryFn: () => entities.RentalAgreement.filter({ status: "accepted" }, "-created_at", 500),
    staleTime: 300000,
  });

  const { data: seekers = [] } = useQuery({
    queryKey: ["public-stats-seekers"],
    queryFn: () => entities.SeekerProfile.filter({ status: "active" }, "-created_at", 500),
    staleTime: 300000,
  });

  const cities = new Set(listings.map(l => l.city).filter(Boolean)).size;
  const totalListings = listings.length;
  const totalRented = rented.length;
  const totalSeekers = seekers.length;

  const fmt = (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}k+` : n > 0 ? `${n}+` : "—";

  const stats = [
    { label: "Rooms Available", value: fmt(totalListings) },
    { label: "Rooms Rented", value: fmt(totalRented) },
    { label: "Room Seekers Active", value: fmt(totalSeekers) },
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