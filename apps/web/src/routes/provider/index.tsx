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
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}/api/providers?userId=${session.data.user.id}`,
        {
          credentials: "include",
        }
      );
      
      if (response.ok) {
        const providers = await response.json();
        if (!providers || providers.length === 0) {
          // Provider has no provider records - redirect to login
          throw redirect({
            to: "/login",
          });
        }
      }
    } catch (error) {
      console.error("Error checking provider membership:", error);
    }

    return { session };
  },
});

function ProviderComponent() {
  const { session } = Route.useRouteContext();
  const [provider, setProvider] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEvents: 0,
    bookedEvents: 0,
    availableSlots: 0,
  });

  useEffect(() => {
    const loadProviderData = async () => {
      try {
        // Load provider info
        const providerResponse = await fetch(
          `${import.meta.env.VITE_SERVER_URL}/api/providers?userId=${
            session.data?.user.id
          }`,
          {
            credentials: "include",
          }
        );

        if (providerResponse.ok) {
          const providers = await providerResponse.json();
          if (providers.length > 0) {
            setProvider(providers[0]);

            // Load events to calculate stats
            const eventsResponse = await fetch(
              `${import.meta.env.VITE_SERVER_URL}/api/events?providerId=${
                providers[0].id
              }`,
              {
                credentials: "include",
              }
            );

            if (eventsResponse.ok) {
              const events = await eventsResponse.json();
              const now = new Date();
              const futureEvents = events.filter(
                (e: any) => new Date(e.start) > now
              );
              const bookedEvents = futureEvents.filter((e: any) => e.isBooked);
              const availableSlots = futureEvents.filter(
                (e: any) => !e.isBooked
              );

              setStats({
                totalEvents: futureEvents.length,
                bookedEvents: bookedEvents.length,
                availableSlots: availableSlots.length,
              });
            }
          } else {
            toast.error("You are not registered as a provider");
          }
        }
      } catch (err) {
        console.error("Error loading provider data:", err);
        toast.error("Error loading provider information");
      } finally {
        setLoading(false);
      }
    };

    loadProviderData();
  }, [session.data?.user.id]);

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
