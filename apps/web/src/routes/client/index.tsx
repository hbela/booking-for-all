import { createFileRoute, Link, redirect } from "@tanstack/react-router";
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
import { Calendar, Building2, Users, Clock, MapPin, User, } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { apiFetch, ApiError } from "@/lib/apiFetch";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/client/")({
  component: ClientDashboard,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
      });
    }

    // Allow all authenticated users to access client booking portal
    // Users can book appointments if they have CLIENT role in any organization
    return { session };
  },
});

interface Organization {
  id: string;
  name: string;
  description?: string | null;
  _count?: {
    departments: number;
  };
}

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

// API functions
const fetchClientOrganizations = async (): Promise<Organization[]> => {
  return apiFetch<Organization[]>(
    `${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}/api/client/organizations`
  );
};

const fetchClientBookings = async (): Promise<Booking[]> => {
  const response = await apiFetch<{ success: boolean; data: Booking[] }>(
    `${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}/api/bookings`
  );
  return response.data || response;
};

const cancelBooking = async (bookingId: string): Promise<void> => {
  await apiFetch(
    `${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}/api/bookings/${bookingId}`,
    { method: "DELETE" }
  );
};

function ClientDashboard() {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();

  // Get the current organization ID from sessionStorage (set during login/connect flow)
  const currentOrgId = typeof window !== "undefined"
    ? sessionStorage.getItem("externalAppOrgId")
    : null;

  const {
    data: allOrganizations = [],
    isLoading: orgsLoading,
    error: orgsError,
  } = useQuery({
    queryKey: ["client", "organizations"],
    queryFn: fetchClientOrganizations,
  });

  const {
    data: allBookings = [],
    isLoading: bookingsLoading,
    error: bookingsError,
    refetch: refetchBookings,
  } = useQuery({
    queryKey: ["client", "bookings"],
    queryFn: fetchClientBookings,
  });

  // Filter to only the current organization if one is set
  const organizations = useMemo(() => {
    if (currentOrgId) {
      return allOrganizations.filter((org) => org.id === currentOrgId);
    }
    return allOrganizations;
  }, [allOrganizations, currentOrgId]);

  // Filter bookings to only the current organization
  const bookings = useMemo(() => {
    if (currentOrgId) {
      return allBookings.filter(
        (b) => b.event.provider.department.organization.id === currentOrgId
      );
    }
    return allBookings;
  }, [allBookings, currentOrgId]);

  const isLoading = orgsLoading || bookingsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">{t("common.loading")}</div>
      </div>
    );
  }

  if (orgsError) {
    toast.error(t("booking.failedToLoadOrganizations"));
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-500">
          {t("booking.errorLoadingOrganizations")}
        </div>
      </div>
    );
  }

  // Helper to get date string in YYYY-MM-DD format (local timezone)
  const now = new Date();
  const todayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const getDateString = (dateString: string): string => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  // Group bookings by organization
  const getBookingsForOrg = (orgId: string) => {
    const orgBookings = bookings.filter(
      (b) => b.event.provider.department.organization.id === orgId
    );

    const active = orgBookings
      .filter((b) => getDateString(b.event.start) >= todayString)
      .sort((a, b) => new Date(a.event.start).getTime() - new Date(b.event.start).getTime());

    const past = orgBookings
      .filter((b) => getDateString(b.event.start) < todayString)
      .sort((a, b) => new Date(b.event.start).getTime() - new Date(a.event.start).getTime());

    return { active, past };
  };

  return (
    <div className="container mx-auto max-w-7xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">
          {t("common.welcome")}, {session?.user?.name}!
        </h1>
        <p className="text-muted-foreground">
          {t("client.viewAndManageAppointments")}
        </p>
      </div>

      {organizations.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              {t("booking.noOrganizationsAvailable")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {organizations.map((org) => {
            const { active, past } = getBookingsForOrg(org.id);

            return (
              <Card key={org.id}>
                {/* Organization Header */}
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Building2 className="h-8 w-8 text-primary mt-0.5 shrink-0" />
                      <div>
                        <CardTitle className="text-2xl">{org.name}</CardTitle>
                        {org.description && (
                          <CardDescription className="mt-1">
                            {org.description}
                          </CardDescription>
                        )}
                        <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>
                            {org._count?.departments || 0} {t("booking.departments")}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Link
                      to="/client/organizations/$orgId"
                      params={{ orgId: org.id }}
                    >
                      <Button size="lg">
                        <Calendar className="mr-2 h-4 w-4" />
                        {t("booking.bookAnAppointment")}
                      </Button>
                    </Link>
                  </div>
                </CardHeader>

                {/* Appointments Tabs */}
                <CardContent>
                  {bookingsError && (
                    <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {t("client.errorLoadingBookings")}{" "}
                        <button
                          onClick={() => refetchBookings()}
                          className="underline font-medium"
                        >
                          {t("client.tryAgain")}
                        </button>
                      </p>
                    </div>
                  )}

                  <Tabs defaultValue="active" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="active">
                        {t("client.currentBookings")} ({active.length})
                      </TabsTrigger>
                      <TabsTrigger value="past">
                        {t("client.bookingHistory")} ({past.length})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="active" className="mt-4">
                      {active.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground">
                            {t("client.noUpcomingBookings")}
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {active.map((booking) => (
                            <BookingCard
                              key={booking.id}
                              booking={booking}
                              onCancelSuccess={() => refetchBookings()}
                            />
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="past" className="mt-4">
                      {past.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground">
                            {t("client.noPastBookings")}
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {past.map((booking) => (
                            <BookingCard
                              key={booking.id}
                              booking={booking}
                              onCancelSuccess={() => refetchBookings()}
                            />
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BookingCard({
  booking,
  onCancelSuccess,
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

  const canCancel = startDate >= now && booking.status === "CONFIRMED";

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
    if (startDate < now) {
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
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
        {t("client.confirmed")}
      </span>
    );
  };

  return (
    <>
      <Card
        className={`hover:shadow-md transition-shadow ${isCancelled ? "cursor-pointer opacity-75" : ""}`}
        onClick={handleCardClick}
      >
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base">{booking.event.title}</h3>
                {getStatusBadge()}
              </div>

              {booking.event.description && (
                <p className="text-sm text-muted-foreground">
                  {booking.event.description}
                </p>
              )}

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  <span>{booking.event.provider.user.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{booking.event.provider.department.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{format(startDate, "PPP")}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {format(startDate, "h:mm a")} - {format(endDate, "h:mm a")}
                  </span>
                  {booking.event.duration && (
                    <span>({booking.event.duration} {t("client.minutes")})</span>
                  )}
                </div>
                {booking.event.price && (
                  <div className="font-medium text-foreground">
                    ${booking.event.price}
                  </div>
                )}
              </div>
            </div>

            {canCancel && (
              <Button
                variant="destructive"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel();
                }}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending
                  ? t("client.cancelling")
                  : t("client.cancelBooking")}
              </Button>
            )}
          </div>
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
              <span className="text-sm">
                {format(new Date(booking.updatedAt), "PPP 'at' h:mm a")}
              </span>
            </div>
            <div>
              <span className="text-sm font-medium">{t("client.eventTitle")}: </span>
              <span className="text-sm">{booking.event.title}</span>
            </div>
            <div>
              <span className="text-sm font-medium">{t("client.eventDate")}: </span>
              <span className="text-sm">
                {format(startDate, "PPP 'at' h:mm a")}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
