/**
 * MessageThread — renders an array of messages plus a small composer.
 * Recognizes "system" messages (encoded via conversationSystemMessages.js)
 * and renders them as inline cards instead of chat bubbles.
 */

import React, { useEffect, useRef, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { format, isToday, isYesterday } from "date-fns";
import {
  CheckCheck,
  Trash2,
  FileText,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Flag,
  RotateCw,
  PartyPopper,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { entities } from "@/api/entities";
import { isSystemMessage, parseSystemMessage } from "@/lib/conversationSystemMessages";
import { toast } from "sonner";

function dayLabel(d) {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "PPP");
}

/**
 * Card renderer for system messages. Variants are keyed by the system
 * message `type` and produce a small icon + title + optional CTA link.
 */
function SystemMessageCard({ type, payload }) {
  const num =
    payload?.agreement_number != null
      ? `#${String(payload.agreement_number).padStart(4, "0")}`
      : null;
  const link = payload?.agreement_id
    ? `/my-payments?agreement=${payload.agreement_id}`
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
    // --- Termination
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
    // --- Renewal
    renewal_offered: {
      Icon: RotateCw,
      iconCls: "text-indigo-700 bg-indigo-50",
      title: "Renewal offered",
      cta: link ? "Review offer" : null,
    },
    renewal_countered: {
      Icon: RefreshCw,
      iconCls: "text-blue-700 bg-blue-50",
      title: "Renewal counter-offer",
      cta: link ? "Review counter-offer" : null,
    },
    renewal_accepted: {
      Icon: CheckCircle2,
      iconCls: "text-emerald-700 bg-emerald-50",
      title: "Renewal accepted",
      cta: link ? "View new agreement" : null,
    },
    renewal_declined: {
      Icon: XCircle,
      iconCls: "text-red-700 bg-red-50",
      title: "Renewal declined",
      cta: null,
    },
    renewal_completed: {
      Icon: PartyPopper,
      iconCls: "text-emerald-700 bg-emerald-50",
      title: "Lease renewed",
      cta: link ? "View new agreement" : null,
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
      {link ? (
        <Link to={link} className="block">
          {card}
        </Link>
      ) : (
        card
      )}
    </div>
  );
}

export default function MessageThread({
  conversationId,
  messages = [],
  currentUserId,
  onMessagesChanged,
  participants = {},
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const grouped = useMemo(() => {
    const out = [];
    let lastDay = null;
    for (const m of messages) {
      const d = new Date(m.created_at);
      const label = dayLabel(d);
      if (label !== lastDay) {
        out.push({ kind: "day", id: `day-${label}-${m.id}`, label });
        lastDay = label;
      }
      out.push({ kind: "msg", id: m.id, msg: m });
    }
    return out;
  }, [messages]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await entities.Message.create({
        conversation_id: conversationId,
        sender_user_id: currentUserId,
        content: text,
      });
      try {
        await entities.Conversation.update(conversationId, {
          last_message_text: text.slice(0, 200),
          last_message_at: new Date().toISOString(),
        });
      } catch {
        /* non-fatal */
      }
      setDraft("");
      onMessagesChanged?.();
    } catch (err) {
      console.warn("[MessageThread] send failed:", err);
      toast.error("Couldn't send message.");
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id) {
    try {
      await entities.Message.delete(id);
      onMessagesChanged?.();
    } catch (err) {
      console.warn("[MessageThread] delete failed:", err);
      toast.error("Couldn't delete message.");
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {grouped.map(item => {
          if (item.kind === "day") {
            return (
              <div key={item.id} className="text-center text-[11px] text-muted-foreground py-2">
                {item.label}
              </div>
            );
          }
          const m = item.msg;
          const isMine = m.sender_user_id === currentUserId;
          if (isSystemMessage(m.content)) {
            const parsed = parseSystemMessage(m.content);
            if (!parsed) return null;
            return <SystemMessageCard key={m.id} type={parsed.type} payload={parsed.payload} />;
          }
          return (
            <div
              key={m.id}
              className={`flex ${isMine ? "justify-end" : "justify-start"} group`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  isMine
                    ? "bg-accent text-accent-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
                <div
                  className={`flex items-center gap-1 mt-1 text-[10px] ${
                    isMine ? "text-accent-foreground/70" : "text-muted-foreground"
                  }`}
                >
                  <span>{format(new Date(m.created_at), "p")}</span>
                  {isMine && <CheckCheck className="w-3 h-3" />}
                  {isMine && (
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity ml-1"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border p-2 flex items-end gap-2">
        <Textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message…"
          className="min-h-[40px] max-h-[120px] resize-none"
        />
        <Button onClick={handleSend} disabled={sending || !draft.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
