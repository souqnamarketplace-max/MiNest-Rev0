import React from "react";
import { APP_CONFIG } from "@/lib/config";

export default function AcceptableUse() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-bold text-foreground mb-8">Acceptable Use Policy</h1>
      <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
        <p>This policy outlines what is and is not allowed on {APP_CONFIG.name}.</p>
        <h2 className="text-lg font-semibold text-foreground">Prohibited Content</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Fake, misleading, or fraudulent listings</li>
          <li>Discriminatory content beyond legal roommate preferences</li>
          <li>Spam, duplicate, or low-quality listings</li>
          <li>Illegal activity or solicitation</li>
          <li>Harassment, threats, or abusive language</li>
          <li>Personal information of others without consent</li>
        </ul>
        <h2 className="text-lg font-semibold text-foreground">Prohibited Behavior</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Creating multiple accounts to circumvent bans</li>
          <li>Automated scraping or data collection</li>
          <li>Attempting to bypass geographic restrictions</li>
          <li>Impersonating another person or organization</li>
        </ul>
        <h2 className="text-lg font-semibold text-foreground">Reporting</h2>
        <p>If you encounter content or behavior that violates this policy, please report it using the reporting tools on any listing or profile, or contact us directly.</p>
        <h2 className="text-lg font-semibold text-foreground">Enforcement</h2>
        <p>Violations may result in content removal, account suspension, or permanent banning at our discretion.</p>
        <p className="text-xs text-muted-foreground pt-4">Last updated: March 2026</p>
      </div>
    </div>
  );
}