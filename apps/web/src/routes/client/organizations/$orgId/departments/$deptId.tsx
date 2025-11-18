import {
  createFileRoute,
  useNavigate,
  Outlet,
  useMatches,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, User } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/client/organizations/$orgId/departments/$deptId"
)({
  component: ProviderSelection,
});

interface Provider {
  id: string;
  user: {
    name: string;
    email: string;
  };
  bio?: string | null;
  specialization?: string | null;
  _count?: {
    events: number;
  };
}

interface Department {
  id: string;
  name: string;
  organization: {
    id: string;
    name: string;
  };
}

// API functions
const fetchDepartment = async (deptId: string): Promise<Department> => {
  const response = await fetch(
    `${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}/api/client/departments/${deptId}`,
    {
      credentials: "include",
    }
  );
  if (!response.ok) {
    throw new Error("Failed to load department");
  }
  return response.json();
};

const fetchProviders = async (deptId: string): Promise<Provider[]> => {
  const response = await fetch(
    `${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}/api/client/departments/${deptId}/providers`,
    {
      credentials: "include",
    }
  );
  if (!response.ok) {
    throw new Error("Failed to load providers");
  }
  return response.json();
};

function ProviderSelection() {
  const { orgId, deptId } = Route.useParams();
  const navigate = useNavigate();
  const matches = useMatches();

  // Check if we're on a child route (like providers/$providerId)
  // If there are more than 3 matches (root + orgId + deptId + child), we're on a child route
  const isChildRoute =
    matches.length > 3 && matches[matches.length - 1].id !== Route.id;

  console.log(
    "$deptId route - isChildRoute:",
    isChildRoute,
    "matches:",
    matches.map((m) => m.id),
    "Route.id:",
    Route.id
  );

  // Query for department
  const {
    data: department,
    isLoading: isLoadingDept,
    error: deptError,
  } = useQuery({
    queryKey: ["client", "departments", deptId],
    queryFn: () => fetchDepartment(deptId),
    enabled: !isChildRoute,
  });

  // Query for providers
  const {
    data: providers = [],
    isLoading: isLoadingProviders,
    error: providersError,
  } = useQuery({
    queryKey: ["client", "departments", deptId, "providers"],
    queryFn: () => fetchProviders(deptId),
    enabled: !isChildRoute,
  });

  // If on child route, render the child component
  if (isChildRoute) {
    return <Outlet />;
  }

  const isLoading = isLoadingDept || isLoadingProviders;
  const hasError = deptError || providersError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading providers...</div>
      </div>
    );
  }

  if (hasError) {
    toast.error(
      deptError ? "Failed to load department" : "Failed to load providers"
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Button
        variant="ghost"
        className="mb-6"
        onClick={() =>
          navigate({ to: "/client/organizations/$orgId", params: { orgId } })
        }
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Departments
      </Button>

      <div className="mb-8">
        <div className="text-sm text-muted-foreground mb-2">
          {department?.organization.name}
        </div>
        <h1 className="text-4xl font-bold mb-2">{department?.name}</h1>
        <p className="text-sm text-muted-foreground">
          Select a provider to view their available time slots
        </p>
      </div>

      {hasError ? (
        <Card className="col-span-full">
          <CardContent className="pt-6">
            <p className="text-center text-red-500">
              Error loading data. Please try again.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {providers.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No providers available in this department.
                </p>
              </CardContent>
            </Card>
          ) : (
            providers.map((provider) => (
              <Card
                key={provider.id}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">
                        {provider.user.name}
                      </CardTitle>
                      {provider.specialization && (
                        <CardDescription>
                          {provider.specialization}
                        </CardDescription>
                      )}
                      <CardDescription className="text-xs text-muted-foreground">
                        ID: {provider.id.slice(0, 8)}...
                      </CardDescription>
                    </div>
                  </div>
                  {provider.bio && (
                    <CardDescription className="line-clamp-3">
                      {provider.bio}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Calendar className="h-4 w-4" />
                    <span>{provider._count?.events || 0} available slots</span>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() =>
                      navigate({
                        to: "/client/organizations/$orgId/departments/$deptId/providers/$providerId",
                        params: { orgId, deptId, providerId: provider.id },
                      })
                    }
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    View Calendar
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
