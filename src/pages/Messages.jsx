import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { MessageSquare, Flag, Loader2 } from "lucide-react";
import usePullToRefresh from "@/hooks/usePullToRefresh";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import ConversationList from "@/components/messages/ConversationList";
import ConversationHeader from "@/components/messages/ConversationHeader";
import MessageThread from "@/components/messages/MessageThread";
import MessageComposer from "@/components/messages/MessageComposer";
import { enrichConversations } from "@/lib/conversationHelpers";
import { notifyNewMessage, notifyReportFiled } from "@/lib/notificationService";
import { supabase } from "@/lib/supabase";
import { useProfileCheck, ProfileIncompleteWarning } from "@/components/ProfileGate";

export default function Messages() {
  const { user, navigateToLogin, logout } = useAuth();
  const queryClient = useQueryClient();
  const { isComplete, missingFields } = useProfileCheck("lister");
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedId, setSelectedId] = useState(urlParams.get("id") || null);

  // Sync selectedId to URL so MobileBottomNav can detect it
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedId) {
      params.set("id", selectedId);
    } else {
      params.delete("id");
    }
    const newUrl = `${window.location.pathname}${params.toString() ? "?" + params.toString() : ""}`;
    window.history.replaceState(null, "", newUrl);
  }, [selectedId]);
  const [sending, setSending] = useState(false);

  // FIX #6: Realtime subscription for messages instead of 5s polling
  useEffect(() => {
    if (!selectedId) return;
    const channel = supabase
      .channel(`messages_${selectedId}_${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${selectedId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['messages', selectedId] });
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [selectedId, queryClient]);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportingUserId, setReportingUserId] = useState(null);

  // Fetch conversations
  const { data: rawConversations = [], isLoading: loadingConvos, refetch: refetchConvos } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      const convos = await entities.Conversation.filter({ participant_ids: [user.id] }, '-last_message_at', 50);
      return convos;
    },
    enabled: !!user,
    staleTime: 30000,
  });

  // Enrich conversations with context
  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations-enriched", rawConversations.length],
    queryFn: async () => {
      if (rawConversations.length === 0) return [];
      return enrichConversations(rawConversations, user.id);
    },
    enabled: rawConversations.length > 0,
    staleTime: 30000,
  });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["messages", selectedId],
    queryFn: () => entities.Message.filter({ conversation_id: selectedId }, "created_date", 100),
    enabled: !!selectedId,
    staleTime: 5000,
  });

  const selectedConvo = conversations.find(c => c.id === selectedId);

  const { pulling, refreshing, pullDistance, threshold } = usePullToRefresh(async () => {
    await refetchConvos();
  });

  const handleSend = async (messageText) => {
    if (!messageText.trim() || !selectedId) return;
    setSending(true);
    try {
      // Fetch current user's display name
      const userProfiles = await entities.UserProfile.filter({ user_id: user.id });
      const displayName = userProfiles[0]?.display_name || userProfiles[0]?.full_name || user.full_name || user.email;

      await entities.Message.create({
        conversation_id: selectedId,
        sender_user_id: user.id,
        sender_name: displayName,
        text: messageText,
      });

      await entities.Conversation.update(selectedId, {
        last_message_text: messageText,
        last_message_at: new Date().toISOString(),
      });

      queryClient.invalidateQueries({ queryKey: ["messages", selectedId] });
      refetchConvos();
      // Notify the recipient of the new message
      const convo = conversations.find(c => c.id === selectedId);
      const recipientId = convo?.participant_ids?.find(id => id !== user.id) || convo?.other_user_id;
      if (recipientId) {
        notifyNewMessage({ recipientId, senderName: displayName, messagePreview: messageText, conversationId: selectedId });
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleReport = (userId) => {
    setReportingUserId(userId);
    setReportOpen(true);
  };

  const handleReportSubmit = async () => {
    if (!reportReason) {
      toast.error("Please select a reason");
      return;
    }
    setReportSubmitting(true);
    try {
      await entities.Report.create({
        reporter_user_id: user.id,
        target_type: 'user',
        target_id: reportingUserId,
        reason: reportReason,
        details: reportDetails,
        status: "pending"
      });
      toast.success("Report submitted. Thank you for helping us keep the community safe.");
      notifyReportFiled({ reporterName: user?.user_metadata?.full_name, targetType: 'user', reason: reportReason });
      setReportOpen(false);
      setReportReason("");
      setReportDetails("");
      setReportingUserId(null);
    } catch (err) {
      toast.error("Failed to submit report.");
    } finally {
      setReportSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col">
      {missingFields.length > 0 && <div className="p-4"><ProfileIncompleteWarning userType="lister" missingFields={missingFields} /></div>}
      <div className="h-[calc(100vh-64px)] bg-background flex flex-col md:flex-row overflow-hidden">
      {/* Desktop: Conversation list sidebar */}
      <div className="hidden md:flex md:flex-col">
        {selectedId ? null : (
          <div className="md:hidden p-4">
            <h1 className="text-2xl font-bold text-foreground">Messages</h1>
          </div>
        )}
        <ConversationList
          conversations={conversations}
          isLoading={loadingConvos}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {/* Mobile: Conversation list or thread */}
      {!selectedId ? (
        <div className="flex-1 flex flex-col md:hidden bg-card">
          <div className="p-4 border-b border-border">
            <h2 className="text-2xl font-bold text-foreground">Messages</h2>
          </div>
          {/* Pull-to-refresh indicator */}
          {(pulling || refreshing) && (
            <div
              className="flex items-center justify-center overflow-hidden transition-all duration-200"
              style={{ height: refreshing ? 40 : Math.min(pullDistance, 40) }}
            >
              <Loader2 className={`w-5 h-5 text-accent ${refreshing ? "animate-spin" : ""}`} style={{ opacity: pullDistance / threshold }} />
            </div>
          )}
          <ConversationList
            conversations={conversations}
            isLoading={loadingConvos}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      ) : null}

      {/* Desktop/Tablet: Thread area */}
      {selectedConvo && (
        <div className={`flex-1 flex flex-col md:flex ${!selectedId ? "hidden md:flex" : "flex"}`}>
          <ConversationHeader
            conversation={selectedConvo}
            onBack={() => setSelectedId(null)}
            onReport={() => handleReport(selectedConvo.other_user_email)}
          />
          <MessageThread
            messages={messages}
            currentUserId={user.id}
            isLoading={loadingMessages}
          />
          <MessageComposer
            onSend={handleSend}
            isLoading={sending}
            sourceType={selectedConvo.source_type}
            disabled={sending}
          />
        </div>
      )}

      {/* Empty state */}
      {!selectedId && (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-card">
          <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">Select a conversation to start messaging</p>
          <p className="text-sm text-muted-foreground mt-1">Ask about listings, availability, house rules, or roommate fit.</p>
        </div>
      )}

      {/* Report modal */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report This User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="report-reason" className="text-sm font-semibold block mb-2">Reason</label>
              <select
id="select-field"                 value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
              >
                <option value="">Select a reason...</option>
                <option value="spam">Spam</option>
                <option value="scam">Scam</option>
                <option value="inappropriate">Inappropriate Content</option>
                <option value="harassment">Harassment</option>
                <option value="fake_profile">Fake Profile</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="report-details" className="text-sm font-semibold block mb-2">Details</label>
              <Textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Provide details about why you're reporting this user..."
                className="min-h-24"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReportOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleReportSubmit}
                disabled={reportSubmitting || !reportReason}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                {reportSubmitting ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  );
}