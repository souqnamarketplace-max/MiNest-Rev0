/**
 * sendPushNotification — Push delivery adapter.
 * Architecture is provider-agnostic. Swap the adapter section to plug in FCM, APNs, or Web Push.
 *
 * Payload: { notification_id, tokens: [{ id, token, platform }] }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ── Priority ──────────────────────────────────────────────────────────────────
const HIGH_PRIORITY = new Set(["new_message", "message_request", "security_alert", "verification_completed", "verification_failed"]);

function getPriority(type) {
  return HIGH_PRIORITY.has(type) ? "high" : "normal";
}

/**
 * PROVIDER ADAPTER — Replace this with FCM, APNs, or Web Push SDK when ready.
 * Currently logs the payload for development/testing purposes.
 * Returns { success: true, provider: "mock" }
 */
async function sendViaPushProvider(token, platform, payload) {
  // TODO: Replace with real provider
  // Example FCM:
  //   const fcmKey = Deno.env.get("FCM_SERVER_KEY");
  //   const res = await fetch("https://fcm.googleapis.com/fcm/send", {
  //     method: "POST",
  //     headers: { Authorization: `key=${fcmKey}`, "Content-Type": "application/json" },
  //     body: JSON.stringify({ to: token, notification: { title: payload.title, body: payload.body }, data: payload.data }),
  //   });
  //   return res.json();

  // Mock delivery — log and return success
  console.log(`[PUSH:${platform}] token=${token.slice(0, 12)}...`, JSON.stringify(payload));
  return { success: true, provider: "mock" };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let authorized = false;
    try {
      const user = await base44.auth.me();
      authorized = !!user;
    } catch {
      authorized = true;
    }
    if (!authorized) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { notification_id, tokens } = await req.json();
    if (!notification_id || !tokens?.length) {
      return Response.json({ error: "notification_id and tokens required" }, { status: 400 });
    }

    const notifs = await base44.asServiceRole.entities.Notification.filter({ id: notification_id });
    const notif = notifs[0];
    if (!notif) return Response.json({ error: "Notification not found" }, { status: 404 });

    if (notif.delivery_status_push === "sent") {
      return Response.json({ ok: true, status: "already_sent" });
    }

    const payload = {
      title: notif.title,
      body: notif.body || "",
      data: {
        notification_id: notif.id,
        notification_type: notif.type,
        deep_link: notif.link || "/dashboard",
        priority: getPriority(notif.type),
      },
    };

    const sendResults = [];
    for (const t of tokens) {
      const result = await sendViaPushProvider(t.token, t.platform, payload);
      sendResults.push({ token_id: t.id, result });

      // Mark stale tokens inactive if provider says invalid
      if (result.invalid_token) {
        await base44.asServiceRole.entities.DeviceToken.update(t.id, { is_active: false });
      }
    }

    // Update notification delivery status
    await base44.asServiceRole.entities.Notification.update(notif.id, {
      delivery_status_push: "sent",
      push_sent_at: new Date().toISOString(),
      last_delivery_attempt_at: new Date().toISOString(),
    });

    // Delivery log
    await base44.asServiceRole.entities.NotificationDeliveryLog.create({
      notification_id: notif.id,
      user_id: notif.user_id,
      channel: "push",
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    return Response.json({ ok: true, sent: sendResults.length, results: sendResults });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});