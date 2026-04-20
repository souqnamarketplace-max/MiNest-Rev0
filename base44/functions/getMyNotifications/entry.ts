import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { limit = 10, unread_only = false } = await req.json().catch(() => ({}));

    const query = { user_id: user.email };
    if (unread_only) query.read = { $ne: true };

    const notifications = await base44.asServiceRole.entities.Notification.filter(
      query,
      "-created_date",
      limit
    );

    const allUnread = await base44.asServiceRole.entities.Notification.filter(
      { user_id: user.email, read: { $ne: true } },
      "-created_date",
      200
    );
    const unreadCount = allUnread.length;

    return Response.json({ notifications, unreadCount });
  } catch (error) {
    console.error('[getMyNotifications] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});