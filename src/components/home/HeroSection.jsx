import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MapPin, ArrowRight } from "lucide-react";
import { APP_CONFIG } from "@/lib/config";

export default function HeroSection() {
  const navigate = useNavigate();
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (country) params.set("country", country);
    navigate(`/search?${params.toString()}`);
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/90">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-32">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-primary-foreground/80 text-sm font-medium">
              Trusted by renters across Canada & USA
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold text-primary-foreground leading-tight tracking-tight">
            Find Your{" "}
            <span className="text-accent">Space</span>.<br className="hidden sm:block" />
            Find Your{" "}
            <span className="text-secondary">People</span>.
          </h1>

          <p className="mt-6 text-lg md:text-xl text-primary-foreground/70 max-w-2xl mx-auto leading-relaxed">
            {APP_CONFIG.tagline}. Browse verified listings, match with compatible roommates, and move in with confidence.
          </p>

          {/* Search Bar */}
          <div className="mt-10 bg-white/10 backdrop-blur-sm rounded-2xl p-2 max-w-2xl mx-auto">
            <div className="bg-card rounded-xl p-2 flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="City (e.g., Toronto, Vancouver, New York)"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="pl-10 border-0 bg-muted/50 h-12"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="w-full sm:w-40 h-12 border-0 bg-muted/50">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Canada">🇨🇦 Canada</SelectItem>
                  <SelectItem value="USA">🇺🇸 USA</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleSearch} size="lg" className="h-12 px-8 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold">
                <Search className="w-4 h-4 mr-2" /> Search
              </Button>
            </div>
          </div>

          {/* Quick Links */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {["Toronto", "Vancouver", "Montreal", "New York", "Los Angeles", "Chicago"].map(c => (
              c !== "Montreal" ? (
                <Button
                  key={c}
                  variant="ghost"
                  size="sm"
                  className="text-primary-foreground/60 hover:text-primary-foreground hover:bg-white/10"
                  onClick={() => navigate(`/search?city=${c}`)}
                >
                  {c} <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              ) : null
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}