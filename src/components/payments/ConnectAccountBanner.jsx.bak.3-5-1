/**
 * Shown to homeowners who haven't connected their Stripe account yet.
 * Also shows the current onboarding status if in progress.
 */
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { AlertCircle, CheckCircle2, Loader2, ExternalLink, CreditCard, Edit3, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function ConnectAccountBanner({ status, onStatusChange }) {
  const { user, navigateToLogin, logout } = useAuth();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = async () => {
    toast.info("Stripe Connect coming soon! Payment collection will be enabled after setup.");
    setLoading(false);
  };

  const handleDisconnect = async () => {
    toast.info("Stripe Connect coming soon!");
    setDisconnecting(false);
  };

  if (status === "completed") {
    return (
      <div className={`flex items-center gap-3 rounded-xl p-4 border transition-all ${
        disconnecting 
          ? "bg-muted/50 border-border opacity-60" 
          : "bg-accent/5 border-accent/20"
      }`}>
        {disconnecting ? (
          <Loader2 className="w-5 h-5 text-accent flex-shrink-0 animate-spin" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {disconnecting ? "Disconnecting..." : "Payment account connected"}
          </p>
          <p className="text-xs text-muted-foreground">
            {disconnecting ? "Your payment account is being disconnected." : "You can receive rent payments directly to your bank."}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={handleConnect}
            disabled={loading || disconnecting}
            title="Update account details"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Edit3 className="w-3.5 h-3.5" />}
            Update
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive border-destructive hover:bg-destructive/5 gap-1"
            onClick={handleDisconnect}
            disabled={disconnecting || loading}
            title="Disconnect Stripe account"
          >
            {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            {disconnecting ? "Disconnecting..." : "Disconnect"}
          </Button>
        </div>
      </div>
    );
  }

  if (status === "requires_attention") {
    return (
      <div className="flex items-start gap-3 bg-destructive/5 border border-destructive/20 rounded-xl p-4">
        <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Action required on your Stripe account</p>
          <p className="text-xs text-muted-foreground mb-3">Please complete your account setup to receive payments.</p>
          <Button size="sm" onClick={handleConnect} disabled={loading} className="gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
            Fix Account
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 bg-muted/50 border border-border rounded-xl p-4">
      <CreditCard className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Connect your bank to receive rent payments</p>
        <p className="text-xs text-muted-foreground mb-3">Securely receive monthly rent from tenants, directly into your bank account via Stripe.</p>
        <Button size="sm" onClick={handleConnect} disabled={loading} className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
          {status === "in_progress" ? "Continue Setup" : "Connect Bank Account"}
        </Button>
      </div>
    </div>
  );
}