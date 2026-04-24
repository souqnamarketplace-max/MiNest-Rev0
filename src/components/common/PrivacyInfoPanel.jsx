import React, { useState } from "react";
import { Shield, Eye, Lock, ChevronDown, ChevronUp } from "lucide-react";

/**
 * PrivacyInfoPanel — Shows users exactly what personal information is
 * visible to other users vs kept private. Used on seeker onboarding,
 * profile pages, and listing creation.
 *
 * Variants:
 *   "seeker" — what hosts see about a seeker
 *   "host" — what seekers see about a host
 *   "both" — full summary
 */

const VISIBILITY_MATRIX = {
  seeker: {
    title: "What hosts see about you",
    description: "When you apply to a listing or start a conversation, hosts see:",
    visible: [
      { label: "Display name or first name", detail: "Hosts see how you choose to present yourself." },
      { label: "Profile photo", detail: "Only if you upload one — optional but helps build trust." },
      { label: "City & preferred region", detail: "So hosts know you're looking in their area." },
      { label: "Age range (if provided)", detail: "Shown as '25-30' instead of exact date of birth." },
      { label: "Occupation / student status", detail: "Helps hosts gauge suitability." },
      { label: "Bio and lifestyle preferences", detail: "Pet friendly, smoking, etc. — what you wrote publicly." },
      { label: "Verification badges", detail: "Email/phone/ID verified — yes or no, no details shown." },
    ],
    hidden: [
      { label: "Email address", detail: "Never shared. Hosts can only message you through MiNest." },
      { label: "Phone number", detail: "Never shared unless you post it yourself in messages." },
      { label: "Exact date of birth", detail: "Only age range is shown, never the full date." },
      { label: "Full home address", detail: "Only the city is visible, never your street or postal code." },
      { label: "Payment methods", detail: "Stripe handles this — MiNest and hosts never see card details." },
      { label: "Government ID images", detail: "Used for verification only. Stored encrypted, not shown to hosts." },
      { label: "Browsing history", detail: "Which listings you viewed stays private." },
    ],
  },
  host: {
    title: "What seekers see about you",
    description: "When seekers view your listing or start a conversation, they see:",
    visible: [
      { label: "Display name or first name", detail: "Your public-facing name." },
      { label: "Profile photo", detail: "Optional, but listings with host photos get 3x more inquiries." },
      { label: "Property city & neighborhood", detail: "Exact address is only shared after booking confirmation." },
      { label: "Host bio", detail: "What you wrote publicly about yourself." },
      { label: "Verification badges", detail: "Email/phone/ID verified — yes or no." },
      { label: "Response time & rate", detail: "Calculated from your message history." },
      { label: "Number of active listings", detail: "Seekers can see if you're a multi-property host." },
    ],
    hidden: [
      { label: "Email address", detail: "Never shared. Seekers message you through MiNest." },
      { label: "Phone number", detail: "Only shared if you choose to send it in messages." },
      { label: "Exact street address", detail: "Hidden until a booking is confirmed." },
      { label: "Bank / Stripe account details", detail: "Payments are processed by Stripe — seekers never see this." },
      { label: "Government ID images", detail: "Used for verification only, never shown to seekers." },
      { label: "Earnings / booking history", detail: "Private to you and the admin dashboard." },
    ],
  },
};

export default function PrivacyInfoPanel({ variant = "seeker", defaultOpen = false, className = "" }) {
  const [open, setOpen] = useState(defaultOpen);
  const data = VISIBILITY_MATRIX[variant] || VISIBILITY_MATRIX.seeker;

  return (
    <div className={`border border-border rounded-xl bg-muted/20 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 rounded-xl transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{data.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Tap to see the full list</p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-3">
          <p className="text-xs text-muted-foreground">{data.description}</p>

          {/* Visible section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-green-600" />
              <h4 className="text-xs font-semibold">Visible to others</h4>
            </div>
            <ul className="space-y-2 pl-6">
              {data.visible.map((item, i) => (
                <li key={i} className="text-xs">
                  <span className="font-medium text-foreground">{item.label}</span>
                  <span className="text-muted-foreground"> — {item.detail}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Hidden section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-slate-600" />
              <h4 className="text-xs font-semibold">Kept private</h4>
            </div>
            <ul className="space-y-2 pl-6">
              {data.hidden.map((item, i) => (
                <li key={i} className="text-xs">
                  <span className="font-medium text-foreground">{item.label}</span>
                  <span className="text-muted-foreground"> — {item.detail}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-2 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground">
              MiNest follows PIPEDA (Canada), CCPA (California), and GDPR (EU) privacy rules.
              You can request a copy or deletion of your data anytime from the Profile page.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
