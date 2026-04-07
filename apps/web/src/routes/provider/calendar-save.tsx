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
import type { View } from "react-big-calendar";
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

export const Route = createFileRoute("/provider/calendar-save")({
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
  const { session } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const { t, i18n: i18nInstance } = useTranslation();
  const userId = session.data?.user.id;
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState(new Date());

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

  // Custom format function for time gutter - always use English locale
  const timeGutterFormat = (date: Date) => {
    return format(date, "h:mm a", { locale: enUS });
  };

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
    queryFn: () => fetchProvider(userId!),
    enabled: !!userId,
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
      .map((event: any) => {
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

        return {
          id: event.id,
          title,
          description: event.description,
          start: new Date(event.start),
          end: new Date(event.end),
          isBooked: event.isBooked,
          booking: event.booking
            ? {
                id: event.booking.id,
                status: event.booking.status,
                updatedAt: event.booking.updatedAt,
                member: event.booking.member,
              }
            : undefined,
        };
      })
      .filter((event: CalendarEvent) => event.start >= pastCutoff);
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

  const FROZEN_STATUSES = ['PAYMENT_FAILED', 'SUBSCRIPTION_DELETED', 'SUSPENDED', 'REFUND_REQUESTED'];
  const isOrgFrozen = !!(provider?.department?.organization?.status && FROZEN_STATUSES.includes(provider.department.organization.status));

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

    if (isOrgFrozen) {
      toast.error(t("provider.orgFrozenCannotCreateEvent", "Your organization is suspended. Event creation is disabled."));
      return;
    }

    // Check if the selected date is in the past
    const now = new Date();
    if (start < now) {
      toast.error(t("provider.cannotCreateAvailabilityInPast"));
      return;
    }

    // Round to nearest 15-minute boundary
    const minutes = start.getMinutes();
    const roundedMinutes = Math.round(minutes / 15) * 15;
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
    // Check if event is cancelled
    const isCancelled = event.booking?.status === "CANCELLED";

    if (isCancelled) {
      // Show cancellation details dialog instead of edit modal
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
  const eventStyleGetter = (event: CalendarEvent) => {
    const isCancelled = event.booking?.status === "CANCELLED";
    let backgroundColor = "#10b981"; // Default green for available

    if (isCancelled) {
      backgroundColor = "#dc2626"; // Red for cancelled
    } else if (event.isBooked) {
      backgroundColor = "#eab308"; // Yellow for booked (not cancelled)
    }

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

  // Debug: Test click handler on container
  const handleContainerClick = (e: React.MouseEvent) => {
    console.log("📅 Container clicked:", e.target, e.currentTarget);
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("provider.myCalendar")}</h1>
        <p className="text-muted-foreground">
          {t("provider.manageYourAvailability", {
            department: provider?.department?.name || "",
          })}
          <SentrySmokeTest />
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("provider.availabilityCalendar")}</CardTitle>
          <CardDescription>
            {t("provider.clickCalendarToCreateSlotsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isOrgFrozen && (
            <Alert variant="destructive" className="mb-6">
              <AlertTitle>{t("owner.orgFrozenTitle")}</AlertTitle>
              <AlertDescription>
                {t("owner.orgFrozenDescription")}
              </AlertDescription>
            </Alert>
          )}
          <div
            className="calendar-container relative h-[calc(100vh-280px)] min-h-[600px] max-h-[1400px]"
            onClick={handleContainerClick}
            onMouseDown={(e) =>
              console.log("📅 Mouse down on container:", e.target)
            }
          >
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
              
              /* Show all 15-minute slot dividers - no suppression needed */
              /* With step=15, we want all dividers visible */
              
              
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
            `}</style>
            <div
              onClick={(e) =>
                console.log("📅 Calendar wrapper clicked:", e.target)
              }
              onMouseDown={(e) =>
                console.log("📅 Calendar wrapper mouse down:", e.target)
              }
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
                step={15}
                showMultiDayTimes
                defaultView="week"
                min={new Date(0, 0, 0, 8, 0, 0)}
                max={new Date(0, 0, 0, 20, 0, 0)}
                messages={calendarMessagesForLang}
                culture={currentLang}
                formats={{
                  timeGutterFormat: timeGutterFormat,
                }}
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
                              <SelectItem value="15">
                                {t("provider.fifteenMinutes")}
                              </SelectItem>
                              <SelectItem value="30">
                                {t("provider.thirtyMinutes")}
                              </SelectItem>
                              <SelectItem value="45">
                                {t("provider.fortyFiveMinutes")}
                              </SelectItem>
                              <SelectItem value="60">
                                {t("provider.sixtyMinutes")}
                              </SelectItem>
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
