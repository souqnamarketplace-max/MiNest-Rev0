import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Users, Plus, CreditCard, ShieldCheck, Zap, Sparkles, MapPin, TrendingUp } from "lucide-react";
import { useCountry } from "@/lib/CountryContext";
import { useQuery } from "@tanstack/react-query";
import { entities } from "@/api/entities";

const COUNTRY_DATA = {
  'Canada': {
    flag: '🍁',
    cities: ['Toronto', 'Vancouver', 'Calgary', 'Montreal', 'Ottawa', 'Edmonton', 'Winnipeg', 'Halifax'],
    stat: { rooms: '12,847', cities: '180+', users: '45k+' },
    avgRent: '$1,450 CAD',
    greeting: 'Eh! Welcome to MiNest',
    currency: 'CAD',
  },
  'United States': {
    flag: '🇺🇸',
    cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami', 'Seattle', 'Austin', 'Boston'],
    stat: { rooms: '28,391', cities: '450+', users: '96k+' },
    avgRent: '$934 USD',
    greeting: 'Hey! Welcome to MiNest',
    currency: 'USD',
  },
};

export default function ConversionHero() {
  const { country, flag, convertPrice } = useCountry();
  const data = COUNTRY_DATA[country] || COUNTRY_DATA['Canada'];
  const [cityIndex, setCityIndex] = useState(0);

  // Fetch real average rent from actual listings for this country
  const { data: listingsData } = useQuery({
    queryKey: ["avg-rent-hero", country],
    queryFn: async () => {
      const listings = await entities.Listing.filter(
        { status: "active", country: country },
        null, 50
      );
      if (!listings || listings.length === 0) return null;
      const amounts = listings
        .map(l => l.rent_amount || l.monthly_rent)
        .filter(Boolean);
      if (amounts.length === 0) return null;
      const avg = Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length);
      return avg;
    },
    staleTime: 300000, // 5 min cache
  });

  // Only show avg rent if we have real data for this country
  const avgRentDisplay = listingsData
    ? `$${convertPrice(listingsData).toLocaleString()} ${data.currency}/mo`
    : null;

  // Rotate through cities
  useEffect(() => {
    const interval = setInterval(() => {
      setCityIndex((i) => (i + 1) % data.cities.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [data.cities.length]);

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden opacity-30">
        <motion.div
          className="absolute -top-20 -left-20 w-96 h-96 bg-accent/40 rounded-full blur-3xl"
          animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-20 -right-20 w-96 h-96 bg-emerald-500/40 rounded-full blur-3xl"
          animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Country pill at top */}
        <motion.div
          key={country}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-6"
        >
          <div className="inline-flex items-center gap-2 bg-accent/20 border border-accent/40 rounded-full px-4 py-1.5 text-sm font-semibold text-accent">
            <span className="text-lg">{flag}</span>
            <span>Showing listings in {country}</span>
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
          </div>
        </motion.div>

        {/* Headline with rotating city */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-5 leading-tight"
        >
          Find your next place
          <br />
          in{' '}
          <span className="relative inline-block">
            <AnimatePresence mode="wait">
              <motion.span
                key={`${country}-${cityIndex}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="text-accent inline-block"
              >
                {data.cities[cityIndex]}
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="text-center text-lg sm:text-xl text-primary-foreground/85 mb-8 max-w-2xl mx-auto"
        >
          Browse verified listings, match with compatible roommates, and pay rent online — all in one place. No scams. No stress.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-10"
        >
          <Link to="/search" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground gap-2 shadow-lg shadow-accent/20 h-12 px-6">
              <Home className="w-5 h-5" />
              Find a Room
            </Button>
          </Link>
          <Link to="/roommates" className="w-full sm:w-auto">
            <Button size="lg" variant="secondary" className="w-full sm:w-auto gap-2 h-12 px-6 bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm">
              <Users className="w-5 h-5" />
              Find a Roommate
            </Button>
          </Link>
          <Link to="/create-listing" className="w-full sm:w-auto">
            <Button size="lg" variant="ghost" className="w-full sm:w-auto gap-2 h-12 px-6 text-white hover:bg-white/10">
              <Plus className="w-5 h-5" />
              Post a Room
            </Button>
          </Link>
        </motion.div>

        {/* Live stats row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="grid grid-cols-3 gap-3 max-w-2xl mx-auto mb-8"
        >
          {[
            { icon: Home, label: 'Active Listings', value: data.stat.rooms, accent: '#10b981' },
            { icon: MapPin, label: 'Cities', value: data.stat.cities, accent: '#3b82f6' },
            { icon: Users, label: 'Happy Users', value: data.stat.users, accent: '#f59e0b' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + i * 0.08 }}
              className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-3 sm:p-4 text-center hover:bg-white/15 transition-colors"
            >
              <s.icon className="w-4 h-4 mx-auto mb-1.5 opacity-80" style={{ color: s.accent }} />
              <div className="text-xl sm:text-2xl font-bold">{s.value}</div>
              <div className="text-[10px] sm:text-xs text-primary-foreground/70 uppercase tracking-wider">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Trust signals */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.8 }}
          className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-primary-foreground/80"
        >
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span>Verified hosts</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-accent" />
            <span>Instant matches</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-accent" />
            <span>Secure payments</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-accent" />
            <span>AI-powered matching</span>
          </div>
        </motion.div>

        {/* Average rent indicator - bottom */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 1.0 }}
          className="mt-8 text-center"
        >
          <div className="inline-flex items-center gap-2 text-xs text-primary-foreground/70 bg-white/5 backdrop-blur-sm rounded-full px-4 py-1.5 border border-white/10">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Avg rent in {country}:</span>
            <span className="font-bold text-accent">{avgRentDisplay || data.avgRent}</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
