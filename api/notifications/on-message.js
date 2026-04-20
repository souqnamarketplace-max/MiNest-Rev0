/**
 * POST /api/notifications/on-message
 * Called via Supabase webhook when a new message is created.
 * Notifies all conversation participants except the sender.
 * Deduplicates: only one unread notification per conversation per sender.
 */
import { getServiceClient } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;

    // Support Supabase webhook format: { record } AND direct: { message }
    const message = body.record || body.message || body.data;
    if (!message) return res.status(200).json({ skipped: true, reason: 'No message data' });

    const { conversation_id, sender_user_id, content } = message;
    // Support both sender_user_id and sender_id field names
    const senderId = sender_user_id || message.sender_id;

    if (!conversation_id || !senderId) {
      return res.status(200).json({ skipped: true, reason: 'Missing conversation_id or sender' });
    }

    const supabase = getServiceClient();

    // Fetch conversation to get participant_ids
    const { data: convo } = await supabase
      .from('conversations')
      .select('participant_ids, listing_id, listing_title')
      .eq('id', conversation_id)
      .single();

    if (!convo) return res.status(200).json({ skipped: true, reason: 'Conversation not found' });

    // Get sender's display name
    const { data: senderProfile } = await supabase
      .from('user_profiles')
      .select('display_name, full_name')
      .eq('user_id', senderId)
      .single();

    const senderName = senderProfile?.display_name || senderProfile?.full_name || 'Someone';

    const recipients = (convo.participant_ids || []).filter(p => p !== senderId);
    const results = [];
    const now = new Date().toISOString();

    for (const recipientId of recipients) {
      // Check message notification preferences
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('message_alerts_enabled')
        .eq('user_id', recipientId)
        .single();

      if (prefs?.message_alerts_enabled === false) {
        results.push({ recipientId, skipped: true, reason: 'message_alerts_disabled' });
        continue;
      }

      // Dedup: update existing unread notif for this conversation if exists
      // This prevents spam when many messages sent quickly
      const dedupKey = `msg_${conversation_id}_${senderId}_unread`;

      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', recipientId)
        .eq('dedup_key', dedupKey)
        .eq('read', false)
        .single();

      if (existing) {
        // Update existing notification with latest message content
        await supabase.from('notifications').update({
          body: convo.listing_title ? `Re: ${convo.listing_title}` : (content?.slice(0, 80) || 'New message'),
          updated_at: now,
        }).eq('id', existing.id);
        results.push({ recipientId, updated: true, notification_id: existing.id });
      } else {
        // Create new notification
        const { data: notif } = await supabase.from('notifications').insert({
          user_id: recipientId,
          type: 'new_message',
          title: `New message from ${senderName}`,
          body: convo.listing_title ? `Re: ${convo.listing_title}` : (content?.slice(0, 80) || 'You have a new message'),
          read: false,
          dedup_key: dedupKey,
          data: { conversation_id, listing_id: convo.listing_id },
        }).select().single();

        results.push({ recipientId, created: true, notification_id: notif?.id });
      }
    }

    // Send new message email notification
    try {
      const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://minest.ca';
      for (const participantId of otherParticipants) {
        const { data: prefs } = await supabase.from('notification_preferences').select('email_enabled, message_email_enabled').eq('user_id', participantId).single();
        if (prefs?.email_enabled === false || prefs?.message_email_enabled === false) continue;

        const { data: profile } = await supabase.from('user_profiles').select('full_name, email').eq('user_id', participantId).single();
        if (!profile?.email) continue;

        await fetch(`${baseUrl}/api/emails/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'new_message',
            to: profile.email,
            data: {
              recipientName: profile.full_name,
              senderName,
              listingTitle: conversation?.listing_title,
              messagePreview: message_text?.slice(0, 200),
              conversationId: conversation_id,
            },
          }),
        }).catch(() => {});
      }
    } catch (emailErr) {
      console.warn('[on-message] email send failed:', emailErr.message);
    }

    return res.status(200).json({ ok: true, results });
  } catch (error) {
    console.error('[notifications/on-message] error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
