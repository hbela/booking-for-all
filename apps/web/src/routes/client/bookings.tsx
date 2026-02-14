import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { Calendar, Clock, MapPin, User, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/apiFetch";
import { useTranslation } from "react-i18next";
import { useState } from "react";

export const Route = createFileRoute("/client/bookings")({
  component: ClientBookings,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
      });
    }

    // Allow all authenticated users to view their bookings
    // (users can have CLIENT role in some organizations)
    return { session };
  },
});

interface Booking {
  id: string;
  eventId: string;
  memberId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  event: {
    id: string;
    title: string;
    description?: string | null;
    start: string;
    end: string;
    duration?: number | null;
    price?: number | null;
    provider: {
      user: {
        id: string;
        name: string;
        email: string;
      };
      department: {
        name: string;
        organization: {
          id: string;
          name: string;
        };
      };
    };
  };
  member: {
    id: string;
    name: string;
    email: string;
  };
}

// API function
const fetchClientBookings = async (): Promise<Booking[]> => {
  const response = await apiFetch<{ success: boolean; data: Booking[] }>(
    `${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}/api/bookings`
  );
  return response.data || response;
};

// Cancel booking API function
const cancelBooking = async (bookingId: string): Promise<void> => {
  await apiFetch(
    `${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}/api/bookings/${bookingId}`,
    {
      method: "DELETE",
    }
  );
};

