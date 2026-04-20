import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, PlusCircle } from "lucide-react";

export default function CTASection() {
  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Seekers */}
          <div className="rounded-3xl bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 p-8 md:p-12">
            <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Looking for a Room?
            </h3>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Browse thousands of verified rooms across Canada and the USA. Filter by price, location, and lifestyle to find your perfect match.
            </p>
            <Link to="/search">
              <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold">
                Browse Rooms <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          {/* Listers */}
          <div className="rounded-3xl bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20 p-8 md:p-12">
            <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Have a Room to Rent?
            </h3>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              List your space in minutes. Reach qualified roommates, use our matching engine, and fill your room faster.
            </p>
            <Link to="/create-listing">
              <Button size="lg" variant="outline" className="border-secondary text-secondary hover:bg-secondary/10 font-semibold">
                <PlusCircle className="w-4 h-4 mr-2" /> Post a Room
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}