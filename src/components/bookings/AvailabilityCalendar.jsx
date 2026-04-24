import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { supabase } from '@/lib/supabase';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function AvailabilityCalendar({ listing, onUpdate }) {
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [blockedDates, setBlockedDates] = useState(listing?.blocked_dates || []);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch booked dates from bookings table
  const { data: bookedDates = [] } = useQuery({
    queryKey: ["booked-dates", listing?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('bookings')
        .select('checkin_date, checkout_date, status')
        .eq('listing_id', listing.id)
        .in('status', ['confirmed', 'pending']);

      const dates = [];
      if (data) {
        for (const booking of data) {
          const current = new Date(booking.checkin_date);
          const end = new Date(booking.checkout_date);
          while (current < end) {
            dates.push({
              date: current.toISOString().split('T')[0],
              status: booking.status,
            });
            current.setDate(current.getDate() + 1);
          }
        }
      }
      return dates;
    },
    enabled: !!listing?.id,
  });

  useEffect(() => {
    setBlockedDates(listing?.blocked_dates || []);
  }, [listing?.blocked_dates]);

  const bookedSet = useMemo(() => {
    const map = {};
    bookedDates.forEach(d => { map[d.date] = d.status; });
    return map;
  }, [bookedDates]);

  const blockedSet = useMemo(() => new Set(blockedDates), [blockedDates]);

  const getDaysInMonth = (month, year) => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);

    return days;
  };

  const days = getDaysInMonth(currentMonth, currentYear);
  const today = new Date().toISOString().split('T')[0];

  const getDateString = (day) => {
    if (!day) return null;
    const m = String(currentMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${currentYear}-${m}-${d}`;
  };

  const toggleBlockDate = (day) => {
    const dateStr = getDateString(day);
    if (!dateStr || dateStr < today) return;
    if (bookedSet[dateStr]) {
      toast.error("This date has an active booking and cannot be blocked.");
      return;
    }

    setBlockedDates(prev => {
      const set = new Set(prev);
      if (set.has(dateStr)) {
        set.delete(dateStr);
      } else {
        set.add(dateStr);
      }
      return Array.from(set);
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await entities.Listing.update(listing.id, {
        blocked_dates: blockedDates,
      });
      toast.success("Availability calendar updated!");
      setHasChanges(false);
      onUpdate?.();
      queryClient.invalidateQueries({ queryKey: ["listing", listing.id] });
    } catch {
      toast.error("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4 text-accent" />
          Availability Calendar
        </h3>
        {hasChanges && (
          <Button size="sm" onClick={handleSave} disabled={saving}
            className="bg-accent hover:bg-accent/90 text-accent-foreground text-xs gap-1">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-1 hover:bg-muted rounded">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium">{MONTHS[currentMonth]} {currentYear}</span>
        <button onClick={nextMonth} className="p-1 hover:bg-muted rounded">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAYS.map(d => (
          <div key={d} className="text-xs text-muted-foreground font-medium py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;

          const dateStr = getDateString(day);
          const isPast = dateStr < today;
          const isBooked = bookedSet[dateStr];
          const isBlocked = blockedSet.has(dateStr);
          const isToday = dateStr === today;

          let bg = "bg-muted/30 hover:bg-muted/60 cursor-pointer";
          let text = "text-foreground";

          if (isPast) {
            bg = "bg-transparent cursor-not-allowed";
            text = "text-muted-foreground/40";
          } else if (isBooked === "confirmed") {
            bg = "bg-accent/20 cursor-not-allowed";
            text = "text-accent font-medium";
          } else if (isBooked === "pending") {
            bg = "bg-yellow-500/20 cursor-not-allowed";
            text = "text-yellow-700 dark:text-yellow-400 font-medium";
          } else if (isBlocked) {
            bg = "bg-destructive/15 hover:bg-destructive/25 cursor-pointer";
            text = "text-destructive font-medium";
          }

          return (
            <button key={day} onClick={() => !isPast && !isBooked && toggleBlockDate(day)}
              disabled={isPast || !!isBooked}
              className={`aspect-square rounded-lg flex items-center justify-center text-xs transition-colors ${bg} ${text} ${isToday ? "ring-1 ring-accent" : ""}`}
              title={
                isBooked === "confirmed" ? "Booked (confirmed)" :
                isBooked === "pending" ? "Booked (pending)" :
                isBlocked ? "Blocked — click to unblock" :
                isPast ? "Past date" : "Available — click to block"
              }
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2 border-t border-border">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-muted/30 border border-border" /> Available
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-accent/20" /> Booked
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-yellow-500/20" /> Pending
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-destructive/15" /> Blocked
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Click dates to block/unblock. Booked dates cannot be changed.
      </p>
    </div>
  );
}
