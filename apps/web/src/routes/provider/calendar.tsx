import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import type { View, Components } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
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
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import * as Sentry from "@sentry/react";
import { SentrySmokeTest } from "@/components/SentrySmokeTest";
import { apiFetch, ApiError } from "@/lib/apiFetch";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

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

export const Route = createFileRoute("/provider/calendar")({
  component: ProviderCalendarComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
      });
    }

    return { session };
  },
});

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  isBooked: boolean;
  booking?: {
    id?: string;
    status?: string;
    updatedAt?: string;
    member?: {
      name?: string;
      email?: string;
    };
  };
}

// API functions
const fetchProvider = async (userId: string): Promise<any> => {
  const response = await apiFetch<any>(
    `${import.meta.env.VITE_SERVER_URL}/api/providers?userId=${userId}`
  );
  // Handle both array response and wrapped response
  const providers = Array.isArray(response)
    ? response
    : (response as any)?.data || [];
  if (providers.length === 0) {
    throw new Error("You are not registered as a provider");
  }
  const provider = providers[0];
  return provider;
};

const fetchEvents = async (providerId: string): Promise<any[]> => {
  return apiFetch<any[]>(
    `${import.meta.env.VITE_SERVER_URL}/api/events?providerId=${providerId}`
  );
};

const createEvent = async (data: {
  providerId: string;
  title: string;
  description?: string;
  start: string;
  end: string;
}): Promise<any> => {
  return apiFetch<any>(
    `${import.meta.env.VITE_SERVER_URL}/api/provider/events`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
};

const updateEvent = async (data: {
  eventId: string;
  title: string;
  description?: string;
}): Promise<any> => {
  return apiFetch<any>(
    `${import.meta.env.VITE_SERVER_URL}/api/provider/events/${data.eventId}`,
    {
      method: "PUT",
      body: JSON.stringify({
        title: data.title,
        description: data.description,
      }),
    }
  );
};

const deleteEvent = async (eventId: string): Promise<void> => {
  await apiFetch(
    `${import.meta.env.VITE_SERVER_URL}/api/provider/events/${eventId}`,
    {
      method: "DELETE",
    }
  );
};

interface EventFormData {
  title: string;
  description: string;
  duration: number;
}

function ProviderCalendarComponent() {
  const routeContext = Route.useRouteContext();
  const session = routeContext?.session;
  const queryClient = useQueryClient();
  const { t, i18n: i18nInstance } = useTranslation();
  const userId = session?.data?.user?.id;
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState(new Date());

  // Guard clause: if session is not available, show loading or redirect
  if (!session || !session.data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>{t("provider.loading") || "Loading..."}</p>
      </div>
    );
  }

  // Get current language and locale
  const currentLang = i18nInstance.language || "en";
  const langCode = currentLang.split("-")[0]; // Extract 'en' from 'en-US'
  const dateFnsLocale =
    dateFnsLocales[currentLang] || dateFnsLocales[langCode] || enUS;
  const calendarMessagesForLang =
    calendarMessages[langCode] || calendarMessages.en;

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

  // Custom format function for time gutter with locale-aware AM/PM translations
  const timeGutterFormat = (date: Date) => {
    const formatted = format(date, "h:mm a", { locale: dateFnsLocale });

    // Custom AM/PM translations for Hungarian and German
    if (langCode === "hu") {
      // Hungarian: DE (délelőtt - before noon), DU (délután - afternoon)
      return formatted.replace(/\bAM\b/gi, "DE").replace(/\bPM\b/gi, "DU");
    } else if (langCode === "de") {
      // German: AM (vormittags - before noon), NA (nachmittags - afternoon)
      return formatted.replace(/\bAM\b/gi, "AM").replace(/\bPM\b/gi, "NA");
    }

    // Default: use locale's native format (English AM/PM)
    return formatted;
  };

  // Custom TimeGutterHeader component to show all 5-minute labels
  const CustomTimeGutterHeader = ({ label, ...props }: any) => {
    // Always show the label for every slot
    if (!label) {
      // If no label provided, generate one from the slot time
      const slotTime = (props as any).value;
      if (slotTime) {
        const formatted = format(slotTime, "h:mm a", { locale: dateFnsLocale });
        // Apply custom AM/PM translations
        if (langCode === "hu") {
          label = formatted.replace(/\bAM\b/gi, "DE").replace(/\bPM\b/gi, "DU");
        } else if (langCode === "de") {
          label = formatted.replace(/\bAM\b/gi, "AM").replace(/\bPM\b/gi, "NA");
        } else {
          label = formatted;
        }
      }
    }
    return (
      <div {...props} className="rbc-label rbc-label-show-all">
        {label || ""}
      </div>
    );
  };

  // Custom TimeSlotGroup component to ensure all labels are shown
  const CustomTimeSlotGroup = ({ children, ...props }: any) => {
    return <div {...props}>{children}</div>;
  };

  // Custom Agenda date component that always shows the date (no rowspan)
  const CustomAgendaDate = ({ label, date }: any) => {
    const formatDate = (dateValue: Date | string | null | undefined) => {
      if (!dateValue) return label || "";

      // Convert to Date if it's a string
      const dateObj =
        dateValue instanceof Date ? dateValue : new Date(dateValue);

      // Check if date is valid
      if (isNaN(dateObj.getTime())) {
        return label || "";
      }

      try {
        return format(dateObj, "EEE MMM d", { locale: dateFnsLocale });
      } catch (error) {
        console.error("Error formatting date:", error, dateValue);
        return label || "";
      }
    };

    return (
      <td className="rbc-agenda-date-cell">{formatDate(date || label)}</td>
    );
  };

  // Custom components to show all time labels
  const customComponents = useMemo(
    () => ({
      timeGutterHeader: CustomTimeGutterHeader,
      timeSlotGroup: CustomTimeSlotGroup,
      agenda: {
        date: CustomAgendaDate,
      },
    }),
    [dateFnsLocale, langCode]
  );

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCancellationDialog, setShowCancellationDialog] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(
    null
  );
  const [selectedSlot, setSelectedSlot] = useState<{
    start: Date;
    end: Date;
  } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );

  // Query for provider
  const {
    data: provider,
    isLoading: isLoadingProvider,
    error: providerError,
  } = useQuery<any>({
    queryKey: ["provider", { userId }],
    queryFn: () => {
      if (!userId) {
        throw new Error("User ID is required");
      }
      return fetchProvider(userId);
    },
    enabled: !!userId && !!session?.data,
  });

  // Query for events (enabled when provider is loaded)
  const {
    data: rawEvents = [],
    isLoading: isLoadingEvents,
    error: eventsError,
  } = useQuery<any[]>({
    queryKey: ["events", { providerId: provider?.id }],
    queryFn: () => fetchEvents(provider.id),
    enabled: !!provider?.id,
  });

  // Format events for calendar
  const events = useMemo(() => {
    if (!rawEvents || rawEvents.length === 0) {
      return [];
    }

    const now = new Date();
    const pastCutoff = new Date();
    pastCutoff.setDate(pastCutoff.getDate() - 30);

    return rawEvents
      .map((event: any): CalendarEvent | null => {
        // Validate dates before creating Date objects
        if (!event.start || !event.end) {
          console.warn("Event missing start or end date:", event);
          return null;
        }

        const startDate = new Date(event.start);
        const endDate = new Date(event.end);

        // Check if dates are valid
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          console.warn("Event has invalid date:", event);
          return null;
        }

        const isCancelled = event.booking?.status === "CANCELLED";
        let title = event.title;

        if (event.isBooked) {
          if (isCancelled) {
            title = `${event.title} - ${t("provider.canceled")} - ${t("provider.bookedBy")} ${
              event.booking?.member?.name || t("provider.client")
            }`;
          } else {
            title = `${event.title} - ${t("provider.bookedBy")} ${
              event.booking?.member?.name || t("provider.client")
            }`;
          }
        }

        const calendarEvent: CalendarEvent = {
          id: event.id,
          title,
          description: event.description,
          start: startDate,
          end: endDate,
          isBooked: event.isBooked,
          booking: event.booking
            ? {
                id: event.booking.id,
                status: event.booking.status,
                updatedAt: event.booking.updatedAt,
                member: event.booking.member
                  ? {
                      name: event.booking.member.name,
                      email: event.booking.member.email,
                    }
                  : undefined,
              }
            : undefined,
        };
        return calendarEvent;
      })
      .filter((event): event is CalendarEvent => {
        // Filter out null events (invalid dates)
        if (!event) return false;
        // Validate dates are still valid after conversion
        if (isNaN(event.start.getTime()) || isNaN(event.end.getTime())) {
          return false;
        }
        // Filter out events older than 30 days
        return event.start >= pastCutoff;
      });
  }, [rawEvents, t]);

  // Mutations
  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      toast.success(t("provider.eventCreatedSuccessfully"));
      setShowModal(false);
      queryClient.invalidateQueries({
        queryKey: ["events", { providerId: provider?.id }],
      });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("provider.failedToCreateEvent"));
      }
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: updateEvent,
    onSuccess: () => {
      toast.success(t("provider.eventUpdatedSuccessfully"));
      setShowModal(false);
      queryClient.invalidateQueries({
        queryKey: ["events", { providerId: provider?.id }],
      });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("provider.failedToUpdateEvent"));
      }
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      toast.success(t("provider.eventDeletedSuccessfully"));
      setShowModal(false);
      queryClient.invalidateQueries({
        queryKey: ["events", { providerId: provider?.id }],
      });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("provider.failedToDeleteEvent"));
      }
    },
  });

  // TanStack Form for event
  const form = useForm({
    defaultValues: {
      title: "",
      description: "",
      duration: 30,
    },
    onSubmit: async ({ value }) => {
      if (selectedEvent) {
        // Update existing event
        await updateEventMutation.mutateAsync({
          eventId: selectedEvent.id,
          title: value.title,
          description: value.description,
        });
      } else if (selectedSlot && provider) {
        // Create new event
        await createEventMutation.mutateAsync({
          providerId: provider.id,
          title: value.title,
          description: value.description,
          start: selectedSlot.start.toISOString(),
          end: selectedSlot.end.toISOString(),
        });
      }
    },
  });

  const loading = isLoadingProvider || isLoadingEvents;

  // Show errors
  useEffect(() => {
    if (providerError) {
      toast.error(
        providerError.message || t("provider.errorLoadingProviderInformation")
      );
    }
    if (eventsError) {
      toast.error(t("provider.errorLoadingEvents"));
    }
  }, [providerError, eventsError, t]);

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    console.log("📅 Calendar slot selected:", { start, end });

    // Check if the selected date is in the past
    const now = new Date();
    if (start < now) {
      toast.error(t("provider.cannotCreateAvailabilityInPast"));
      return;
    }

    // Round to nearest 5-minute boundary
    const minutes = start.getMinutes();
    const roundedMinutes = Math.round(minutes / 5) * 5;
    const roundedStart = new Date(start);
    roundedStart.setMinutes(roundedMinutes, 0, 0);

    // Create slot with default 30-minute duration
    const roundedEnd = new Date(roundedStart);
    roundedEnd.setMinutes(roundedEnd.getMinutes() + 30);

    console.log("📅 Opening modal with slot:", { roundedStart, roundedEnd });
    setSelectedSlot({ start: roundedStart, end: roundedEnd });
    setSelectedEvent(null);
    form.reset();
    form.setFieldValue("duration", 30);
    setShowModal(true);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    // Show cancellation dialog only if event is still marked as booked with a cancelled booking
    const isCancelledAndBooked = event.isBooked && event.booking?.status === "CANCELLED";

    if (isCancelledAndBooked) {
      setSelectedEvent(event);
      setShowCancellationDialog(true);
    } else {
      // Normal flow: show edit modal
      setSelectedEvent(event);
      setSelectedSlot(null); // Clear selected slot when editing an event
      // Calculate duration from event start/end times
      const durationMs = event.end.getTime() - event.start.getTime();
      const durationMinutes = Math.round(durationMs / (1000 * 60));
      form.setFieldValue("title", event.title);
      form.setFieldValue("description", event.description || "");
      form.setFieldValue("duration", durationMinutes);
      setShowModal(true);
    }
  };

  const handleDeleteClick = (event: CalendarEvent) => {
    setEventToDelete(event);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (eventToDelete) {
      deleteEventMutation.mutate(eventToDelete.id);
      setShowDeleteDialog(false);
      setEventToDelete(null);
      // Also close the event modal if it's open
      if (selectedEvent?.id === eventToDelete.id) {
        setShowModal(false);
        setSelectedEvent(null);
      }
    }
  };

  // Event styling based on booking status
  // Green = available for booking, Yellow = booked, Red = cancelled and still booked
  const eventStyleGetter = (event: CalendarEvent) => {
    let backgroundColor = "#10b981"; // Default green for available

    if (event.isBooked && event.booking?.status === "CANCELLED") {
      backgroundColor = "#dc2626"; // Red for cancelled but still marked as booked
    } else if (event.isBooked) {
      backgroundColor = "#eab308"; // Yellow for booked (active)
    }
    // isBooked=false means available (green) even if a cancelled booking record exists

    const style = {
      backgroundColor,
      borderRadius: "5px",
      opacity: 0.8,
      color: "white",
      border: "0px",
      display: "block",
    };
    return { style };
  };

  if (loading && !provider) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="text-center">{t("provider.loading")}</div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              {t("provider.notRegisteredAsProvider")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fix Agenda view: Keep rowspan but add empty date cells for proper time column alignment
  useEffect(() => {
    if (view !== "agenda") return;

    const fixAgendaTable = () => {
      const agendaTable = document.querySelector(
        ".rbc-agenda-view .rbc-agenda-table tbody"
      );
      if (!agendaTable) return;

      const rows = Array.from(agendaTable.querySelectorAll("tr"));

      rows.forEach((row, rowIndex) => {
        const cells = Array.from(row.querySelectorAll("td"));

        // If this row has only 2 cells (missing date cell due to rowspan),
        // add an empty date cell so time moves to the correct column
        if (cells.length === 2) {
          const emptyDateCell = document.createElement("td");
          emptyDateCell.className = "rbc-agenda-date-cell";
          // Leave it empty - this is intentional to keep the date merged above
          emptyDateCell.textContent = "";

          // #region agent log
          fetch(
            "http://127.0.0.1:7242/ingest/b8bb93ec-15de-4b3a-bec0-935d0a287309",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "calendar.tsx:695",
                message: "Adding empty date cell for time alignment",
                data: {
                  rowIndex,
                  rowCellCount: cells.length,
                  firstCellContent: cells[0]?.textContent?.trim() || "",
                  secondCellContent: cells[1]?.textContent?.trim() || "",
                  firstCellComputedStyle: cells[0]
                    ? window.getComputedStyle(cells[0]).borderBottom
                    : null,
                  firstCellComputedRight: cells[0]
                    ? window.getComputedStyle(cells[0]).borderRight
                    : null,
                },
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "border-step1",
                hypothesisId: "border-debug",
              }),
            }
          ).catch(() => {});
          // #endregion

          // Insert empty date cell as first cell, pushing time to second column
          row.insertBefore(emptyDateCell, cells[0]);
        }

        // #region agent log - Check computed borders and text-decoration on date cells
        const dateCells = Array.from(row.querySelectorAll("td:first-child"));
        dateCells.forEach((cell, cellIndex) => {
          const computedStyle = window.getComputedStyle(cell);
          fetch(
            "http://127.0.0.1:7242/ingest/b8bb93ec-15de-4b3a-bec0-935d0a287309",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "calendar.tsx:730",
                message:
                  "Date cell computed styles (borders and text-decoration)",
                data: {
                  rowIndex,
                  cellIndex,
                  cellText: cell.textContent?.trim() || "",
                  borderBottom: computedStyle.borderBottom,
                  borderRight: computedStyle.borderRight,
                  borderTop: computedStyle.borderTop,
                  borderLeft: computedStyle.borderLeft,
                  borderBottomWidth: computedStyle.borderBottomWidth,
                  borderRightWidth: computedStyle.borderRightWidth,
                  textDecoration: computedStyle.textDecoration,
                  textDecorationLine: computedStyle.textDecorationLine,
                  textDecorationStyle: computedStyle.textDecorationStyle,
                  textDecorationColor: computedStyle.textDecorationColor,
                },
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "suppress-date-border",
                hypothesisId: "border-debug",
              }),
            }
          ).catch(() => {});
        });
        // #endregion
      });
    };

    // Run after a short delay to ensure the calendar has rendered
    const timeoutId = setTimeout(fixAgendaTable, 200);

    // Also observe changes to the agenda table
    const agendaView = document.querySelector(".rbc-agenda-view");
    if (agendaView) {
      const observer = new MutationObserver(() => {
        setTimeout(fixAgendaTable, 150);
      });
      observer.observe(agendaView, { childList: true, subtree: true });

      return () => {
        clearTimeout(timeoutId);
        observer.disconnect();
      };
    }

    return () => {
      clearTimeout(timeoutId);
    };
  }, [view, events]);

  // Debug: Log when component renders
  useEffect(() => {
    console.log("📅 ProviderCalendarComponent rendered", {
      provider: !!provider,
      providerId: provider?.id,
      eventsCount: events.length,
      loading,
      view,
      date,
    });
  }, [provider, events, loading, view, date]);

  // Handle single-click on calendar to create events
  const handleCalendarClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Check if click is on an event
    const isEvent =
      target.classList.contains("rbc-event") || target.closest(".rbc-event");

    // Don't handle event clicks
    if (isEvent) {
      console.log("📅 Clicked on event, ignoring");
      return;
    }

    // Only handle clicks in week/day views
    if (view !== "week" && view !== "day") return;

    console.log("📅 Calendar clicked:", {
      targetClass: target.className,
      view,
    });

    // Find the day-slot column
    const daySlot = target.closest(".rbc-day-slot") as HTMLElement;
    if (!daySlot) {
      console.log("📅 Not in a day slot");
      return;
    }

    // Get click position relative to the day slot
    const rect = daySlot.getBoundingClientRect();
    const clickY = e.clientY - rect.top;

    // Get the time slot element at this position
    // We need to find which time slot was clicked based on Y position
    const timeSlotsInColumn = Array.from(
      daySlot.querySelectorAll(".rbc-time-slot")
    ) as HTMLElement[];

    let slotElement: HTMLElement | null = null;
    let slotIndex = -1;

    for (let i = 0; i < timeSlotsInColumn.length; i++) {
      const slot = timeSlotsInColumn[i];
      const slotRect = slot.getBoundingClientRect();
      const slotTop = slotRect.top - rect.top;
      const slotBottom = slotTop + slotRect.height;

      if (clickY >= slotTop && clickY < slotBottom) {
        slotElement = slot;
        slotIndex = i;
        break;
      }
    }

    if (!slotElement || slotIndex === -1) {
      console.log("📅 Could not find time slot at click position");
      return;
    }

    // Get the day from the column
    const allDaySlots = Array.from(document.querySelectorAll(".rbc-day-slot"));
    const dayIndex = allDaySlots.indexOf(daySlot);

    if (dayIndex === -1) {
      console.log("📅 Could not find day index");
      return;
    }

    // Calculate the date for this column
    let clickedDate: Date;
    if (view === "day") {
      // For day view, use the current date
      clickedDate = new Date(date);
    } else {
      // For week view, calculate from start of week using locale-aware function
      const weekStart = startOfWeek(date, { locale: dateFnsLocale });
      clickedDate = new Date(weekStart);
      clickedDate.setDate(weekStart.getDate() + dayIndex);
    }

    // Calculate time (8 AM start + 5-minute slots)
    const startHour = 8; // From Calendar min prop
    const minutesFromStart = slotIndex * 5; // 5-minute slots (step=5, timeslots=1)

    // Create the start time
    const start = new Date(clickedDate);
    start.setHours(startHour + Math.floor(minutesFromStart / 60));
    start.setMinutes(minutesFromStart % 60);
    start.setSeconds(0);
    start.setMilliseconds(0);

    // Create end time (30 minutes later by default)
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 30);

    console.log("📅 Calculated slot:", {
      start,
      end,
      dayIndex,
      slotIndex,
      minutesFromStart,
    });

    // Call the slot selection handler
    handleSelectSlot({ start, end });
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>
            {provider?.user?.name ? `${provider.user.name} ` : ""}
            {t("provider.availabilityCalendar")}
          </CardTitle>
          <CardDescription>
            {t("provider.clickCalendarToCreateSlotsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {provider?.department?.organization?.status === "SUSPENDED" && (
            <Alert variant="destructive" className="mb-6">
              <AlertTitle>{t("owner.orgFrozenTitle")}</AlertTitle>
              <AlertDescription>
                {t("owner.orgSuspendedByAdminDescription")}
              </AlertDescription>
            </Alert>
          )}
          <div className="calendar-container relative h-[calc(100vh-280px)] min-h-[600px] max-h-[1400px]">
            <style>{`
              /* Ensure calendar cells are clickable */
              .rbc-time-view .rbc-day-slot {
                pointer-events: auto !important;
              }
              
              .rbc-time-slot {
                pointer-events: auto !important;
                cursor: pointer !important;
              }
              
              .rbc-time-content {
                pointer-events: auto !important;
              }
              
              /* Base styles for time slots - ensure hour borders are visible */
              .rbc-time-view .rbc-time-gutter .rbc-time-slot,
              .rbc-time-view .rbc-day-slot .rbc-time-slot {
                border-top: 1px solid #e5e5e5;
              }
              
              /* With step=5, we have 5-minute slot dividers for fine-grained scheduling */
              
              
              /* Dark mode: Fix navigation buttons visibility */
              .dark .rbc-toolbar button {
                color: #ffffff !important;
                background-color: #374151 !important;
                border: 1px solid #6b7280 !important;
                padding: 8px 12px !important;
                margin: 0 2px !important;
                border-radius: 4px !important;
                font-weight: 500 !important;
              }
              
              .dark .rbc-toolbar button:hover {
                background-color: #4b5563 !important;
                color: #ffffff !important;
              }
              
              .dark .rbc-toolbar button.rbc-active {
                background-color: #3b82f6 !important;
                color: #ffffff !important;
              }
              
              /* Dark mode: Improve grid border visibility */
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
              
              /* Light mode: Ensure borders are visible */
              .rbc-time-view .rbc-time-slot {
                border-top: 1px solid #e5e5e5 !important;
              }
              
              .rbc-time-view .rbc-day-slot {
                border-right: 1px solid #e5e5e5;
              }
              
              /* Increase time slot height by 2x for 5-minute steps (better visibility and clickability) */
              .rbc-time-view .rbc-time-slot {
                min-height: 40px !important;
                height: auto !important;
              }
              
              .rbc-time-view .rbc-day-slot .rbc-time-slot {
                min-height: 40px !important;
              }
              
              .rbc-time-gutter .rbc-time-slot {
                min-height: 40px !important;
              }
              
              /* Show all 5-minute time labels in the gutter */
              /* React Big Calendar only renders labels at certain intervals by default */
              /* We need to ensure all rendered labels are visible */
              .rbc-time-gutter .rbc-label {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                height: auto !important;
                min-height: 40px !important;
                padding: 4px 8px !important;
                font-size: 12px !important;
                line-height: 1.2 !important;
                white-space: nowrap !important;
              }
              
              /* Show labels in all time slots */
              .rbc-time-gutter .rbc-time-slot .rbc-label {
                display: block !important;
                opacity: 1 !important;
                visibility: visible !important;
              }
              
              /* Force show labels in timeslot groups */
              .rbc-time-gutter .rbc-timeslot-group .rbc-label {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
              }
              
              /* Ensure label-show-all class also shows */
              .rbc-label-show-all {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
              }
              
              /* ============================================
                 AGENDA VIEW - ISOLATED STYLING
                 Prevents interference with other calendar views
                 ============================================ */
              
              /* Main agenda table container */
              .rbc-agenda-view {
                display: flex;
                flex-direction: column;
                overflow: auto;
                box-sizing: border-box;
              }
              
              .rbc-agenda-view .rbc-agenda-table {
                width: 100%;
                border-collapse: collapse;
                box-sizing: border-box;
                border: none !important;
              }
              
              /* Remove all borders from table elements */
              .rbc-agenda-view .rbc-agenda-table th,
              .rbc-agenda-view .rbc-agenda-table td,
              .rbc-agenda-view .rbc-agenda-table tr {
                border: none !important;
              }
              
              /* Header styling */
              .rbc-agenda-view .rbc-agenda-table thead {
                position: sticky;
                top: 0;
                z-index: 10;
                background-color: #1f2937;
                color: #ffffff;
              }
              
              .rbc-agenda-view .rbc-agenda-table thead th {
                padding: 12px 16px;
                text-align: left;
                font-weight: 600;
                border-top: none !important;
                border-left: none !important;
                border-right: none !important;
                border-bottom: 2px solid #374151 !important;
                box-sizing: border-box;
                vertical-align: middle;
              }
              
              .dark .rbc-agenda-view .rbc-agenda-table thead th {
                background-color: #1f2937;
                border-top: none !important;
                border-left: none !important;
                border-right: none !important;
                border-bottom: 2px solid #4b5563 !important;
                color: #ffffff;
              }
              
              /* Date column - fixed width */
              .rbc-agenda-view .rbc-agenda-table thead th:nth-child(1),
              .rbc-agenda-view .rbc-agenda-table tbody td:nth-child(1) {
                width: 150px;
                min-width: 150px;
                max-width: 150px;
                box-sizing: border-box;
              }
              
              /* Time column - fixed width */
              .rbc-agenda-view .rbc-agenda-table thead th:nth-child(2),
              .rbc-agenda-view .rbc-agenda-table tbody td:nth-child(2) {
                width: 200px;
                min-width: 200px;
                max-width: 200px;
                box-sizing: border-box;
              }
              
              /* Event column - flexible width */
              .rbc-agenda-view .rbc-agenda-table thead th:nth-child(3),
              .rbc-agenda-view .rbc-agenda-table tbody td:nth-child(3) {
                width: auto;
                min-width: 200px;
                box-sizing: border-box;
              }
              
              /* ============================================
                 TABLE BODY CELLS - CRITICAL FIX
                 ============================================ */
              
              /* All table body cells - STEP 1: Bottom borders only */
              .rbc-agenda-view .rbc-agenda-table tbody td {
                padding: 12px 16px;
                vertical-align: middle;
                border-top: none !important;
                border-left: none !important;
                border-right: none !important;
                border-bottom: 1px solid #e5e7eb !important;
                box-sizing: border-box;
                height: auto;
                min-height: 48px;
              }
              
              /* No vertical borders - STEP 1 */
              .rbc-agenda-view .rbc-agenda-table tbody td:not(:last-child) {
                border-right: none !important;
              }
              
              .rbc-agenda-view .rbc-agenda-table thead th:not(:last-child) {
                border-right: none !important;
              }
              
              /* ============================================
                 DATE CELL STYLING - ENSURES ALIGNMENT
                 ============================================ */
              
              /* First column (date cell) - Remove bottom border and suppress underline */
              .rbc-agenda-view .rbc-agenda-table tbody td:first-child,
              .rbc-agenda-view .rbc-agenda-date-cell {
                text-align: left;
                padding-left: 16px;
                padding-right: 16px;
                white-space: nowrap;
                font-weight: 500;
                vertical-align: middle;
                box-sizing: border-box;
                border-top: none !important;
                border-left: none !important;
                border-right: none !important;
                border-bottom: none !important;
                text-decoration: none !important;
              }
              
              /* Suppress any React Big Calendar default underlines on date cells */
              .rbc-agenda-view .rbc-agenda-date-cell *,
              .rbc-agenda-view .rbc-agenda-table tbody td:first-child * {
                text-decoration: none !important;
                border-bottom: none !important;
              }
              
              /* ============================================
                 TIME CELL STYLING
                 ============================================ */
              
              .rbc-agenda-view .rbc-agenda-table tbody td:nth-child(2),
              .rbc-agenda-view .rbc-agenda-time-cell {
                white-space: nowrap;
                font-family: monospace;
                vertical-align: middle;
                text-align: left;
                box-sizing: border-box;
                border-top: none !important;
                border-left: none !important;
                border-right: none !important;
                border-bottom: 1px solid #e5e7eb !important;
              }
              
              /* Ensure time is displayed - fix for missing times */
              .rbc-agenda-view .rbc-agenda-time-cell:empty::before {
                content: "—";
                color: #9ca3af;
              }
              
              /* ============================================
                 EVENT CELL STYLING
                 ============================================ */
              
              .rbc-agenda-view .rbc-agenda-table tbody td:nth-child(3),
              .rbc-agenda-view .rbc-agenda-event-cell {
                word-wrap: break-word;
                overflow-wrap: break-word;
                vertical-align: middle;
                text-align: left;
                box-sizing: border-box;
                border-top: none !important;
                border-left: none !important;
                border-right: none !important;
                border-bottom: 1px solid #e5e7eb !important;
              }
              
              /* ============================================
                 ROW STYLING
                 ============================================ */
              
              .rbc-agenda-view .rbc-agenda-table tbody tr {
                transition: background-color 0.2s ease;
              }
              
              .rbc-agenda-view .rbc-agenda-table tbody tr:hover {
                background-color: #f3f4f6;
              }
              
              /* ============================================
                 DARK MODE SUPPORT
                 ============================================ */
              
              .dark .rbc-agenda-view .rbc-agenda-table tbody td {
                border-top: none !important;
                border-left: none !important;
                border-right: none !important;
                border-bottom: 1px solid #4b5563 !important;
                color: #e5e7eb;
              }
              
              /* Dark mode: Remove bottom border from date cells specifically - higher specificity */
              .dark .rbc-agenda-view .rbc-agenda-table tbody td:first-child,
              .dark .rbc-agenda-view .rbc-agenda-table tbody .rbc-agenda-date-cell,
              .dark .rbc-agenda-view .rbc-agenda-date-cell {
                border-bottom: none !important;
                border-bottom-width: 0 !important;
                border-bottom-style: none !important;
                border-bottom-color: transparent !important;
              }
              
              .dark .rbc-agenda-view .rbc-agenda-table tbody tr:hover {
                background-color: #374151;
              }
            `}</style>
            <div
              onClick={handleCalendarClick}
              className="h-full w-full"
            >
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                view={view}
                onView={setView}
                date={date}
                onNavigate={setDate}
                selectable
                onSelectSlot={(slotInfo) => {
                  console.log("📅 onSelectSlot called with:", slotInfo);
                  handleSelectSlot(slotInfo);
                }}
                onSelectEvent={(event) => {
                  console.log("📅 onSelectEvent called with:", event);
                  handleSelectEvent(event);
                }}
                eventPropGetter={eventStyleGetter}
                className="h-full"
                step={5}
                timeslots={1}
                showMultiDayTimes
                defaultView="week"
                min={new Date(0, 0, 0, 8, 0, 0)}
                max={new Date(0, 0, 0, 20, 0, 0)}
                messages={calendarMessagesForLang}
                culture={currentLang}
                formats={{
                  timeGutterFormat: timeGutterFormat,
                }}
                components={customComponents}
                popup={false}
                onSelecting={(slotInfo) => {
                  console.log("📅 onSelecting callback:", slotInfo);
                  return true; // Allow selection
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>
                {selectedEvent
                  ? selectedEvent.isBooked
                    ? t("provider.viewBooking")
                    : t("provider.editEvent")
                  : t("provider.createAvailability")}
              </CardTitle>
              {selectedSlot && !selectedEvent && (
                <CardDescription>
                  {format(selectedSlot.start, "PPP p", {
                    locale: dateFnsLocale,
                  })}{" "}
                  - {format(selectedSlot.end, "p", { locale: dateFnsLocale })}
                </CardDescription>
              )}
              {selectedEvent && (
                <CardDescription>
                  {format(selectedEvent.start, "PPP p", {
                    locale: dateFnsLocale,
                  })}{" "}
                  - {format(selectedEvent.end, "p", { locale: dateFnsLocale })}
                  {selectedEvent.isBooked && (
                    <span className="block mt-1 text-red-600">
                      {t("provider.bookedBy")}:{" "}
                      {selectedEvent.booking?.member?.name}
                    </span>
                  )}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {selectedEvent?.isBooked ? (
                <div className="space-y-2">
                  <p>
                    <strong>{t("provider.title")}:</strong>{" "}
                    {selectedEvent.title}
                  </p>
                  <p>
                    <strong>{t("provider.bookedBy")}:</strong>{" "}
                    {selectedEvent.booking?.member?.name}
                  </p>
                  <p>
                    <strong>{t("provider.emailLabel")}:</strong>{" "}
                    {selectedEvent.booking?.member?.email}
                  </p>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowModal(false)}
                      className="flex-1"
                    >
                      {t("common.close")}
                    </Button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    form.handleSubmit();
                  }}
                  className="space-y-4"
                >
                  <form.Field
                    name="title"
                    validators={{
                      onChange: ({ value }) => {
                        if (!value || value.length < 2) {
                          return t("provider.titleRequired");
                        }
                        return undefined;
                      },
                    }}
                  >
                    {(field) => (
                      <div className="space-y-2">
                        <Label htmlFor="title">{t("provider.title")}</Label>
                        <Input
                          id="title"
                          placeholder={t("provider.titlePlaceholder")}
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                        {field.state.meta.errors.length > 0 && (
                          <p className="text-sm text-destructive">
                            {field.state.meta.errors[0]}
                          </p>
                        )}
                      </div>
                    )}
                  </form.Field>
                  <form.Field name="description">
                    {(field) => (
                      <div className="space-y-2">
                        <Label htmlFor="description">
                          {t("provider.description")}
                        </Label>
                        <Input
                          id="description"
                          placeholder={t("provider.descriptionPlaceholder")}
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                      </div>
                    )}
                  </form.Field>
                  {!selectedEvent && selectedSlot && (
                    <form.Field name="duration">
                      {(field) => (
                        <div className="space-y-2">
                          <Label htmlFor="duration">
                            {t("provider.duration")}
                          </Label>
                          <Select
                            value={field.state.value.toString()}
                            onValueChange={(value) => {
                              const duration = parseInt(value, 10);
                              field.handleChange(duration);
                              // Update selectedSlot.end based on new duration
                              if (selectedSlot) {
                                const newEnd = new Date(
                                  selectedSlot.start.getTime() +
                                    duration * 60000
                                );
                                setSelectedSlot({
                                  ...selectedSlot,
                                  end: newEnd,
                                });
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={t("provider.selectDuration")}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60,
                              ].map((minutes) => (
                                <SelectItem
                                  key={minutes}
                                  value={minutes.toString()}
                                >
                                  {minutes} {t("provider.minutes") || "minutes"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </form.Field>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowModal(false)}
                      className="flex-1"
                    >
                      {t("provider.cancel")}
                    </Button>
                    {selectedEvent && !selectedEvent.isBooked && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => handleDeleteClick(selectedEvent)}
                        disabled={loading || deleteEventMutation.isPending}
                      >
                        {t("provider.deleteAction")}
                      </Button>
                    )}
                    <form.Subscribe
                      selector={(state) => [
                        state.canSubmit,
                        state.isSubmitting,
                      ]}
                    >
                      {([canSubmit, isSubmitting]) => (
                        <Button
                          type="submit"
                          disabled={
                            !canSubmit ||
                            loading ||
                            isSubmitting ||
                            createEventMutation.isPending ||
                            updateEventMutation.isPending
                          }
                          className="flex-1"
                        >
                          {isSubmitting ||
                          createEventMutation.isPending ||
                          updateEventMutation.isPending
                            ? t("provider.saving")
                            : selectedEvent
                              ? t("provider.update")
                              : t("provider.create")}
                        </Button>
                      )}
                    </form.Subscribe>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cancellation Details Dialog */}
      <Dialog
        open={showCancellationDialog}
        onOpenChange={setShowCancellationDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-green-400">
              {t("provider.cancellationDetails")}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && selectedEvent.booking && (
            <div className="space-y-4 py-4">
              <div>
                <span className="text-sm font-medium">
                  {t("provider.userName")}:{" "}
                </span>
                <span className="text-sm">
                  {selectedEvent.booking.member?.name ||
                    t("provider.notAvailable")}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium">
                  {t("provider.emailLabel")}:{" "}
                </span>
                <span className="text-sm">
                  {selectedEvent.booking.member?.email ||
                    t("provider.notAvailable")}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium">
                  {t("provider.eventTitle")}:{" "}
                </span>
                <span className="text-sm">{selectedEvent.title}</span>
              </div>
              <div>
                <span className="text-sm font-medium">
                  {t("provider.eventDate")}:{" "}
                </span>
                <span className="text-sm">
                  {format(selectedEvent.start, "PPP 'at' p", {
                    locale: dateFnsLocale,
                  })}{" "}
                  - {format(selectedEvent.end, "p", { locale: dateFnsLocale })}
                </span>
              </div>
              {selectedEvent.description && (
                <div>
                  <span className="text-sm font-medium">
                    {t("provider.description")}:{" "}
                  </span>
                  <span className="text-sm">{selectedEvent.description}</span>
                </div>
              )}
              <div>
                <span className="text-sm font-medium">
                  {t("provider.cancellationDate")}:{" "}
                </span>
                <span className="text-sm">
                  {selectedEvent.booking.updatedAt
                    ? format(
                        new Date(selectedEvent.booking.updatedAt),
                        "PPP 'at' p",
                        { locale: dateFnsLocale }
                      )
                    : t("provider.notAvailable")}
                </span>
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowCancellationDialog(false);
                setSelectedEvent(null);
              }}
            >
              {t("common.close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("provider.deleteEvent")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("provider.areYouSureDeleteEvent")}
              {eventToDelete && (
                <div className="mt-2">
                  <strong>{t("provider.event")}:</strong> {eventToDelete.title}
                  <br />
                  <strong>{t("provider.time")}:</strong>{" "}
                  {format(eventToDelete.start, "PPP p", {
                    locale: dateFnsLocale,
                  })}{" "}
                  - {format(eventToDelete.end, "p", { locale: dateFnsLocale })}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEventToDelete(null)}>
              {t("provider.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteEventMutation.isPending}
            >
              {deleteEventMutation.isPending
                ? t("provider.deleting")
                : t("provider.deleteAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
