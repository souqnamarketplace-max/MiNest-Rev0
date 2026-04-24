import React, { useState, useEffect, useCallback } from "react";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { getNotifIconConfig } from "@/lib/notificationIcons";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Bell, Check, Settings, ChevronLeft, ChevronRight
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const PAGE_SIZE = 20;

const EMPTY_MESSAGES = {
  all: { title: "You're all caught up!", body: "No notifications to show right now." },
};

// ── Single notification card ──────────────────────────────────────────────────
function NotifCard({ n, onRead, onDismiss }) {
  const { Icon, color } = getNotifIconConfig(n.type);
  const timeAgo = n.created_date
    ? formatDistanceToNow(new Date(n.created_at || n.created_date), { addSuffix: true })
    : "";

  return (
    <div className={`group relative flex items-start gap-3 p-4 rounded-xl border transition-all ${!n.read ? "bg-accent/5 border-accent/20" : "bg-card border-border"} hover:shadow-sm`}>
      {/* Unread indicator */}
      {!n.read && (
        <div className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-accent rounded-full" />
      )}

      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
      </div>

      {/* Content */}
      <Link
        to={n.link || "/notifications"}
        onClick={() => !n.read && onRead(n.id)}
        className="flex-1 min-w-0"
      >
        <p className={`text-sm leading-snug ${!n.read ? "font-semibold text-foreground" : "text-foreground/80"}`}>
          {n.title}
        </p>
        {n.body && (
          <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
            {n.body}
          </p>
        )}
        <p className="text-xs text-muted-foreground/50 mt-1.5">{timeAgo}</p>
      </Link>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {!n.read && (
          <button
            onClick={() => onRead(n.id)}
            title="Mark as read"
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-accent/10 text-muted-foreground hover:text-accent transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ tab }) {
  const msg = EMPTY_MESSAGES[tab] || EMPTY_MESSAGES.all;
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
        <Bell className="w-7 h-7 text-muted-foreground/30" />
      </div>
      <div>
        <p className="font-semibold text-foreground">{msg.title}</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{msg.body}</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Notifications() {
  const { user, navigateToLogin, logout } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const loadNotifications = useCallback(async (pageNum) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const limit = (pageNum + 1) * PAGE_SIZE + 1;
      const all = await entities.Notification.filter({ user_id: user.id }, '-created_at', limit);
      const unread = all.filter(n => !n.read).length;
      setTotalUnread(unread);
      const skip = pageNum * PAGE_SIZE;
      setNotifications(all.slice(skip, skip + PAGE_SIZE));
      setHasMore(all.length > skip + PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setPage(0);
    loadNotifications(0);
  }, []);

  useEffect(() => {
    loadNotifications(page);
  }, [page]);



  const handleRead = async (id) => {
    await entities.Notification.update(id, { read: true });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setTotalUnread((c) => Math.max(0, c - 1));
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(unread.map((n) => entities.Notification.update(n.id, { read: true })));
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setTotalUnread(0);
  };



  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          {totalUnread > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {totalUnread} unread notification{totalUnread !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {totalUnread > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-1.5 text-xs">
              <Check className="w-3.5 h-3.5" /> Mark all read
            </Button>
          )}
          <Link to="/notification-preferences">
            <Button variant="ghost" size="icon" aria-label="Notification settings">
              <Settings className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>



      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState tab="all" />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <NotifCard key={n.id} n={n} onRead={handleRead} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {(page > 0 || hasMore) && !loading && notifications.length > 0 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page + 1}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
            className="gap-1"
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}