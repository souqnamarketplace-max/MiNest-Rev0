import React, { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { entities } from '@/api/entities';
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function VerificationPayment({
  verificationType,
  settings,
  onComplete,
  user,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stripe, setStripe] = useState(null);

  useEffect(() => {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (key) {
      loadStripe(key).then(setStripe).catch(err => console.error("Stripe load error:", err));
    }
  }, []);

  const price = verificationType === "identity" ? settings?.price_cad : settings?.price_cad;

    
  const handlePayment = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!stripe) {
        throw new Error("Stripe is not configured");
      }

      // Verification payment via Stripe (coming soon)
      toast.info("Verification payment coming soon! Your verification request has been submitted for manual review.");
      // Create pending verification record
      await entities.UserVerification.create({
        user_id: user.id,
        verification_type: verificationType,
        status: 'pending',
        document_urls: [],
      });
      onPaymentComplete?.();
      return;
      } catch (err) {
      console.error("Payment error:", err);
      setError(err.message || "Failed to start payment");
      toast.error("Payment error");
    } finally {
      setLoading(false);
    }
  };

  if (!settings) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No verification settings found</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-8 max-w-md mx-auto">
      <h2 className="text-xl font-bold text-foreground mb-4">
        {verificationType === "identity"
          ? "ID Verification"
          : "Background Check"}
      </h2>

      <div className="bg-muted/50 rounded-lg p-6 mb-6">
        <p className="text-sm text-muted-foreground mb-2">Total Price</p>
        <p className="text-3xl font-bold text-accent">
          ${settings.price_cad}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          One-time payment, valid for 1 year
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6 flex gap-3">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="space-y-3 mb-6">
        <h3 className="font-semibold text-foreground text-sm">
          Required Documents:
        </h3>
        <ul className="space-y-2">
          {settings.required_documents?.map((doc) => (
            <li key={doc} className="text-sm text-muted-foreground">
              • {doc}
            </li>
          ))}
        </ul>
      </div>

      <Button
        onClick={handlePayment}
        disabled={loading}
        className="w-full gap-2"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </>
        ) : (
          `Pay $${settings.price_cad}`
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center mt-4">
        Secured by Stripe. Your information is safe with us.
      </p>
    </div>
  );
}