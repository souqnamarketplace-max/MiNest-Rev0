import React, { useEffect, useRef } from "react";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CheckCheck } from "lucide-react";

export default function MessageThread({ messages, currentUserId, currentUserEmail, otherUserAvatar, otherUserName, isLoading }) {
  const containerRef = useRef(null);

  const scrollToBottom = () => {
    if (!containerRef.current) return;
    setTimeout(() => { containerRef.current.scrollTop = containerRef.current.scrollHeight; }, 50);
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const getMessageDate = (msg) => msg.created_at || msg.created_date || msg.sent_at || "";

  const getDateLabel = (dateStr) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "";
      if (isToday(date)) return "Today";
      if (isYesterday(date)) return "Yesterday";
      return format(date, "EEEE, MMM d");
    } catch { return ""; }
  };

  const getTimeLabel = (msg) => {
    const dateStr = getMessageDate(msg);
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "";
      return format(date, "h:mm a");
    } catch { return ""; }
  };

  const groupedMessages = messages.reduce((acc, msg, idx) => {
    const msgDateStr = getMessageDate(msg);
    const msgDate = msgDateStr ? new Date(msgDateStr).toDateString() : "";
    const prevDateStr = idx > 0 ? getMessageDate(messages[idx - 1]) : "";
    const prevDate = prevDateStr ? new Date(prevDateStr).toDateString() : null;
    if (msgDate && msgDate !== prevDate) acc.push({ type: "date", date: msgDateStr });
    acc.push(msg);
    return acc;
  }, []);

  const isSameSenderAsPrev = (idx) => {
    if (idx <= 0) return false;
    const curr = groupedMessages[idx];
    const prev = groupedMessages[idx - 1];
    if (!curr || !prev || prev.type === "date") return false;
    return (curr.sender_user_id || curr.sender_id) === (prev.sender_user_id || prev.sender_id);
  };

  const otherInitials = (otherUserName || "U").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center bg-muted/20">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto flex items-center justify-center bg-muted/20">
        <div className="text-center px-8">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-foreground mb-1">No messages yet</p>
          <p className="text-sm text-muted-foreground">Say hello and start the conversation!</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-0.5 bg-muted/20">
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-2.5 text-xs text-blue-700 dark:text-blue-300 text-center mb-4 mx-auto max-w-xs">
        For your safety, keep payments and agreements on MiNest.
      </div>

      {groupedMessages.map((item, idx) => {
        if (item.type === "date") {
          return (
            <div key={`date-${idx}`} className="flex justify-center py-3">
              <div className="text-[11px] font-medium text-muted-foreground bg-background border border-border rounded-full px-3 py-1">
                {getDateLabel(item.date)}
              </div>
            </div>
          );
        }

        const msg = item;
        const isOwn = (msg.sender_user_id === currentUserId) || (msg.sender_id === currentUserId) || (msg.sender_user_id === currentUserEmail) || (msg.sender_id === currentUserEmail);
        const sameSender = isSameSenderAsPrev(idx);
        const timeLabel = getTimeLabel(msg);

        return (
          <div key={msg.id || `msg-${idx}`} className={`flex items-end gap-2 ${isOwn ? "justify-end" : "justify-start"} ${sameSender ? "mt-0.5" : "mt-3"}`}>
            {!isOwn && (
              <div className="w-7 flex-shrink-0">
                {!sameSender ? (
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={otherUserAvatar} />
                    <AvatarFallback className="bg-accent/10 text-accent text-[10px] font-semibold">{otherInitials}</AvatarFallback>
                  </Avatar>
                ) : null}
              </div>
            )}

            <div className={`max-w-[75%] sm:max-w-[65%]`}>
              <div className={`px-3.5 py-2 text-[14px] leading-relaxed ${
                isOwn
                  ? "bg-accent text-accent-foreground rounded-2xl rounded-br-md shadow-sm"
                  : "bg-card text-foreground border border-border rounded-2xl rounded-bl-md shadow-sm"
              }`}>
                <p className="whitespace-pre-wrap break-words">{msg.content || msg.text}</p>
              </div>
              {timeLabel && (
                <div className={`flex items-center gap-1 mt-0.5 px-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                  <span className="text-[10px] text-muted-foreground/60">{timeLabel}</span>
                  {isOwn && <CheckCheck className="w-3 h-3 text-accent/50" />}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
