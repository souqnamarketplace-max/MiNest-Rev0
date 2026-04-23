import React from "react";

export default function Terms() {
  const name = "MiNest";
  const email = "support@minest.ca";
  const updated = "April 23, 2026";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: {updated}</p>
      <div className="prose prose-sm max-w-none text-muted-foreground space-y-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-medium [&_h3]:text-foreground [&_h3]:mt-4 [&_h3]:mb-2">

        <p>Welcome to {name}. These Terms of Service ("Terms") govern your access to and use of the {name} mobile application, website, and all related services (collectively, the "Platform"). By creating an account or using the Platform, you agree to be bound by these Terms. If you do not agree, do not use the Platform.</p>

        <h2>1. Eligibility</h2>
        <p>You must be at least 18 years old to use {name}. By using the Platform, you represent that you are at least 18 years old and have the legal capacity to enter into these Terms. The Platform is available to users in Canada (excluding Quebec) and the United States. Users from Quebec are not permitted to create accounts or use the Platform due to regulatory requirements.</p>

        <h2>2. Account Registration</h2>
        <p>To access certain features, you must create an account. You agree to: provide accurate, current, and complete information during registration; maintain and promptly update your account information; keep your password confidential and not share it with anyone; accept responsibility for all activities under your account; and notify us immediately of any unauthorized use of your account. You may not create multiple accounts, use another person's account, or transfer your account to another person.</p>

        <h2>3. Platform Description</h2>
        <p>{name} is an online marketplace that connects people seeking shared housing (rooms, apartments, and roommates) in Canada and the United States. The Platform allows users to: post room rental listings with photos, pricing, and details; search and browse available rooms and roommates; communicate with other users via in-app messaging; create roommate seeker profiles; schedule viewings and send booking requests; and process rent payments through integrated payment services.</p>
        <p>{name} is a platform only. We are not a party to any rental agreement, lease, or transaction between users. We do not own, manage, or control any properties listed on the Platform.</p>

        <h2>4. User-Generated Content</h2>
        <h3>4.1 Your Content</h3>
        <p>You retain ownership of content you post (listings, photos, messages, profile information). By posting content, you grant {name} a non-exclusive, worldwide, royalty-free license to use, display, reproduce, and distribute your content solely for the purpose of operating and promoting the Platform.</p>

        <h3>4.2 Content Standards</h3>
        <p>All content must be: accurate, truthful, and not misleading; compliant with applicable laws and regulations; respectful and non-discriminatory (beyond legally permitted roommate preferences); and free of spam, malware, or harmful material. You may not post content that infringes any intellectual property rights, contains personal information of others without their consent, promotes illegal activities, or constitutes harassment, threats, or hate speech.</p>

        <h3>4.3 Content Moderation</h3>
        <p>We reserve the right to review, edit, or remove any content that violates these Terms or our Acceptable Use Policy, at our sole discretion and without prior notice.</p>

        <h2>5. Listings</h2>
        <p>Hosts who post listings represent and warrant that: they have the legal right to rent the property or room; the listing information (price, availability, amenities, photos) is accurate; the property complies with all applicable housing laws and regulations; photos are of the actual property and are not misleading; and they will honor the terms presented in their listing. {name} does not verify the accuracy of listings and is not responsible for any discrepancies between listings and actual properties.</p>

        <h2>6. Payments and Fees</h2>
        <h3>6.1 Premium Features</h3>
        <p>{name} may offer paid features such as listing boosts, identity verification, and promoted placements. Fees for these services are displayed before purchase. All purchases of digital premium features are final and non-refundable unless otherwise required by law.</p>

        <h3>6.2 Rent Payments</h3>
        <p>If you use {name}'s rent payment feature, payments are processed securely through Stripe. {name} is not a party to any rental agreement and does not hold funds. Payment disputes should be resolved directly between the parties involved. {name} may charge a service fee for rent payment processing, which will be clearly disclosed before any transaction.</p>

        <h3>6.3 Taxes</h3>
        <p>You are solely responsible for determining and paying any taxes applicable to your rental income or transactions.</p>

        <h2>7. Prohibited Activities</h2>
        <p>You agree not to: use the Platform for any unlawful purpose; post false, misleading, or fraudulent listings; discriminate against any person based on race, color, religion, national origin, sex, disability, or familial status in violation of fair housing laws; harass, threaten, or abuse other users; scrape, crawl, or collect data from the Platform without permission; interfere with the Platform's operation or security; create fake accounts or impersonate others; use the Platform to send unsolicited commercial messages; or circumvent geographic restrictions or security measures.</p>

        <h2>8. Safety and Disclaimer</h2>
        <p>{name} is a marketplace platform that connects users. We do not: verify the identity, background, or creditworthiness of any user (beyond optional verification features); guarantee the accuracy of any listing, profile, or user information; inspect, own, or manage any listed properties; guarantee the safety of in-person meetings or viewings; or act as a landlord, tenant, or real estate agent. Users should exercise their own judgment and caution when interacting with others, visiting properties, or entering into rental agreements. We strongly recommend meeting in public places first and bringing a trusted person to viewings.</p>

        <h2>9. Intellectual Property</h2>
        <p>The {name} name, logo, design, and all associated intellectual property are owned by us. You may not use our trademarks, logos, or branding without prior written permission. The Platform's software, code, and design are protected by copyright and other intellectual property laws.</p>

        <h2>10. Account Suspension and Termination</h2>
        <p>We may suspend or terminate your account at our discretion if you: violate these Terms or our Acceptable Use Policy; engage in fraudulent or illegal activity; receive multiple reports from other users; create risk or legal exposure for {name}; or fail to respond to our communications regarding policy violations. You may delete your account at any time through Profile Settings. Account deletion permanently removes all your data, listings, messages, and associated information.</p>

        <h2>11. Limitation of Liability</h2>
        <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, {name.toUpperCase()} AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE PLATFORM. OUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM THESE TERMS SHALL NOT EXCEED THE AMOUNT YOU PAID TO {name.toUpperCase()} IN THE 12 MONTHS PRECEDING THE CLAIM.</p>

        <h2>12. Indemnification</h2>
        <p>You agree to indemnify and hold harmless {name} and its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including reasonable legal fees) arising from your use of the Platform, violation of these Terms, or infringement of any third-party rights.</p>

        <h2>13. Dispute Resolution</h2>
        <p>Any disputes arising from these Terms or your use of the Platform will be resolved through binding arbitration in accordance with the rules of the Canadian Arbitration Association (for Canadian users) or the American Arbitration Association (for US users), except that either party may seek injunctive relief in court. Class action lawsuits and class-wide arbitration are waived to the extent permitted by law.</p>

        <h2>14. Governing Law</h2>
        <p>For Canadian users, these Terms are governed by the laws of the Province of Alberta and the federal laws of Canada. For US users, these Terms are governed by the laws of the State of Delaware without regard to conflict of law provisions.</p>

        <h2>15. Changes to These Terms</h2>
        <p>We may modify these Terms at any time. We will notify you of material changes by posting the updated Terms and updating the "Last Updated" date. If you continue to use the Platform after changes take effect, you agree to the revised Terms. If you do not agree, you must stop using the Platform and delete your account.</p>

        <h2>16. Severability</h2>
        <p>If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.</p>

        <h2>17. Entire Agreement</h2>
        <p>These Terms, together with our Privacy Policy and Acceptable Use Policy, constitute the entire agreement between you and {name} regarding the Platform.</p>

        <h2>18. Contact Us</h2>
        <p>If you have questions about these Terms, contact us at:</p>
        <p className="font-medium text-foreground">{name}<br />Email: {email}</p>
      </div>
    </div>
  );
}