function ClientBookings() {
  const { session } = Route.useRouteContext();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Query for bookings
  const {
    data: bookings = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["client", "bookings"],
    queryFn: fetchClientBookings,
  });

  // Get today's date string in YYYY-MM-DD format using LOCAL timezone
  // This ensures "today" means today in the user's local timezone
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = String(now.getMonth() + 1).padStart(2, '0');
  const todayDay = String(now.getDate()).padStart(2, '0');
  const todayString = `${todayYear}-${todayMonth}-${todayDay}`;

  // Helper function to get date string in YYYY-MM-DD format using LOCAL timezone
  // Converts the UTC date from database to local timezone for comparison
  const getDateString = (dateString: string): string => {
    const date = new Date(dateString);
    // Use local timezone to match "today" calculation
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Current Bookings: bookings with event.start date >= today (regardless of status: CONFIRMED or CANCELLED)
  // This ensures bookings with future events appear in Current Bookings, even if created before today
  const currentBookings = bookings
    .filter((booking) => {
      const eventStartString = getDateString(booking.event.start);
      return eventStartString >= todayString;
    })
    .sort((a, b) => {
      const dateA = new Date(a.event.start).getTime();
      const dateB = new Date(b.event.start).getTime();
      return dateB - dateA; // Descending: most recent first
    });

  // Booking History: bookings with event.start date < today (regardless of status: CONFIRMED or CANCELLED)
  // This ensures past events appear in History, even if created today
  const bookingHistory = bookings
    .filter((booking) => {
      const eventStartString = getDateString(booking.event.start);
      return eventStartString < todayString;
    })
    .sort((a, b) => {
      const dateA = new Date(a.event.start).getTime();
      const dateB = new Date(b.event.start).getTime();
      return dateB - dateA; // Descending: most recent first
    });

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="text-center">{t("client.loadingBookings")}</div>
      </div>
    );
  }

  if (error) {
    toast.error(t("client.failedToLoadBookings"));
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("client.myBookings")}</h1>
        <p className="text-muted-foreground">
          {t("client.viewAndManageAppointments")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("client.bookings")}</CardTitle>
          <CardDescription>
            {t("client.manageCurrentAndPastAppointments")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">
                {t("client.errorLoadingBookings")}{" "}
                <button
                  onClick={() => refetch()}
                  className="underline font-medium"
                >
                  {t("client.tryAgain")}
                </button>
              </p>
            </div>
          )}
          <Tabs defaultValue="current" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="current">
                {t("client.currentBookings")} ({currentBookings.length})
              </TabsTrigger>
              <TabsTrigger value="history">
                {t("client.bookingHistory")} ({bookingHistory.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="current" className="mt-6">
              {currentBookings.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    {t("client.noUpcomingBookings")}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {currentBookings.map((booking) => (
                    <BookingCard 
                      key={booking.id} 
                      booking={booking} 
                      onCancelSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ["client", "bookings"] });
                      }}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              {bookingHistory.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    {t("client.noPastBookings")}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {bookingHistory.map((booking) => (
                    <BookingCard 
                      key={booking.id} 
                      booking={booking}
                      onCancelSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ["client", "bookings"] });
                      }}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function BookingCard({ 
  booking, 
  onCancelSuccess 
}: { 
  booking: Booking; 
  onCancelSuccess: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showCancellationDialog, setShowCancellationDialog] = useState(false);
  const startDate = new Date(booking.event.start);
  const endDate = new Date(booking.event.end);
  const now = new Date();
  const isCancelled = booking.status === "CANCELLED";
  const isCompleted = booking.status === "COMPLETED";
  
  // Can cancel if: booking is CONFIRMED and event is in the future
  const canCancel = startDate >= now && booking.status === "CONFIRMED";

  // Cancel booking mutation
  const cancelMutation = useMutation({
    mutationFn: cancelBooking,
    onSuccess: () => {
      toast.success(t("client.bookingCancelledSuccessfully"));
      queryClient.invalidateQueries({ queryKey: ["client", "bookings"] });
      onCancelSuccess();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("client.failedToCancelBooking"));
      }
    },
  });

  const handleCancel = () => {
    const eventStart = new Date(booking.event.start);
    if (eventStart < now) {
      toast.error(t("client.cannotCancelPastEvent"));
      return;
    }
    cancelMutation.mutate(booking.id);
  };

  const handleCardClick = () => {
    if (isCancelled) {
      setShowCancellationDialog(true);
    }
  };

  const getStatusBadge = () => {
    if (isCancelled) {
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200">
          {t("client.cancelled")}
        </span>
      );
    }
    if (isCompleted) {
      return (
        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          {t("client.completed")}
        </span>
      );
    }
    // Default: CONFIRMED status
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
        {t("client.confirmed")}
      </span>
    );
  };

  return (
    <>
      <Card 
        className={`hover:shadow-md transition-shadow w-full ${isCancelled ? "cursor-pointer" : ""}`}
        onClick={handleCardClick}
      >
        <CardHeader>
          <CardTitle className="text-lg">{booking.event.title}</CardTitle>
          {booking.event.description && (
            <CardDescription>{booking.event.description}</CardDescription>
          )}
          <div className="mt-2">
            <span className="text-sm text-muted-foreground">{t("client.status")}: </span>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t("client.provider")}:</span>
            <span className="font-medium">
              {booking.event.provider.user.name}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t("client.organization")}:</span>
            <span className="font-medium">
              {booking.event.provider.department.organization.name}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t("client.department")}:</span>
            <span className="font-medium">
              {booking.event.provider.department.name}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t("client.startDate")}:</span>
            <span className="font-medium">{format(startDate, "PPP")}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t("client.timeSlot")}:</span>
            <span className="font-medium">
              {format(startDate, "h:mm a")} - {format(endDate, "h:mm a")}
            </span>
            {booking.event.duration && (
              <span className="text-muted-foreground">
                ({booking.event.duration} {t("client.minutes")})
              </span>
            )}
          </div>

          {booking.event.price && (
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="text-muted-foreground">{t("client.price")}:</span>
              <span>${booking.event.price}</span>
            </div>
          )}

          {canCancel && (
            <div className="pt-2">
              <Button
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel();
                }}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? t("client.cancelling") : t("client.cancelBooking")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancellation Details Dialog */}
      <Dialog open={showCancellationDialog} onOpenChange={setShowCancellationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("client.cancellationDetails")}</DialogTitle>
            <DialogDescription>
              {t("client.cancellationDetailsDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <span className="text-sm font-medium">{t("client.userName")}: </span>
              <span className="text-sm">{booking.member.name}</span>
            </div>
            <div>
              <span className="text-sm font-medium">{t("client.userEmail")}: </span>
              <span className="text-sm">{booking.member.email}</span>
            </div>
            <div>
              <span className="text-sm font-medium">{t("client.cancellationDate")}: </span>
              <span className="text-sm">{format(new Date(booking.updatedAt), "PPP 'at' h:mm a")}</span>
            </div>
            <div>
              <span className="text-sm font-medium">{t("client.eventTitle")}: </span>
              <span className="text-sm">{booking.event.title}</span>
            </div>
            <div>
              <span className="text-sm font-medium">{t("client.eventDate")}: </span>
              <span className="text-sm">{format(startDate, "PPP 'at' h:mm a")}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
