import {
  MessageSquare, Search, Home, MapPin, Tag, Heart,
  Users, Clock, ShieldCheck, AlertTriangle, Bell,
  CheckCircle, Zap, Star,
} from "lucide-react";

/**
 * Returns { Icon, color } for a given notification type.
 * color is a tailwind bg + text class pair for the icon container.
 */
export function getNotifIconConfig(type) {
  switch (type) {
    case "message":
    case "new_message":
    case "message_request":
      return { Icon: MessageSquare, color: "bg-blue-100 text-blue-600" };

    case "saved_search_match":
      return { Icon: Search, color: "bg-accent/10 text-accent" };

    case "new_matching_listing":
    case "listing_match":
      return { Icon: Home, color: "bg-accent/10 text-accent" };

    case "similar_listing_available":
      return { Icon: MapPin, color: "bg-emerald-100 text-emerald-600" };

    case "price_drop_on_favorite":
      return { Icon: Tag, color: "bg-orange-100 text-orange-600" };

    case "favorite_listing_updated":
      return { Icon: Heart, color: "bg-rose-100 text-rose-600" };

    case "verified_listing_match":
      return { Icon: ShieldCheck, color: "bg-accent/10 text-accent" };

    case "strong_profile_match":
      return { Icon: Star, color: "bg-yellow-100 text-yellow-600" };

    case "matching_seeker_available":
      return { Icon: Users, color: "bg-purple-100 text-purple-600" };

    case "listing_getting_views_no_messages":
      return { Icon: Zap, color: "bg-amber-100 text-amber-600" };

    case "listing_expiring_soon":
    case "boost_expiring_soon":
      return { Icon: Clock, color: "bg-orange-100 text-orange-600" };

    case "listing_expired":
    case "boost_ended":
    case "boost_expired":
      return { Icon: Clock, color: "bg-destructive/10 text-destructive" };

    case "listing_approved":
      return { Icon: CheckCircle, color: "bg-emerald-100 text-emerald-600" };

    case "listing_rejected":
      return { Icon: AlertTriangle, color: "bg-destructive/10 text-destructive" };

    case "verification_completed":
      return { Icon: ShieldCheck, color: "bg-emerald-100 text-emerald-600" };

    case "security_alert":
      return { Icon: AlertTriangle, color: "bg-destructive/10 text-destructive" };

    case "viewing_request":
      return { Icon: Clock, color: "bg-yellow-100 text-yellow-600" };

    case "viewing_approved":
    case "viewing_accepted":
      return { Icon: CheckCircle, color: "bg-emerald-100 text-emerald-600" };

    case "viewing_declined":
      return { Icon: AlertTriangle, color: "bg-destructive/10 text-destructive" };

    case "viewing_proposal":
      return { Icon: Clock, color: "bg-blue-100 text-blue-600" };

    case "viewing_cancelled":
      return { Icon: AlertTriangle, color: "bg-gray-100 text-gray-600" };

    default:
      return { Icon: Bell, color: "bg-muted text-muted-foreground" };
  }
}