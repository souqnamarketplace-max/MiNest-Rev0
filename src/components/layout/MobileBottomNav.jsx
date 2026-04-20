import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, LayoutDashboard, Search, Users } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

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
    ...(user ? [{ label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" }] : []),

  ];

  if (!isLoading && navItems.length === 0) return null;
  // Hide on messages page when a conversation is open
  if (location.pathname === "/messages") return null;

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
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}