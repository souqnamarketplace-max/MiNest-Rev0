import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Users, Plus } from "lucide-react";

export default function ClosingCTA() {
  return (
    <div className="bg-accent text-accent-foreground py-16 sm:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          Find your space. Find your people. Welcome to MiNest.
        </h2>
        <p className="text-accent-foreground/80 mb-8 text-lg">
          Rooms, roommates, and secure rent payments — all in one platform.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/search">
            <Button size="lg" variant="secondary" className="w-full sm:w-auto">
              <Home className="w-5 h-5 mr-2" />
              Find a Room
            </Button>
          </Link>
          <Link to="/roommates">
            <Button size="lg" variant="secondary" className="w-full sm:w-auto">
              <Users className="w-5 h-5 mr-2" />
              Find a Roommate
            </Button>
          </Link>
          <Link to="/create-listing">
            <Button size="lg" className="w-full sm:w-auto bg-white text-accent hover:bg-white/90 font-semibold">
              <Plus className="w-5 h-5 mr-2" />
              Post a Room
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}