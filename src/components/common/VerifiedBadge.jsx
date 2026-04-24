import React from "react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ShieldCheck, Mail, Phone, FileCheck, UserCheck } from "lucide-react";

const BADGE_DEFINITIONS = {
  email_verified: {
    icon: Mail,
    label: "Email Verified",
    description: "This user has confirmed ownership of their email address through a verification link.",
    color: "text-blue-600",
  },
  phone_verified: {
    icon: Phone,
    label: "Phone Verified",
    description: "This user has confirmed ownership of their phone number with a code.",
    color: "text-blue-600",
  },
  id_verified: {
    icon: FileCheck,
    label: "ID Verified",
    description: "This user has uploaded a government-issued ID that was reviewed and approved by our moderation team.",
    color: "text-green-600",
  },
  background_checked: {
    icon: UserCheck,
    label: "Background Checked",
    description: "This user has completed a background check through our verified third-party partner.",
    color: "text-green-600",
  },
};

/**
 * VerifiedBadge — a single badge with hover/tap tooltip explaining what it means.
 * Use when you want to show ONE specific verification.
 *
 * Usage:
 *   <VerifiedBadge type="id_verified" />
 *   <VerifiedBadge type="email_verified" size="sm" />
 */
export default function VerifiedBadge({ type, size = "default", className = "" }) {
  const def = BADGE_DEFINITIONS[type];
  if (!def) return null;

  const Icon = def.icon;
  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className={`bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm text-xs gap-1 cursor-help hover:bg-white ${className}`}
        >
          <Icon className={`${iconSize} ${def.color}`} />
          <span>{def.label}</span>
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" side="top">
        <div className="flex gap-2">
          <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${def.color}`} />
          <div>
            <h4 className="text-sm font-semibold mb-1">{def.label}</h4>
            <p className="text-xs text-muted-foreground">{def.description}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * VerifiedBadgeGroup — shows a compact "Verified" pill summarizing multiple badges.
 * On tap/hover, expands to show each individual verification.
 *
 * Usage:
 *   <VerifiedBadgeGroup badges={user.verification_badges} />
 */
export function VerifiedBadgeGroup({ badges = [], profile = null, className = "" }) {
  // Gather all active verifications from both arrays and profile booleans
  const active = [];
  if (profile?.email_verified) active.push("email_verified");
  if (profile?.phone_verified) active.push("phone_verified");
  if (Array.isArray(badges)) {
    for (const b of badges) {
      if (BADGE_DEFINITIONS[b] && !active.includes(b)) active.push(b);
    }
  }

  if (active.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className={`bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm text-xs gap-1 cursor-help hover:bg-white ${className}`}
        >
          <ShieldCheck className="w-3 h-3 text-accent" />
          <span>Verified</span>
          {active.length > 1 && <span className="text-muted-foreground">·{active.length}</span>}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" side="top">
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-accent" />
          What "Verified" means
        </h4>
        <div className="space-y-2">
          {active.map((type) => {
            const def = BADGE_DEFINITIONS[type];
            if (!def) return null;
            const Icon = def.icon;
            return (
              <div key={type} className="flex gap-2">
                <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${def.color}`} />
                <div>
                  <p className="text-xs font-semibold">{def.label}</p>
                  <p className="text-xs text-muted-foreground">{def.description}</p>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 pt-2 border-t">
          MiNest verifies users to help build trust, but always use judgment when communicating with hosts or seekers.
        </p>
      </PopoverContent>
    </Popover>
  );
}
