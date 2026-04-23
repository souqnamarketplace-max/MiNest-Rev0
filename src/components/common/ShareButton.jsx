import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Check, MessageCircle, Facebook, Twitter, Mail, Link } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Production URL — used for sharing so crawlers can fetch OG tags
const PRODUCTION_URL = "https://minest-xi.vercel.app";

export default function ShareButton({ path, title = "Check this out on MiNest!", description = "" }) {
  const [copied, setCopied] = useState(false);

  const getShareUrl = () => {
    // Always use production URL for sharing (crawlers can't reach localhost)
    const origin = typeof window !== "undefined" && !window.location.hostname.includes("localhost")
      ? window.location.origin
      : PRODUCTION_URL;
    return `${origin}${path}`;
  };

  const shareUrl = getShareUrl();
  const shareText = `${title}\n${shareUrl}`;

  // Try native Web Share API first (works great on mobile)
  const handleNativeShare = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: description || title,
          url: shareUrl,
        });
        return; // Success — native share handled it
      } catch (err) {
        if (err.name === "AbortError") return; // User cancelled
        // Fall through to dropdown
      }
    }
    // If native share isn't available, the dropdown will show via the DropdownMenuTrigger
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  const handleFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(title)}`,
      "_blank",
      "width=600,height=400,menubar=no,toolbar=no"
    );
  };

  const handleTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "width=600,height=400"
    );
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(`${title}\n\n${shareUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="w-9 h-9 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-900 rounded-full shadow-sm"
          onClick={handleNativeShare}
          title="Share"
        >
          {copied ? (
            <Check className="w-4 h-4 text-accent" />
          ) : (
            <Share2 className="w-4 h-4 text-foreground/60 hover:text-foreground/80" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleWhatsApp(); }} className="cursor-pointer gap-2">
          <MessageCircle className="w-4 h-4" /> WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleFacebook(); }} className="cursor-pointer gap-2">
          <Facebook className="w-4 h-4" /> Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleTwitter(); }} className="cursor-pointer gap-2">
          <Twitter className="w-4 h-4" /> X (Twitter)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEmail(); }} className="cursor-pointer gap-2">
          <Mail className="w-4 h-4" /> Email
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopyLink(); }} className="cursor-pointer gap-2">
          <Link className="w-4 h-4" /> {copied ? "Copied!" : "Copy Link"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
