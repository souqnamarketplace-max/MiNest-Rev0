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

export default function ShareButton({ path, title = "Check this out on MiNest!" }) {
  const [copied, setCopied] = useState(false);

  const getShareUrl = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}${path}`;
  };

  const handleCopyLink = async () => {
    try {
      const shareUrl = getShareUrl();
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const shareUrl = getShareUrl();

  const handleWhatsApp = () => {
    const text = encodeURIComponent(`${title}\n${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleFacebook = () => {
    const url = encodeURIComponent(shareUrl);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
  };

  const handleTwitter = () => {
    const text = encodeURIComponent(title);
    const url = encodeURIComponent(shareUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  };

  const handleEmail = () => {
    const subject = encodeURIComponent('Check this out on MiNest');
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
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
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
          <Twitter className="w-4 h-4" /> Twitter
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEmail(); }} className="cursor-pointer gap-2">
          <Mail className="w-4 h-4" /> Email
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopyLink(); }} className="cursor-pointer gap-2">
          <Link className="w-4 h-4" /> Copy Link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}