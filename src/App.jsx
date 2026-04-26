import React, { Suspense, lazy } from 'react'
import { ThemeProvider } from 'next-themes'
import { Toaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import InstallPrompt from '@/components/pwa/InstallPrompt';
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ProfileSetupGuard from '@/components/auth/ProfileSetupGuard';
import { CountryProvider } from '@/lib/CountryContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import AppLayout from '@/components/layout/AppLayout';

// ─── Lazy loading with auto-reload on stale chunk errors ──────────────
// When Vercel deploys a new build, old chunk files no longer exist.
// If a cached page tries to load an old chunk, this catches the error
// and reloads the page once to get the fresh chunks.
function lazyWithRetry(importFn) {
  return lazy(() =>
    importFn().catch((err) => {
      const hasReloaded = sessionStorage.getItem('chunk_reload');
      if (!hasReloaded) {
        sessionStorage.setItem('chunk_reload', '1');
        window.location.reload();
        return new Promise(() => {}); // Never resolves — page is reloading
      }
      sessionStorage.removeItem('chunk_reload');
      throw err; // Already reloaded once, let ErrorBoundary handle it
    })
  );
}

// ─── Lazy-loaded pages (code splitting) ──────────────────────────────────
// Each page is loaded on-demand, reducing initial bundle size by ~60%
const Home = lazyWithRetry(() => import('@/pages/Home'));
const Login = lazyWithRetry(() => import('@/pages/Login'));
const SearchRooms = lazyWithRetry(() => import('@/pages/SearchRooms'));
const SearchRoommates = lazyWithRetry(() => import('@/pages/SearchRoommates'));
const SeekerDetail = lazyWithRetry(() => import('@/pages/SeekerDetail'));
const ListingDetail = lazyWithRetry(() => import('@/pages/ListingDetail'));
const CreateListing = lazyWithRetry(() => import('@/pages/CreateListing'));
const EditListing = lazyWithRetry(() => import('@/pages/EditListing'));
const Dashboard = lazyWithRetry(() => import('@/pages/Dashboard'));
const Messages = lazyWithRetry(() => import('@/pages/Messages'));
const Profile = lazyWithRetry(() => import('@/pages/Profile'));
const Favorites = lazyWithRetry(() => import('@/pages/Favorites'));
const HowItWorks = lazyWithRetry(() => import('@/pages/HowItWorks'));
const Safety = lazyWithRetry(() => import('@/pages/Safety'));
const Pricing = lazyWithRetry(() => import('@/pages/Pricing'));
const Contact = lazyWithRetry(() => import('@/pages/Contact'));
const Terms = lazyWithRetry(() => import('@/pages/Terms'));
const Privacy = lazyWithRetry(() => import('@/pages/Privacy'));
const AcceptableUse = lazyWithRetry(() => import('@/pages/AcceptableUse'));
const Admin = lazyWithRetry(() => import('@/pages/Admin'));
const MyBookings = lazyWithRetry(() => import('@/pages/MyBookings'));
const AdminModeration = lazyWithRetry(() => import('@/pages/AdminModeration'));
const AdminEmailTest = lazyWithRetry(() => import('@/pages/AdminEmailTest'));
const CityListings = lazyWithRetry(() => import('@/pages/CityListings'));
const SeekerOnboarding = lazyWithRetry(() => import('@/pages/SeekerOnboarding'));
const SavedSearches = lazyWithRetry(() => import('@/pages/SavedSearches'));
const NotificationPreferences = lazyWithRetry(() => import('@/pages/NotificationPreferences'));
const Notifications = lazyWithRetry(() => import('@/pages/Notifications'));
const MyViewings = lazyWithRetry(() => import('@/pages/MyViewings'));
const BoostManager = lazyWithRetry(() => import('@/pages/BoostManager'));
const VerificationFlow = lazyWithRetry(() => import('@/pages/VerificationFlow'));
const AdminVerification = lazyWithRetry(() => import('@/pages/AdminVerification'));
const AuditLog = lazyWithRetry(() => import('@/pages/AuditLog'));
const FraudSignals = lazyWithRetry(() => import('@/pages/FraudSignals'));
const AdminUsers = lazyWithRetry(() => import('@/pages/AdminUsers'));
const MyPayments = lazyWithRetry(() => import('@/pages/MyPayments'));
const RentalAgreementPage = lazyWithRetry(() => import('@/pages/RentalAgreementPage'));
const Rentals = lazyWithRetry(() => import('@/pages/Rentals'));
const OwnerPaymentSetup = lazyWithRetry(() => import('@/pages/OwnerPaymentSetup'));
const CityRoomsPage = lazyWithRetry(() => import('@/pages/CityRoomsPage'));
const PageNotFound = lazyWithRetry(() => import('./lib/PageNotFound'));

// ─── Loading fallback ────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="text-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-accent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

// ─── Protected route wrapper ─────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const { user, isLoadingAuth } = useAuth();
  const location = useLocation();
  if (isLoadingAuth) return <PageLoader />;
  if (!user) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return <ProfileSetupGuard>{children}</ProfileSetupGuard>;
};

