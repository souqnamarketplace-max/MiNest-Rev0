import React, { useState, useEffect, useRef } from "react";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { getNotifIconConfig } from "@/lib/notificationIcons";
import { Button } from "@/components/ui/button";
import { Bell, Check, X, Settings } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/lib/supabase";

export default function NotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const notifs = await entities.Notification.filter(
        { user_id: user.id },
        '-created_at',
        20
      );
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    } catch {
      // Fail silently
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    fetchNotifications();

    // Use a timestamp to ensure unique channel name and avoid resubscription errors
    const channelName = `notif_${user.id}_${Date.now()}`;
    let channel;
    try {
      channel = supabase
        .channel(channelName)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, () => fetchNotifications())
        .subscribe();
    } catch (err) {
      // Realtime not available - polling fallback handles this silently
    }

    // Fallback polling every 30s
    const poll = setInterval(fetchNotifications, 30000);

    return () => {
      clearInterval(poll);
      if (channel) supabase.removeChannel(channel).catch(() => {});
    };
  }, [user?.id]);

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleMarkRead = async (id) => {
    try {
      await entities.Notification.update(id, { read: true });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => entities.Notification.update(n.id, { read: true })));
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  if (!user) return null;

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        aria-label="Notifications"
        onClick={() => setOpen(o => !o)}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-accent-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-foreground text-sm">Notifications</span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleMarkAllRead}>
                  <Check className="w-3 h-3 mr-1" /> Mark all read
                </Button>
              )}
              <Link to="/notification-preferences" onClick={() => setOpen(false)}>
                <Button variant="ghost" size="icon" aria-label="Notification settings" className="h-7 w-7">
                  <Settings className="w-3.5 h-3.5" />
                </Button>
              </Link>
              <Button variant="ghost" size="icon" aria-label="Close notifications" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                No notifications yet
              </div>
            ) : (
              notifications.map(n => {
                const iconCfg = getNotifIconConfig(n.type);
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors ${!n.read ? 'bg-accent/5' : ''}`}
                    onClick={() => { handleMarkRead(n.id); setOpen(false); if (n.data?.link) navigate(n.data.link); }}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${iconCfg?.bg || 'bg-muted'}`}>
                      <span className="text-sm">{iconCfg?.emoji || '🔔'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-accent mt-1.5 flex-shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
