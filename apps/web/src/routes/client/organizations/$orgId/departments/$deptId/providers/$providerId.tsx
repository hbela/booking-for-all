import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/apiFetch";
import { useTranslation } from "react-i18next";
import { Calendar as BigCalendar, dateFnsLocalizer } from "react-big-calendar";
import type { View } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useIsMobile } from "@/lib/utils/device";
import { MobileCalendar } from "@/components/calendar/MobileCalendar";
import {
  format,
  parse,
  startOfWeek,
  getDay,
  addHours,
  startOfHour,
  type Locale,
} from "date-fns";
import { enUS, hu, de } from "date-fns/locale";

// Date-fns locale mapping
const dateFnsLocales: Record<string, Locale> = {
  en: enUS,
  hu: hu,
  de: de,
  "en-US": enUS,
  "hu-HU": hu,
  "de-DE": de,
};

// React Big Calendar messages for different languages
const calendarMessages: Record<string, any> = {
  en: {
    allDay: "All Day",
    previous: "Back",
    next: "Next",
    today: "Today",
    month: "Month",
    week: "Week",
    day: "Day",
    agenda: "Agenda",
    date: "Date",
    time: "Time",
    event: "Event",
    noEventsInRange: "There are no events in this range.",
    showMore: (total: number) => `+${total} more`,
  },
  hu: {
    allDay: "Egész nap",
    previous: "Vissza",
    next: "Előre",
    today: "Ma",
    month: "Hónap",
    week: "Hét",
    day: "Nap",
    agenda: "Naptár",
    date: "Dátum",
    time: "Idő",
    event: "Esemény",
    noEventsInRange: "Nincsenek események ebben a tartományban.",
    showMore: (total: number) => `+${total} további`,
  },
  de: {
    allDay: "Ganztägig",
    previous: "Zurück",
    next: "Weiter",
    today: "Heute",
    month: "Monat",
    week: "Woche",
    day: "Tag",
    agenda: "Agenda",
    date: "Datum",
    time: "Zeit",
    event: "Ereignis",
    noEventsInRange: "Es gibt keine Ereignisse in diesem Bereich.",
    showMore: (total: number) => `+${total} weitere`,
  },
};

export const Route = createFileRoute(
  "/client/organizations/$orgId/departments/$deptId/providers/$providerId"
)({
  component: ClientCalendar,
});

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

interface Provider {
  id: string;
  user: {
    name: string;
    email: string;
  };
  bio?: string | null;
  specialization?: string | null;
}

interface CreateBookingData {
  eventId: string;
  providerId: string;
  language?: string; // Optional language code for email translations
}

// API functions
const fetchProvider = async (providerId: string): Promise<Provider> => {
  return apiFetch<Provider>(
    `${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}/api/client/providers/${providerId}`
  );
};

const fetchAvailableEvents = async (providerId: string): Promise<Event[]> => {
  const eventsData = await apiFetch<any[]>(
    `${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}/api/client/providers/${providerId}/available-events`
  );
  // Convert to BigCalendar format
  return eventsData.map((event: any) => ({
    ...event,
    start: new Date(event.start),
    end: new Date(event.end),
    isBooked: false, // All events from this endpoint are available (not booked)
  }));
};

const createBooking = async (data: CreateBookingData): Promise<any> => {
  return apiFetch<any>(
    `${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}/api/client/bookings`,
    {
      method: "POST",
      body: JSON.stringify({
        eventId: data.eventId,
        providerId: data.providerId,
        language: data.language, // Include current language in request body
      }),
    }
  );
};

