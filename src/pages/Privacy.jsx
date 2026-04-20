import React from "react";
import { APP_CONFIG } from "@/lib/config";

export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-bold text-foreground mb-8">Privacy Policy</h1>
      <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
        <p>{APP_CONFIG.name} is committed to protecting your privacy. This policy explains how we collect, use, and protect your information.</p>
        <h2 className="text-lg font-semibold text-foreground">Information We Collect</h2>
        <p>We collect information you provide (name, email, profile data, listing data) and usage data (page views, search queries, device info).</p>
        <h2 className="text-lg font-semibold text-foreground">How We Use Your Information</h2>
        <p>We use your data to operate the platform, match roommates, improve search results, and communicate with you about your account.</p>
        <h2 className="text-lg font-semibold text-foreground">Data Sharing</h2>
        <p>We do not sell your personal data. We share information only as needed with service providers (hosting, email, payments) and when required by law.</p>
        <h2 className="text-lg font-semibold text-foreground">Your Rights</h2>
        <p>You can access, update, or delete your personal data at any time through your profile settings or by contacting us.</p>
        <h2 className="text-lg font-semibold text-foreground">Cookies</h2>
        <p>We use cookies for authentication and analytics. You can manage cookie preferences in your browser.</p>
        <p className="text-xs text-muted-foreground pt-4">Last updated: March 2026</p>
      </div>
    </div>
  );
}