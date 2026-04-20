/**
 * GET /api/cron/daily-digest
 * Runs daily via Vercel Cron.
 * Sends one digest email per user for all queued notifications from yesterday.
 * Skips users who have disabled email or have no queued notifications.
 */
import { getServiceClient } from '../_lib/supabase.js';

const BASE_URL = 'https://minest.ca';

function buildDigestHtml(items) {
  const rows = items.map(n => {
    const link = n.data?.link
      ? (n.data.link.startsWith('http') ? n.data.link : `${BASE_URL}${n.data.link}`)
      : `${BASE_URL}/dashboard`;
    return `<tr><td style="padding:16px 0;border-bottom:1px solid #e2e8f0;">
      <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#0f172a;">${n.title}</p>
      ${n.body ? `<p style="margin:0 0 8px;font-size:13px;color:#64748b;">${n.body}</p>` : ''}
      <a href="${link}" style="font-size:13px;color:#10b981;font-weight:600;text-decoration:none;">View →</a>
    </td></tr>`;
  }).join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Your MiNest Daily Digest</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:24px 32px;">
  <p style="margin:0;font-size:22px;font-weight:800;color:#fff;">Mi<span style="color:#10b981;">Nest</span></p>
  <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">Your daily digest</p>
</td></tr>
<tr><td style="background:#fff;padding:32px;">
  <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0f172a;">Here's what you missed</h2>
  <p style="margin:0 0 24px;font-size:14px;color:#64748b;">${items.length} update${items.length !== 1 ? 's' : ''} since your last digest.</p>
  <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
  <table cellpadding="0" cellspacing="0" style="margin-top:28px;"><tr><td>
    <a href="${BASE_URL}/notifications" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:14px 28px;border-radius:8px;">View All Notifications</a>
  </td></tr></table>
</td></tr>
<tr><td style="background:#f8fafc;border-radius:0 0 12px 12px;padding:20px 32px;border-top:1px solid #e2e8f0;">
  <p style="margin:0;font-size:12px;color:#94a3b8;">
    You're receiving this daily digest from MiNest.<br/>
    <a href="${BASE_URL}/notification-preferences" style="color:#10b981;">Manage preferences</a>
  </p>
</td></tr>
</table></td></tr></table></body></html>`;
}

async function sendEmail(to, subject, html) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.warn('[daily-digest] RESEND_API_KEY not set — email skipped');
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
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const supabase = getServiceClient();

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const digestDate = yesterday.toISOString().slice(0, 10);

    // Fetch all queued notifications from yesterday — paginated
    let allQueued = [];
    let page = 0;
    while (true) {
      const { data: batch } = await supabase
        .from('notifications')
        .select('id, user_id, type, title, body, data')
        .eq('delivery_status_email', 'queued')
        .eq('digest_group', digestDate)
        .order('created_at', { ascending: true })
        .range(page * 500, page * 500 + 499);

      if (!batch?.length) break;
      allQueued = allQueued.concat(batch);
      if (batch.length < 500) break;
      page++;
    }

    if (allQueued.length === 0) {
      return res.status(200).json({ ok: true, message: 'No queued notifications', date: digestDate });
    }

    // Group by user
    const byUser = {};
    for (const n of allQueued) {
      if (!byUser[n.user_id]) byUser[n.user_id] = [];
      byUser[n.user_id].push(n);
    }

    let digestsSent = 0;
    let skipped = 0;
    let errors = 0;
    const now = new Date().toISOString();

    for (const [userId, items] of Object.entries(byUser)) {
      try {
        // Check user still has email enabled
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('email_enabled')
          .eq('user_id', userId)
          .single();

        if (prefs?.email_enabled === false) {
          // Mark as skipped
          await supabase.from('notifications')
            .update({ delivery_status_email: 'skipped' })
            .in('id', items.map(n => n.id));
          skipped++;
          continue;
        }

        // Get user email
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email')
          .eq('user_id', userId)
          .single();

        const email = profile?.email;
        if (!email) { skipped++; continue; }

        const html = buildDigestHtml(items);
        const subject = `Your MiNest daily digest — ${items.length} update${items.length !== 1 ? 's' : ''}`;

        await sendEmail(email, subject, html);

        // Mark all as sent
        await supabase.from('notifications')
          .update({ delivery_status_email: 'sent', email_sent_at: now })
          .in('id', items.map(n => n.id));

        digestsSent++;
      } catch (err) {
        console.error(`[daily-digest] failed for user ${userId}:`, err.message);
        errors++;
      }
    }

    console.log(`[daily-digest] date=${digestDate} sent=${digestsSent} skipped=${skipped} errors=${errors}`);
    return res.status(200).json({
      ok: true, date: digestDate,
      users_processed: Object.keys(byUser).length,
      digests_sent: digestsSent,
      skipped, errors,
    });
  } catch (error) {
    console.error('[daily-digest] error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
