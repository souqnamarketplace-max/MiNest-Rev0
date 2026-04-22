import React, { useEffect, useRef } from "react";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";

export default function MessageThread({ messages, currentUserId, currentUserEmail, isLoading }) {
  const containerRef = useRef(null);

  const scrollToBottom = () => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Safely get a date string from a message object
  const getMessageDate = (msg) => msg.created_at || msg.created_date || msg.sent_at || "";

  // Safely format a date label with full error protection
  const getDateLabel = (dateStr) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "";
      if (isToday(date)) return "Today";
      if (isYesterday(date)) return "Yesterday";
      return format(date, "MMM d, yyyy");
    } catch {
      return "";
    }
  };

  // Safely format a relative time
  const getTimeAgo = (msg) => {
    const dateStr = getMessageDate(msg);
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "";
      return formatDistanceToNow(date, { addSuffix: false });
    } catch {
      return "";
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((acc, msg, idx) => {
    const msgDateStr = getMessageDate(msg);
    const msgDate = msgDateStr ? new Date(msgDateStr).toDateString() : "";
    const prevDateStr = idx > 0 ? getMessageDate(messages[idx - 1]) : "";
    const prevDate = prevDateStr ? new Date(prevDateStr).toDateString() : null;

    if (msgDate && msgDate !== prevDate) {
      acc.push({ type: "date", date: msgDateStr });
    }
    acc.push(msg);
    return acc;
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No messages yet</p>
          <p className="text-xs text-muted-foreground mt-1">Start the conversation!</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
      {/* Safety notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 text-center mb-4">
        For your safety, keep payments and agreements on MiNest.
      </div>

      {/* Messages */}
      {groupedMessages.map((item, idx) => {
        if (item.type === "date") {
          return (
            <div key={`date-${idx}`} className="flex justify-center my-4">
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1">
                {getDateLabel(item.date)}
              </div>
            </div>
          );
        }

        const msg = item;
        // Match sender using UUID (sender_user_id) or email (sender_id) for backward compat
        const isOwn = msg.sender_user_id === (currentUserId || currentUserEmail)
          || msg.sender_id === (currentUserId || currentUserEmail);

        return (
          <div key={msg.id || `msg-${idx}`} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[70%] sm:max-w-[60%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                isOwn
                  ? "bg-accent text-accent-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              }`}
            >
              <p>{msg.content || msg.text}</p>
              {getTimeAgo(msg) && (
                <p className="text-xs mt-1 opacity-70">
                  {getTimeAgo(msg)}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
