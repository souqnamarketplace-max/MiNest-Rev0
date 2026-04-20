import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/api/entities';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Search, PlusCircle, User, LogOut, Heart, MessageSquare, Home, CreditCard, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { APP_CONFIG } from '@/lib/config';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import CountrySwitcher from '@/components/layout/CountrySwitcher';
import SignInRequiredModal from '@/components/modals/SignInRequiredModal';

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const { user, isLoadingAuth, logout, navigateToLogin } = useAuth();

  const { data: userProfile } = useQuery({
    queryKey: ['header-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const profiles = await entities.UserProfile.filter({ user_id: user.id });
      return profiles[0] || null;
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  const navLinks = [
    { to: '/search', label: 'Find a Room', icon: Search },
    { to: '/roommates', label: 'Find a Roommate', icon: Search },
    { to: '/how-it-works', label: 'How It Works', icon: Home },
    { to: '/pricing', label: 'Pricing', icon: Home },
  ];

  const userLinks = user ? [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/create-listing', label: 'Post a Room', icon: PlusCircle },
    { to: '/messages', label: 'Messages', icon: MessageSquare },
    { to: '/favorites', label: 'Favorites', icon: Heart },
    { to: '/my-payments', label: 'Payments', icon: CreditCard },
    { to: '/profile', label: 'Profile', icon: User },
  ] : [];

  return (
    <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
              <span className="text-accent-foreground font-extrabold text-sm">M</span>
            </div>
            <span className="text-xl font-extrabold tracking-tight">
              <span className="text-foreground">Mi</span><span className="text-accent">Nest</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive(link.to) ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-2">
            <CountrySwitcher />
            {!isLoadingAuth && (
              user ? (
                <>
                  <NotificationCenter />
                  <Link to="/favorites">
                    <Button variant="ghost" size="icon" aria-label="Favorites" className="h-9 w-9">
                      <Heart className="w-5 h-5" />
                    </Button>
                  </Link>
                  <Link to="/create-listing">
                    <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1">
                      <PlusCircle className="w-4 h-4" /> Post a Room
                    </Button>
                  </Link>
                  <Link to="/dashboard"><Button variant="ghost" size="sm">Dashboard</Button></Link>
                  {userProfile?.is_admin && <Link to="/admin"><Button variant="ghost" size="sm" className="text-accent">Admin</Button></Link>}
                  <Button variant="ghost" size="sm" aria-label="Sign out" onClick={() => logout('/')}><LogOut className="w-4 h-4" /></Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => navigateToLogin(window.location.href)}>Sign In</Button>
                  <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => navigateToLogin(window.location.href)}>Get Started</Button>
                </>
              )
            )}
          </div>

          {/* Mobile quick actions - visible on small screens */}
          <div className="flex lg:hidden items-center gap-1">
            <CountrySwitcher />
          </div>
          {user && !isLoadingAuth && (
            <div className="flex lg:hidden items-center gap-1">
              <NotificationCenter />
              <Link to="/messages">
                <Button variant="ghost" size="icon" aria-label="Messages" className="h-9 w-9">
                  <MessageSquare className="w-5 h-5" />
                </Button>
              </Link>
              <Link to="/favorites">
                <Button variant="ghost" size="icon" aria-label="Favorites" className="h-9 w-9">
                  <Heart className="w-5 h-5" />
                </Button>
              </Link>
            </div>
          )}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation menu"><Menu className="w-5 h-5" /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 pt-8">
              <div className="flex flex-col gap-1">
                <CountrySwitcher variant="mobile" />
                <div className="my-3 border-t border-border" />
                {navLinks.map((link) => (
                  <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${isActive(link.to) ? 'bg-accent/10 text-accent' : 'text-foreground hover:bg-muted'}`}>
                    <link.icon className="w-4 h-4" />{link.label}
                  </Link>
                ))}
                {user && (
                  <>
                    <div className="my-2 border-t border-border" />
                    <Link to="/create-listing" onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-accent/10 text-accent">
                      <PlusCircle className="w-4 h-4" /> Post a Room
                    </Link>
                    {userProfile?.is_admin && (
                      <Link to="/admin" onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-accent hover:bg-muted">
                        <LayoutDashboard className="w-4 h-4" /> Admin Panel
                      </Link>
                    )}
                    <div className="my-2 border-t border-border" />
                    {userLinks.map((link) => (
                      <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted">
                        <link.icon className="w-4 h-4" />{link.label}
                      </Link>
                    ))}
                    <div className="my-2 border-t border-border" />
                    <Button variant="outline" className="w-full gap-2" onClick={() => { setMobileOpen(false); logout('/'); }}>
                      <LogOut className="w-4 h-4" /> Sign Out
                    </Button>
                  </>
                )}
                {!user && !isLoadingAuth && (
                  <>
                    <div className="my-2 border-t border-border" />
                    <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                      onClick={() => { setMobileOpen(false); navigateToLogin(window.location.href); }}>
                      Sign In / Get Started
                    </Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <SignInRequiredModal open={signInModalOpen} onOpenChange={setSignInModalOpen} />
    </header>
  );
}
