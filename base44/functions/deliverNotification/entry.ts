/**
 * deliverNotification — triggered after a Notification record is created.
 * Sends email (and optionally push) based on user preferences.
 *
 * Accepts: { notification_id } OR entity automation payload { event, data }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const HIGH_PRIORITY = new Set([
  "new_message", "message_request", "security_alert",
  "verification_completed", "verification_failed"
]);

function getEmailPrefKey(type) {
  if (["new_message", "message_request", "message"].includes(type)) return "message_email_enabled";
  if (["saved_search_match", "new_matching_listing", "similar_listing_available", "listing_match", "verified_listing_match", "strong_profile_match"].includes(type)) return "saved_search_email_enabled";
  if (["price_drop_on_favorite", "favorite_listing_updated"].includes(type)) return "favorite_updates_email_enabled";
  if (["listing_expiring_soon", "listing_expired", "listing_approved", "listing_rejected", "boost_expiring_soon", "boost_ended", "boost_expired", "matching_seeker_available", "listing_getting_views_no_messages"].includes(type)) return "listing_alerts_email_enabled";
  if (["verification_completed", "verification_failed"].includes(type)) return "verification_email_enabled";
  return null; // system / unknown — always send
}

function shouldSendEmail(type, prefs) {
  // Global email toggle — default ON when no prefs record
  if (prefs.email_enabled === false) return false;

  // Type-specific key — if key exists and is explicitly false, skip
  const key = getEmailPrefKey(type);
  if (key !== null && prefs[key] === false) return false;

  // Listing alerts are opt-IN for email — skip unless explicitly enabled
  if (key === "listing_alerts_email_enabled" && prefs[key] !== true) return false;

  // Digest mode filter
  if ((prefs.digest_mode || "instant") === "important_only" && !HIGH_PRIORITY.has(type)) return false;

  return true;
}

function isInQuietHours(prefs) {
  if (!prefs.quiet_hours_enabled) return false;
  const now = new Date();
  const hhmm = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  const start = prefs.quiet_hours_start || "22:00";
  const end = prefs.quiet_hours_end || "08:00";
  return start < end ? (hhmm >= start && hhmm < end) : (hhmm >= start || hhmm < end);
}

function getEmailSubjectAndCta(type, title) {
  const map = {
    saved_search_match:   { subject: title || "New room match found",              ctaText: "View Listing",      ctaColor: "#10b981" },
    new_matching_listing: { subject: title || "New room matches your preferences", ctaText: "View Listing",      ctaColor: "#10b981" },
    price_drop_on_favorite:     { subject: "Price dropped on a saved room",        ctaText: "View Listing",      ctaColor: "#f97316" },
    favorite_listing_updated:   { subject: "A saved room has been updated",        ctaText: "View Listing",      ctaColor: "#10b981" },
    new_message:          { subject: title || "You have a new message",            ctaText: "View Message",      ctaColor: "#3b82f6" },
    message_request:      { subject: title || "New contact request",               ctaText: "View Message",      ctaColor: "#3b82f6" },
    listing_expiring_soon:{ subject: "Your listing expires soon",                  ctaText: "Renew Listing",     ctaColor: "#f97316" },
    boost_expiring_soon:  { subject: "Your boost is expiring soon",                ctaText: "View Dashboard",    ctaColor: "#f97316" },
    listing_approved:     { subject: "Your listing is now live!",                  ctaText: "View Listing",      ctaColor: "#10b981" },
    listing_rejected:     { subject: "Your listing was not approved",              ctaText: "View Dashboard",    ctaColor: "#ef4444" },
    verification_completed:{ subject: "Your verification was approved ✓",          ctaText: "View Status",       ctaColor: "#10b981" },
    verification_failed:  { subject: "Verification could not be completed",        ctaText: "Try Again",         ctaColor: "#ef4444" },
    security_alert:       { subject: "⚠️ Security alert on your account",          ctaText: "Review Account",    ctaColor: "#ef4444" },
    matching_seeker_available:  { subject: title || "New rental application",      ctaText: "View Application",  ctaColor: "#10b981" },
  };
  return map[type] || { subject: title || "MiNest Notification", ctaText: "View on MiNest", ctaColor: "#10b981" };
}

function buildHtml(title, body, ctaText, ctaColor, fullLink) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:24px 32px;">
    <p style="margin:0;font-size:22px;font-weight:800;color:#fff;"><span>Mi</span><span style="color:#10b981;">Nest</span></p>
    <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">Smart room &amp; roommate matching</p>
  </td></tr>
  <tr><td style="background:#ffffff;padding:32px;">
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f172a;">${title}</h2>
    <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.6;">${body || ""}</p>
    <table cellpadding="0" cellspacing="0"><tr><td>
      <a href="${fullLink}" style="display:inline-block;background:${ctaColor};color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:14px 28px;border-radius:8px;">${ctaText}</a>
    </td></tr></table>
    <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;">Or visit: <a href="${fullLink}" style="color:#10b981;">${fullLink}</a></p>
  </td></tr>
  <tr><td style="background:#f8fafc;border-radius:0 0 12px 12px;padding:20px 32px;border-top:1px solid #e2e8f0;">
    <p style="margin:0;font-size:12px;color:#94a3b8;">
      You're receiving this because you have notifications enabled on MiNest.<br/>
      <a href="https://minest.ca/notification-preferences" style="color:#10b981;">Manage preferences</a>
    </p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    console.log("deliverNotification called, body keys:", Object.keys(body));

    // Handle entity automation payload { event, data } OR direct { notification_id }
    const notification_id = (body.event && body.data) ? body.data?.id : body.notification_id;
    if (!notification_id) {
      console.error("No notification_id found in payload:", JSON.stringify(body).slice(0, 200));
      return Response.json({ error: "notification_id required" }, { status: 400 });
    }

    console.log("Processing notification:", notification_id);

    const [notif] = await base44.asServiceRole.entities.Notification.filter({ id: notification_id });
    if (!notif) return Response.json({ error: "Notification not found" }, { status: 404 });

    if (notif.delivery_status_email === "sent") {
      console.log("Already sent, skipping");
      return Response.json({ ok: true, status: "already_sent" });
    }

    const [prefRecord] = await base44.asServiceRole.entities.NotificationPreference.filter({ user_id: notif.user_id });
    const prefs = prefRecord || {};
    const type = notif.type;

    console.log("Notification type:", type, "| prefs found:", !!prefRecord, "| shouldSendEmail:", shouldSendEmail(type, prefs));

    const results = { email: "skipped", push: "skipped" };

    // ── EMAIL ─────────────────────────────────────────────────────────────────
    if (shouldSendEmail(type, prefs)) {
      const digestMode = prefs.digest_mode || "instant";
      const isHigh = HIGH_PRIORITY.has(type);

      if (digestMode === "daily_digest" && !isHigh) {
        const today = new Date().toISOString().slice(0, 10);
        await base44.asServiceRole.entities.Notification.update(notif.id, {
          delivery_status_email: "queued",
          digest_group: today,
          last_delivery_attempt_at: new Date().toISOString(),
        });
        results.email = "queued_for_digest";
        console.log("Queued for daily digest");
      } else {
        const [profile] = await base44.asServiceRole.entities.UserProfile.filter({ user_id: notif.user_id });
        const emailTo = profile?.email || notif.user_id;
        console.log("Sending email to:", emailTo);

        const { subject, ctaText, ctaColor } = getEmailSubjectAndCta(type, notif.title);
        const fullLink = (notif.link?.startsWith("http")) ? notif.link : `https://minest.ca${notif.link || "/dashboard"}`;
        const html = buildHtml(notif.title, notif.body, ctaText, ctaColor, fullLink);

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: emailTo,
          subject,
          body: html,
          from_name: "MiNest",
        });

        await base44.asServiceRole.entities.Notification.update(notif.id, {
          delivery_status_email: "sent",
          email_sent_at: new Date().toISOString(),
          last_delivery_attempt_at: new Date().toISOString(),
        });

        await base44.asServiceRole.entities.NotificationDeliveryLog.create({
          notification_id: notif.id,
          user_id: notif.user_id,
          channel: "email",
          status: "sent",
          sent_at: new Date().toISOString(),
        });

        results.email = "sent";
        console.log("Email sent successfully to:", emailTo);
      }
    } else {
      await base44.asServiceRole.entities.Notification.update(notif.id, {
        delivery_status_email: "skipped",
        last_delivery_attempt_at: new Date().toISOString(),
      });
      console.log("Email skipped for type:", type);
    }

    // ── PUSH ──────────────────────────────────────────────────────────────────
    if (prefs.push_enabled === true) {
      if (!isInQuietHours(prefs) || HIGH_PRIORITY.has(type)) {
        const tokens = await base44.asServiceRole.entities.DeviceToken.filter({ user_id: notif.user_id, is_active: true });
        if (tokens.length > 0) {
          await base44.asServiceRole.functions.invoke("sendPushNotification", {
            notification_id: notif.id,
            tokens: tokens.map(t => ({ id: t.id, token: t.device_token, platform: t.platform })),
          });
          results.push = "sent";
        } else {
          results.push = "skipped_no_token";
        }
      } else {
        results.push = "skipped_quiet_hours";
      }
    }

    return Response.json({ ok: true, notification_id, results });
  } catch (error) {
    console.error("deliverNotification error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});