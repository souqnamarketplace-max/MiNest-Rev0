import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

export default function MobilePageHeader({ title, onBack, rightAction }) {
  const navigate = useNavigate();
  const handleBack = onBack || (() => navigate(-1));

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border lg:hidden">
      <button
        onClick={handleBack}
        className="flex items-center justify-center w-11 h-11 -ml-2 rounded-xl text-foreground hover:bg-muted transition-colors"
        aria-label="Go back"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <h1 className="text-base font-semibold text-foreground">{title}</h1>
      <div className="w-11 h-11 flex items-center justify-center">
        {rightAction || null}
      </div>
    </div>
  );
}