/**
 * Admin Email Test Page — /admin/email-test
 * Lets admin send test emails for each template
 */
import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { entities } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, Loader2, CheckCircle2, Shield } from "lucide-react";
import { Navigate } from "react-router-dom";

const TEMPLATES = [
  {
    type: "welcome",
    label: "👋 Welcome Email",
    desc: "Sent when a user signs in for the first time",
    data: (email, name) => ({ name, userType: "seeker" }),
  },
  {
    type: "listing_approved",
    label: "✅ Listing Approved",
    desc: "Sent when admin approves a listing",
    data: (email, name) => ({
      name, listingTitle: "Bright Private Room Near Downtown Toronto",
      listingCity: "Toronto, Ontario", listingSlug: "test",
      rentAmount: "$1,450",
    }),
  },
  {
    type: "listing_rejected",
    label: "❌ Listing Rejected",
    desc: "Sent when admin rejects a listing with reason",
    data: (email, name) => ({
      name, listingTitle: "Cozy Room in Vancouver",
      reason: "Photos are too blurry. Please upload clear, well-lit photos of the room.",
    }),
  },
  {
    type: "new_message",
    label: "💬 New Message",
    desc: "Sent when someone sends you a message",
    data: (email, name) => ({
      recipientName: name, senderName: "Alex Johnson",
      listingTitle: "Bright Private Room Near Downtown Toronto",
      messagePreview: "Hi! I'm interested in the room. Is it still available? I can move in next month.",
      conversationId: "test-123",
    }),
  },
  {
    type: "saved_search_match",
    label: "🔔 Saved Search Match",
    desc: "Sent when new listings match a saved search",
    data: (email, name) => ({
      recipientName: name, searchName: "Calgary rooms under $1,200",
      listings: [
        { id: "1", title: "Spacious Room in Beltline", city: "Calgary", province_or_state: "Alberta", rent_amount: 1100, cover_photo_url: null },
        { id: "2", title: "Private Room Near LRT", city: "Calgary", province_or_state: "Alberta", rent_amount: 950, cover_photo_url: null },
        { id: "3", title: "Furnished Room – Utilities Included", city: "Calgary", province_or_state: "Alberta", rent_amount: 1150, cover_photo_url: null },
      ],
    }),
  },
  {
    type: "viewing_request",
    label: "📅 Viewing Request",
    desc: "Sent when someone requests to view your listing",
    data: (email, name) => ({
      recipientName: name, requesterName: "Sarah Lee",
      listingTitle: "Bright Private Room Near Downtown Toronto",
      requestedDate: "Saturday, April 26, 2025",
      requestedTime: "2:00 PM",
      conversationId: "test-456",
    }),
  },
];

export default function AdminEmailTest() {
  const { user } = useAuth();
  const [testEmail, setTestEmail] = useState("souqnamarketplace@gmail.com");
  const [sending, setSending] = useState(null);
  const [sent, setSent] = useState({});

  const { data: adminProfile } = useQuery({
    queryKey: ["admin-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const profiles = await entities.UserProfile.filter({ user_id: user.id });
      return profiles[0] || null;
    },
    enabled: !!user?.id,
  });

  if (!user) return <Navigate to="/login" replace />;
  if (adminProfile && !adminProfile.is_admin) return <Navigate to="/" replace />;

  const handleSend = async (template) => {
    if (!testEmail.trim()) { toast.error("Enter a test email first"); return; }
    setSending(template.type);
    try {
      const name = adminProfile?.full_name || "Test User";
      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: template.type,
          to: testEmail.trim(),
          data: template.data(testEmail, name),
        }),
      });
      const result = await res.json();
      if (result.ok || result.skipped) {
        setSent(prev => ({ ...prev, [template.type]: true }));
        toast.success(result.skipped
          ? "⚠️ Skipped — RESEND_API_KEY not set on server (works after Vercel deploy)"
          : `✅ Email sent to ${testEmail}!`
        );
      } else {
        toast.error(result.error || "Failed to send");
      }
    } catch (err) {
      toast.error("API not available in dev mode — deploy to Vercel first");
    } finally {
      setSending(null);
    }
  };

  const handleSendAll = async () => {
    for (const template of TEMPLATES) {
      await handleSend(template);
      await new Promise(r => setTimeout(r, 800)); // Rate limit
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <Mail className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Email Template Tester</h1>
          <p className="text-sm text-muted-foreground">Send test emails to verify all templates look correct</p>
        </div>
      </div>

      {/* Test email input */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <label className="text-sm font-semibold block mb-2">Send test emails to:</label>
        <div className="flex gap-2">
          <Input
            type="email"
            value={testEmail}
            onChange={e => setTestEmail(e.target.value)}
            placeholder="test@example.com"
            className="flex-1"
          />
          <Button onClick={handleSendAll} disabled={!!sending} className="bg-accent text-white gap-2 whitespace-nowrap">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Send All 6
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          ⚠️ Email sending only works after deploying to Vercel with RESEND_API_KEY set.
          In local dev, it will show "skipped".
        </p>
      </div>

      {/* Template list */}
      <div className="space-y-3">
        {TEMPLATES.map(template => (
          <div key={template.type} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">{template.label}</span>
                {sent[template.type] && (
                  <Badge className="bg-green-100 text-green-700 text-xs gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Sent
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{template.desc}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={sending === template.type}
              onClick={() => handleSend(template)}
              className="flex-shrink-0 gap-1.5"
            >
              {sending === template.type
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Mail className="w-3.5 h-3.5" />}
              Send Test
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 font-semibold text-foreground mb-2">
          <Shield className="w-4 h-4 text-accent" /> How emails are triggered in production
        </div>
        <ul className="space-y-1.5 text-xs">
          <li>👋 <strong>Welcome</strong> — automatically on first sign-in</li>
          <li>✅ <strong>Listing Approved/Rejected</strong> — when admin moderates in <a href="/admin" className="text-accent">Admin Panel</a></li>
          <li>💬 <strong>New Message</strong> — via Supabase webhook → /api/notifications/on-message</li>
          <li>🔔 <strong>Saved Search Match</strong> — via Supabase webhook → /api/listings/activated</li>
          <li>📅 <strong>Viewing Request</strong> — when tenant submits viewing request</li>
        </ul>
      </div>
    </div>
  );
}
