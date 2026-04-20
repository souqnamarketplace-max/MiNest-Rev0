/**
 * MiNest Email Templates — Beautiful HTML transactional emails via Resend
 */

const BASE_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://minest.ca';
const GREEN = '#10b981';
const DARK = '#0f172a';

function base({ preheader, body }) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>MiNest</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
  <tr><td style="background:${DARK};border-radius:12px 12px 0 0;padding:22px 32px;">
    <span style="font-size:22px;font-weight:800;color:#fff;">Mi<span style="color:${GREEN};">Nest</span></span>
    <span style="font-size:12px;color:#94a3b8;display:block;margin-top:2px;">Smart room &amp; roommate matching</span>
  </td></tr>
  <tr><td style="background:#fff;padding:36px 32px;">${body}</td></tr>
  <tr><td style="background:#f8fafc;border-radius:0 0 12px 12px;padding:18px 32px;border-top:1px solid #e2e8f0;">
    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
      © MiNest &nbsp;·&nbsp; <a href="${BASE_URL}/notification-preferences" style="color:${GREEN};">Manage preferences</a>
      &nbsp;·&nbsp; <a href="${BASE_URL}/privacy" style="color:${GREEN};">Privacy</a>
    </p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

function btn(text, url, color = GREEN) {
  return `<table cellpadding="0" cellspacing="0" style="margin:28px 0 0;"><tr>
    <td style="background:${color};border-radius:8px;">
      <a href="${url}" style="display:inline-block;padding:13px 30px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;">${text}</a>
    </td></tr></table>
  <p style="margin:10px 0 0;font-size:11px;color:#94a3b8;">Or: <a href="${url}" style="color:${GREEN};">${url}</a></p>`;
}

const hr = `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>`;

// ── 1. WELCOME ────────────────────────────────────────────────────────────────
export function welcomeEmail({ name, userType = 'seeker' }) {
  const first = name?.split(' ')[0] || 'there';
  const isSeeker = userType !== 'lister';
  const steps = isSeeker ? [
    ['🔍','Search listings','Browse verified rooms across Canada and the USA.'],
    ['❤️','Save favourites','Get alerts when new matches appear or prices drop.'],
    ['💬','Message hosts','Chat securely — no phone number needed.'],
    ['📋','Create a profile','Let landlords find YOU based on your lifestyle.'],
  ] : [
    ['📸','Post your room','Add photos and details in under 5 minutes.'],
    ['✅','Get verified','Verified listings get 3× more views.'],
    ['💬','Chat with seekers','Receive messages and viewing requests directly.'],
    ['🤝','Free agreement','Generate a roommate agreement instantly.'],
  ];

  const stepsHtml = steps.map(([e, t, d]) => `
    <tr><td style="padding:10px 0;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td width="36" style="vertical-align:top;padding-top:3px;font-size:20px;">${e}</td>
        <td style="padding-left:10px;">
          <div style="font-size:14px;font-weight:700;color:${DARK};">${t}</div>
          <div style="font-size:13px;color:#64748b;margin-top:2px;">${d}</div>
        </td>
      </tr></table>
    </td></tr>`).join('');

  const cta = isSeeker
    ? btn('Find a Room Now', `${BASE_URL}/search`)
    : btn('Post Your First Room', `${BASE_URL}/create-listing`);

  const body = `
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:${DARK};">Welcome, ${first}! 🏠</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
      Your MiNest account is ready. Here's how to get started:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">${stepsHtml}</table>
    ${cta}
    ${hr}
    <p style="margin:0;font-size:13px;color:#64748b;">Questions? <a href="${BASE_URL}/contact" style="color:${GREEN};">Contact us</a> — we usually respond within a few hours.</p>`;

  return { subject: `Welcome to MiNest, ${first}! 🏠`, html: base({ preheader: 'Your account is ready — let\'s find your perfect match.', body }) };
}

