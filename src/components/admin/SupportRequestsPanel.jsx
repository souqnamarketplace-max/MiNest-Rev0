import React, { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entities, uploadFile } from '@/api/entities';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Send, ChevronDown, ChevronUp, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

const statusColors = {
  open: "bg-yellow-50 border-yellow-200 text-yellow-700",
  in_progress: "bg-blue-50 border-blue-200 text-blue-700",
  resolved: "bg-green-50 border-green-200 text-green-700",
};

export default function SupportRequestsPanel() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(null);
  const [reply, setReply] = useState({});
  const [files, setFiles] = useState({});
  const [sending, setSending] = useState(null);
  const fileRefs = useRef({});

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["admin-contact-messages"],
    queryFn: () => entities.ContactMessage.list("-created_at", 50),
  });

  const handleStatusChange = async (id, status) => {
    await entities.ContactMessage.update(id, { status });
    qc.invalidateQueries({ queryKey: ["admin-contact-messages"] });
    toast.success("Status updated");
  };

  const handleReply = async (msg) => {
    const text = reply[msg.id]?.trim();
    const msgFiles = files[msg.id] || [];
    if (!text && msgFiles.length === 0) return;
    setSending(msg.id);
    const mediaUrls = await Promise.all(
      msgFiles.map(f => uploadFile(f, 'contact-attachments').then(r => r.file_url))
    );
    const newEntry = { role: "admin", text: text || "", media_urls: mediaUrls, created_at: new Date().toISOString() };
    const updatedThread = [...(msg.thread || [{ role: "user", text: msg.message, created_at: msg.created_date }]), newEntry];
    await entities.ContactMessage.update(msg.id, {
      thread: updatedThread,
      admin_reply: text || msg.admin_reply,
      status: msg.status === "open" ? "in_progress" : msg.status,
    });
    setReply(r => ({ ...r, [msg.id]: "" }));
    setFiles(f => ({ ...f, [msg.id]: [] }));
    setSending(null);
    qc.invalidateQueries({ queryKey: ["admin-contact-messages"] });
    toast.success("Reply sent");
  };

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Loading...</p>;
  if (messages.length === 0) return (
    <div className="text-center py-12">
      <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
      <p className="text-muted-foreground">No support requests yet.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {messages.map(msg => {
        const thread = msg.thread || [{ role: "user", text: msg.message, created_at: msg.created_date }];
        const msgFiles = files[msg.id] || [];
        return (
          <div key={msg.id} className="bg-card border border-border rounded-xl overflow-hidden">
            <div
              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setExpanded(expanded === msg.id ? null : msg.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-foreground">{msg.name}</span>
                  <span className="text-xs text-muted-foreground">{msg.email}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{msg.subject || msg.message?.slice(0, 60)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{new Date(msg.created_date).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${statusColors[msg.status] || statusColors.open}`}>
                {msg.status === "in_progress" ? "In Progress" : msg.status === "resolved" ? "Resolved" : "Open"}
              </span>
              {expanded === msg.id ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
            </div>

            {expanded === msg.id && (
              <div className="border-t border-border">
                {/* Thread */}
                <div className="p-4 space-y-3 max-h-80 overflow-y-auto bg-muted/20">
                  {thread.map((entry, i) => (
                    <div key={i} className={`flex ${entry.role === "admin" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${entry.role === "admin" ? "bg-accent text-accent-foreground" : "bg-white border border-border text-foreground"}`}>
                        <p className="text-xs font-semibold mb-1 opacity-70">{entry.role === "admin" ? "You (Admin)" : msg.name}</p>
                        {entry.text && <p className="whitespace-pre-line">{entry.text}</p>}
                        {entry.media_urls?.map((url, j) => (
                          <a key={j} href={url} target="_blank" rel="noopener noreferrer" className="block mt-2">
                            <img src={url} alt="attachment" className="rounded-lg max-w-full max-h-40 object-cover" onError={e => e.target.style.display = "none"} />
                          </a>
                        ))}
                        <p className="text-xs opacity-50 mt-1">{new Date(entry.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Controls */}
                <div className="p-4 space-y-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Status:</span>
                    <Select value={msg.status || "open"} onValueChange={v => handleStatusChange(msg.id, v)}>
                      <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {msgFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {msgFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-1 bg-muted rounded-lg px-2 py-1 text-xs">
                          {f.name}
                          <button onClick={() => setFiles(prev => ({ ...prev, [msg.id]: prev[msg.id].filter((_, j) => j !== i) }))}><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.status !== "resolved" ? (
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type a reply..."
                      value={reply[msg.id] || ""}
                      onChange={e => setReply(r => ({ ...r, [msg.id]: e.target.value }))}
                      className="text-sm min-h-[60px] resize-none flex-1"
                    />
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => { if (!fileRefs.current[msg.id]) return; fileRefs.current[msg.id].click(); }}
                        className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
                      >
                        <Paperclip className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <Button
                        size="icon"
                        disabled={(!reply[msg.id]?.trim() && msgFiles.length === 0) || sending === msg.id}
                        onClick={() => handleReply(msg)}
                        className="bg-accent hover:bg-accent/90 text-accent-foreground"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  ) : (
                    <p className="text-xs text-center text-muted-foreground py-2 bg-muted/40 rounded-lg">This request is resolved — no further replies can be sent.</p>
                  )}
                  <input
                    ref={el => fileRefs.current[msg.id] = el}
                    type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx"
                    className="hidden"
                    onChange={e => setFiles(prev => ({ ...prev, [msg.id]: [...(prev[msg.id] || []), ...Array.from(e.target.files)] }))}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}