function ClientCalendar() {
  const { orgId, deptId, providerId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { t, i18n: i18nInstance } = useTranslation();
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState(new Date());

  // Get current language and locale
  const currentLang = i18nInstance.language || "en";
  const langCode = currentLang.split("-")[0]; // Extract 'en' from 'en-US'
  const dateFnsLocale = dateFnsLocales[currentLang] || dateFnsLocales[langCode] || enUS;
  const calendarMessagesForLang = calendarMessages[langCode] || calendarMessages.en;

  // Create localizer with current locale for calendar content
  // But we'll use English locale for time gutter formatting
  const localizer = useMemo(
    () =>
      dateFnsLocalizer({
        format,
        parse,
        startOfWeek,
        getDay,
        locales: {
          [currentLang]: dateFnsLocale,
          [langCode]: dateFnsLocale,
        },
      }),
    [currentLang, langCode, dateFnsLocale]
  );

  // Custom format function for time gutter - always use English locale
  const timeGutterFormat = (date: Date) => {
    return format(date, "h:mm a", { locale: enUS });
  };

  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Query for provider
  const {
    data: provider,
    isLoading: isLoadingProvider,
    error: providerError,
  } = useQuery({
    queryKey: ["client", "providers", providerId],
    queryFn: () => fetchProvider(providerId),
  });

  // Query for events
  const {
    data: events = [],
    isLoading: isLoadingEvents,
    error: eventsError,
    refetch: refetchEvents,
  } = useQuery({
    queryKey: ["client", "providers", providerId, "events"],
    queryFn: () => fetchAvailableEvents(providerId),
  });

  // Booking mutation
  const bookingMutation = useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      toast.success(t("client.bookingConfirmed"));
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["client", "bookings"] });
      queryClient.invalidateQueries({
        queryKey: ["client", "providers", providerId, "events"],
      });
      // Refetch events to update availability
      refetchEvents();
      setShowConfirmDialog(false);
      setSelectedEvent(null);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("client.failedToCreateBooking"));
      }
    },
  });

  const isLoading = isLoadingProvider || isLoadingEvents;

  // Event styling for BigCalendar
  const eventStyleGetter = (event: Event) => {
    const style = {
      backgroundColor: event.isBooked ? "#ef4444" : "#10b981",
      borderRadius: "5px",
      opacity: 0.8,
      color: "white",
      border: "0px",
      display: "block",
    };
    return { style };
  };

  // Handle event selection for booking - show confirmation dialog
  const handleSelectEvent = (event: Event) => {
    if (!event.isBooked) {
      setSelectedEvent(event);
      setShowConfirmDialog(true);
    } else {
      toast.info(t("client.thisTimeSlotAlreadyBooked"));
    }
  };

  // Confirm booking after user clicks confirm
  const confirmBooking = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    await bookingMutation.mutateAsync({
      eventId: selectedEvent.id,
      providerId,
      language: langCode, // Pass current language to ensure email is sent in correct language
    });
  };

  // Cancel booking dialog
  const cancelBooking = () => {
    setShowConfirmDialog(false);
    setSelectedEvent(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">{t("client.loadingBookings")}</div>
      </div>
    );
  }

  if (providerError || eventsError) {
    toast.error(
      providerError
        ? t("client.failedToLoadProviders")
        : t("client.errorLoadingCalendar")
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Button
        variant="ghost"
        className="mb-6"
        onClick={() =>
          navigate({
            to: "/client/organizations/$orgId/departments/$deptId",
            params: { orgId, deptId },
          })
        }
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("client.backToProviders")}
      </Button>

      {/* Calendar - Responsive: Big Calendar for desktop, Mobile Calendar for mobile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("client.availableTimeSlotsOf", { name: provider?.user.name })}</CardTitle>
          <CardDescription>
            {t("client.clickGreenSlotsToBook")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {eventsError ? (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">
                {t("client.errorLoadingCalendar")}{" "}
                <button
                  onClick={() => refetchEvents()}
                  className="underline font-medium"
                >
                  {t("client.tryAgain")}
                </button>
              </p>
            </div>
          ) : isMobile ? (
            <MobileCalendar
              events={events}
              selectedDate={date}
              onDateChange={setDate}
              onEventSelect={handleSelectEvent}
              loading={isLoadingEvents}
            />
          ) : (
            <div style={{ height: "600px" }} className="calendar-container">
              <style>{`
                /* Fix navigation buttons visibility - both light and dark mode */
                .rbc-toolbar button {
                  color: hsl(var(--foreground)) !important;
                  background-color: hsl(var(--background)) !important;
                  border: 1px solid hsl(var(--border)) !important;
                  padding: 8px 12px !important;
                  margin: 0 2px !important;
                  border-radius: 4px !important;
                  font-weight: 500 !important;
                  opacity: 1 !important;
                }
                
                .rbc-toolbar button:hover {
                  background-color: hsl(var(--accent)) !important;
                  color: hsl(var(--accent-foreground)) !important;
                }
                
                .rbc-toolbar button.rbc-active {
                  background-color: hsl(var(--primary)) !important;
                  color: hsl(var(--primary-foreground)) !important;
                }
                
                /* Dark mode: Ensure buttons are visible */
                .dark .rbc-toolbar button {
                  color: #ffffff !important;
                  background-color: #374151 !important;
                  border: 1px solid #6b7280 !important;
                }
                
                .dark .rbc-toolbar button:hover {
                  background-color: #4b5563 !important;
                  color: #ffffff !important;
                }
                
                .dark .rbc-toolbar button.rbc-active {
                  background-color: #3b82f6 !important;
                  color: #ffffff !important;
                }
                
                /* Current day highlighting - only highlight the header, not the whole column */
                .rbc-today {
                  background-color: transparent !important;
                }
                
                .rbc-header.rbc-today {
                  background-color: hsl(var(--primary)) !important;
                  color: hsl(var(--primary-foreground)) !important;
                  font-weight: 600 !important;
                }
                
                .dark .rbc-header.rbc-today {
                  background-color: #3b82f6 !important;
                  color: #ffffff !important;
                }
                
                /* Ensure day slots don't have background for today */
                .rbc-day-slot.rbc-today {
                  background-color: transparent !important;
                }
                
                /* Improve grid border visibility */
                .rbc-time-view .rbc-time-slot {
                  border-top: 1px solid hsl(var(--border)) !important;
                }
                
                .rbc-time-view .rbc-day-slot {
                  border-right: 1px solid hsl(var(--border));
                }
                
                .dark .rbc-time-view .rbc-time-slot {
                  border-top: 1px solid #6b7280 !important;
                }
                
                .dark .rbc-time-view .rbc-day-bg {
                  border-right: 1px solid #6b7280 !important;
                }
                
                .dark .rbc-time-header .rbc-time-header-content {
                  border-bottom: 1px solid #6b7280 !important;
                }
                
                .dark .rbc-time-view {
                  border: 1px solid #6b7280 !important;
                }
                
                .dark .rbc-time-content {
                  border-top: 1px solid #6b7280 !important;
                }
                
                .dark .rbc-day-slot {
                  border-right: 1px solid #6b7280 !important;
                }
                
                .dark .rbc-time-gutter {
                  border-right: 1px solid #6b7280 !important;
                }
              `}</style>
              <BigCalendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                view={view}
                onView={setView}
                date={date}
                onNavigate={setDate}
                onSelectEvent={handleSelectEvent}
                eventPropGetter={eventStyleGetter}
                style={{ height: "100%" }}
                step={15}
                showMultiDayTimes
                defaultView="week"
                min={new Date(0, 0, 0, 8, 0, 0)}
                max={new Date(0, 0, 0, 20, 0, 0)}
                popup
                popupOffset={{ x: 10, y: 10 }}
                messages={calendarMessagesForLang}
                culture={currentLang}
                formats={{
                  timeGutterFormat: timeGutterFormat,
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("client.confirmBooking")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("client.reviewAndConfirmAppointmentDetails")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedEvent && (
            <div className="space-y-4 py-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{t("client.provider")}</p>
                  <p className="font-medium">{provider?.user.name}</p>
                  {provider?.specialization && (
                    <p className="text-sm text-muted-foreground">
                      {provider.specialization}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{t("client.date")}</p>
                  <p className="font-medium">
                    {format(selectedEvent.start, "PPPP", { locale: dateFnsLocale })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{t("client.time")}</p>
                  <p className="font-medium">
                    {format(selectedEvent.start, "h:mm a", { locale: enUS })} -{" "}
                    {format(selectedEvent.end, "h:mm a", { locale: enUS })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("client.duration")}: {selectedEvent.duration} {t("client.minutes")}
                  </p>
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="font-medium text-sm mb-1">
                  {selectedEvent.title}
                </p>
                {selectedEvent.description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedEvent.description}
                  </p>
                )}
                {selectedEvent.price && (
                  <p className="text-sm font-semibold mt-2">
                    {t("client.price")}: ${selectedEvent.price}
                  </p>
                )}
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={cancelBooking}
              disabled={bookingMutation.isPending}
            >
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBooking}
              disabled={bookingMutation.isPending}
            >
              {bookingMutation.isPending ? t("client.booking") : t("client.confirmBooking")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
