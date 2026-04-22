import React, { useEffect, useRef } from "react";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";

export default function MessageThread({ messages, currentUserEmail, isLoading }) {
  const containerRef = useRef(null);

  const scrollToBottom = (smooth = false) => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getDateLabel = (dateStr) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MMM d, yyyy");
  };

  const groupedMessages = messages.reduce((acc, msg, idx) => {
    const msgDate = new Date(msg.created_date).toDateString();
    const prevDate = idx > 0 ? new Date(messages[idx - 1].created_date).toDateString() : null;
    
    if (msgDate !== prevDate) {
      acc.push({ type: "date", date: msg.created_date });
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
        const isOwn = msg.sender_id === currentUserEmail;

        return (
          <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[70%] sm:max-w-[60%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                isOwn
                  ? "bg-accent text-accent-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              }`}
            >
              <p>{msg.content || msg.text}</p>
              <p className={`text-xs mt-1 opacity-70 ${isOwn ? "" : ""}`}>
                {formatDistanceToNow(new Date(msg.created_date), { addSuffix: false })}
              </p>
            </div>
          </div>
        );
      })}

    </div>
  );
}