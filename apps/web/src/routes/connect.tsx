import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiFetch } from "@/lib/apiFetch";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/connect")({
  component: ConnectLandingPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      // Optional: allow domain override, but default to auto-detect
      domain: (search.domain as string) || undefined,
    };
  },
  head: () => ({
    meta: [
      {
        title: "Connect - Booking for All",
      },
      {
        name: "description",
        content: "Connect to the booking system",
      },
    ],
  }),
});

interface OrganizationData {
  organizationId: string;
  organizationName: string;
  organizationSlug?: string;
  redirectUrl?: string;
}

interface OrganizationResponse {
  success: boolean;
  data: OrganizationData;
}

function ConnectLandingPage() {
  const navigate = useNavigate();
  const { domain: urlDomain } = Route.useSearch();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationSlug, setOrganizationSlug] = useState<string | null>(null);

  // Determine API base URL based on environment (same logic as wellness_external.html)
  const getApiBaseUrl = () => {
    if (typeof window === "undefined") return "http://localhost:3000";
    if (window.location.origin.includes("localhost")) {
      return "http://localhost:3000";
    }
    if (
      window.location.hostname.includes("dev") ||
      window.location.hostname.includes("wellnessdev") ||
      window.location.hostname.includes("medicaredev")
    ) {
      return "https://apidev.appointer.hu";
    }
    return window.location.protocol === "https:"
      ? "https://api.appointer.hu"
      : "http://localhost:3000";
  };

  // Auto-detect domain from current hostname (primary method)
  const detectedDomain =
    urlDomain || (typeof window !== "undefined" ? window.location.hostname : "");

  // Fetch organization by domain (same as wellness_external.html)
  const {
    data: orgData,
    isLoading,
    error: orgError,
  } = useQuery<OrganizationResponse>({
    queryKey: ["organization-by-domain", detectedDomain],
    queryFn: async () => {
      if (!detectedDomain) {
        throw new Error("No domain provided");
      }

      const apiBaseUrl = getApiBaseUrl();
      const url = `${apiBaseUrl}/api/external/organization-by-domain?domain=${encodeURIComponent(
        detectedDomain
      )}`;

      console.log("🔍 Fetching organization for domain:", detectedDomain);
      console.log("   API URL:", url);

      const response = await apiFetch<OrganizationResponse>(url);

      if (!response || !response.success) {
        throw new Error("Organization lookup failed");
      }

      console.log("✅ Organization found:", response.data);

      // Store organization info
      if (response.data.organizationId) {
        setOrganizationId(response.data.organizationId);
      }
      if (response.data.organizationSlug) {
        setOrganizationSlug(response.data.organizationSlug);
      }

      return response;
    },
    enabled: !!detectedDomain,
    retry: 1,
  });

  const handleConnectToApp = () => {
    const orgId = organizationId || orgData?.data?.organizationId;
    const orgSlug = organizationSlug || orgData?.data?.organizationSlug;
    const externalOrigin =
      typeof window !== "undefined" ? window.location.origin : "";

    if (!orgId) {
      toast.error("Organization not found. Please try again.");
      return;
    }

    // Build redirect URL with orgId in query params (same as wellness_external.html)
    const redirectUrl = new URL("/login", window.location.origin);
    redirectUrl.searchParams.set("org", orgId);
    
    // Include orgSlug if available
    if (orgSlug) {
      redirectUrl.searchParams.set("orgSlug", orgSlug);
    }
    
    // Include external origin for reference
    if (externalOrigin) {
      redirectUrl.searchParams.set("externalOrigin", externalOrigin);
    }

    // Include referrer
    if (document.referrer) {
      redirectUrl.searchParams.set("referrer", encodeURIComponent(document.referrer));
    }

    console.log("🔄 Redirecting to:", redirectUrl.toString());

    navigate({
      to: redirectUrl.pathname,
      search: Object.fromEntries(redirectUrl.searchParams),
    });
  };

  const orgName = orgData?.data?.organizationName || "Organization";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-gray-600">Loading organization information...</p>
        </div>
      </div>
    );
  }

  if (orgError || !orgData?.data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-destructive">
              Organization Not Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-600 mb-4">
              We couldn't find an organization for domain: <strong>{detectedDomain}</strong>
            </p>
            <p className="text-center text-sm text-muted-foreground mb-4">
              Please check:
            </p>
            <ul className="text-left text-sm text-muted-foreground space-y-1 mb-4">
              <li>1. Backend API is reachable</li>
              <li>2. Domain is registered in the database</li>
              <li>3. CORS is properly configured</li>
            </ul>
            <Button
              onClick={() => navigate({ to: "/" })}
              className="w-full"
              variant="outline"
            >
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl">🌿 Connect to {orgName}</CardTitle>
          <CardDescription className="text-base">
            Connect to the booking system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleConnectToApp}
            className="w-full h-14 text-lg"
            size="lg"
          >
            Connect to the app
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

