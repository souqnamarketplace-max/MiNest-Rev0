import React, { useState, useEffect, useCallback } from "react";
import { Outlet, useLocation } from "react-router-dom";
import usePullToRefresh from "@/hooks/usePullToRefresh";
import Header from "./Header";
import Footer from "./Footer";
import MobileBottomNav from "./MobileBottomNav";
import { useAuth } from "@/lib/AuthContext";

import WelcomeModal from "@/components/onboarding/WelcomeModal";
import NotifToast from "@/components/notifications/NotifToast";

export default function AppLayout() {
  const { user, isLoadingAuth, navigateToLogin, logout } = useAuth();
  const location = useLocation();
  const isMessages = location.pathname === "/messages";
  const [showWelcome, setShowWelcome] = useState(false);

  const handleRefresh = useCallback(() => {
    return new Promise((resolve) => {
      setTimeout(() => { window.location.reload(); resolve(); }, 300);
    });
  }, []);

  const { pulling, refreshing, pullDistance, threshold } = usePullToRefresh(handleRefresh);

  const handleOnboardingComplete = () => {
    setShowWelcome(false);
  };

  return (
    <div className={`min-h-screen flex flex-col bg-background font-inter lg:pb-0 ${isMessages ? "pb-0" : "pb-16 lg:pb-0"}`} style={{ paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Pull-to-refresh indicator */}
      {(pulling || refreshing) && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center transition-all duration-200 pointer-events-none"
          style={{ height: Math.min(pullDistance, threshold) + "px", paddingTop: 8 }}
        >
          <div className={`w-8 h-8 rounded-full border-4 border-accent/30 border-t-accent ${refreshing ? "animate-spin" : ""} bg-background shadow-md flex items-center justify-center`}
            style={{ transform: refreshing ? "none" : `rotate(${(pullDistance / threshold) * 360}deg)` }}
          />
        </div>
      )}
      <Header />
      <main className="flex-1">
        {!isLoadingAuth ? <Outlet /> : (
          <div className="fixed inset-0 flex items-center justify-center bg-background">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
          </div>
        )}
      </main>
      <Footer />
      <MobileBottomNav />
      {showWelcome && user && (
        <WelcomeModal user={user} onComplete={handleOnboardingComplete} />
      )}
      <NotifToast />
    </div>
  );
}