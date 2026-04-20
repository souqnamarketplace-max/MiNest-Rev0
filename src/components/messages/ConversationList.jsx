import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Search } from "lucide-react";
import ConversationRow from "./ConversationRow";

export default function ConversationList({
  conversations,
  isLoading,
  selectedId,
  onSelect,
  unreadCounts = {},
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      c =>
        c.primary_title.toLowerCase().includes(q) ||
        c.secondary_title?.toLowerCase().includes(q) ||
        c.last_message_text?.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  return (
    <div className="w-full md:w-80 lg:w-96 border-r border-border flex-shrink-0 flex flex-col h-full bg-card">
      {/* Search */}
      <div className="p-4 border-b border-border flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array(4).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center h-full">
            <MessageSquare className="w-8 h-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">
              {searchQuery ? "No conversations found" : "No messages yet"}
            </p>
            <p className="text-xs text-muted-foreground">
              {searchQuery
                ? "Try a different name, listing title, or keyword."
                : "When you contact a lister or roommate, your conversations will appear here."}
            </p>
          </div>
        ) : (
          filtered.map((conv) => (
            <ConversationRow
              key={conv.id}
              conversation={conv}
              isSelected={selectedId === conv.id}
              onClick={() => onSelect(conv.id)}
              isUnread={(unreadCounts[conv.id] || 0) > 0}
            />
          ))
        )}
      </div>
    </div>
  );
}