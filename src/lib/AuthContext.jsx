import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isRoleResolved, setIsRoleResolved] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoadingAuth(false);
      setIsRoleResolved(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
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
    window.location.href = redirectTo;
  };

  const navigateToLogin = (returnUrl) => {
    const encoded = returnUrl ? `?returnTo=${encodeURIComponent(returnUrl)}` : '';
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
