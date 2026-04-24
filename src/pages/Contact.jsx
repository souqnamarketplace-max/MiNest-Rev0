import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, CheckCircle2, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { entities, uploadFile } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { notifyContactSubmitted } from "@/lib/notificationService";

const statusColors = {
  open: "bg-yellow-50 border-yellow-200 text-yellow-700",
  in_progress: "bg-blue-50 border-blue-200 text-blue-700",
  resolved: "bg-green-50 border-green-200 text-green-700",
};

export default function Contact() {
  const { user, navigateToLogin, logout } = useAuth();
  const [form, setForm] = useState({ name: user?.full_name || "", email: user?.email || "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [pastMessages, setPastMessages] = useState([]);
  const [activeThread, setActiveThread] = useState(null);

  useEffect(() => {
    if (user?.id) {
      entities.ContactMessage.filter({ user_id: user.id }, "-created_at", 20)
        .then(setPastMessages).catch(() => {});
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAttempted(true);
    const contactErrors = [];
    if (!form.name?.trim()) contactErrors.push('Name is required');
    if (!form.email?.trim()) contactErrors.push('Email is required');
    if (!form.message?.trim()) contactErrors.push('Message is required');
    if (contactErrors.length > 0) { contactErrors.forEach(e => toast.error(e)); return; }
    setSending(true);
    const saved = await entities.ContactMessage.create({
      ...form,
      user_id: user?.id || null,
      status: "open",
      thread: [{ role: "user", text: form.message, media_urls: [], created_at: new Date().toISOString() }],
    });
    setSending(false);
    setSubmitted(saved);
    setPastMessages(prev => [saved, ...prev]);
    // Notify admin about new support request
    notifyContactSubmitted({ senderName: form.name, subject: form.subject || form.message?.slice(0, 50) });
  };

  if (submitted && !activeThread) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-card rounded-2xl border border-border p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-accent" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Message Sent!</h2>
          <p className="text-muted-foreground">Thanks for reaching out. We'll get back to you shortly.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button variant="outline" onClick={() => setSubmitted(null)}>Send Another Message</Button>
            {user && <Button onClick={() => setActiveThread(submitted)} className="bg-accent hover:bg-accent/90 text-accent-foreground">View Conversation</Button>}
          </div>
        </div>
        {pastMessages.length > 1 && <PastList messages={pastMessages} onOpen={setActiveThread} />}
      </div>
    );
  }

  if (activeThread) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <button onClick={() => setActiveThread(null)} className="text-sm text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1">
          ← Back
        </button>
        <ThreadView
          messageId={activeThread.id}
          subject={activeThread.subject}
          onUpdate={(updated) => {
            setPastMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
            setActiveThread(updated);
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-foreground">Contact Us</h1>
        <p className="text-muted-foreground mt-2">Have a question, feedback, or need help? We're here for you.</p>
      </div>
      <div className="bg-card rounded-2xl border border-border p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Name *</Label><Input id="contact-name" name="name" value={form.name} className={`mt-1 ${attempted && !form.name?.trim() ? "border-destructive" : ""}`} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email *</Label><Input type="email" id="contact-email" name="email" autoComplete="email" value={form.email} className={`mt-1 ${attempted && !form.email?.trim() ? "border-destructive" : ""}`} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div><Label>Subject</Label><Input className="mt-1" id="contact-subject" name="subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
          <div><Label>Message *</Label><Textarea id="contact-message" name="message" value={form.message} className={`mt-1 min-h-[120px] ${attempted && !form.message?.trim() ? "border-destructive" : ""}`} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
          <Button type="submit" disabled={sending} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
            <Mail className="w-4 h-4 mr-2" /> {sending ? "Sending..." : "Send Message"}
          </Button>
        </form>
      </div>

      {pastMessages.length > 0 && <PastList messages={pastMessages} onOpen={setActiveThread} />}
    </div>
  );
}

function PastList({ messages, onOpen }) {
  return (
    <div className="mt-8 space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Your Past Requests</h3>
      {messages.map(m => (
        <button key={m.id} onClick={() => onOpen(m)} className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-accent/40 transition-colors">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-sm text-foreground truncate">{m.subject || "No subject"}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${statusColors[m.status] || statusColors.open}`}>
              {m.status === "in_progress" ? "In Progress" : m.status === "resolved" ? "Resolved" : "Open"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{new Date(m.created_at || m.created_date).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}</p>
          {m.admin_reply && !m.thread?.some(t => t.role === "admin") && (
            <p className="text-xs text-accent mt-1">Admin replied — tap to view</p>
          )}
          {m.thread?.some(t => t.role === "admin") && (
            <p className="text-xs text-accent mt-1">New reply — tap to view</p>
          )}
        </button>
      ))}
    </div>
  );
}

function ThreadView({ messageId, subject, onUpdate }) {
  const { user, navigateToLogin, logout } = useAuth();
  const [msg, setMsg] = useState(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const fileRef = useRef();
  const bottomRef = useRef();

  useEffect(() => {
    entities.ContactMessage.filter({ id: messageId }).then(r => r[0] && setMsg(r[0])).catch(() => {});
  }, [messageId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msg?.thread]);

  const handleSend = async () => {
    if (!text.trim() && files.length === 0) return;
    setSending(true);
    const mediaUrls = await Promise.all(files.map(f => uploadFile(f, 'contact-attachments').then(r => r.file_url)));
    const newEntry = { role: "user", text: text.trim(), media_urls: mediaUrls, created_at: new Date().toISOString() };
    const updatedThread = [...(msg.thread || []), newEntry];
    const updated = await entities.ContactMessage.update(messageId, { thread: updatedThread, status: msg.status === "resolved" ? "open" : msg.status });
    setText("");
    setFiles([]);
    setMsg(updated);
    onUpdate?.(updated);
    setSending(false);
  };

  if (!msg) return <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>;

  const thread = msg.thread || [{ role: "user", text: msg.message, created_at: msg.created_date }];

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: 400 }}>
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <p className="font-semibold text-foreground">{subject || "Support Request"}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColors[msg.status] || statusColors.open}`}>
            {msg.status === "in_progress" ? "In Progress" : msg.status === "resolved" ? "Resolved" : "Open"}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: 400 }}>
        {thread.map((entry, i) => (
          <div key={i} className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${entry.role === "user" ? "bg-accent text-accent-foreground" : "bg-muted text-foreground"}`}>
              {entry.role === "admin" && <p className="text-xs font-semibold mb-1 opacity-70">MiNest Support</p>}
              {entry.text && <p className="whitespace-pre-line">{entry.text}</p>}
              {entry.media_urls?.map((url, j) => (
                <a key={j} href={url} target="_blank" rel="noopener noreferrer" className="block mt-2">
                  <img src={url} alt="attachment" className="rounded-lg max-w-full max-h-48 object-cover" onError={e => e.target.style.display = "none"} />
                </a>
              ))}
              <p className="text-xs opacity-50 mt-1 text-right">{new Date(entry.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {msg.status !== "resolved" && (
        <div className="border-t border-border p-3 space-y-2">
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-1 bg-muted rounded-lg px-2 py-1 text-xs">
                  {f.name}
                  <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Type your reply..."
              className="text-sm min-h-[60px] flex-1 resize-none"
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <div className="flex flex-col gap-1">
              <button onClick={() => fileRef.current?.click()} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors">
                <Paperclip className="w-4 h-4 text-muted-foreground" />
              </button>
              <Button size="icon" disabled={sending || (!text.trim() && files.length === 0)} onClick={handleSend} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <input ref={fileRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx" className="hidden" onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files)])} />
        </div>
      )}
      {msg.status === "resolved" && (
        <div className="border-t border-border p-3 text-center text-sm text-muted-foreground">This request has been resolved.</div>
      )}
    </div>
  );
}