import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
} from "date-fns";
import { enUS } from "date-fns/locale";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import * as Sentry from "@sentry/react";
import { SentrySmokeTest } from "@/components/SentrySmokeTest";

// Setup the localizer for BigCalendar
const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

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
  booking?: any;
}

// API functions
const fetchProvider = async (userId: string): Promise<any> => {
  const response = await fetch(
    `${import.meta.env.VITE_SERVER_URL}/api/providers?userId=${userId}`,
    {
      credentials: "include",
    }
  );
  if (!response.ok) {
    throw new Error("Failed to load provider");
  }
  const providers = await response.json();
  if (providers.length === 0) {
    throw new Error("You are not registered as a provider");
  }
  return providers[0];
};

const fetchEvents = async (providerId: string): Promise<any[]> => {
  const response = await fetch(
    `${import.meta.env.VITE_SERVER_URL}/api/events?providerId=${providerId}`,
    {
      credentials: "include",
    }
  );
  if (!response.ok) {
    throw new Error("Failed to load events");
  }
  return response.json();
};

const createEvent = async (data: {
  providerId: string;
  title: string;
  description?: string;
  start: string;
  end: string;
}): Promise<any> => {
  const response = await fetch(
    `${import.meta.env.VITE_SERVER_URL}/api/events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create event");
  }
  return response.json();
};

const updateEvent = async (data: {
  eventId: string;
  title: string;
  description?: string;
}): Promise<any> => {
  const response = await fetch(
    `${import.meta.env.VITE_SERVER_URL}/api/events/${data.eventId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        title: data.title,
        description: data.description,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update event");
  }
  return response.json();
};

const deleteEvent = async (eventId: string): Promise<void> => {
  const response = await fetch(
    `${import.meta.env.VITE_SERVER_URL}/api/events/${eventId}`,
    {
      method: "DELETE",
      credentials: "include",
    }
  );

  if (!response.ok) {
    let errorMessage = "Failed to delete event";
    try {
      const error = await response.json();
      errorMessage = error.error || errorMessage;
    } catch {
      // If response is not JSON, use status text
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }
  // Success - response might be empty (204 No Content)
};

interface EventFormData {
  title: string;
  description: string;
  duration: number;
}

function ProviderCalendarComponent() {
  const { session } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const userId = session.data?.user.id;
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState(new Date());

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
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
      .map((event: any) => ({
        id: event.id,
        title: event.isBooked
          ? `${event.title} - Booked by ${
              event.booking?.member?.name || "Client"
            }`
          : event.title,
        description: event.description,
        start: new Date(event.start),
        end: new Date(event.end),
        isBooked: event.isBooked,
        booking: event.booking,
      }))
      .filter((event: CalendarEvent) => event.start >= pastCutoff);
  }, [rawEvents]);

  // Mutations
  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      toast.success("Event created successfully");
      setShowModal(false);
      queryClient.invalidateQueries({
        queryKey: ["events", { providerId: provider?.id }],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create event");
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: updateEvent,
    onSuccess: () => {
      toast.success("Event updated successfully");
      setShowModal(false);
      queryClient.invalidateQueries({
        queryKey: ["events", { providerId: provider?.id }],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update event");
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      toast.success("Event deleted successfully");
      setShowModal(false);
      queryClient.invalidateQueries({
        queryKey: ["events", { providerId: provider?.id }],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete event");
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
        providerError.message || "Error loading provider information"
      );
    }
    if (eventsError) {
      toast.error("Error loading events");
    }
  }, [providerError, eventsError]);

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    // Check if the selected date is in the past
    const now = new Date();
    if (start < now) {
      toast.error("Cannot create availability in the past");
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

    setSelectedSlot({ start: roundedStart, end: roundedEnd });
    setSelectedEvent(null);
    form.reset();
    form.setFieldValue("duration", 30);
    setShowModal(true);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setSelectedSlot(null); // Clear selected slot when editing an event
    // Calculate duration from event start/end times
    const durationMs = event.end.getTime() - event.start.getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));
    form.setFieldValue("title", event.title);
    form.setFieldValue("description", event.description || "");
    form.setFieldValue("duration", durationMinutes);
    setShowModal(true);
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

  if (loading && !provider) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              You are not registered as a provider. Please contact your
              organization owner.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">My Calendar</h1>
        <p className="text-muted-foreground">
          Manage your availability - {provider.department?.name}
          <SentrySmokeTest />
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Availability Calendar</CardTitle>
          <CardDescription>
            Click on the calendar to create new availability slots (8 AM - 8 PM
            only). Green = Available, Red = Booked. Past dates are not
            selectable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ height: 600 }} className="calendar-container">
            <style>{`
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
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={eventStyleGetter}
              style={{ height: "100%" }}
              step={15}
              showMultiDayTimes
              defaultView="week"
              min={new Date(0, 0, 0, 8, 0, 0)}
              max={new Date(0, 0, 0, 20, 0, 0)}
            />
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
                    ? "View Booking"
                    : "Edit Event"
                  : "Create Availability"}
              </CardTitle>
              {selectedSlot && !selectedEvent && (
                <CardDescription>
                  {format(selectedSlot.start, "PPP p")} -{" "}
                  {format(selectedSlot.end, "p")}
                </CardDescription>
              )}
              {selectedEvent && (
                <CardDescription>
                  {format(selectedEvent.start, "PPP p")} -{" "}
                  {format(selectedEvent.end, "p")}
                  {selectedEvent.isBooked && (
                    <span className="block mt-1 text-red-600">
                      Booked by: {selectedEvent.booking?.member?.name}
                    </span>
                  )}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {selectedEvent?.isBooked ? (
                <div className="space-y-2">
                  <p>
                    <strong>Title:</strong> {selectedEvent.title}
                  </p>
                  <p>
                    <strong>Booked by:</strong>{" "}
                    {selectedEvent.booking?.member?.name}
                  </p>
                  <p>
                    <strong>Email:</strong>{" "}
                    {selectedEvent.booking?.member?.email}
                  </p>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowModal(false)}
                      className="flex-1"
                    >
                      Close
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
                          return "Title must be at least 2 characters";
                        }
                        return undefined;
                      },
                    }}
                  >
                    {(field) => (
                      <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input
                          id="title"
                          placeholder="Available for consultation"
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
                          Description (optional)
                        </Label>
                        <Input
                          id="description"
                          placeholder="Add notes..."
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
                          <Label htmlFor="duration">Duration</Label>
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
                              <SelectValue placeholder="Select duration" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="15">15 minutes</SelectItem>
                              <SelectItem value="30">30 minutes</SelectItem>
                              <SelectItem value="45">45 minutes</SelectItem>
                              <SelectItem value="60">60 minutes</SelectItem>
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
                      Cancel
                    </Button>
                    {selectedEvent && !selectedEvent.isBooked && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => handleDeleteClick(selectedEvent)}
                        disabled={loading || deleteEventMutation.isPending}
                      >
                        Delete
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
                            ? "Saving..."
                            : selectedEvent
                            ? "Update"
                            : "Create"}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this event? This action cannot be
              undone.
              {eventToDelete && (
                <div className="mt-2">
                  <strong>Event:</strong> {eventToDelete.title}
                  <br />
                  <strong>Time:</strong> {format(eventToDelete.start, "PPP p")}{" "}
                  - {format(eventToDelete.end, "p")}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEventToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteEventMutation.isPending}
            >
              {deleteEventMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
