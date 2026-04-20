/**
 * POST /api/notifications/deliver
 * Triggered after a notification is created (via Supabase webhook).
 * Sends email via Resend and optionally queues push notification.
 * Respects user preferences: email on/off, digest mode, quiet hours.
 */
import { getServiceClient } from '../_lib/supabase.js';

const HIGH_PRIORITY = new Set([
  'new_message', 'message_request', 'security_alert',
  'verification_completed', 'verification_failed',
]);

const EMAIL_PREF_MAP = {
  new_message:               'message_email_enabled',
  message_request:           'message_email_enabled',
  message:                   'message_email_enabled',
  saved_search_match:        'saved_search_email_enabled',
  new_matching_listing:      'saved_search_email_enabled',
  similar_listing_available: 'saved_search_email_enabled',
  price_drop_on_favorite:    'favorite_updates_email_enabled',
  favorite_listing_updated:  'favorite_updates_email_enabled',
  listing_expiring_soon:     'listing_alerts_email_enabled',
  listing_expired:           'listing_alerts_email_enabled',
  listing_approved:          'listing_alerts_email_enabled',
  listing_rejected:          'listing_alerts_email_enabled',
  boost_expiring_soon:       'listing_alerts_email_enabled',
  boost_ended:               'listing_alerts_email_enabled',
  verification_completed:    'verification_email_enabled',
  verification_failed:       'verification_email_enabled',
};

const EMAIL_TEMPLATES = {
  saved_search_match:        { ctaText: 'View Listing',       ctaColor: '#10b981' },
  new_matching_listing:      { ctaText: 'View Listing',       ctaColor: '#10b981' },
  similar_listing_available: { ctaText: 'View Listing',       ctaColor: '#10b981' },
  price_drop_on_favorite:    { ctaText: 'View Listing',       ctaColor: '#f97316' },
  favorite_listing_updated:  { ctaText: 'View Listing',       ctaColor: '#10b981' },
  new_message:               { ctaText: 'View Message',       ctaColor: '#3b82f6' },
  message_request:           { ctaText: 'View Message',       ctaColor: '#3b82f6' },
  listing_expiring_soon:     { ctaText: 'Renew Listing',      ctaColor: '#f97316' },
  listing_expired:           { ctaText: 'Renew Listing',      ctaColor: '#f97316' },
  boost_expiring_soon:       { ctaText: 'View Dashboard',     ctaColor: '#f97316' },
  boost_ended:               { ctaText: 'View Dashboard',     ctaColor: '#64748b' },
  listing_approved:          { ctaText: 'View Listing',       ctaColor: '#10b981' },
  listing_rejected:          { ctaText: 'View Dashboard',     ctaColor: '#ef4444' },
  verification_completed:    { ctaText: 'View Status',        ctaColor: '#10b981' },
  verification_failed:       { ctaText: 'Try Again',          ctaColor: '#ef4444' },
  security_alert:            { ctaText: 'Review Account',     ctaColor: '#ef4444' },
};

function shouldSendEmail(type, prefs) {
  if (prefs.email_enabled === false) return false;
  const key = EMAIL_PREF_MAP[type];
  if (key && prefs[key] === false) return false;
  // listing alerts are opt-IN for email
  if (key === 'listing_alerts_email_enabled' && prefs[key] !== true) return false;
  const digestMode = prefs.digest_mode || 'instant';
  if (digestMode === 'important_only' && !HIGH_PRIORITY.has(type)) return false;
  return true;
}

function isInQuietHours(prefs) {
  if (!prefs.quiet_hours_enabled) return false;
  const now = new Date();
  const hhmm = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
  const start = prefs.quiet_hours_start || '22:00';
  const end = prefs.quiet_hours_end || '08:00';
  return start < end ? (hhmm >= start && hhmm < end) : (hhmm >= start || hhmm < end);
}

