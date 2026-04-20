import React from "react";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, CheckCircle2, Clock, MapPin } from "lucide-react";

export default function HostCard({ hostProfile, listing }) {
  if (!hostProfile) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5">
        <h3 className="font-semibold text-foreground mb-3">Host Information</h3>
        <p className="text-sm text-muted-foreground">Host profile not available.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      {/* Host header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-1">
          {hostProfile.avatar_url ? (
            <img src={hostProfile.avatar_url} alt={hostProfile.display_name} className="w-12 h-12 rounded-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent font-semibold">
              {hostProfile.display_name?.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h4 className="font-semibold text-foreground">{hostProfile.display_name || "Host"}</h4>
            <p className="text-xs text-muted-foreground">{hostProfile.user_type_intent === "both" ? "Lister & Seeker" : hostProfile.user_type_intent === "lister" ? "Property Owner" : "User"}</p>
          </div>
        </div>
      </div>

      {/* Verification badges */}
      <div className="flex flex-wrap gap-1.5">
        {hostProfile.email_verified && (
          <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Email Verified
          </Badge>
        )}
        {hostProfile.phone_verified && (
          <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Phone Verified
          </Badge>
        )}
        {listing.verification_badges?.includes("id_verified") && (
          <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
            <ShieldCheck className="w-3 h-3 mr-1" /> ID Verified
          </Badge>
        )}
      </div>

      {/* Bio */}
      {hostProfile.bio && (
        <div>
          <p className="text-sm text-foreground leading-relaxed">{hostProfile.bio}</p>
        </div>
      )}

      {/* Meta */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          <span>Joined {hostProfile.created_date ? new Date(hostProfile.created_date).toLocaleDateString("en-US", { year: "numeric", month: "short" }) : "recently"}</span>
        </div>
        {hostProfile.city && (
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5" />
            <span>{hostProfile.city}, {hostProfile.province_or_state}</span>
          </div>
        )}
      </div>
    </div>
  );
}