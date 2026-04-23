import React, { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { isPushSupported, getPushPermission, requestPushPermission } from "@/lib/pushNotifications";

/**
 * Shows a non-intrusive banner asking users to enable push notifications.
 * Only shows once per session, only if push is supported and permission hasn't been decided.
 */
export default function PushNotificationPrompt() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!isPushSupported()) return;
    
    const permission = getPushPermission();
    const dismissed = sessionStorage.getItem('push-prompt-dismissed');
    
    // Only show if permission hasn't been decided yet and user hasn't dismissed
    if (permission === 'default' && !dismissed) {
      // Delay showing the prompt by 5 seconds so the user settles in first
      const timer = setTimeout(() => setShow(true), 5000);
      return () => clearTimeout(timer);
    }
    
    // If already granted, silently register the token (in case it expired)
    if (permission === 'granted') {
      requestPushPermission(user.id).catch(() => {});
    }
  }, [user]);

  const handleEnable = async () => {
    setRequesting(true);
    const token = await requestPushPermission(user.id);
    if (token) {
      setShow(false);
    }
    setRequesting(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem('push-prompt-dismissed', '1');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-96 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-card border border-border rounded-2xl shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground mb-1">Enable notifications?</p>
            <p className="text-xs text-muted-foreground mb-3">
              Get notified instantly when someone messages you, requests a viewing, or when new rooms match your search.
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-8 text-xs" onClick={handleEnable} disabled={requesting}>
                {requesting ? "Enabling..." : "Enable"}
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={handleDismiss}>
                Not now
              </Button>
            </div>
          </div>
          <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