// ── 2. LISTING APPROVED ───────────────────────────────────────────────────────
export function listingApprovedEmail({ name, listingTitle, listingCity, listingSlug, listingId, rentAmount }) {
  const first = name?.split(' ')[0] || 'there';
  const url = `${BASE_URL}/listing/${listingSlug || listingId}`;

  const body = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:52px;">✅</div>
      <h1 style="margin:12px 0 6px;font-size:24px;font-weight:800;color:${DARK};">Your listing is live!</h1>
      <p style="margin:0;font-size:15px;color:#475569;">Great news, ${first}!</p>
    </div>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:18px 22px;margin-bottom:22px;">
      <div style="font-size:16px;font-weight:700;color:${DARK};">${listingTitle}</div>
      <div style="font-size:13px;color:#64748b;margin-top:4px;">📍 ${listingCity}${rentAmount ? ` &nbsp;·&nbsp; 💰 ${rentAmount}/mo` : ''}</div>
    </div>
    <p style="margin:0 0 12px;font-size:14px;color:#475569;line-height:1.6;">Your listing is now visible to thousands of seekers. Tips to get more views:</p>
    <ul style="margin:0 0 4px;padding-left:18px;color:#475569;font-size:14px;line-height:2.2;">
      <li>Add 8+ photos — listings with more photos get 2× more inquiries</li>
      <li>Keep your available date current</li>
      <li>Reply to messages within 24 hours to rank higher in search</li>
    </ul>
    ${btn('View Your Listing', url)}
    ${hr}
    <p style="margin:0;font-size:13px;color:#64748b;">Manage listings from your <a href="${BASE_URL}/dashboard" style="color:${GREEN};">dashboard</a>.</p>`;

  return { subject: `✅ "${listingTitle}" is now live on MiNest!`, html: base({ preheader: 'Your listing is approved and visible to seekers.', body }) };
}

// ── 3. NEW MESSAGE ────────────────────────────────────────────────────────────
export function newMessageEmail({ recipientName, senderName, listingTitle, messagePreview, conversationId }) {
  const first = recipientName?.split(' ')[0] || 'there';
  const url = `${BASE_URL}/messages${conversationId ? `?id=${conversationId}` : ''}`;

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:${DARK};">💬 New message from ${senderName}</h1>
    <p style="margin:0 0 22px;font-size:15px;color:#475569;">
      Hi ${first}! You have a new message${listingTitle ? ` about <strong>${listingTitle}</strong>` : ''}.
    </p>
    <div style="background:#f8fafc;border-left:4px solid ${GREEN};border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:22px;">
      <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">${senderName}</div>
      <div style="font-size:15px;color:#334155;line-height:1.6;font-style:italic;">"${messagePreview ? messagePreview.slice(0, 200) : 'Click to view the message.'}"</div>
    </div>
    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">Replying within 1 hour increases your match rate by 40%.</p>
    ${btn('Reply Now', url, '#3b82f6')}
    ${hr}
    <p style="margin:0;font-size:12px;color:#94a3b8;"><a href="${BASE_URL}/notification-preferences" style="color:${GREEN};">Manage message notifications</a></p>`;

  return { subject: `💬 ${senderName} sent you a message on MiNest`, html: base({ preheader: `${senderName}: ${(messagePreview || '').slice(0, 80)}`, body }) };
}

