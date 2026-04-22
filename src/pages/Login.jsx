import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Mail, ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react';

export default function Login() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'recovery'
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Rate limiting: max 5 attempts per 60 seconds
  const [attempts, setAttempts] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Cooldown countdown timer
  useEffect(() => {
    if (!cooldownUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setCooldownUntil(null);
        setCooldownSeconds(0);
        setAttempts(0);
        clearInterval(interval);
      } else {
        setCooldownSeconds(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  // SECURITY: Validate returnTo to prevent open redirect attacks
  const rawReturnTo = new URLSearchParams(window.location.search).get('returnTo') || '/dashboard';
  const returnTo = rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//')
    ? rawReturnTo
    : '/dashboard';

  // Detect password recovery flow from Supabase redirect
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('recovery');
      }
    });
    // Also check URL hash for recovery token (Supabase sometimes uses hash)
    if (window.location.hash?.includes('type=recovery')) {
      setMode('recovery');
    }
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Don't auto-redirect if user is in recovery mode (resetting password)
    if (!isLoadingAuth && isAuthenticated && mode !== 'recovery') navigate(returnTo, { replace: true });
  }, [isAuthenticated, isLoadingAuth, navigate, returnTo, mode]);

  const checkRateLimit = () => {
    if (cooldownUntil && Date.now() < cooldownUntil) {
      toast.error(`Too many attempts. Please wait ${cooldownSeconds} seconds.`);
      return false;
    }
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    if (newAttempts >= 5) {
      const until = Date.now() + 60000;
      setCooldownUntil(until);
      setCooldownSeconds(60);
      toast.error('Too many attempts. Please wait 60 seconds before trying again.');
      return false;
    }
    return true;
  };

  const handlePasswordAuth = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    if (!checkRateLimit()) return;

    setLoading(true);
    try {
      if (mode === 'signup') {
        if (password.length < 6) {
          toast.error('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: { full_name: fullName.trim() || undefined },
            emailRedirectTo: `${window.location.origin}${returnTo}`,
          },
        });
        if (error) throw error;
        toast.success('Account created! Check your email to confirm, then sign in.');
        setMode('signin');
        setPassword('');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) {
          if (error.message?.includes('Invalid login credentials')) {
            toast.error('Wrong email or password. Try again or use a sign-in link.');
          } else {
            throw error;
          }
        }
      }
    } catch (err) {
      toast.error(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      toast.error('Enter your email first.');
      return;
    }
    if (!checkRateLimit()) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: `${window.location.origin}${returnTo}` },
      });
      if (error) throw error;
      setSent(true);
      toast.success('Check your email — sign-in link sent!');
    } catch (err) {
      toast.error(err.message || 'Failed to send link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}${returnTo}` },
      });
      if (error) throw error;
      setTimeout(() => setGoogleLoading(false), 10000);
    } catch (err) {
      toast.error(err.message || 'Google sign-in failed.');
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error('Enter your email first, then click "Forgot password?"');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/login` }
      );
      if (error) throw error;
      toast.success('Password reset email sent! Check your inbox.');
    } catch (err) {
      toast.error(err.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in both password fields.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated! You are now signed in.');
      setMode('signin');
      setNewPassword('');
      setConfirmPassword('');
      navigate(returnTo, { replace: true });
    } catch (err) {
      toast.error(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingAuth) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-accent" />
    </div>
  );

  const isSignUp = mode === 'signup';
  const isRecovery = mode === 'recovery';
  const isCoolingDown = cooldownUntil && Date.now() < cooldownUntil;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        {/* Back to browsing */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-1.5 mb-4">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <span className="text-accent-foreground font-extrabold text-lg">M</span>
            </div>
            <span className="text-2xl font-extrabold tracking-tight">
              <span className="text-foreground">Mi</span><span className="text-accent">Nest</span>
            </span>
          </Link>
          <h1 className="text-xl font-semibold text-foreground">
            {sent ? 'Check your email' : isRecovery ? 'Set new password' : isSignUp ? 'Create your account' : 'Sign in to MiNest'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {sent
              ? `We sent a sign-in link to ${email}`
              : isRecovery
                ? 'Enter your new password below.'
                : isSignUp
                  ? 'Join thousands finding rooms across Canada & USA.'
                  : 'Find rooms, roommates & pay rent online.'}
          </p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="bg-accent/10 rounded-xl p-5 text-center">
              <Mail className="w-10 h-10 text-accent mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">Link sent!</p>
              <p className="text-xs text-muted-foreground">Click the link in your email to sign in. If you don't see it, check your spam folder.</p>
            </div>
            <Button variant="ghost" className="w-full text-sm" onClick={() => { setSent(false); setEmail(''); }}>
              Use a different email
            </Button>
          </div>
        ) : isRecovery ? (
          <div className="space-y-4">
            <form onSubmit={handleUpdatePassword} className="space-y-3">
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="New password (6+ characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  autoFocus
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                className="h-11"
              />
              <Button
                type="submit"
                className="w-full h-11 bg-foreground hover:bg-foreground/90 text-background gap-2 font-semibold"
                disabled={loading || !newPassword || !confirmPassword}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Update Password
              </Button>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Google */}
            <Button variant="outline" className="w-full gap-2 h-11" onClick={handleGoogle} disabled={googleLoading}>
              {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              )}
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-background px-3 text-muted-foreground">or</span></div>
            </div>

            {/* Email + Password form */}
            <form onSubmit={handlePasswordAuth} className="space-y-3">
              {isSignUp && (
                <Input
                  type="text"
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  className="h-11"
                />
              )}

              <Input
                type="email"
                id="email"
                name="email"
                placeholder="you@example.com"
                value={email}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="h-11"
              />

              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isSignUp ? 'Create a password (6+ chars)' : 'Password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  required
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {!isSignUp && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-muted-foreground hover:text-accent transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {isCoolingDown ? (
                <div className="w-full h-11 bg-muted rounded-md flex items-center justify-center text-sm text-muted-foreground">
                  Too many attempts. Try again in {cooldownSeconds}s
                </div>
              ) : (
                <Button
                  type="submit"
                  className="w-full h-11 bg-foreground hover:bg-foreground/90 text-background gap-2 font-semibold"
                  disabled={loading || !email.trim() || !password}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Button>
              )}
            </form>

            {/* Magic link option — sign in only */}
            {!isSignUp && (
              <button
                type="button"
                onClick={handleMagicLink}
                disabled={loading || !email.trim() || isCoolingDown}
                className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 py-2"
              >
                <Mail className="w-3.5 h-3.5" />
                Send me a sign-in link instead
              </button>
            )}

            {/* Toggle sign in / sign up */}
            <div className="text-center pt-2">
              {isSignUp ? (
                <p className="text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('signin'); setPassword(''); }}
                    className="text-accent font-medium hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  New to MiNest?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('signup'); setPassword(''); }}
                    className="text-accent font-medium hover:underline"
                  >
                    Create an account
                  </button>
                </p>
              )}
            </div>

            <p className="text-xs text-center text-muted-foreground pt-1">
              By signing in, you agree to our{' '}
              <Link to="/terms" className="underline hover:text-foreground">Terms</Link>{' '}and{' '}
              <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