// ─── Page transitions ────────────────────────────────────────────────────

function AnimatedRoutes() {
  const location = useLocation();
  // Use only the base pathname (not query params) as key to avoid
  // re-animating when query strings change (e.g. ?id= in messages)
  const baseKey = location.pathname;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={baseKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: "easeInOut" }}
        style={{ width: '100%' }}
      >
        <Suspense fallback={<PageLoader />}>
          <Routes location={location}>
            <Route path="/login" element={<Login />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/search" element={<SearchRooms />} />
              <Route path="/roommates" element={<SearchRoommates />} />
              <Route path="/seeker/:id" element={<SeekerDetail />} />
              <Route path="/listing/:id" element={<ListingDetail />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/safety" element={<Safety />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/acceptable-use" element={<AcceptableUse />} />
              <Route path="/city" element={<CityListings />} />
              <Route path="/rooms-for-rent/:citySlug" element={<CityRoomsPage />} />
              <Route path="/rooms-for-rent-:citySlug" element={<CityRoomsPage />} />
              <Route path="/notification-preferences" element={<ProtectedRoute><NotificationPreferences /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/create-listing" element={<ProtectedRoute><CreateListing /></ProtectedRoute>} />
              <Route path="/listing/:id/edit" element={<ProtectedRoute><EditListing /></ProtectedRoute>} />
              <Route path="/my-bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
              <Route path="/seeker-onboarding" element={<ProtectedRoute><SeekerOnboarding /></ProtectedRoute>} />
              <Route path="/saved-searches" element={<ProtectedRoute><SavedSearches /></ProtectedRoute>} />
              <Route path="/my-viewings" element={<ProtectedRoute><MyViewings /></ProtectedRoute>} />
              <Route path="/boost-manager" element={<ProtectedRoute><BoostManager /></ProtectedRoute>} />
              <Route path="/verification-flow" element={<ProtectedRoute><VerificationFlow /></ProtectedRoute>} />
              <Route path="/my-payments" element={<ProtectedRoute><MyPayments /></ProtectedRoute>} />
              <Route path="/rentals/:id" element={<ProtectedRoute><RentalAgreementPage /></ProtectedRoute>} />
              <Route path="/rentals" element={<ProtectedRoute><Rentals /></ProtectedRoute>} />
              <Route path="/owner-payment-setup" element={<ProtectedRoute><OwnerPaymentSetup /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/admin/email-test" element={<ProtectedRoute><AdminEmailTest /></ProtectedRoute>} />
              <Route path="/admin/moderation" element={<ProtectedRoute><AdminModeration /></ProtectedRoute>} />
              <Route path="/admin/verification" element={<ProtectedRoute><AdminVerification /></ProtectedRoute>} />
              <Route path="/admin/audit-log" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
              <Route path="/admin/fraud-signals" element={<ProtectedRoute><FraudSignals /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
              <Route path="*" element={<PageNotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── App root ────────────────────────────────────────────────────────────
function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AuthProvider>
          <CountryProvider>
            <QueryClientProvider client={queryClientInstance}>
              <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <AnimatedRoutes />
              </Router>
              <Toaster />
            </QueryClientProvider>
          </CountryProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
