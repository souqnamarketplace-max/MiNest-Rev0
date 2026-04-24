import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";

import { LogIn } from "lucide-react";

export default function SignInRequiredModal({ open, onOpenChange, title, description, listingId, action }) {
  const { navigateToLogin } = useAuth();
  const handleSignIn = () => {
    const returnUrl = `${window.location.origin}/listing/${listingId}?action=${action}&source=signin`;
    navigateToLogin(returnUrl);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSignIn}
            className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
          >
            <LogIn className="w-4 h-4 mr-2" /> Sign In / Create Account
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}