import React, { Suspense, lazy } from 'react'
import { ThemeProvider } from 'next-themes'
import { Toaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import InstallPrompt from '@/components/pwa/InstallPrompt';
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { CountryProvider } from '@/lib/CountryContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import AppLayout from '@/components/layout/AppLayout';

// ─── Lazy-loaded pages (code splitting) ──────────────────────────────────
// Each page is loaded on-demand, reducing initial bundle size by ~60%
const Home = lazy(() => import('@/pages/Home'));
const Login = lazy(() => import('@/pages/Login'));
const SearchRooms = lazy(() => import('@/pages/SearchRooms'));
const SearchRoommates = lazy(() => import('@/pages/SearchRoommates'));
const SeekerDetail = lazy(() => import('@/pages/SeekerDetail'));
const ListingDetail = lazy(() => import('@/pages/ListingDetail'));
const CreateListing = lazy(() => import('@/pages/CreateListing'));
const EditListing = lazy(() => import('@/pages/EditListing'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Messages = lazy(() => import('@/pages/Messages'));
const Profile = lazy(() => import('@/pages/Profile'));
const Favorites = lazy(() => import('@/pages/Favorites'));
const HowItWorks = lazy(() => import('@/pages/HowItWorks'));
const Safety = lazy(() => import('@/pages/Safety'));
const Pricing = lazy(() => import('@/pages/Pricing'));
const Contact = lazy(() => import('@/pages/Contact'));
const Terms = lazy(() => import('@/pages/Terms'));
const Privacy = lazy(() => import('@/pages/Privacy'));
const AcceptableUse = lazy(() => import('@/pages/AcceptableUse'));
const Admin = lazy(() => import('@/pages/Admin'));
const MyBookings = lazy(() => import('@/pages/MyBookings'));
const AdminModeration = lazy(() => import('@/pages/AdminModeration'));
const AdminEmailTest = lazy(() => import('@/pages/AdminEmailTest'));
const CityListings = lazy(() => import('@/pages/CityListings'));
const SeekerOnboarding = lazy(() => import('@/pages/SeekerOnboarding'));
const SavedSearches = lazy(() => import('@/pages/SavedSearches'));
const NotificationPreferences = lazy(() => import('@/pages/NotificationPreferences'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const MyViewings = lazy(() => import('@/pages/MyViewings'));
const BoostManager = lazy(() => import('@/pages/BoostManager'));
const VerificationFlow = lazy(() => import('@/pages/VerificationFlow'));
const AdminVerification = lazy(() => import('@/pages/AdminVerification'));
const MyPayments = lazy(() => import('@/pages/MyPayments'));
const OwnerPaymentSetup = lazy(() => import('@/pages/OwnerPaymentSetup'));
const CityRoomsPage = lazy(() => import('@/pages/CityRoomsPage'));
const PageNotFound = lazy(() => import('./lib/PageNotFound'));

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
  return children;
};

// ─── Page transitions ────────────────────────────────────────────────────
const pageVariants = { initial: { opacity: 0, x: 20 }, in: { opacity: 1, x: 0 }, out: { opacity: 0, x: -20 } };
const pageTransition = { type: 'tween', ease: 'easeOut', duration: 0.2 };

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={location.pathname} initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} style={{ width: '100%' }}>
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
              <Route path="/owner-payment-setup" element={<ProtectedRoute><OwnerPaymentSetup /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/admin/email-test" element={<ProtectedRoute><AdminEmailTest /></ProtectedRoute>} />
              <Route path="/admin/moderation" element={<ProtectedRoute><AdminModeration /></ProtectedRoute>} />
              <Route path="/admin/verification" element={<ProtectedRoute><AdminVerification /></ProtectedRoute>} />
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
