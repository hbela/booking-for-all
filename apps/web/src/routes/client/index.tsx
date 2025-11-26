import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Building2, Users } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/apiFetch";

export const Route = createFileRoute("/client/")({
  component: ClientDashboard,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
      });
    }

    // @ts-ignore - role is UserRole enum
    const role = session.data.user.role;

    // Owners, Admins, and Providers don't need to book appointments
    // Redirect to their respective dashboards
    if (role === "OWNER") {
      throw redirect({
        to: "/owner",
      });
    }
    if (role === "ADMIN") {
      throw redirect({
        to: "/admin",
      });
    }
    if (role === "PROVIDER") {
      throw redirect({
        to: "/provider",
      });
    }

    // CLIENT must have organization membership
    if (role === "CLIENT") {
      try {
        try {
          const organizations = await apiFetch<any[]>(
            `${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}/api/client/organizations`
          );
          if (!organizations || organizations.length === 0) {
            // Client has no organizations - redirect to login
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
        console.error("Error checking organization membership:", error);
      }
    }

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

// API function
const fetchClientOrganizations = async (): Promise<Organization[]> => {
  return apiFetch<Organization[]>(
    `${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}/api/client/organizations`
  );
};

function ClientDashboard() {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();

  // Query for organizations
  const {
    data: organizations = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["client", "organizations"],
    queryFn: fetchClientOrganizations,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">{t("booking.loadingOrganizations")}</div>
      </div>
    );
  }

  if (error) {
    toast.error(t("booking.failedToLoadOrganizations"));
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-500">
          {t("booking.errorLoadingOrganizations")}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{t("booking.bookAnAppointment")}</h1>
        <p className="text-muted-foreground">
          {t("common.welcome")} {session?.user?.name}!{" "}
          {organizations.length === 0
            ? t("booking.browseAvailableOrganizations")
            : organizations.length === 1
            ? `${t("booking.bookAppointmentWith")} ${organizations[0]?.name}.`
            : t("booking.selectOrganizationToStart")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {organizations.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                {t("booking.noOrganizationsAvailable")}
              </p>
            </CardContent>
          </Card>
        ) : (
          organizations.map((org) => (
            <Card key={org.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <Building2 className="h-10 w-10 text-primary mb-2" />
                </div>
                <CardTitle className="text-xl">{org.name}</CardTitle>
                {org.description && (
                  <CardDescription className="line-clamp-2">
                    {org.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{org._count?.departments || 0} {t("booking.departments")}</span>
                  </div>
                </div>
                <Link
                  to="/client/organizations/$orgId"
                  params={{ orgId: org.id }}
                >
                  <Button className="w-full">
                    <Calendar className="mr-2 h-4 w-4" />
                    {t("booking.bookAnAppointment")}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
