import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function ConversationRow({ conversation, isSelected, onClick, isUnread }) {
  const {
    other_user_avatar,
    other_user_display_name,
    other_user_email,
    primary_title,
    secondary_title,
    last_message_text,
    last_message_at,
  } = conversation;

  const initials = (other_user_display_name || other_user_email)
    ?.split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase() || "U";

  const getTimeLabel = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffMinutes < 1) return "now";
    if (diffMinutes < 60) return `${diffMinutes}m`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 border-b border-border/50 hover:bg-accent/5 transition-colors ${
        isSelected ? "bg-accent/10" : ""
      }`}
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <Avatar className="w-12 h-12 flex-shrink-0">
          <AvatarImage src={other_user_avatar} />
          <AvatarFallback className="bg-accent/10 text-accent text-sm font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className={`text-sm font-semibold truncate ${isUnread ? "text-foreground" : "text-foreground"}`}>
              {primary_title}
            </h3>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {getTimeLabel(last_message_at)}
            </span>
          </div>

          <div className="text-xs text-muted-foreground truncate mb-1">
            {secondary_title}
          </div>

          <div className={`text-xs line-clamp-1 ${isUnread ? "text-foreground font-medium" : "text-muted-foreground"}`}>
            {last_message_text || "No messages yet"}
          </div>
        </div>

        {/* Unread indicator */}
        {isUnread && (
          <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-2" />
        )}
      </div>
    </button>
  );
}