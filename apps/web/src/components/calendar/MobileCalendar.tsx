import { useState, useMemo, useEffect } from "react";
import Calendar from "react-calendar";
import type { Value } from "react-calendar/dist/cjs/shared/types";
import { format, isSameDay, startOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Clock, ChevronLeft, ChevronRight, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import "react-calendar/dist/Calendar.css";

interface Event {
  id: string;
  title: string;
  description?: string | null;
  start: Date;
  end: Date;
  duration: number;
  price?: number | null;
  isBooked?: boolean;
}

interface MobileCalendarProps {
  events: Event[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onEventSelect: (event: Event) => void;
  loading?: boolean;
}

export function MobileCalendar({
  events,
  selectedDate,
  onDateChange,
  onEventSelect,
  loading = false,
}: MobileCalendarProps) {
  const [calendarValue, setCalendarValue] = useState<Date>(selectedDate);

  // Filter events for the selected date
  const dayEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dayStart = startOfDay(selectedDate);
    return events.filter((event) => isSameDay(event.start, dayStart));
  }, [events, selectedDate]);

  // Sort events by start time
  const sortedEvents = useMemo(() => {
    return [...dayEvents].sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [dayEvents]);

  // Check if a date has free (non-booked) events
  const hasFreeEvents = (date: Date) => {
    return events.some((event) => 
      isSameDay(event.start, date) && !event.isBooked
    );
  };

  // Custom tile content with visual indicator
  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === "month") {
      const hasFree = hasFreeEvents(date);
      if (hasFree) {
        return (
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
            <div className="flex items-center justify-center gap-0.5">
              <Circle className="h-2 w-2 fill-green-600 dark:fill-green-400 text-green-600 dark:text-green-400" />
            </div>
          </div>
        );
      }
    }
    return null;
  };

  const handleCalendarChange = (value: Value) => {
    if (value instanceof Date) {
      setCalendarValue(value);
      onDateChange(value);
    } else if (Array.isArray(value) && value[0] instanceof Date) {
      setCalendarValue(value[0]);
      onDateChange(value[0]);
    }
  };

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(selectedDate);
    if (direction === "prev") {
      newDate.setDate(newDate.getDate() - 1);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCalendarValue(newDate);
    onDateChange(newDate);
  };

  // Update calendar value when selectedDate changes externally
  useEffect(() => {
    if (!isSameDay(calendarValue, selectedDate)) {
      setCalendarValue(selectedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  return (
    <div className="w-full space-y-6">
      {/* Calendar Picker */}
      <div className="flex flex-col items-center">
        <Calendar
          onChange={handleCalendarChange}
          value={calendarValue}
          className="w-full rounded-lg border bg-card text-card-foreground shadow-sm"
          tileClassName={({ date, view }) => {
            if (view === "month") {
              const hasFree = hasFreeEvents(date);
              const isSelected = isSameDay(date, selectedDate);
              return cn(
                "hover:bg-accent hover:text-accent-foreground rounded-md transition-colors relative",
                hasFree && "pb-6", // Add extra padding for indicator
                isSelected && "bg-primary text-primary-foreground font-semibold"
              );
            }
            return "";
          }}
          tileContent={tileContent}
        />
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigateDate("prev")}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous Day
        </Button>
        <div className="text-center">
          <h3 className="font-semibold text-lg">
            {format(selectedDate, "EEEE, MMMM d, yyyy")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {sortedEvents.length} available slot{sortedEvents.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigateDate("next")}
          className="flex items-center gap-2"
        >
          Next Day
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Time Slots List */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading time slots...
          </div>
        ) : sortedEvents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              No available time slots for this date.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Try selecting a different date.
            </p>
          </div>
        ) : (
          sortedEvents.map((event) => (
            <button
              key={event.id}
              onClick={() => onEventSelect(event)}
              disabled={event.isBooked}
              className={cn(
                "w-full text-left p-4 rounded-lg border transition-all",
                "min-h-[44px] touch-manipulation", // Ensure minimum 44x44px for touch
                event.isBooked
                  ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 cursor-not-allowed opacity-75"
                  : "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900 hover:bg-green-100 dark:hover:bg-green-950/30 active:bg-green-200 dark:active:bg-green-950/40 cursor-pointer",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              )}
            >
              <div className="flex items-center gap-3">
                <Clock className={cn(
                  "h-5 w-5 flex-shrink-0",
                  event.isBooked
                    ? "text-red-600 dark:text-red-400"
                    : "text-green-600 dark:text-green-400"
                )} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-base">
                    {format(event.start, "h:mm a")} - {format(event.end, "h:mm a")}
                  </div>
                  {event.duration && (
                    <div className="text-sm text-muted-foreground">
                      Duration: {event.duration} minutes
                    </div>
                  )}
                  {event.title && (
                    <div className="text-sm font-medium mt-1">{event.title}</div>
                  )}
                  {event.price && (
                    <div className="text-sm font-semibold mt-1">
                      ${event.price}
                    </div>
                  )}
                </div>
                {event.isBooked && (
                  <span className="text-xs font-medium text-red-600 dark:text-red-400 px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30">
                    Booked
                  </span>
                )}
                {!event.isBooked && (
                  <span className="text-xs font-medium text-green-600 dark:text-green-400 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30">
                    Available
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
