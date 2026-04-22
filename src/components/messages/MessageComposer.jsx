import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

export default function MessageComposer({
  onSend,
  isLoading,
  sourceType,
  disabled = false,
}) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef(null);

  const placeholder =
    sourceType === "listing"
      ? "Ask about rent, utilities, move-in, parking, or house rules…"
      : "Introduce yourself and ask about budget, lifestyle, move-in date…";

  const handleChange = (e) => {
    setMessage(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  };

  const handleSend = () => {
    if (!message.trim() || disabled || isLoading) return;
    onSend(message);
    setMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-shrink-0 bg-card border-t border-border p-3 sm:p-4 safe-area-bottom">
      <div className="flex gap-2 items-end max-w-full">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className="flex-1 min-w-0 px-4 py-3 border border-border rounded-xl text-base resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50 bg-muted/30"
          rows={1}
          style={{ minHeight: "48px", maxHeight: "120px" }}
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim() || disabled || isLoading}
          className="bg-accent hover:bg-accent/90 text-accent-foreground flex-shrink-0 h-12 w-12 rounded-xl"
          size="icon"
        >
          <Send className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}