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
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/provider/")({
  component: ProviderComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
      });
    }

    // Check if user has PROVIDER role in at least one organization
    try {
      const memberships = await apiFetch<any[]>(
        `${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}/api/members/my-organizations`
      );

      // Filter for PROVIDER memberships
      const providerMemberships = memberships.filter((m: any) => m.role === "PROVIDER");

      if (!providerMemberships || providerMemberships.length === 0) {
        // User is not a provider in any organization
        throw redirect({
          to: "/",
          search: {
            error: "You do not have provider access to any organization.",
          },
        });
      }
    } catch (error) {
      console.error("Error checking organization membership:", error);
      throw redirect({
        to: "/",
        search: {
          error: "Could not verify organization membership.",
        },
      });
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
  const { t } = useTranslation();
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
      toast.error(providerError.message || t("provider.errorLoadingProviderInformation"));
    }
    if (eventsError) {
      toast.error(t("provider.errorLoadingEvents"));
    }
  }, [providerError, eventsError, t]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="text-center">{t("provider.loading")}</div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
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

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("provider.providerDashboard")}</h1>
        <p className="text-muted-foreground">
          {t("provider.welcomeBack", { name: provider?.user?.name || session.data?.user.name })}
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-6 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("provider.totalFutureEvents")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalEvents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("provider.bookedAppointments")}
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
              {t("provider.availableSlots")}
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
            <CardTitle>{t("provider.yourInformation")}</CardTitle>
            <CardDescription>{t("provider.providerDetails")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="font-semibold">{t("provider.name")}:</span>{" "}
              {session.data?.user.name}
            </div>
            <div>
              <span className="font-semibold">{t("provider.emailLabel")}:</span>{" "}
              {session.data?.user.email}
            </div>
            <div>
              <span className="font-semibold">{t("provider.department")}:</span>{" "}
              {provider.department?.name || t("provider.nA")}
            </div>
            <div>
              <span className="font-semibold">{t("provider.organization")}:</span>{" "}
              {provider.department?.organization?.name || t("provider.nA")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("provider.quickActionsTitle")}</CardTitle>
            <CardDescription>
              {t("provider.manageCalendarAndAvailability")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link to="/provider/calendar">
              <Button className="w-full">{t("provider.goToCalendar")}</Button>
            </Link>
            <p className="text-sm text-muted-foreground">
              {t("provider.clickCalendarToCreateSlots")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