function buildEmailHtml(title, body, ctaText, ctaColor, fullLink) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:24px 32px;">
  <p style="margin:0;font-size:22px;font-weight:800;color:#fff;">Mi<span style="color:#10b981;">Nest</span></p>
  <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">Smart room &amp; roommate matching</p>
</td></tr>
<tr><td style="background:#fff;padding:32px;">
  <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f172a;">${title}</h2>
  <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.6;">${body || ''}</p>
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
</table></td></tr></table></body></html>`;
}

async function sendEmail(to, subject, html) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.warn('[deliver] RESEND_API_KEY not set — email skipped');
    return { skipped: true, reason: 'no_api_key' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'MiNest <notifications@minest.ca>',
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
  return await res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;

    // Support Supabase webhook format: { record } AND direct: { notification_id }
    const notifId = body.record?.id || body.notification_id;
    if (!notifId) return res.status(400).json({ error: 'notification_id required' });

    const supabase = getServiceClient();

    // Fetch notification
    const { data: notif } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notifId)
      .single();

    if (!notif) return res.status(404).json({ error: 'Notification not found' });

    // Skip if already sent
    if (notif.delivery_status_email === 'sent') {
      return res.status(200).json({ ok: true, status: 'already_sent' });
    }

    // Get user preferences
    const { data: prefRecord } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', notif.user_id)
      .single();

    const prefs = prefRecord || {};
    const type = notif.type;
    const results = { email: 'skipped', push: 'skipped' };

    // ── EMAIL ───────────────────────────────────────────────────────────────
    if (shouldSendEmail(type, prefs)) {
      const digestMode = prefs.digest_mode || 'instant';

      if (digestMode === 'daily_digest' && !HIGH_PRIORITY.has(type)) {
        // Queue for daily digest
        const today = new Date().toISOString().slice(0, 10);
        await supabase.from('notifications').update({
          delivery_status_email: 'queued',
          digest_group: today,
        }).eq('id', notif.id);
        results.email = 'queued_for_digest';
      } else {
        // Send immediately
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email')
          .eq('user_id', notif.user_id)
          .single();

        const emailTo = profile?.email;
        if (!emailTo) {
          results.email = 'skipped_no_email';
        } else {
          const tpl = EMAIL_TEMPLATES[type] || { ctaText: 'View on MiNest', ctaColor: '#10b981' };
          const fullLink = notif.data?.link
            ? (notif.data.link.startsWith('http') ? notif.data.link : `https://minest.ca${notif.data.link}`)
            : 'https://minest.ca/dashboard';

          const html = buildEmailHtml(notif.title, notif.body, tpl.ctaText, tpl.ctaColor, fullLink);
          await sendEmail(emailTo, notif.title, html);

          await supabase.from('notifications').update({
            delivery_status_email: 'sent',
            email_sent_at: new Date().toISOString(),
          }).eq('id', notif.id);

          results.email = 'sent';
        }
      }
    } else {
      await supabase.from('notifications').update({
        delivery_status_email: 'skipped',
      }).eq('id', notif.id);
    }

    // ── PUSH (placeholder — wire up FCM in Phase 5) ─────────────────────────
    if (prefs.push_enabled === true) {
      if (!isInQuietHours(prefs) || HIGH_PRIORITY.has(type)) {
        const { data: tokens } = await supabase
          .from('device_tokens')
          .select('id, device_token, platform')
          .eq('user_id', notif.user_id)
          .eq('is_active', true);

        if (tokens?.length > 0) {
          // TODO: wire up FCM — for now log for development
          console.log(`[deliver] push to ${tokens.length} device(s) for user ${notif.user_id}`);
          results.push = 'pending_fcm_setup';
        } else {
          results.push = 'skipped_no_token';
        }
      } else {
        results.push = 'skipped_quiet_hours';
      }
    }

    return res.status(200).json({ ok: true, notification_id: notifId, results });
  } catch (error) {
    console.error('[notifications/deliver] error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
