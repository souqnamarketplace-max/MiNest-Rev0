/**
 * ProfileSetupGuard — wraps protected routes. When a signed-in user
 * has not yet completed their profile (no user_profiles row OR an
 * empty full_name), redirects them to /profile so they can fill it
 * out before doing anything else in the app.
 *
 * Designed to live INSIDE ProtectedRoute so the auth check runs
 * first; this guard assumes `user` is non-null.
 *
 * Why a separate component instead of doing this in ProtectedRoute
 * directly: keeps the auth-vs-onboarding concerns separate, and
 * makes it easy to remove later if we add a more sophisticated
 * onboarding wizard.
 */
import { Navigate, useLocation } from "react-router-dom";
import { useProfileCompletion } from "@/lib/useProfileCompletion";

// Routes the guard should NEVER redirect AWAY from. The user must
// be able to reach /profile to fill it out, and must be able to
// sign out from /login. Everything else under ProtectedRoute is
// gated on a completed profile.
const ALLOWED_DURING_SETUP = new Set([
  "/profile",
  "/login",
]);

export default function ProfileSetupGuard({ children }) {
  const { loading, needsSetup } = useProfileCompletion();
  const location = useLocation();

  // Wait until we know — don't flash protected content first.
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  // If the user's profile is incomplete and they're not already on
  // /profile (or another allowed path), bounce them there.
  if (needsSetup && !ALLOWED_DURING_SETUP.has(location.pathname)) {
    return <Navigate to="/profile?setup=1" replace />;
  }

  return children;
}
