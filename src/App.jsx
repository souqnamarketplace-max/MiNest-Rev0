import React from 'react'
import { ThemeProvider } from 'next-themes'
import { Toaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import InstallPrompt from '@/components/pwa/InstallPrompt';
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { CountryProvider } from '@/lib/CountryContext';
import AppLayout from '@/components/layout/AppLayout';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import SearchRooms from '@/pages/SearchRooms';
import SearchRoommates from '@/pages/SearchRoommates';
import SeekerDetail from '@/pages/SeekerDetail';
import ListingDetail from '@/pages/ListingDetail';
import CreateListing from '@/pages/CreateListing';
import EditListing from '@/pages/EditListing';
import Dashboard from '@/pages/Dashboard';
import Messages from '@/pages/Messages';
import Profile from '@/pages/Profile';
import Favorites from '@/pages/Favorites';
import HowItWorks from '@/pages/HowItWorks';
import Safety from '@/pages/Safety';
import Pricing from '@/pages/Pricing';
import Contact from '@/pages/Contact';
import Terms from '@/pages/Terms';
import Privacy from '@/pages/Privacy';
import AcceptableUse from '@/pages/AcceptableUse';
import Admin from '@/pages/Admin';
import MyBookings from "@/pages/MyBookings";
import AdminModeration from '@/pages/AdminModeration';
import AdminEmailTest from '@/pages/AdminEmailTest';
import CityListings from '@/pages/CityListings';
import SeekerOnboarding from '@/pages/SeekerOnboarding';
import SavedSearches from '@/pages/SavedSearches.jsx';
import NotificationPreferences from '@/pages/NotificationPreferences.jsx';
import Notifications from '@/pages/Notifications';
import MyViewings from '@/pages/MyViewings';
import BoostManager from '@/pages/BoostManager';
import VerificationFlow from '@/pages/VerificationFlow';
import AdminVerification from '@/pages/AdminVerification';
import MyPayments from '@/pages/MyPayments';
import OwnerPaymentSetup from '@/pages/OwnerPaymentSetup';
import CityRoomsPage from '@/pages/CityRoomsPage';

const ProtectedRoute = ({ children }) => {
  const { user, isLoadingAuth } = useAuth();
  const location = useLocation();
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return children;
};

const pageVariants = { initial: { opacity: 0, x: 20 }, in: { opacity: 1, x: 0 }, out: { opacity: 0, x: -20 } };
const pageTransition = { type: 'tween', ease: 'easeOut', duration: 0.2 };

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={location.pathname} initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} style={{ width: '100%' }}>
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
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  return (
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
  );
}

export default App;
