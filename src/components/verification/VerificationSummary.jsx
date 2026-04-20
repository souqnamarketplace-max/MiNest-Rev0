import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock } from "lucide-react";

export default function VerificationSummary({
  verification,
  settings,
  onBack,
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-8 max-w-2xl mx-auto">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
          <Clock className="w-6 h-6 text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Documents Submitted
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Thank you for submitting your documents. Our team will review them shortly.
          </p>
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-6 space-y-4 mb-8">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
            Verification Type
          </p>
          <p className="font-medium text-foreground capitalize">
            {verification?.verification_type}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
            Status
          </p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <p className="font-medium text-foreground">Under Review</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
            Documents Submitted
          </p>
          <div className="space-y-2">
            {verification?.documents?.map((doc, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-accent flex-shrink-0" />
                <span className="text-foreground capitalize">
                  {doc.type.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
            Expected Review Time
          </p>
          <p className="font-medium text-foreground">24-48 hours</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <p className="text-sm text-blue-900">
          You'll receive an email notification once your verification is approved or if we need any additional information.
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          Back
        </Button>
        <Button className="flex-1">Continue</Button>
      </div>
    </div>
  );
}