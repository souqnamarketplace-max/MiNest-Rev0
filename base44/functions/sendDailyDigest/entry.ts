/**
 * sendDailyDigest — scheduled job that sends one digest email per user
 * for all queued (daily_digest) notifications from the previous day.
 *
 * Run: daily, e.g. 08:00 UTC
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const BASE_URL = "https://minest.ca";

function buildDigestHtml({ userEmail, items, prefsLink }) {
  const rows = items.map((n) => {
    const link = n.link?.startsWith("http") ? n.link : `${BASE_URL}${n.link || "/dashboard"}`;
    return `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #e2e8f0;">
        <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#0f172a;">${n.title}</p>
        ${n.body ? `<p style="margin:0 0 8px;font-size:13px;color:#64748b;">${n.body}</p>` : ""}
        <a href="${link}" style="font-size:13px;color:#10b981;font-weight:600;text-decoration:none;">View →</a>
      </td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Your MiNest Daily Digest</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:24px 32px;">
        <p style="margin:0;font-size:22px;font-weight:800;color:#fff;"><span style="color:#fff;">Mi</span><span style="color:#10b981;">Nest</span></p>
        <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">Your daily digest</p>
      </td></tr>
      <tr><td style="background:#fff;padding:32px;">
        <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0f172a;">Here's what you missed</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#64748b;">${items.length} update${items.length !== 1 ? "s" : ""} since your last digest.</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${rows}
        </table>
        <table cellpadding="0" cellspacing="0" style="margin-top:28px;"><tr><td>
          <a href="${BASE_URL}/notifications" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:14px 28px;border-radius:8px;">View All Notifications</a>
        </td></tr></table>
      </td></tr>
      <tr><td style="background:#f8fafc;border-radius:0 0 12px 12px;padding:20px 32px;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
          You're receiving this daily digest from MiNest.<br/>
          <a href="${prefsLink}" style="color:#10b981;">Manage preferences</a> · 
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

    // Allow scheduler (no user auth) — verify via admin check or open
    let isAuthorized = false;
    try {
      const user = await base44.auth.me();
      isAuthorized = user?.role === "admin";
    } catch {
      // Scheduled/internal call — allow
      isAuthorized = true;
    }
    if (!isAuthorized) return Response.json({ error: "Forbidden" }, { status: 403 });

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const digestDate = yesterday.toISOString().slice(0, 10);

    // Fetch all notifications queued for digest from yesterday
    const queued = await base44.asServiceRole.entities.Notification.filter({
      delivery_status_email: "queued",
      digest_group: digestDate,
    }, "-created_date", 500);

    if (queued.length === 0) {
      return Response.json({ ok: true, message: "No queued notifications", date: digestDate });
    }

    // Group by user
    const byUser = {};
    for (const n of queued) {
      if (!byUser[n.user_id]) byUser[n.user_id] = [];
      byUser[n.user_id].push(n);
    }

    const prefsLink = `${BASE_URL}/notification-preferences`;
    let digestsSent = 0;
    let errors = 0;

    for (const [userId, items] of Object.entries(byUser)) {
      try {
        // Check user still has email+digest enabled
        const prefList = await base44.asServiceRole.entities.NotificationPreference.filter({ user_id: userId });
        const prefs = prefList[0] || {};
        if (!prefs.email_enabled) {
          // Mark all as skipped
          await Promise.all(items.map((n) =>
            base44.asServiceRole.entities.Notification.update(n.id, { delivery_status_email: "skipped" })
          ));
          continue;
        }

        // Get user email
        const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: userId });
        const email = profiles[0]?.email || userId;

        const html = buildDigestHtml({ userEmail: email, items, prefsLink });

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject: `Your MiNest daily digest — ${items.length} update${items.length !== 1 ? "s" : ""}`,
          body: html,
          from_name: "MiNest",
        });

        // Mark all as sent
        const now = new Date().toISOString();
        await Promise.all(items.map((n) =>
          base44.asServiceRole.entities.Notification.update(n.id, {
            delivery_status_email: "sent",
            email_sent_at: now,
            last_delivery_attempt_at: now,
          })
        ));

        // Single delivery log per user digest
        await base44.asServiceRole.entities.NotificationDeliveryLog.create({
          notification_id: items[0].id,
          user_id: userId,
          channel: "email",
          status: "sent",
          reason: `digest:${digestDate}:${items.length}items`,
          sent_at: now,
        });

        digestsSent++;
      } catch (err) {
        console.error(`Digest failed for ${userId}:`, err.message);
        errors++;
      }
    }

    return Response.json({
      ok: true,
      date: digestDate,
      users_processed: Object.keys(byUser).length,
      digests_sent: digestsSent,
      errors,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});