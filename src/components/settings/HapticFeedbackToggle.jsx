import React, { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { isHapticEnabled, setHapticEnabled, triggerHaptic, HapticPatterns } from "@/lib/hapticFeedback";
import { Smartphone } from "lucide-react";

export default function HapticFeedbackToggle() {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setEnabled(isHapticEnabled());
    setMounted(true);
  }, []);

  const handleToggle = (checked) => {
    setEnabled(checked);
    setHapticEnabled(checked);
    // Provide feedback on toggle
    if (checked) {
      triggerHaptic(HapticPatterns.SUCCESS, true);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex items-center justify-between py-4 px-4 sm:px-0 bg-card rounded-lg sm:rounded-none border-b border-border sm:border-0">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-accent/10">
          <Smartphone className="w-4 h-4 text-accent" />
        </div>
        <div>
          <Label className="text-sm font-semibold block mb-0.5">Haptic Feedback</Label>
          <p className="text-xs text-muted-foreground">Subtle vibrations on actions</p>
        </div>
      </div>
      <Switch checked={enabled} onCheckedChange={handleToggle} aria-label="Toggle haptic feedback" />
    </div>
  );
}