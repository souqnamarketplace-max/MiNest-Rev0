import React from "react";
import { useQuery } from "@tanstack/react-query";
import { entities } from "@/api/entities";
import { APP_CONFIG } from "@/lib/config";

const FALLBACK_CONTENT = `
This Acceptable Use Policy outlines what is and is not permitted on **${APP_CONFIG.name}**. All users must comply with this policy. Violations may result in content removal, account suspension, or permanent banning.

## 1. Prohibited Listings

The following types of listings are strictly prohibited: fake, misleading, or fraudulent property listings; listings for properties you do not have legal authority to rent; listings with stolen, AI-generated, or misleading photos; duplicate or spam listings for the same property; listings for illegal or unlicensed accommodations; and listings that discriminate on the basis of race, religion, national origin, disability, sexual orientation, or gender identity beyond legally permitted roommate preferences under applicable human rights laws.

## 2. Prohibited Communication

Users must not use the messaging system to: harass, threaten, intimidate, or abuse other users; send spam, unsolicited advertising, or commercial solicitations; share another person's personal information without consent; send sexually explicit or offensive content; attempt to arrange transactions outside the platform to avoid safety protections; or impersonate another person, organization, or ${APP_CONFIG.name} staff.

## 3. Prohibited Account Behavior

The following account activities are prohibited: creating multiple accounts to circumvent bans or restrictions; sharing account credentials with others; using automated tools, bots, or scripts to interact with the platform; scraping, crawling, or collecting data from the platform; attempting to bypass geographic restrictions (including Quebec exclusion); attempting to access admin features or other users' accounts; and manipulating search rankings, reviews, or platform metrics.

## 4. Content Standards

All user-generated content (listings, profiles, messages) must: be truthful and not misleading; respect the intellectual property rights of others; not contain malware, phishing links, or harmful code; not promote illegal activities; and comply with all applicable laws and regulations.

## 5. Viewing & Meeting Safety

When arranging in-person property viewings: meet in common areas when possible; inform someone you trust about your plans; do not share sensitive financial information before verifying the listing; report any suspicious behavior immediately; and never send money before seeing the property.

## 6. Payment Conduct

Users must not: submit fraudulent payment disputes or chargebacks; use stolen payment methods; attempt to manipulate pricing, fees, or commission structures; or conduct money laundering or other financial crimes through the platform.

## 7. Reporting Violations

If you encounter content or behavior that violates this policy: use the Report button available on any listing, profile, or conversation; contact us through the Contact page; or email support@minest.ca with details of the violation. All reports are reviewed by our moderation team and handled confidentially.

## 8. Enforcement

Violations of this policy may result in: a warning and request to modify content; temporary content removal pending review; account suspension for a defined period; permanent account termination; and referral to law enforcement for illegal activity. The severity of enforcement depends on the nature and frequency of violations. ${APP_CONFIG.name} reserves the right to take action at our sole discretion.

## 9. Appeals

If you believe your account was suspended or content was removed in error, you may appeal by contacting support@minest.ca within 14 days of the action. Include your account email and a detailed explanation. Appeals are reviewed within 5 business days.

## 10. Changes

We may update this policy from time to time to reflect changes in our platform, legal requirements, or community standards. Continued use of ${APP_CONFIG.name} after changes constitutes acceptance.
`;

export default function AcceptableUse() {
  const { data: dbContent } = useQuery({
    queryKey: ["site-content", "acceptable_use"],
    queryFn: async () => {
      try {
        const results = await entities.SiteContent.filter({ page_key: "acceptable_use" });
        return results?.[0]?.content || null;
      } catch { return null; }
    },
    staleTime: 5 * 60 * 1000,
  });

  const content = dbContent || FALLBACK_CONTENT;
  const sections = content.split(/\n(?=## )/);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-bold text-foreground mb-2">Acceptable Use Policy</h1>
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
