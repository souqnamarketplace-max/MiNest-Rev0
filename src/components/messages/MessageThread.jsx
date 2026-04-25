import React, { useEffect, useRef } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CheckCheck, Trash2, FileText, ChevronRight, CheckCircle2, XCircle, Clock, RefreshCw, Flag } from "lucide-react";
import { Link } from "react-router-dom";
import { isSystemMessage, parseSystemMessage } from "@/lib/conversationSystemMessages";

/**
 * Card-style render for a system message inside the thread.
 * Each variant has a clear visual marker + an action link when relevant.
 */
function SystemMessageCard({ type, payload, time }) {
  const num = payload?.agreement_number != null
    ? `#${String(payload.agreement_number).padStart(4, "0")}`
    : null;
  const link = payload?.agreement_id
    ? `/rentals/${payload.agreement_id}`
    : null;

  const variants = {
    rental_offer_sent: {
      Icon: FileText,
      iconCls: "text-accent bg-accent/10",
      title: "Rental offer sent",
      cta: link ? "View agreement" : null,
    },
    rental_offer_signed: {
      Icon: CheckCircle2,
      iconCls: "text-emerald-700 bg-emerald-50",
      title: "Rental agreement signed",
      cta: link ? "View agreement" : null,
    },
    rental_offer_declined: {
      Icon: XCircle,
      iconCls: "text-red-700 bg-red-50",
      title: "Rental offer declined",
      cta: null,
    },
    termination_requested: {
      Icon: Clock,
      iconCls: "text-amber-700 bg-amber-50",
      title: "Early termination requested",
      cta: link ? "Review request" : null,
    },
    termination_countered: {
      Icon: RefreshCw,
      iconCls: "text-blue-700 bg-blue-50",
      title: "Termination counter-offer",
      cta: link ? "Review counter-offer" : null,
    },
    termination_accepted: {
      Icon: CheckCircle2,
      iconCls: "text-emerald-700 bg-emerald-50",
      title: "Termination accepted",
      cta: link ? "Sign to finalize" : null,
    },
    termination_declined: {
      Icon: XCircle,
      iconCls: "text-red-700 bg-red-50",
      title: "Termination declined",
      cta: null,
    },
    agreement_terminated_early: {
      Icon: Flag,
      iconCls: "text-slate-700 bg-slate-100",
      title: "Lease terminated early",
      cta: link ? "View agreement" : null,
    },
  };
  const v = variants[type];
  if (!v) return null;
  const { Icon, iconCls, title, cta } = v;

  const card = (
    <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2.5 max-w-md mx-auto hover:border-accent/30 transition-colors">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${iconCls}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <span>{title}</span>
          {num && (
            <span className="text-[10px] font-semibold text-muted-foreground bg-muted/50 rounded-full px-1.5 py-0.5">
              {num}
            </span>
          )}
        </div>
        {payload?.listing_title && (
          <div className="text-[11px] text-muted-foreground truncate">{payload.listing_title}</div>
        )}
      </div>
      {cta && (
        <div className="flex items-center gap-1 text-[11px] font-medium text-accent flex-shrink-0">
          <span>{cta}</span>
          <ChevronRight className="w-3 h-3" />
        </div>
      )}
    </div>
  );

  return (
    <div className="my-3 px-2">
      {link ? <Link to={link}>{card}</Link> : card}
      {time && (
        <div className="text-center text-[10px] text-muted-foreground/50 mt-1">{time}</div>
      )}
    </div>
  );
}

export default function MessageThread({ messages, currentUserId, currentUserEmail, otherUserAvatar, otherUserName, isLoading, onDeleteMessage }) {
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

  const handleDeleteClick = (msg) => {
    if (!onDeleteMessage) return;
    if (window.confirm("Delete this message? It will be hidden from your view. The other person will still see it.")) {
      onDeleteMessage(msg.id);
    }
  };

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

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 bg-background">
      {groupedMessages.map((item, idx) => {
        if (item.type === "date") {
          return (
            <div key={`date-${idx}`} className="flex justify-center my-4">
              <span className="px-3 py-1 bg-muted/40 rounded-full text-[11px] text-muted-foreground font-medium">
                {getDateLabel(item.date)}
              </span>
            </div>
          );
        }

        // System message? Render as a card, not a bubble.
        if (isSystemMessage(item)) {
          const parsed = parseSystemMessage(item);
          if (parsed) {
            return (
              <SystemMessageCard
                key={item.id || `sys-${idx}`}
                type={parsed.type}
                payload={parsed.payload}
                time={getTimeLabel(item)}
              />
            );
          }
          // Malformed system message — fall through to bubble (defensive)
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
          <div key={msg.id || `msg-${idx}`} className={`group flex items-end gap-1.5 ${isOwn ? "justify-end" : "justify-start"} ${sameSenderPrev ? "mt-[2px]" : "mt-3"}`}>
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

            <div className="max-w-[75%] sm:max-w-[60%] relative">
              {/* Hover/touch delete button for own messages */}
              {isOwn && onDeleteMessage && msg.id && (
                <button
                  onClick={() => handleDeleteClick(msg)}
                  className="absolute -left-7 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  aria-label="Delete message"
                  title="Delete message"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

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
