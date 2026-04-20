/**
 * POST /api/emails/send
 * Sends transactional emails via Resend using our templates.
 * Called internally by other API functions.
 *
 * Body: { type, to, data }
 * Types: welcome | listing_approved | listing_rejected | new_message | saved_search_match | viewing_request
 */
import {
  welcomeEmail,
  listingApprovedEmail,
  listingRejectedEmail,
  newMessageEmail,
  savedSearchMatchEmail,
  viewingRequestEmail,
} from './templates.js';

const FROM = 'MiNest <notifications@minest.ca>';

async function sendViaResend(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[emails/send] RESEND_API_KEY not set — skipping');
    return { skipped: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend ${res.status}: ${err}`);
  }
  return res.json();
}

const TEMPLATES = {
  welcome:            welcomeEmail,
  listing_approved:   listingApprovedEmail,
  listing_rejected:   listingRejectedEmail,
  new_message:        newMessageEmail,
  saved_search_match: savedSearchMatchEmail,
  viewing_request:    viewingRequestEmail,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, to, data = {} } = req.body || {};

  if (!type || !to) return res.status(400).json({ error: 'type and to are required' });

  const templateFn = TEMPLATES[type];
  if (!templateFn) return res.status(400).json({ error: `Unknown template: ${type}` });

  try {
    const { subject, html } = templateFn(data);
    const result = await sendViaResend(to, subject, html);
    console.log(`[emails/send] ${type} → ${to}: ${result.skipped ? 'skipped' : 'sent'}`);
    return res.status(200).json({ ok: true, type, to, result });
  } catch (err) {
    console.error('[emails/send] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
