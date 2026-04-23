import React, { useEffect, useRef } from "react";
import { format, isToday, isYesterday } from "date-fns";
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

  const isOwnMessage = (msg) => {
    return (msg.sender_user_id === currentUserId) || (msg.sender_id === currentUserId) ||
           (msg.sender_user_id === currentUserEmail) || (msg.sender_id === currentUserEmail);
  };

  // Build grouped messages with date separators
  const groupedMessages = messages.reduce((acc, msg, idx) => {
    const msgDateStr = getMessageDate(msg);
    const msgDate = msgDateStr ? new Date(msgDateStr).toDateString() : "";
    const prevDateStr = idx > 0 ? getMessageDate(messages[idx - 1]) : "";
    const prevDate = prevDateStr ? new Date(prevDateStr).toDateString() : null;
    if (msgDate && msgDate !== prevDate) acc.push({ type: "date", date: msgDateStr });
    acc.push(msg);
    return acc;
  }, []);

  // Check if consecutive messages are from the same sender (for grouping bubbles)
  const isSameSenderAsPrev = (idx) => {
    if (idx <= 0) return false;
    const curr = groupedMessages[idx];
    const prev = groupedMessages[idx - 1];
    if (!curr || !prev || prev.type === "date") return false;
    return (curr.sender_user_id || curr.sender_id) === (prev.sender_user_id || prev.sender_id);
  };

  const isSameSenderAsNext = (idx) => {
    if (idx >= groupedMessages.length - 1) return false;
    const curr = groupedMessages[idx];
    const next = groupedMessages[idx + 1];
    if (!curr || !next || next.type === "date") return false;
    return (curr.sender_user_id || curr.sender_id) === (next.sender_user_id || next.sender_id);
  };

  const otherInitials = (otherUserName || "U").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-[3px] border-border border-t-accent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto flex items-center justify-center">
        <div className="text-center px-8">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-foreground mb-1">Start the conversation</p>
          <p className="text-sm text-muted-foreground max-w-[240px] mx-auto">Say hello and ask about the listing details, availability, or house rules.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-0.5">
      {/* Safety reminder */}
      <div className="flex justify-center mb-5">
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-xl px-4 py-2 text-[11px] text-blue-600 dark:text-blue-400 text-center max-w-[320px]">
          🔒 For your safety, keep payments and agreements on MiNest.
        </div>
      </div>

      {groupedMessages.map((item, idx) => {
        if (item.type === "date") {
          return (
            <div key={`date-${idx}`} className="flex justify-center py-4">
              <span className="text-[11px] font-medium text-muted-foreground/60 bg-muted/50 rounded-full px-3 py-1">
                {getDateLabel(item.date)}
              </span>
            </div>
          );
        }

        const msg = item;
        const isOwn = isOwnMessage(msg);
        const sameSenderPrev = isSameSenderAsPrev(idx);
        const sameSenderNext = isSameSenderAsNext(idx);
        const timeLabel = getTimeLabel(msg);
        const isLastInGroup = !sameSenderNext;

        // Dynamic border radius for grouped bubbles (WhatsApp-style)
        const ownRadius = sameSenderPrev && sameSenderNext
          ? "rounded-2xl rounded-r-lg"
          : sameSenderPrev
          ? "rounded-2xl rounded-tr-lg rounded-br-md"
          : sameSenderNext
          ? "rounded-2xl rounded-br-lg"
          : "rounded-2xl rounded-br-md";

        const otherRadius = sameSenderPrev && sameSenderNext
          ? "rounded-2xl rounded-l-lg"
          : sameSenderPrev
          ? "rounded-2xl rounded-tl-lg rounded-bl-md"
          : sameSenderNext
          ? "rounded-2xl rounded-bl-lg"
          : "rounded-2xl rounded-bl-md";

        return (
          <div key={msg.id || `msg-${idx}`} className={`flex items-end gap-1.5 ${isOwn ? "justify-end" : "justify-start"} ${sameSenderPrev ? "mt-[2px]" : "mt-3"}`}>
            {/* Other user avatar — only show on last message in a group */}
            {!isOwn && (
              <div className="w-7 flex-shrink-0 mb-5">
                {isLastInGroup ? (
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={otherUserAvatar} />
                    <AvatarFallback className="bg-gradient-to-br from-accent/20 to-accent/5 text-accent text-[10px] font-bold">{otherInitials}</AvatarFallback>
                  </Avatar>
                ) : null}
              </div>
            )}

            <div className="max-w-[75%] sm:max-w-[60%]">
              {/* Message bubble */}
              <div className={`px-3.5 py-2 text-[14px] leading-relaxed ${
                isOwn
                  ? `bg-accent text-accent-foreground ${ownRadius} shadow-sm`
                  : `bg-card text-foreground border border-border/60 ${otherRadius} shadow-sm`
              }`}>
                <p className="whitespace-pre-wrap break-words">{msg.content || msg.text}</p>
              </div>

              {/* Timestamp — only show on last message in group */}
              {isLastInGroup && timeLabel && (
                <div className={`flex items-center gap-1 mt-1 px-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                  <span className="text-[10px] text-muted-foreground/50">{timeLabel}</span>
                  {isOwn && <CheckCheck className="w-3 h-3 text-accent/40" />}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
