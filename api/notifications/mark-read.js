/**
 * POST /api/notifications/mark-read
 * Marks one or all notifications as read for the authenticated user.
 * Body: { notification_id } OR { all: true }
 */
import { getServiceClient, getAuthUser } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const supabase = getServiceClient();
    const { notification_id, all } = req.body;

    if (all) {
      // Mark all as read
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;
      return res.status(200).json({ ok: true, marked: 'all' });
    }

    if (!notification_id) {
      return res.status(400).json({ error: 'notification_id or all:true required' });
    }

    // Mark single notification — verify ownership
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notification_id)
      .eq('user_id', user.id); // security: only mark own notifications

    if (error) throw error;
    return res.status(200).json({ ok: true, notification_id });
  } catch (error) {
    console.error('[notifications/mark-read] error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
