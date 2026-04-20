/**
 * GET /api/notifications/list
 * Returns paginated notifications for the authenticated user.
 * Replaces the old base44 getMyNotifications function.
 */
import { getServiceClient, getAuthUser } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const supabase = getServiceClient();
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const unreadOnly = req.query.unread_only === 'true';
    const page = Number(req.query.page) || 0;

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(page * limit, page * limit + limit - 1);

    if (unreadOnly) query = query.eq('read', false);

    const { data: notifications, count, error } = await query;
    if (error) throw error;

    // Get unread count separately
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    return res.status(200).json({
      notifications: notifications || [],
      unreadCount: unreadCount || 0,
      total: count || 0,
      page,
      hasMore: (page + 1) * limit < (count || 0),
    });
  } catch (error) {
    console.error('[notifications/list] error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
