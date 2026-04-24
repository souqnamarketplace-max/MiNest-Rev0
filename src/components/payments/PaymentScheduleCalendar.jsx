/**
 * Shows the full rent payment schedule derived from rental agreements.
 * Each payment date is calculated from lease_start_date + interval cycle.
 */
import React, { useMemo, useState } from "react";
import { formatCents } from "@/lib/paymentHelpers";
import { format, addMonths, addWeeks, addYears, isBefore, isAfter, isSameDay } from "date-fns";
import { Calendar, CreditCard, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function generateScheduleFromAgreement(agreement, paidTransactions) {
  if (!agreement?.lease_start_date || !agreement?.rent_amount) return [];

  const interval = agreement.interval || "month";
  const start = new Date(agreement.lease_start_date);
  const end = agreement.lease_end_date ? new Date(agreement.lease_end_date) : null;
  const today = new Date();
  const items = [];

  let current = new Date(start);

  // Build a set of paid dates from transactions for matching
  const paidDates = (paidTransactions || []).map(tx => new Date(tx.created_date));

  const isPaidAround = (targetDate) =>
    paidDates.some(pd => {
      const diff = Math.abs(pd - targetDate) / (1000 * 60 * 60 * 24);
      return diff <= 5; // within 5 days = consider matched
    });

  while (!end || isBefore(current, end) || isSameDay(current, end)) {
    const paymentDate = new Date(current);
    const isPast = isBefore(paymentDate, today);
    const paid = isPast && isPaidAround(paymentDate);

    items.push({
      date: paymentDate,
      label: agreement.listing_title || "Rent",
      amount: agreement.rent_amount,
      currency: agreement.currency || "cad",
      type: isPast ? (paid ? "paid" : "due") : "upcoming",
      agreement_id: agreement.id,
    });

    // Advance by interval
    if (interval === "week") current = addWeeks(current, 1);
    else if (interval === "year") current = addYears(current, 1);
    else current = addMonths(current, 1);

    // Safety: stop if no end date but we've gone 24+ months out
    if (!end && items.length >= 24) break;
  }

  return items;
}

export default function PaymentScheduleCalendar({ agreements = [], transactions = [], subscriptions = [] }) {
  const [showAll, setShowAll] = useState(false);

  const schedule = useMemo(() => {
    const items = [];

    // Generate from agreements (most accurate — uses lease terms)
    const activeAgreements = agreements.filter(a => a.status === "accepted" && a.rent_amount);
    activeAgreements.forEach(agreement => {
      const txForAgreement = transactions.filter(
        tx => tx.listing_id === agreement.listing_id || tx.agreement_id === agreement.id
      );
      const generated = generateScheduleFromAgreement(agreement, txForAgreement);
      items.push(...generated);
    });

    // Fallback: if no accepted agreements but has subscriptions, show upcoming from subscriptions
    if (activeAgreements.length === 0) {
      const today = new Date();
      subscriptions.filter(s => s.status === "active" || s.status === "trialing").forEach(sub => {
        if (!sub.next_payment_date) return;
        let current = new Date(sub.next_payment_date);
        const end = sub.end_date ? new Date(sub.end_date) : null;
        const interval = sub.plan_interval || "month";
        for (let i = 0; i < 6; i++) {
          if (end && isAfter(current, end)) break;
          if (isAfter(current, today)) {
            items.push({
              date: new Date(current),
              label: sub.listing_title || "Rent",
              amount: sub.amount_per_period,
              currency: "cad",
              type: "upcoming",
            });
          }
          if (interval === "week") current = addWeeks(current, 1);
          else if (interval === "year") current = addYears(current, 1);
          else current = addMonths(current, 1);
        }
      });
    }

    return items.sort((a, b) => a.date - b.date);
  }, [agreements, transactions, subscriptions]);

  if (schedule.length === 0) return null;

  // Show only from 2 months ago to 6 months ahead by default
  const today = new Date();
  const twoMonthsAgo = addMonths(today, -2);
  const sixMonthsAhead = addMonths(today, 6);

  const visible = showAll
    ? schedule
    : schedule.filter(item => isAfter(item.date, twoMonthsAgo) && isBefore(item.date, sixMonthsAhead));

  const grouped = visible.reduce((acc, item) => {
    const monthKey = format(item.date, "MMMM yyyy");
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(item);
    return acc;
  }, {});

  const typeConfig = {
    paid: { bg: "bg-accent/10", icon: "text-accent", badge: "bg-accent/10 text-accent", label: "Paid" },
    due: { bg: "bg-destructive/10", icon: "text-destructive", badge: "bg-destructive/10 text-destructive", label: "Due" },
    upcoming: { bg: "bg-secondary/10", icon: "text-secondary", badge: "bg-secondary/10 text-secondary", label: "Upcoming" },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-accent" />
          <h2 className="text-base font-semibold text-foreground">Payment Schedule</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent inline-block" /> Paid</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive inline-block" /> Due</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-secondary inline-block" /> Upcoming</span>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {Object.entries(grouped).map(([month, items]) => (
          <div key={month}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{month}</p>
            <div className="space-y-2">
              {items.map((item, i) => {
                const cfg = typeConfig[item.type] || typeConfig.upcoming;
                return (
                  <div key={i} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                      <CreditCard className={`w-4 h-4 ${cfg.icon}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground line-clamp-1">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{format(item.date, "EEEE, MMM d, yyyy")}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-foreground">{formatCents(item.amount, item.currency)}</p>
                      <Badge className={`text-[10px] ${cfg.badge}`}>{cfg.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {schedule.length > visible.length && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-2 border border-dashed border-border rounded-xl"
        >
          {showAll ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show all {schedule.length} payments</>}
        </button>
      )}
    </div>
  );
}