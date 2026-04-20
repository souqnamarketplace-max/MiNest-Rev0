/**
 * sendNotificationEmail — sends a branded email for a single notification.
 * Called by deliverNotification for instant emails.
 *
 * Payload: { notification_id }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ── Email template builder ────────────────────────────────────────────────────

function getEmailMeta(type, title, body, link) {
  const base = "https://minest.ca";

  const templates = {
    saved_search_match: {
      subject: title || "New room match found",
      preheader: "A new listing matches your saved search",
      ctaText: "View Listing",
      ctaColor: "#10b981",
    },
    new_matching_listing: {
      subject: title || "New room matches your preferences",
      preheader: "Check out this new listing",
      ctaText: "View Listing",
      ctaColor: "#10b981",
    },
    similar_listing_available: {
      subject: "Similar room now available",
      preheader: body || "A similar listing just became available",
      ctaText: "View Listing",
      ctaColor: "#10b981",
    },
    price_drop_on_favorite: {
      subject: "Price dropped on a room you saved",
      preheader: body || "The price just dropped — now's a good time to reach out",
      ctaText: "View Updated Listing",
      ctaColor: "#f97316",
    },
    favorite_listing_updated: {
      subject: "A saved room has been updated",
      preheader: body || "Check the latest changes",
      ctaText: "View Listing",
      ctaColor: "#10b981",
    },
    new_message: {
      subject: title || "You have a new message",
      preheader: body || "Someone sent you a message on MiNest",
      ctaText: "View Message",
      ctaColor: "#3b82f6",
    },
    message_request: {
      subject: title || "New contact request",
      preheader: body || "Someone wants to connect with you",
      ctaText: "View Message",
      ctaColor: "#3b82f6",
    },
    listing_expiring_soon: {
      subject: "Your listing expires soon",
      preheader: body || "Renew your listing to keep it live",
      ctaText: "Renew Listing",
      ctaColor: "#f97316",
    },
    boost_expiring_soon: {
      subject: "Your boost is expiring soon",
      preheader: body || "Your listing boost will end soon",
      ctaText: "View Dashboard",
      ctaColor: "#f97316",
    },
    listing_approved: {
      subject: "Your listing is now live",
      preheader: body || "Your listing has been approved",
      ctaText: "View Listing",
      ctaColor: "#10b981",
    },
    listing_rejected: {
      subject: "Your listing was not approved",
      preheader: body || "Your listing needs attention",
      ctaText: "View Dashboard",
      ctaColor: "#ef4444",
    },
    verification_completed: {
      subject: "Your verification was approved ✓",
      preheader: "Your account is now verified on MiNest",
      ctaText: "View Verification Status",
      ctaColor: "#10b981",
    },
    verification_failed: {
      subject: "Verification could not be completed",
      preheader: body || "Please review your verification documents",
      ctaText: "Try Again",
      ctaColor: "#ef4444",
    },
    security_alert: {
      subject: "⚠️ Security alert on your account",
      preheader: body || "Important security notice from MiNest",
      ctaText: "Review Account",
      ctaColor: "#ef4444",
    },
  };

  const tpl = templates[type] || {
    subject: title || "MiNest Notification",
    preheader: body || "",
    ctaText: "View on MiNest",
    ctaColor: "#10b981",
  };

  const fullLink = link?.startsWith("http") ? link : `${base}${link || "/dashboard"}`;

  return { ...tpl, fullLink };
}

function buildEmailHtml({ title, body, ctaText, ctaColor, fullLink, prefsLink }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <!-- Header -->
      <tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:24px 32px;">
        <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;"><span style="color:#ffffff;">Mi</span><span style="color:#10b981;">Nest</span></p>
        <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">Smart room &amp; roommate matching</p>
      </td></tr>
      <!-- Body -->
      <tr><td style="background:#ffffff;padding:32px;">
        <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f172a;line-height:1.3;">${title}</h2>
        <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.6;">${body || ""}</p>
        <!-- CTA Button -->
        <table cellpadding="0" cellspacing="0"><tr><td>
          <a href="${fullLink}" style="display:inline-block;background:${ctaColor};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:14px 28px;border-radius:8px;">${ctaText}</a>
        </td></tr></table>
        <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;">Or copy this link: <a href="${fullLink}" style="color:#10b981;">${fullLink}</a></p>
      </td></tr>
      <!-- Footer -->
      <tr><td style="background:#f8fafc;border-radius:0 0 12px 12px;padding:20px 32px;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
          You're receiving this because you have notifications enabled on MiNest.<br/>
          <a href="${prefsLink}" style="color:#10b981;">Manage notification preferences</a> · 
          <a href="${prefsLink}" style="color:#10b981;">Unsubscribe</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Internal function — called by deliverNotification (no user session needed)
    const { notification_id } = await req.json();
    if (!notification_id) return Response.json({ error: "notification_id required" }, { status: 400 });

    // Fetch notification
    const notifs = await base44.asServiceRole.entities.Notification.filter({ id: notification_id });
    const notif = notifs[0];
    if (!notif) return Response.json({ error: "Notification not found" }, { status: 404 });

    // Already sent?
    if (notif.delivery_status_email === "sent") {
      return Response.json({ ok: true, status: "already_sent" });
    }

    // Get user email from UserProfile
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: notif.user_id });
    const email = profiles[0]?.email || notif.user_id; // fallback to user_id if it's email

    const { subject, ctaText, ctaColor, fullLink } = getEmailMeta(notif.type, notif.title, notif.body, notif.link);
    const prefsLink = "https://minest.ca/notification-preferences";

    const html = buildEmailHtml({
      title: notif.title,
      body: notif.body,
      ctaText,
      ctaColor,
      fullLink,
      prefsLink,
    });

    // Send via Base44 SendEmail integration
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject,
      body: html,
      from_name: "MiNest",
    });

    // Update delivery status
    await base44.asServiceRole.entities.Notification.update(notif.id, {
      delivery_status_email: "sent",
      email_sent_at: new Date().toISOString(),
      last_delivery_attempt_at: new Date().toISOString(),
    });

    // Delivery log
    await base44.asServiceRole.entities.NotificationDeliveryLog.create({
      notification_id: notif.id,
      user_id: notif.user_id,
      channel: "email",
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    return Response.json({ ok: true, email_sent_to: email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});