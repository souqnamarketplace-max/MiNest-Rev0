import React from "react";
import { useImpersonation, stopImpersonation } from "@/lib/impersonation";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Sticky banner shown at the top of the app whenever impersonation is active.
 * Rendered in AppLayout.
 */
export default function ImpersonationBanner() {
  const impersonation = useImpersonation();

  if (!impersonation) return null;

  const handleStop = async () => {
    await stopImpersonation();
    toast.success("Impersonation ended");
    window.location.reload();
  };

  const duration = Math.floor((Date.now() - new Date(impersonation.started_at).getTime()) / 1000);
  const mins = Math.floor(duration / 60);
  const secs = duration % 60;

  return (
    <div className="sticky top-0 z-[60] w-full bg-yellow-400 text-yellow-950 shadow">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <div className="text-xs sm:text-sm min-w-0">
            <span className="font-semibold">IMPERSONATING: </span>
            <span className="font-mono truncate">{impersonation.email}</span>
            <span className="ml-2 text-yellow-900/70 hidden sm:inline">
              · {mins}m {secs}s
            </span>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleStop}
          className="bg-yellow-950/10 hover:bg-yellow-950/20 text-yellow-950 h-7 gap-1"
        >
          <X className="w-3 h-3" />
          <span className="hidden sm:inline">End</span>
        </Button>
      </div>
    </div>
  );
}
