import React from "react";
import { Link } from "react-router-dom";

const scrollToTop = () => window.scrollTo({ top: 0, behavior: "instant" });

export default function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-1.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                <span className="text-accent-foreground font-extrabold text-sm">M</span>
              </div>
              <span className="text-xl font-extrabold tracking-tight">
                <span className="text-white">Mi</span><span className="text-white font-black">Nest</span>
              </span>
            </div>
            <p className="text-sm opacity-70 leading-relaxed">
              Smart housing and roommate matching for modern renters across Canada and the USA. MiNest.ca
            </p>
          </div>

          {/* Explore */}
          <div>
            <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider opacity-80">Explore</h4>
            <ul className="space-y-2 text-sm opacity-70">
              <li><Link to="/search" onClick={scrollToTop} className="hover:opacity-100 transition-opacity">Find a Place</Link></li>
              <li><Link to="/roommates" onClick={scrollToTop} className="hover:opacity-100 transition-opacity">Find a Roommate</Link></li>
              <li><Link to="/how-it-works" onClick={scrollToTop} className="hover:opacity-100 transition-opacity">How It Works</Link></li>
              <li><Link to="/pricing" onClick={scrollToTop} className="hover:opacity-100 transition-opacity">Pricing</Link></li>
              <li><Link to="/my-payments" onClick={scrollToTop} className="hover:opacity-100 transition-opacity">Pay Rent Online</Link></li>
              <li><Link to="/safety" onClick={scrollToTop} className="hover:opacity-100 transition-opacity">Safety</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider opacity-80">Support</h4>
            <ul className="space-y-2 text-sm opacity-70">
              <li><Link to="/contact" onClick={scrollToTop} className="hover:opacity-100 transition-opacity">Contact Us</Link></li>
              <li><Link to="/safety" onClick={scrollToTop} className="hover:opacity-100 transition-opacity">Safety Tips</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider opacity-80">Legal</h4>
            <ul className="space-y-2 text-sm opacity-70">
              <li><Link to="/terms" onClick={scrollToTop} className="hover:opacity-100 transition-opacity">Terms of Service</Link></li>
              <li><Link to="/privacy" onClick={scrollToTop} className="hover:opacity-100 transition-opacity">Privacy Policy</Link></li>
              <li><Link to="/acceptable-use" onClick={scrollToTop} className="hover:opacity-100 transition-opacity">Acceptable Use</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-primary-foreground/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm opacity-60">© {new Date().getFullYear()} MiNest.ca — All rights reserved.</p>
          <div className="flex items-center gap-4 text-sm opacity-60">
            <span>🇨🇦 Canada</span>
            <span>🇺🇸 USA</span>
          </div>
        </div>
      </div>
    </footer>
  );
}