import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiFetch";

export const Route = createFileRoute("/provider/")({
  component: ProviderComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
      });
    }

    // @ts-ignore - role is UserRole enum
    const role = session.data.user.role;

    // Check if user has PROVIDER role
    if (role !== "PROVIDER") {
      throw redirect({
        to: "/login",
      });
    }

    // PROVIDER must have provider record (which implies organization membership)
    try {
      try {
        const providers = await apiFetch<any[]>(
          `${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}/api/providers?userId=${session.data.user.id}`
        );
        if (!providers || providers.length === 0) {
          // Provider has no provider records - redirect to login
          throw redirect({
            to: "/login",
          });
        }
      } catch (error) {
        throw redirect({
          to: "/login",
        });
      }
    } catch (error) {
      console.error("Error checking provider membership:", error);
    }

    return { session };
  },
});

// API functions
const fetchProvider = async (userId: string): Promise<any> => {
  const providers = await apiFetch<any[]>(
    `${import.meta.env.VITE_SERVER_URL}/api/providers?userId=${userId}`
  );
  if (providers.length === 0) {
    throw new Error("You are not registered as a provider");
  }
  return providers[0];
};

const fetchEvents = async (providerId: string): Promise<any[]> => {
  return apiFetch<any[]>(
    `${import.meta.env.VITE_SERVER_URL}/api/events?providerId=${providerId}`
  );
};

function ProviderComponent() {
  const { session } = Route.useRouteContext();
  const userId = session.data?.user.id;

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
    data: events = [],
    isLoading: isLoadingEvents,
    error: eventsError,
  } = useQuery<any[]>({
    queryKey: ["events", { providerId: provider?.id }],
    queryFn: () => fetchEvents(provider.id),
    enabled: !!provider?.id,
  });

  // Calculate stats from events
  const stats = useMemo(() => {
    if (!events || events.length === 0) {
      return {
        totalEvents: 0,
        bookedEvents: 0,
        availableSlots: 0,
      };
    }

    const now = new Date();
    const futureEvents = events.filter(
      (e: any) => new Date(e.start) > now
    );
    const bookedEvents = futureEvents.filter((e: any) => e.isBooked);
    const availableSlots = futureEvents.filter((e: any) => !e.isBooked);

    return {
      totalEvents: futureEvents.length,
      bookedEvents: bookedEvents.length,
      availableSlots: availableSlots.length,
    };
  }, [events]);

  const loading = isLoadingProvider || isLoadingEvents;

  // Show errors
  useEffect(() => {
    if (providerError) {
      toast.error(providerError.message || "Error loading provider information");
    }
    if (eventsError) {
      toast.error("Error loading events");
    }
  }, [providerError, eventsError]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              You are not registered as a provider. Please contact your
              organization administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Provider Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {session.data?.user.name}
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-6 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Future Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalEvents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Booked Appointments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {stats.bookedEvents}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Available Slots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats.availableSlots}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Provider Info */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your Information</CardTitle>
            <CardDescription>Provider details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="font-semibold">Name:</span>{" "}
              {session.data?.user.name}
            </div>
            <div>
              <span className="font-semibold">Email:</span>{" "}
              {session.data?.user.email}
            </div>
            <div>
              <span className="font-semibold">Department:</span>{" "}
              {provider.department?.name || "N/A"}
            </div>
            <div>
              <span className="font-semibold">Organization:</span>{" "}
              {provider.department?.organization?.name || "N/A"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Manage your calendar and availability
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link to="/provider/calendar">
              <Button className="w-full">Go to Calendar</Button>
            </Link>
            <p className="text-sm text-muted-foreground">
              Click on your calendar to create availability slots. Clients can
              book appointments during your available times.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
