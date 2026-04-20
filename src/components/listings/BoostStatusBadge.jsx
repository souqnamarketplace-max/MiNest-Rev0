import React, { useEffect, useState } from "react";
import { Zap, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function BoostStatusBadge({ listing }) {
  const [daysRemaining, setDaysRemaining] = useState(null);

  useEffect(() => {
    if (!listing.is_boosted && !listing.is_featured) return;

    const calculateDays = () => {
      const endDate = listing.boost_end_at ? new Date(listing.boost_end_at) : null;
      if (!endDate) return null;
      
      const now = new Date();
      const diff = endDate - now;
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return days > 0 ? days : 0;
    };

    setDaysRemaining(calculateDays());
    const timer = setInterval(() => {
      setDaysRemaining(calculateDays());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, [listing.is_boosted, listing.boost_end_at, listing.is_featured]);

  if (!listing.is_boosted && !listing.is_featured) return null;

  const isExpired = daysRemaining === 0;
  
  if (listing.is_boosted) {
    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        isExpired ? "bg-yellow-100 text-yellow-700" : "bg-secondary/20 text-secondary"
      }`}>
        <Zap className="w-3 h-3" />
        <span>
          {isExpired ? "Boost Expired" : `Boosted ${daysRemaining ? `(${daysRemaining}d left)` : ""}`}
        </span>
      </div>
    );
  }

  if (listing.is_featured) {
    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        isExpired ? "bg-yellow-100 text-yellow-700" : "bg-accent/20 text-accent"
      }`}>
        <Sparkles className="w-3 h-3" />
        <span>Featured</span>
      </div>
    );
  }

  return null;
}