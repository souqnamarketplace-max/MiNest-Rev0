import React from "react";
import { APP_CONFIG } from "@/lib/config";

export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-bold text-foreground mb-8">Terms of Service</h1>
      <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
        <p>Welcome to {APP_CONFIG.name}. By using our platform, you agree to these terms.</p>
        <h2 className="text-lg font-semibold text-foreground">1. Eligibility</h2>
        <p>You must be at least 18 years old and located in Canada (excluding Quebec) or the United States to use {APP_CONFIG.name}.</p>
        <h2 className="text-lg font-semibold text-foreground">2. Account Responsibility</h2>
        <p>You are responsible for maintaining the security of your account and all activities under it.</p>
        <h2 className="text-lg font-semibold text-foreground">3. Listings</h2>
        <p>All listings must be accurate, truthful, and comply with local laws. We reserve the right to remove any listing that violates our policies.</p>
        <h2 className="text-lg font-semibold text-foreground">4. Payments</h2>
        <p>Paid features (boosts, verification) are non-refundable unless otherwise stated. Rent payments are between you and the other party.</p>
        <h2 className="text-lg font-semibold text-foreground">5. Safety</h2>
        <p>{APP_CONFIG.name} is a marketplace platform. We do not guarantee the identity or behavior of any user. Always exercise caution.</p>
        <h2 className="text-lg font-semibold text-foreground">6. Geographic Restrictions</h2>
        <p>This platform is not available in Quebec. Users from Quebec will not be able to create accounts, listings, or access local features.</p>
        <h2 className="text-lg font-semibold text-foreground">7. Termination</h2>
        <p>We may suspend or terminate accounts that violate these terms at our discretion.</p>
        <p className="text-xs text-muted-foreground pt-4">Last updated: March 2026</p>
      </div>
    </div>
  );
}