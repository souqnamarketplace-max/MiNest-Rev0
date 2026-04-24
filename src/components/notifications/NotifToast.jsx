/**
 * NotifToast — subscribes to real-time Notification events
 * and shows a toast for high-priority types.
 */
import { useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { getNotifIconConfig } from "@/lib/notificationIcons";
import { useNavigate } from "react-router-dom";
import { playMessageSound, playNotificationSound } from "@/lib/soundService";
import { supabase } from "@/lib/supabase";

const TOAST_TYPES = new Set([
  "new_message", "message_request", "saved_search_match",
  "similar_listing_available", "favorite_listing_updated",
  "listing_expiring_soon", "listing_approved", "listing_rejected",
  "verification_completed",
]);

const MESSAGE_TYPES = new Set(["new_message", "message_request"]);

export default function NotifToast() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    // Use Supabase Realtime instead of base44 subscribe
    const channel = supabase
      .channel('notif_toast_' + user.id)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new;
          if (!n || n.user_id !== user.id) return;
          if (!TOAST_TYPES.has(n.type)) return;

          const iconCfg = getNotifIconConfig(n.type);

          if (MESSAGE_TYPES.has(n.type)) {
            playMessageSound?.();
          } else {
            playNotificationSound?.();
          }

          toast(n.title || "New notification", {
            description: n.body,
            icon: iconCfg?.emoji || "🔔",
            action: n.data?.link
              ? { label: "View", onClick: () => navigate(n.data.link) }
              : undefined,
          });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel).catch(() => {});
  }, [user?.id, navigate]);

  return null;
}
