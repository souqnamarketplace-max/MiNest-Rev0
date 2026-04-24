import React from "react";
import { Calendar, DollarSign } from "lucide-react";
import { getBookingStatusInfo } from "@/lib/bookingHelpers";

export default function BookingCard({ booking, viewAs = "host", children }) {
  const statusInfo = getBookingStatusInfo(booking.status);

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {booking.listing_title || "Booking"}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {booking.checkin_date} → {booking.checkout_date}
            </span>
            <span>{booking.nights} night{booking.nights !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </div>

      {/* Pricing */}
      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1 text-muted-foreground">
          <DollarSign className="w-3.5 h-3.5" />
          ${Number(booking.nightly_rate).toLocaleString()}/night
        </span>
        {booking.cleaning_fee > 0 && (
          <span className="text-muted-foreground">+ ${Number(booking.cleaning_fee).toLocaleString()} cleaning</span>
        )}
        <span className="font-semibold text-accent ml-auto">
          ${Number(booking.total_amount).toLocaleString()} total
        </span>
      </div>

      {/* Guest message */}
      {booking.guest_message && (
        <div className="bg-muted/50 rounded-lg p-2.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {viewAs === "host" ? "Guest:" : "Your message:"}
          </span>{" "}
          {booking.guest_message}
        </div>
      )}

      {/* Host response */}
      {booking.host_response && (
        <div className="bg-accent/5 rounded-lg p-2.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {viewAs === "host" ? "Your response:" : "Host:"}
          </span>{" "}
          {booking.host_response}
        </div>
      )}

      {/* Action buttons (passed as children) */}
      {children && <div className="flex gap-2 pt-1">{children}</div>}
    </div>
  );
}
