import React from "react";
import { useQuery } from "@tanstack/react-query";
import { entities } from "@/api/entities";
import { APP_CONFIG } from "@/lib/config";

const FALLBACK_CONTENT = `
**${APP_CONFIG.name}** is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and protect your personal information when you use our platform.

## 1. Information We Collect

**Account Information:** When you create an account, we collect your name, email address, and password. You may also provide a phone number, profile photo, and biographical information.

**Listing Data:** If you create a listing, we collect property details including address, photos, pricing, amenities, and availability information.

**Seeker Profile Data:** If you create a roommate seeker profile, we collect your preferences, lifestyle information, budget range, and location preferences.

**Communications:** We store messages sent through our messaging system between users.

**Verification Data:** If you choose to verify your identity, we collect identification documents. These are processed securely and not shared with other users.

**Usage Data:** We automatically collect information about how you use the platform, including pages viewed, search queries, device type, browser, IP address, and interaction patterns.

**Location Data:** We may collect your approximate location based on your IP address or device settings to provide relevant local search results.

## 2. How We Use Your Information

We use your information to: operate and improve the platform; match you with relevant listings and roommates; facilitate communication between users; process payments and bookings; send notifications about messages, viewings, and booking updates; verify user identities; enforce our Terms of Service and Acceptable Use Policy; analyze platform usage to improve our services; and communicate important updates about your account.

## 3. Data Sharing

We do not sell your personal data to third parties. We share information only with: payment processors (Stripe) to facilitate transactions; hosting providers (Supabase, Vercel) to operate the platform; analytics services to understand usage patterns; and law enforcement when required by legal process.

We may share anonymized, aggregated data for research or business purposes.

## 4. Data Retention

We retain your personal data for as long as your account is active. If you delete your account, we will remove your personal data within 30 days, except where retention is required by law. Messages sent to other users may remain visible to those users.

## 5. Data Security

We implement industry-standard security measures including: encrypted data transmission (TLS/SSL); row-level security on all database tables; secure authentication via Supabase Auth; password hashing (bcrypt); and regular security audits.

No system is 100% secure. We cannot guarantee absolute security but we take reasonable measures to protect your information.

## 6. Your Rights

You have the right to: access your personal data through your profile settings; correct inaccurate information; delete your account and associated data; export your data; withdraw consent for optional data processing; and opt out of non-essential notifications.

To exercise these rights, contact us at privacy@minest.ca or use the relevant settings in your account.

## 7. Cookies & Tracking

We use essential cookies for authentication and session management. We use analytics cookies to understand how the platform is used. You can manage cookie preferences in your browser settings. We do not use third-party advertising cookies.

## 8. Children's Privacy

${APP_CONFIG.name} is not intended for users under 18 years of age. We do not knowingly collect personal information from children. If we become aware of such collection, we will delete the information promptly.

## 9. International Data

${APP_CONFIG.name} operates in Canada and the United States. Your data may be processed in either country. By using the platform, you consent to the transfer of your information across borders within these jurisdictions.

## 10. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify users of material changes through the platform. Continued use of ${APP_CONFIG.name} after changes constitutes acceptance.

## 11. Contact

For privacy-related questions or requests, contact us at privacy@minest.ca or through the Contact page on our platform.

For users in Canada, you may also file a complaint with the Office of the Privacy Commissioner of Canada at priv.gc.ca.
`;

export default function Privacy() {
  const { data: dbContent } = useQuery({
    queryKey: ["site-content", "privacy"],
    queryFn: async () => {
      try {
        const results = await entities.SiteContent.filter({ page_key: "privacy" });
        return results?.[0]?.content || null;
      } catch { return null; }
    },
    staleTime: 5 * 60 * 1000,
  });

  const content = dbContent || FALLBACK_CONTENT;
  const sections = content.split(/\n(?=## )/);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
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
