import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { setUser as setSentryUser, clearUser as clearSentryUser } from '@/lib/sentry';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isRoleResolved, setIsRoleResolved] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) setSentryUser(u);
      setIsLoadingAuth(false);
      setIsRoleResolved(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) setSentryUser(u); else clearSentryUser();
      setIsLoadingAuth(false);
      setIsRoleResolved(true);

      // Send welcome email on first sign-in
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          const { data: existing } = await supabase
            .from('user_profiles')
            .select('id, full_name, user_type_intent, welcome_email_sent')
            .eq('user_id', session.user.id)
            .single();

          if (existing && !existing.welcome_email_sent) {
            // Send welcome email via API
            fetch('/api/emails/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'welcome',
                to: session.user.email,
                data: {
                  name: existing.full_name || session.user.user_metadata?.full_name || 'there',
                  userType: existing.user_type_intent || 'seeker',
                },
              }),
            }).catch(() => {}); // Fire and forget

            // Mark welcome email as sent
            await supabase.from('user_profiles')
              .update({ welcome_email_sent: true })
              .eq('user_id', session.user.id);
          }
        } catch {
          // Non-critical - don't block auth flow
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const logout = async (redirectTo = '/') => {
    await supabase.auth.signOut();
    setUser(null);
    // Prevent open redirect — only allow relative paths
    const safeRedirect = (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')) ? redirectTo : '/';
    window.location.href = safeRedirect;
  };

  const navigateToLogin = (returnUrl) => {
    // Strip origin to create relative path — prevents open redirect and
    // ensures Login.jsx's returnTo validation doesn't reject it
    let relative = '';
    if (returnUrl) {
      try {
        if (returnUrl.startsWith('http')) {
          const url = new URL(returnUrl);
          relative = url.pathname + url.search;
        } else {
          relative = returnUrl;
        }
      } catch {
        relative = returnUrl;
      }
    }
    const encoded = relative ? `?returnTo=${encodeURIComponent(relative)}` : '';
    window.location.href = `/login${encoded}`;
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoadingAuth,
      isRoleResolved,
      appPublicSettings,
      logout,
      navigateToLogin,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
