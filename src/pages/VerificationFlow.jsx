import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import VerificationPayment from "@/components/verification/VerificationPayment";
import VerificationDocuments from "@/components/verification/VerificationDocuments";
import VerificationSummary from "@/components/verification/VerificationSummary";

export default function VerificationFlow() {
  const { user, navigateToLogin, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const verificationType = searchParams.get("type") || "identity";

  const [step, setStep] = useState("payment"); // payment, documents, review, complete
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;
    loadVerificationData();
  }, [user, verificationType]);

  const loadVerificationData = async () => {
    try {
      setLoading(true);
      // Check if user already has this verification
      const existing = await entities.UserVerification.filter({
        user_id: user.id,
        verification_type: verificationType,
      });

      if (existing.length > 0) {
        setVerification(existing[0]);
        if (existing[0].status === "approved") {
          setStep("complete");
        } else if (existing[0].payment_status === "completed") {
          setStep("documents");
        }
      }

      // Get settings
      const verifySettings = await entities.VerificationSettings.filter({
        verification_type: verificationType,
      });
      if (verifySettings.length > 0) {
        setSettings(verifySettings[0]);
      }
    } catch (err) {
      console.error("Failed to load verification data:", err);
      setError("Failed to load verification details");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentComplete = (sessionId, intentId) => {
    setVerification((prev) => ({
      ...prev,
      payment_session_id: sessionId,
      stripe_payment_intent_id: intentId,
      payment_status: "completed",
    }));
    setStep("documents");
  };

  const handleDocumentsSubmit = async (documents) => {
    try {
      setLoading(true);
      const updatedVerification = {
        ...verification,
        documents,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      };

      if (verification && verification.id) {
        await entities.UserVerification.update(verification.id, updatedVerification);
      } else {
        const newVerif = await entities.UserVerification.create({
          user_id: user.id,
          verification_type: verificationType,
          ...updatedVerification,
        });
        setVerification(newVerif);
      }

      setStep("review");
    } catch (err) {
      console.error("Failed to submit documents:", err);
      setError("Failed to submit documents");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-accent" />
          <p className="text-muted-foreground">Loading verification...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-9 w-9"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground capitalize">
              {verificationType} Verification
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Build trust with our community
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Steps */}
        <div className="flex gap-2 mb-8">
          {["payment", "documents", "review", "complete"].map((s, idx) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                  step === s
                    ? "bg-accent text-accent-foreground"
                    : ["documents", "review", "complete"].includes(step) &&
                        ["documents", "review", "complete"].includes(s)
                      ? "bg-accent/20 text-accent"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {idx + 1}
              </div>
              {idx < 3 && (
                <div
                  className={`h-1 flex-1 ${
                    ["documents", "review", "complete"].includes(step) &&
                    ["documents", "review", "complete"].includes(s)
                      ? "bg-accent/20"
                      : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        {step === "payment" && (
          <VerificationPayment
            verificationType={verificationType}
            settings={settings}
            onComplete={handlePaymentComplete}
            user={user}
          />
        )}

        {step === "documents" && (
          <VerificationDocuments
            verificationType={verificationType}
            settings={settings}
            onSubmit={handleDocumentsSubmit}
            loading={loading}
          />
        )}

        {step === "review" && (
          <VerificationSummary
            verification={verification}
            settings={settings}
            onBack={() => setStep("documents")}
          />
        )}

        {step === "complete" && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-accent" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Verification Approved!
            </h2>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Your {verificationType} verification has been approved. You now have a verified badge on your profile.
            </p>
            <Button onClick={() => navigate("/profile")} className="gap-2">
              View Your Profile
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}