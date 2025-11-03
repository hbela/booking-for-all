import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
} from "date-fns";
import { enUS } from "date-fns/locale";

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

function ClientCalendar() {
  const { orgId, deptId, providerId } = Route.useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState(new Date());

  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  useEffect(() => {
    fetchData();
  }, [providerId]);

  const fetchData = async () => {
    try {
      const [providerResponse, eventsResponse] = await Promise.all([
        fetch(`http://localhost:3000/api/client/providers/${providerId}`, {
          credentials: "include",
        }),
        fetch(
          `http://localhost:3000/api/client/providers/${providerId}/available-events`,
          {
            credentials: "include",
          }
        ),
      ]);

      if (providerResponse.ok) {
        const providerData = await providerResponse.json();
        setProvider(providerData);
      }

      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        console.log("Fetched events for provider", providerId, ":", eventsData);
        // Convert to BigCalendar format
        const formattedEvents = eventsData.map((event: any) => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end),
          isBooked: false, // All events from this endpoint are available (not booked)
        }));
        console.log("Formatted events:", formattedEvents);
        setEvents(formattedEvents);
      } else {
        console.error(
          "Failed to fetch events:",
          eventsResponse.status,
          eventsResponse.statusText
        );
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("Failed to load calendar data");
    } finally {
      setLoading(false);
    }
  };

  const handleBookEvent = async (eventId: string) => {
    setBooking(true);
    try {
      const response = await fetch(
        "http://localhost:3000/api/client/bookings",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            eventId,
            providerId,
          }),
        }
      );

      if (response.ok) {
        const booking = await response.json();
        toast.success("Booking confirmed! Check your email for details.");
        // Refresh events to update availability
        await fetchData();
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to create booking");
      }
    } catch (error) {
      console.error("Failed to book event:", error);
      toast.error("Failed to create booking");
    } finally {
      setBooking(false);
    }
  };

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
      toast.info("This time slot is already booked");
    }
  };

  // Confirm booking after user clicks confirm
  const confirmBooking = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    await handleBookEvent(selectedEvent.id);
    setShowConfirmDialog(false);
    setSelectedEvent(null);
  };

  // Cancel booking dialog
  const cancelBooking = () => {
    setShowConfirmDialog(false);
    setSelectedEvent(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading calendar...</div>
      </div>
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
        Back to Providers
      </Button>

      {/* Provider Info */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">{provider?.user.name}</CardTitle>
              {provider?.specialization && (
                <CardDescription className="text-base">
                  {provider.specialization}
                </CardDescription>
              )}
            </div>
          </div>
          {provider?.bio && (
            <CardDescription className="mt-4">{provider.bio}</CardDescription>
          )}
        </CardHeader>
      </Card>

      {/* Calendar - Responsive: Big Calendar for desktop, Mobile Calendar for mobile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Available Time Slots</CardTitle>
          <CardDescription>
            Click on green time slots to book an appointment. Red slots are
            already booked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isMobile ? (
            <MobileCalendar
              events={events}
              selectedDate={date}
              onDateChange={setDate}
              onEventSelect={handleSelectEvent}
              loading={loading}
            />
          ) : (
            <div style={{ height: "600px" }}>
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
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Please review and confirm your appointment details
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedEvent && (
            <div className="space-y-4 py-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Provider</p>
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
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {format(selectedEvent.start, "PPPP")}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Time</p>
                  <p className="font-medium">
                    {format(selectedEvent.start, "p")} -{" "}
                    {format(selectedEvent.end, "p")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Duration: {selectedEvent.duration} minutes
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
                    Price: ${selectedEvent.price}
                  </p>
                )}
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelBooking} disabled={booking}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmBooking} disabled={booking}>
              {booking ? "Booking..." : "Confirm Booking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
