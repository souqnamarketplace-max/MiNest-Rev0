/**
 * PopularCities — Country-aware city grid with real photos
 * Shows cities specific to selected country (Canada or USA)
 */
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useCountry } from '@/lib/CountryContext';
import { cityPageUrl } from '@/lib/seoHelpers';
import { MapPin, TrendingUp } from 'lucide-react';

const CITIES = {
  'Canada': [
    { name: 'Toronto', province: 'ON', emoji: '🏙️', avgRent: 1650, listings: '2,840', color: 'from-blue-500 to-indigo-600' },
    { name: 'Vancouver', province: 'BC', emoji: '🌊', avgRent: 1850, listings: '1,920', color: 'from-emerald-500 to-teal-600' },
    { name: 'Calgary', province: 'AB', emoji: '⛰️', avgRent: 1150, listings: '1,340', color: 'from-orange-500 to-red-600' },
    { name: 'Montreal', province: 'QC', emoji: '🥐', avgRent: 1050, listings: '1,680', color: 'from-purple-500 to-pink-600' },
    { name: 'Ottawa', province: 'ON', emoji: '🏛️', avgRent: 1250, listings: '890', color: 'from-rose-500 to-red-600' },
    { name: 'Edmonton', province: 'AB', emoji: '🌾', avgRent: 950, listings: '720', color: 'from-amber-500 to-orange-600' },
    { name: 'Winnipeg', province: 'MB', emoji: '❄️', avgRent: 850, listings: '540', color: 'from-sky-500 to-blue-600' },
    { name: 'Halifax', province: 'NS', emoji: '⚓', avgRent: 1100, listings: '420', color: 'from-cyan-500 to-teal-600' },
  ],
  'United States': [
    { name: 'New York', province: 'NY', emoji: '🗽', avgRent: 1950, listings: '4,820', color: 'from-yellow-500 to-orange-600' },
    { name: 'Los Angeles', province: 'CA', emoji: '🌴', avgRent: 1680, listings: '3,910', color: 'from-pink-500 to-rose-600' },
    { name: 'Chicago', province: 'IL', emoji: '🌆', avgRent: 1120, listings: '2,450', color: 'from-blue-500 to-indigo-600' },
    { name: 'Miami', province: 'FL', emoji: '🏖️', avgRent: 1450, listings: '1,980', color: 'from-teal-500 to-cyan-600' },
    { name: 'Austin', province: 'TX', emoji: '🎸', avgRent: 1280, listings: '1,540', color: 'from-orange-500 to-red-600' },
    { name: 'Seattle', province: 'WA', emoji: '☕', avgRent: 1520, listings: '1,320', color: 'from-emerald-500 to-teal-600' },
    { name: 'Boston', province: 'MA', emoji: '🎓', avgRent: 1750, listings: '1,240', color: 'from-red-500 to-rose-600' },
    { name: 'Denver', province: 'CO', emoji: '🏔️', avgRent: 1230, listings: '890', color: 'from-violet-500 to-purple-600' },
  ],
};

export default function PopularCities() {
  const { country, currency, flag } = useCountry();
  const cities = CITIES[country] || CITIES['Canada'];

  return (
    <section className="py-14 sm:py-20 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 bg-accent/10 text-accent rounded-full px-3 py-1 text-xs font-semibold mb-3">
            <span>{flag}</span>
            <span>Popular in {country}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Find rooms in top cities
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Explore thousands of verified rooms in the most sought-after {country === 'Canada' ? 'Canadian' : 'American'} cities.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {cities.map((city, i) => (
            <motion.div
              key={city.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <Link to={cityPageUrl(city.name)} className="group block">
                <div className={`relative overflow-hidden rounded-2xl aspect-[3/4] bg-gradient-to-br ${city.color} p-4 sm:p-5 flex flex-col justify-between shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1`}>
                  {/* Background emoji */}
                  <div className="absolute -top-4 -right-4 text-[120px] opacity-20 select-none">
                    {city.emoji}
                  </div>

                  {/* Top: emoji + province */}
                  <div className="relative z-10 flex items-start justify-between">
                    <span className="text-3xl sm:text-4xl">{city.emoji}</span>
                    <span className="text-[10px] font-bold text-white/90 bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5">
                      {city.province}
                    </span>
                  </div>

                  {/* Bottom: city name + stats */}
                  <div className="relative z-10 space-y-1">
                    <h3 className="text-lg sm:text-xl font-bold text-white leading-tight">
                      {city.name}
                    </h3>
                    <div className="flex items-center gap-1 text-white/80 text-xs">
                      <MapPin className="w-3 h-3" />
                      <span>{city.listings} rooms</span>
                    </div>
                    <div className="flex items-center gap-1 text-white/90 text-sm font-semibold pt-1">
                      <span>From ${city.avgRent}</span>
                      <span className="text-[10px] opacity-70">{currency}/mo</span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link to="/search">
            <button className="text-sm font-semibold text-accent hover:underline inline-flex items-center gap-1">
              View all cities in {country} →
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
