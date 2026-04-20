import React from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ListingCard from "@/components/listings/ListingCard";
import { useCountry } from "@/lib/CountryContext";

export default function FeaturedListingsPreview() {
  const { country } = useCountry();

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["featured-listings-preview", country],
    queryFn: () => entities.Listing.filter(
      { status: "active", is_featured: true, country: country },
      "-featured_rank", 6
    ),
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <h2 className="text-3xl font-bold text-foreground mb-12">{`Featured Listings in ${country === "United States" ? "the USA" : "Canada"}`}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => (
            <Skeleton key={i} className="rounded-2xl h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (listings.length === 0) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="flex items-center justify-between mb-12"
      >
        <h2 className="text-3xl font-bold text-foreground">{`Featured Listings in ${country === "United States" ? "the USA" : "Canada"}`}</h2>
        <Link to="/search">
          <Button variant="outline">View All</Button>
        </Link>
      </motion.div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings.map((listing, i) => (
          <motion.div
            key={listing.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 + i * 0.1 }}
          >
            <ListingCard listing={listing} isFavorited={false} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}