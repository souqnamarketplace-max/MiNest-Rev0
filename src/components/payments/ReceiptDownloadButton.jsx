import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ReceiptDownloadButton({ transaction }) {
  const [loading, setLoading] = useState(false);

  if (!transaction?.id || transaction.status !== "succeeded") {
    return null;
  }

  const handleDownload = async () => {
    toast.info("Receipt downloads coming soon!");
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-xs text-accent hover:text-accent/90 gap-1 h-7 px-2"
      onClick={handleDownload}
      disabled={loading}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
      {loading ? "Preparing..." : "Receipt"}
    </Button>
  );
}