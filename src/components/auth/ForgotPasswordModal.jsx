import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

/**
 * ForgotPasswordModal — self-contained modal for requesting a password reset.
 * Accepts an optional initial email (e.g. pre-filled from the Login form).
 *
 * Usage:
 *   <ForgotPasswordModal open={open} onOpenChange={setOpen} defaultEmail={email} />
 */
export default function ForgotPasswordModal({ open, onOpenChange, defaultEmail = "" }) {
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // Reset state when modal opens with a new default email
  React.useEffect(() => {
    if (open) {
      setEmail(defaultEmail);
      setSent(false);
    }
  }, [open, defaultEmail]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast.error("Please enter your email address.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(trimmed)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      // Don't reveal whether the email exists (security best practice) —
      // Supabase already does this, we just show success either way
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        {sent ? (
          <>
            <DialogHeader>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <DialogTitle>Check your inbox</DialogTitle>
              <DialogDescription>
                If an account exists for <strong>{email}</strong>, you'll receive an email
                with a link to reset your password. The link expires in 1 hour.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <p className="text-xs text-muted-foreground">
                Didn't get the email? Check your spam folder, or wait a minute and try again.
              </p>
              <Button onClick={() => onOpenChange(false)} className="w-full">
                Close
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-2">
                <Mail className="w-6 h-6 text-accent" />
              </div>
              <DialogTitle>Reset your password</DialogTitle>
              <DialogDescription>
                Enter the email address you used to sign up, and we'll send you a link
                to reset your password.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3 mt-2">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                disabled={loading}
                required
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
                  ) : (
                    "Send reset link"
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