// ── 4. SAVED SEARCH MATCH ─────────────────────────────────────────────────────
export function savedSearchMatchEmail({ recipientName, searchName, listings = [] }) {
  const first = recipientName?.split(' ')[0] || 'there';
  const count = listings.length;

  const cards = listings.slice(0, 3).map(l => {
    const lUrl = `${BASE_URL}/listing/${l.slug || l.id}`;
    return `<tr><td style="padding:6px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <tr>
          ${l.cover_photo_url ? `<td width="80"><img src="${l.cover_photo_url}" width="80" height="80" alt="" style="display:block;width:80px;height:80px;object-fit:cover;"/></td>` : ''}
          <td style="padding:12px 14px;vertical-align:top;">
            <div style="font-size:14px;font-weight:700;color:${DARK};">${l.title}</div>
            <div style="font-size:12px;color:#64748b;margin-top:3px;">📍 ${l.city}, ${l.province_or_state}</div>
            ${l.rent_amount ? `<div style="font-size:13px;font-weight:700;color:${GREEN};margin-top:4px;">$${l.rent_amount}/mo</div>` : ''}
            <a href="${lUrl}" style="font-size:12px;color:${GREEN};text-decoration:none;margin-top:6px;display:inline-block;">View listing →</a>
          </td>
        </tr>
      </table>
    </td></tr>`;
  }).join('');

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:${DARK};">🔔 ${count} new ${count === 1 ? 'room' : 'rooms'} match your search!</h1>
    <p style="margin:0 0 22px;font-size:15px;color:#475569;line-height:1.6;">
      Hi ${first}! We found <strong>${count} new listing${count !== 1 ? 's' : ''}</strong> matching your saved search <strong>"${searchName}"</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">${cards}</table>
    ${count > 3 ? `<p style="margin:14px 0;font-size:13px;color:#64748b;text-align:center;">+ ${count - 3} more listings available</p>` : ''}
    ${btn(`View All ${count} Matches`, `${BASE_URL}/search`)}
    ${hr}
    <p style="margin:0;font-size:12px;color:#94a3b8;">Alert from saved search "${searchName}". <a href="${BASE_URL}/saved-searches" style="color:${GREEN};">Manage searches</a></p>`;

  return { subject: `🔔 ${count} new room${count !== 1 ? 's' : ''} match "${searchName}"`, html: base({ preheader: `${count} new listing${count !== 1 ? 's' : ''} match your saved search "${searchName}".`, body }) };
}

// ── 5. LISTING REJECTED ───────────────────────────────────────────────────────
export function listingRejectedEmail({ name, listingTitle, reason }) {
  const first = name?.split(' ')[0] || 'there';
  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:${DARK};">Your listing needs attention</h1>
    <p style="margin:0 0 22px;font-size:15px;color:#475569;">Hi ${first}, your listing <strong>"${listingTitle}"</strong> was not approved at this time.</p>
    ${reason ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 20px;margin-bottom:22px;">
      <div style="font-size:12px;font-weight:700;color:#991b1b;margin-bottom:4px;">REASON</div>
      <div style="font-size:14px;color:#7f1d1d;line-height:1.5;">${reason}</div>
    </div>` : ''}
    <p style="margin:0 0 4px;font-size:14px;color:#475569;line-height:1.6;">
      Please review our <a href="${BASE_URL}/acceptable-use" style="color:${GREEN};">listing guidelines</a> and update your listing to resubmit.
    </p>
    ${btn('Edit & Resubmit', `${BASE_URL}/dashboard`, '#ef4444')}
    ${hr}
    <p style="margin:0;font-size:13px;color:#64748b;"><a href="${BASE_URL}/contact" style="color:${GREEN};">Contact support</a> if you need help.</p>`;

  return { subject: `Action required: "${listingTitle}" needs updates`, html: base({ preheader: 'Your listing needs a few updates before it can go live.', body }) };
}

// ── 6. VIEWING REQUEST ────────────────────────────────────────────────────────
export function viewingRequestEmail({ recipientName, requesterName, listingTitle, requestedDate, requestedTime, conversationId }) {
  const first = recipientName?.split(' ')[0] || 'there';
  const url = `${BASE_URL}/messages${conversationId ? `?id=${conversationId}` : ''}`;
  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:${DARK};">📅 New viewing request!</h1>
    <p style="margin:0 0 22px;font-size:15px;color:#475569;">Hi ${first}! <strong>${requesterName}</strong> wants to view <strong>${listingTitle}</strong>.</p>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:18px 22px;margin-bottom:22px;">
      <div style="font-size:13px;font-weight:700;color:#1e40af;margin-bottom:6px;">REQUESTED TIME</div>
      <div style="font-size:18px;font-weight:800;color:${DARK};">📅 ${requestedDate}</div>
      ${requestedTime ? `<div style="font-size:15px;color:#475569;margin-top:4px;">⏰ ${requestedTime}</div>` : ''}
    </div>
    ${btn('Accept or Decline', url, '#3b82f6')}`;

  return { subject: `📅 ${requesterName} wants to view "${listingTitle}"`, html: base({ preheader: `${requesterName} has requested a viewing of your listing.`, body }) };
}
