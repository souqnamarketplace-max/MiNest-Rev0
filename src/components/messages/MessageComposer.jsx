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
    <div className="sticky bottom-0 bg-card border-t border-border p-3 sm:p-4">
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className="flex-1 px-5 py-4 sm:px-4 sm:py-3 border border-border rounded-lg text-lg sm:text-base resize-none focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          rows={1}
          style={{ minHeight: "64px", maxHeight: "120px" }}
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim() || disabled || isLoading}
          className="bg-accent hover:bg-accent/90 text-accent-foreground flex-shrink-0 h-14 w-14 sm:h-12 sm:w-12"
          size="icon"
        >
          <Send className="w-5 h-5 sm:w-4 sm:h-4" />
        </Button>
      </div>
    </div>
  );
}