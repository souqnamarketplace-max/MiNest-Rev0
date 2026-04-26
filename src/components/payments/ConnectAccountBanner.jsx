// STRIPE_CONNECT_REAL_3_6_1
/**
 * ConnectAccountBanner — landlord Stripe Connect onboarding UI.
 *
 * Three visual states:
 *   1. not_started: "Connect your bank to receive rent payments" + button
 *   2. pending:     "Bank setup in progress" + Continue setup button
 *   3. enabled:     "Bank Connected ✓ Ready to receive rent" + Manage link
 *
 * Connection state comes from /api/stripe/connect/status. We refresh
 * automatically when the user lands on /dashboard?stripe_connect=return
 * (which Stripe redirects to after onboarding).
 *
 * Replaces the legacy stub that showed "Stripe Connect coming soon"
 * toast.
 */
import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { CreditCard, Check, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers = { "Content-Type": "application/json" };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

export default function ConnectAccountBanner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/stripe/connect/status", { method: "GET", headers });
      if (!res.ok) {
        console.warn("[ConnectAccountBanner] status fetch failed:", res.status);
        setStatus({ connected: false });
        return;
      }
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error("[ConnectAccountBanner] status error:", err);
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // If returning from Stripe onboarding, refresh status and clean URL
  useEffect(() => {
    const stripeReturn = searchParams.get("stripe_connect");
    if (stripeReturn === "return" || stripeReturn === "refresh") {
      refreshStatus();
      // Strip the param from the URL so a refresh doesn't re-trigger
      const next = new URLSearchParams(searchParams);
      next.delete("stripe_connect");
      setSearchParams(next, { replace: true });
      if (stripeReturn === "return") {
        toast.success("Welcome back! Refreshing your account status…");
      }
    }
  }, [searchParams, setSearchParams, refreshStatus]);

  const startOnboarding = async () => {
    setActionLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/stripe/connect/onboard", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast.error(data.error || "Failed to start onboarding");
        return;
      }
      // Redirect to Stripe-hosted onboarding
      window.location.href = data.url;
    } catch (err) {
      toast.error("Network error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const continueOnboarding = async () => {
    setActionLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/stripe/connect/refresh-link", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast.error(data.error || "Failed to resume onboarding");
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      toast.error("Network error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-border p-4 flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Checking payment account…</span>
      </div>
    );
  }

  // STATE 3: enabled — fully onboarded
  if (status?.connected && status.charges_enabled && status.payouts_enabled) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-2">
            <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm">Bank Connected</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ready to receive rent payments in {status.country === "US" ? "USD" : "CAD"}.
            </p>
          </div>
          <a
            href="https://dashboard.stripe.com/express"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            Manage <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  // STATE 2: pending — account exists, KYC in progress / restricted
  if (status?.connected) {
    const isRestricted = status.onboarding_status === "restricted";
    const Icon = isRestricted ? AlertCircle : Loader2;
    const iconClass = isRestricted ? "text-amber-600" : "text-blue-600 animate-spin";
    const wrapClass = isRestricted
      ? "border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900"
      : "border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900";

    return (
      <div className={`rounded-lg border p-4 ${wrapClass}`}>
        <div className="flex items-start gap-3">
          <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconClass}`} />
          <div className="flex-1">
            <h3 className="font-semibold text-sm">
              {isRestricted ? "Bank account needs attention" : "Bank setup in progress"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isRestricted
                ? "Stripe needs additional information to enable rent payments. Continue setup to fix."
                : "Stripe is reviewing your account. This usually takes a few minutes."}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={continueOnboarding}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Loading…</>
              ) : (
                <>Continue setup <ExternalLink className="w-3 h-3 ml-1.5" /></>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // STATE 1: not_started — no Connect account at all
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-accent/10 p-2 flex-shrink-0">
          <CreditCard className="w-4 h-4 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Connect your bank to receive rent payments</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Securely receive monthly rent from tenants, directly into your bank account via Stripe.
          </p>
          <Button
            size="sm"
            className="mt-3 gap-1.5"
            onClick={startOnboarding}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Starting…</>
            ) : (
              <><CreditCard className="w-3 h-3" /> Connect Bank Account</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
