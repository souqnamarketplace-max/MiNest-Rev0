import React from "react";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, CheckCircle2, Clock } from "lucide-react";

export default function TrustBadges({ hostProfile, listing }) {
  const badges = [];

  if (hostProfile?.email_verified) {
    badges.push({
      icon: CheckCircle2,
      label: "Email Verified",
      color: "bg-green-50 border-green-200 text-green-700",
      description: "Host confirmed their email address.",
    });
  }

  if (hostProfile?.phone_verified) {
    badges.push({
      icon: CheckCircle2,
      label: "Phone Verified",
      color: "bg-green-50 border-green-200 text-green-700",
      description: "Host confirmed their phone number.",
    });
  }

  if (listing?.verification_badges?.includes("id_verified")) {
    badges.push({
      icon: ShieldCheck,
      label: "ID Verified",
      color: "bg-blue-50 border-blue-200 text-blue-700",
      description: "Host completed identity verification.",
    });
  }

  if (listing?.verification_badges?.includes("background_checked")) {
    badges.push({
      icon: ShieldCheck,
      label: "Background Check",
      color: "bg-blue-50 border-blue-200 text-blue-700",
      description: "Host passed a background check.",
    });
  }

  if (badges.length === 0) {
    return (
      <div className="bg-muted/30 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">Trust Level</h3>
        <p className="text-xs text-muted-foreground">Host has basic verification. Consider asking questions before committing.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">Verified Information</h3>
      <div className="space-y-2">
        {badges.map((badge, i) => (
          <div key={i} className={`border rounded-lg p-3 flex gap-2 items-start ${badge.color}`}>
            <badge.icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold">{badge.label}</p>
              <p className="text-xs opacity-80">{badge.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}