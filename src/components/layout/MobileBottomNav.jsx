import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, LayoutDashboard, Search, Users, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { entities } from "@/api/entities";

import { saveScrollPosition, getScrollPosition, saveTabPath, getTabPath } from "@/lib/navScrollCache";

export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, navigateToLogin, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    setIsLoading(false);
  }, [user]);

  // Reuse the same queryKey as Header's unread count — shared cache, zero extra queries
  const { data: unreadMessages = 0 } = useQuery({
    queryKey: ['unread-conversations', user?.id],
    queryFn: async () => {
      try {
        const convos = await entities.Conversation.filter(
          { participant_ids: [user.id] },
          '-last_message_at',
          50
        );
        return convos.filter(c => c.last_message_sender_id && c.last_message_sender_id !== user.id).length;
      } catch {
        return 0;
      }
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  // Save scroll position and full path whenever location changes
  useEffect(() => {
    const prev = prevPathRef.current;
    const tabBases = ["/", "/search", "/roommates", "/dashboard"];
    const prevBase = tabBases.find(b => b === "/" ? prev === "/" : prev.startsWith(b));
    if (prevBase) {
      saveScrollPosition(prevBase, window.scrollY);
      saveTabPath(prevBase, prev + window.location.search);
    }
    prevPathRef.current = location.pathname;
  }, [location]);

  const isActive = (path) => location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  const handleTabPress = (path) => {
    if (isActive(path)) {
      // Already on this tab — scroll to top
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const cachedPath = getTabPath(path);
    const cachedScroll = getScrollPosition(path);
    navigate(cachedPath);
    requestAnimationFrame(() => {
      setTimeout(() => window.scrollTo({ top: cachedScroll, behavior: "instant" }), 50);
    });
  };

  const navItems = [
    { label: "Home", icon: Home, path: "/" },
    { label: "Find Place", icon: Search, path: "/search" },
    { label: "Roommates", icon: Users, path: "/roommates" },
    ...(user ? [{ label: "Messages", icon: MessageSquare, path: "/messages", badge: unreadMessages }] : []),
    ...(user ? [{ label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" }] : []),
  ];

  if (!isLoading && navItems.length === 0) return null;
  // Hide on messages page when a conversation is open
  const searchParams = new URLSearchParams(location.search);
  if (location.pathname === "/messages" && searchParams.has("id")) return null;
  // Hide on listing detail and seeker detail pages — they have their own sticky CTA bar
  if (location.pathname.startsWith("/listing/")) return null;
  if (location.pathname.startsWith("/seeker/")) return null;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center justify-around h-16 max-w-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => handleTabPress(item.path)}
              className={`flex flex-col items-center justify-center gap-0.5 w-full h-full min-h-[44px] transition-colors ${
                active ? "text-accent" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}