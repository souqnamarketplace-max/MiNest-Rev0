import React from "react";

export default function Privacy() {
  const name = "MiNest";
  const email = "support@minest.ca";
  const updated = "April 23, 2026";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: {updated}</p>
      <div className="prose prose-sm max-w-none text-muted-foreground space-y-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-medium [&_h3]:text-foreground [&_h3]:mt-4 [&_h3]:mb-2">

        <p>{name} ("we," "us," or "our") operates the {name} mobile application and website (collectively, the "Platform"). This Privacy Policy explains how we collect, use, disclose, and protect your personal information when you use our Platform. By using {name}, you agree to the collection and use of information in accordance with this policy.</p>

        <h2>1. Information We Collect</h2>
        <h3>1.1 Information You Provide</h3>
        <p>When you create an account or use our Platform, you may provide: your name, email address, and phone number; profile photo and biographical information; date of birth and gender; roommate preferences (lifestyle, cleanliness, sleep schedule, social habits); listing information (property details, photos, pricing, location); payment information (processed securely through Stripe — we do not store credit card numbers); messages sent to other users; verification documents (government ID for identity verification); and search history and saved preferences.</p>

        <h3>1.2 Information Collected Automatically</h3>
        <p>When you use our Platform, we automatically collect: device information (device model, operating system, browser type, unique device identifiers); log data (IP address, access times, pages viewed, referring URL); location data (approximate location based on IP address; precise location only with your explicit permission for map features); usage analytics (features used, search queries, interaction patterns); and cookies and similar tracking technologies for authentication and functionality.</p>

        <h3>1.3 Information from Third Parties</h3>
        <p>We may receive information from: authentication providers (Google, Apple Sign-In) if you choose to sign in with a third-party account; Walk Score API for property transportation scores; payment processors (Stripe) for transaction confirmation; and analytics providers for aggregated usage data.</p>

        <h2>2. How We Use Your Information</h2>
        <p>We use the information we collect to: provide, maintain, and improve the Platform; create and manage your account; facilitate communication between users (hosts and seekers); display listing information and match roommates based on preferences; process payments for premium features; send transactional notifications (new messages, booking requests, listing updates); enforce our Terms of Service and Acceptable Use Policy; detect and prevent fraud, abuse, and security incidents; comply with legal obligations; and provide customer support.</p>

        <h2>3. How We Share Your Information</h2>
        <p>We do not sell your personal information. We share your information only in the following circumstances:</p>
        <p><strong>With Other Users:</strong> Your profile information, listing details, and messages are shared with other users as necessary for the Platform to function. Your exact address is only shared after you mutually connect with another user.</p>
        <p><strong>With Service Providers:</strong> We share information with third-party service providers who assist in operating the Platform, including Supabase (database and authentication), Stripe (payment processing), Vercel (hosting), Walk Score (transportation data), Sentry (error monitoring), and email service providers.</p>
        <p><strong>For Legal Reasons:</strong> We may disclose information if required by law, in response to valid legal requests, or to protect the rights, property, or safety of {name}, our users, or the public.</p>
        <p><strong>Business Transfers:</strong> If {name} is involved in a merger, acquisition, or sale of assets, your information may be transferred. We will notify you via email or a prominent notice on our Platform.</p>

        <h2>4. Data Retention</h2>
        <p>We retain your personal information for as long as your account is active or as needed to provide services. If you delete your account, we permanently delete all personal data, listings, messages, and associated information within 30 days, except where required by law (e.g., payment records retained for 7 years for tax compliance).</p>

        <h2>5. Your Rights and Choices</h2>
        <h3>5.1 All Users</h3>
        <p>You have the right to: access and download your personal data through profile settings; update or correct your information at any time; delete your account and all associated data through "Delete Account" in Profile Settings; opt out of non-essential emails through notification preferences; and withdraw consent for location services through your device settings.</p>

        <h3>5.2 Canadian Users (PIPEDA)</h3>
        <p>Under the Personal Information Protection and Electronic Documents Act, you have the right to access, correct, and challenge the accuracy of your personal information. Contact us at {email} to exercise these rights.</p>

        <h3>5.3 California Users (CCPA/CPRA)</h3>
        <p>California residents have additional rights: the right to know what personal information is collected and how it is used; the right to request deletion; the right to opt-out of sale (we do not sell personal information); and the right to non-discrimination for exercising privacy rights. Contact {email} to exercise these rights.</p>

        <h3>5.4 EU/EEA Users (GDPR)</h3>
        <p>EEA residents have the right to: access, rectify, erase, or port personal data; restrict or object to processing; withdraw consent; and lodge a complaint with a data protection authority. Our legal basis for processing includes consent, contract performance, and legitimate interests.</p>

        <h2>6. Data Security</h2>
        <p>We implement appropriate technical and organizational measures to protect your information, including encryption in transit (TLS/SSL) and at rest, secure authentication, row-level security policies, regular security monitoring, and access controls. No method of transmission is 100% secure, and we cannot guarantee absolute security.</p>

        <h2>7. Children's Privacy</h2>
        <p>Our Platform is not intended for anyone under 18 years of age. We do not knowingly collect personal information from children under 18. If we become aware that we have collected such information, we will promptly delete it. Contact us at {email} if you believe we have information from a child.</p>

        <h2>8. International Data Transfers</h2>
        <p>Your information may be transferred to and processed in countries other than your country of residence, including Canada and the United States. We ensure appropriate safeguards are in place.</p>

        <h2>9. Push Notifications</h2>
        <p>With your permission, we may send push notifications for messages, booking requests, and listing updates. You can manage notifications in your device settings or the app's notification preferences.</p>

        <h2>10. Cookies and Tracking</h2>
        <p>We use essential cookies for authentication and session management. We use analytics tools to understand Platform usage. You can control cookies through your browser settings. Disabling essential cookies may prevent use of certain features.</p>

        <h2>11. Changes to This Privacy Policy</h2>
        <p>We may update this policy from time to time. We will notify you of material changes by posting the updated policy and updating the "Last Updated" date. Continued use constitutes acceptance of changes.</p>

        <h2>12. Contact Us</h2>
        <p>If you have questions about this Privacy Policy, contact us at:</p>
        <p className="font-medium text-foreground">{name}<br />Email: {email}</p>
      </div>
    </div>
  );
}
