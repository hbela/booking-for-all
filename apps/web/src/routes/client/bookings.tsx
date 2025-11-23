import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Calendar, Clock, MapPin, User } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiFetch";

export const Route = createFileRoute("/client/bookings")({
  component: ClientBookings,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
      });
    }

    // @ts-ignore - role is UserRole enum
    const role = session.data.user.role;

    // Only allow CLIENT role
    if (role === "OWNER" || role === "ADMIN" || role === "PROVIDER") {
      throw redirect({
        to: "/",
      });
    }

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
  return apiFetch<Booking[]>(
    `${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}/api/bookings`
  );
};

function ClientBookings() {
  const { session } = Route.useRouteContext();

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

  const now = new Date();

  // Current Bookings: future bookings with CONFIRMED status, sorted by date ascending
  const currentBookings = bookings
    .filter((booking) => {
      const eventStart = new Date(booking.event.start);
      return eventStart >= now && booking.status === "CONFIRMED";
    })
    .sort((a, b) => {
      const dateA = new Date(a.event.start).getTime();
      const dateB = new Date(b.event.start).getTime();
      return dateA - dateB; // Ascending: soonest first
    });

  // Booking History: past bookings or cancelled/completed bookings, sorted by date descending
  const bookingHistory = bookings
    .filter((booking) => {
      const eventStart = new Date(booking.event.start);
      return eventStart < now || booking.status !== "CONFIRMED";
    })
    .sort((a, b) => {
      const dateA = new Date(a.event.start).getTime();
      const dateB = new Date(b.event.start).getTime();
      return dateB - dateA; // Descending: most recent first
    });

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="text-center">Loading bookings...</div>
      </div>
    );
  }

  if (error) {
    toast.error("Failed to load bookings");
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">My Bookings</h1>
        <p className="text-muted-foreground">
          View and manage your appointments
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bookings</CardTitle>
          <CardDescription>
            Manage your current and past appointments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">
                Error loading bookings.{" "}
                <button
                  onClick={() => refetch()}
                  className="underline font-medium"
                >
                  Try again
                </button>
              </p>
            </div>
          )}
          <Tabs defaultValue="current" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="current">
                Current Bookings ({currentBookings.length})
              </TabsTrigger>
              <TabsTrigger value="history">
                Booking History ({bookingHistory.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="current" className="mt-6">
              {currentBookings.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    You don't have any upcoming bookings.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {currentBookings.map((booking) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              {bookingHistory.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    You don't have any past bookings.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {bookingHistory.map((booking) => (
                    <BookingCard key={booking.id} booking={booking} />
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

function BookingCard({ booking }: { booking: Booking }) {
  const startDate = new Date(booking.event.start);
  const endDate = new Date(booking.event.end);
  const isPast = startDate < new Date();
  const isCancelled = booking.status === "CANCELLED";
  const isCompleted = booking.status === "COMPLETED";

  const getStatusBadge = () => {
    if (isCancelled) {
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200">
          Cancelled
        </span>
      );
    }
    if (isCompleted) {
      return (
        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          Completed
        </span>
      );
    }
    if (isPast) {
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-900 dark:text-gray-200">
          Past
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
        Confirmed
      </span>
    );
  };

  return (
    <Card className="hover:shadow-md transition-shadow w-full">
      <CardHeader>
        <CardTitle className="text-lg">{booking.event.title}</CardTitle>
        {booking.event.description && (
          <CardDescription>{booking.event.description}</CardDescription>
        )}
        <div className="mt-2">
          <span className="text-sm text-muted-foreground">Status: </span>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Provider:</span>
          <span className="font-medium">
            {booking.event.provider.user.name}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Organization:</span>
          <span className="font-medium">
            {booking.event.provider.department.organization.name}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Department:</span>
          <span className="font-medium">
            {booking.event.provider.department.name}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{format(startDate, "PPP")}</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {format(startDate, "h:mm a")} - {format(endDate, "h:mm a")}
          </span>
          {booking.event.duration && (
            <span className="text-muted-foreground">
              ({booking.event.duration} min)
            </span>
          )}
        </div>

        {booking.event.price && (
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-muted-foreground">Price:</span>
            <span>${booking.event.price}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
