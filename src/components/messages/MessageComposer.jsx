import React, { useState, useRef } from "react";
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
      ? "Type a message..."
      : "Type a message...";

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

  const canSend = message.trim().length > 0 && !disabled && !isLoading;

  return (
    <div className="flex-shrink-0 bg-card/95 backdrop-blur-sm border-t border-border/60 px-3 sm:px-4 py-3 safe-area-bottom">
      <div className="flex gap-2 items-end max-w-full">
        <div className="flex-1 min-w-0 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            className="w-full px-4 py-2.5 border border-border/60 rounded-2xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 disabled:opacity-50 bg-muted/20 placeholder:text-muted-foreground/50 transition-all"
            rows={1}
            style={{ minHeight: "42px", maxHeight: "120px" }}
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
            canSend
              ? "bg-accent text-accent-foreground shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
              : "bg-muted text-muted-foreground/40 cursor-not-allowed"
          }`}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
