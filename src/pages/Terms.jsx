import React from "react";
import { useQuery } from "@tanstack/react-query";
import { entities } from "@/api/entities";
import { APP_CONFIG } from "@/lib/config";

const FALLBACK_CONTENT = `
**Welcome to ${APP_CONFIG.name}.** By accessing or using our platform, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.

## 1. Eligibility

You must be at least 18 years old and located in Canada (excluding Quebec) or the United States to use ${APP_CONFIG.name}. By creating an account, you represent that you meet these requirements.

## 2. Account Responsibility

You are responsible for maintaining the confidentiality of your login credentials and for all activities under your account. You agree to notify us immediately of any unauthorized use. ${APP_CONFIG.name} is not liable for losses resulting from unauthorized account access.

## 3. Platform Description

${APP_CONFIG.name} is a shared housing marketplace that connects people looking for rooms, roommates, and rental accommodations across Canada and the USA. We provide tools for listing rooms, searching for accommodations, communicating between users, scheduling viewings, and facilitating booking requests.

## 4. Listings & Content

All listings must be accurate, truthful, and comply with applicable federal, provincial/state, and local laws. You must have legal authority to offer any space listed. We reserve the right to remove, modify, or flag any listing that violates our policies without prior notice.

Photos must accurately represent the property. Misleading images, stolen photos, or AI-generated property images are strictly prohibited.

## 5. Messaging & Communication

Our messaging system is provided for legitimate housing-related communication. You may not use messaging to harass, spam, solicit, or send unsolicited commercial content. Messages may be monitored for safety and policy compliance.

## 6. Viewing Appointments

${APP_CONFIG.name} facilitates scheduling of property viewings between listers and seekers. Both parties are responsible for their own safety during in-person viewings. We recommend meeting in common areas and informing someone of your plans.

## 7. Bookings & Payments

Booking requests submitted through the platform are subject to approval by the listing owner. ${APP_CONFIG.name} may facilitate payment processing through third-party providers (e.g., Stripe). All payment disputes should first be raised through our platform's dispute resolution system.

Paid features including listing boosts and identity verification are non-refundable unless otherwise stated. Rent payments arranged through the platform are agreements between the tenant and landlord.

## 8. Identity Verification

Users may optionally verify their identity through our verification system. Verification does not constitute an endorsement or guarantee of any user's character, background, or trustworthiness. It only confirms that the user submitted identification documents.

## 9. User Conduct

You agree not to: create fake or misleading listings; discriminate beyond legally permitted roommate preferences; harass, threaten, or abuse other users; attempt to circumvent platform security or geographic restrictions; scrape, copy, or redistribute platform content; or use the platform for any illegal purpose.

## 10. Notifications

By using ${APP_CONFIG.name}, you consent to receive platform notifications including messages, booking updates, viewing confirmations, and administrative notices. You can manage notification preferences in your account settings.

## 11. Safety & Liability

${APP_CONFIG.name} is a marketplace platform. We do not verify the accuracy of listings, guarantee the identity or behavior of users, or assume responsibility for any transaction between users. Always exercise caution when meeting in person or sharing personal information.

## 12. Geographic Restrictions

This platform currently does not operate in the province of Quebec, Canada. Users from Quebec will not be able to create accounts or access localized features.

## 13. Intellectual Property

All platform content, design, logos, and software are the property of ${APP_CONFIG.name} and its licensors. User-generated content (listings, messages, reviews) remains owned by the user, but by posting it you grant ${APP_CONFIG.name} a non-exclusive, worldwide license to display and distribute it on the platform.

## 14. Termination

We may suspend or terminate accounts that violate these terms, engage in fraudulent activity, or compromise platform safety, at our sole discretion and without prior notice.

## 15. Privacy

Your use of ${APP_CONFIG.name} is also governed by our Privacy Policy. Please review it to understand how we collect, use, and protect your personal information.

## 16. Changes to Terms

We may update these Terms from time to time. Continued use of the platform after changes constitutes acceptance of the updated terms. We will notify users of material changes through the platform.

## 17. Governing Law

These Terms are governed by the laws of the Province of Alberta, Canada, and the federal laws of Canada applicable therein.

## 18. Contact

For questions about these Terms, contact us at support@minest.ca or through the Contact page on our platform.
`;

export default function Terms() {
  const { data: dbContent } = useQuery({
    queryKey: ["site-content", "terms"],
    queryFn: async () => {
      try {
        const results = await entities.SiteContent.filter({ page_key: "terms" });
        return results?.[0]?.content || null;
      } catch { return null; }
    },
    staleTime: 5 * 60 * 1000,
  });

  const content = dbContent || FALLBACK_CONTENT;
  const sections = content.split(/\n(?=## )/);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: April 2026</p>
      <div className="prose prose-sm max-w-none text-muted-foreground space-y-5">
        {sections.map((section, i) => {
          const lines = section.trim().split("\n");
          return (
            <div key={i}>
              {lines.map((line, j) => {
                const trimmed = line.trim();
                if (!trimmed) return null;
                if (trimmed.startsWith("## ")) return <h2 key={j} className="text-lg font-semibold text-foreground mt-6 mb-2">{trimmed.replace("## ", "")}</h2>;
                if (trimmed.startsWith("**") && trimmed.endsWith("**")) return <p key={j} className="font-semibold text-foreground">{trimmed.replace(/\*\*/g, "")}</p>;
                return <p key={j}>{trimmed.replace(/\*\*/g, "")}</p>;
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
