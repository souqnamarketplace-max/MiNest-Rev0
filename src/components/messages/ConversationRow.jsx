import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

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
      className={`w-full text-left px-4 py-3.5 transition-all duration-150 border-b border-border/30 group ${
        isSelected
          ? "bg-accent/8 border-l-[3px] border-l-accent"
          : "hover:bg-muted/40 border-l-[3px] border-l-transparent"
      }`}
    >
      <div className="flex gap-3 items-center">
        {/* Avatar with online dot */}
        <div className="relative flex-shrink-0">
          <Avatar className={`w-12 h-12 ring-2 ${isSelected ? "ring-accent/30" : "ring-transparent"} transition-all`}>
            <AvatarImage src={other_user_avatar} />
            <AvatarFallback className="bg-gradient-to-br from-accent/20 to-accent/5 text-accent text-sm font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h3 className={`text-[13px] truncate ${isUnread ? "font-bold text-foreground" : "font-medium text-foreground"}`}>
              {primary_title}
            </h3>
            <span className={`text-[11px] flex-shrink-0 ${isUnread ? "text-accent font-semibold" : "text-muted-foreground"}`}>
              {getTimeLabel(last_message_at)}
            </span>
          </div>

          <p className="text-[11px] text-muted-foreground/70 truncate mb-0.5">
            {secondary_title}
          </p>

          <div className="flex items-center justify-between gap-2">
            <p className={`text-xs truncate ${isUnread ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {last_message_text || "No messages yet"}
            </p>

            {/* Unread badge */}
            {isUnread && (
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">
                •
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
