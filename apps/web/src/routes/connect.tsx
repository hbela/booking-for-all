import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/apiFetch";
import { toast } from "sonner";
import { Loader2, Globe, Smartphone } from "lucide-react";
import SignInForm from "@/components/sign-in-form";

export const Route = createFileRoute("/connect")({
  component: ConnectLandingPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      // Allow orgId directly (from wellness_external.html) or domain for lookup
      orgId: (search.orgId as string) || undefined,
      domain: (search.domain as string) || undefined,
      orgSlug: (search.orgSlug as string) || undefined,
    };
  },
  head: () => ({
    meta: [
      {
        title: "Connect - Booking for All",
      },
      {
        name: "description",
        content: "Connect to the booking system via web or mobile app",
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
  const search = Route.useSearch();
  const urlOrgId = search.orgId as string | undefined;
  const urlDomain = search.domain as string | undefined;
  const urlOrgSlug = search.orgSlug as string | undefined;
  const [showQRModal, setShowQRModal] = useState(false);
  const [showSignInForm, setShowSignInForm] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(urlOrgId || null);
  const [organizationSlug, setOrganizationSlug] = useState<string | null>(urlOrgSlug || null);

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

  // Use domain from URL parameter first, then fallback to current hostname
  const detectedDomain = urlDomain || (typeof window !== "undefined" ? window.location.hostname : "");
  
  // Debug logging
  useEffect(() => {
    console.log("🔍 ConnectLandingPage - Organization detection:", {
      urlOrgId,
      urlDomain,
      urlOrgSlug,
      currentHostname: typeof window !== "undefined" ? window.location.hostname : "N/A",
      detectedDomain,
      organizationId,
      organizationSlug,
    });
  }, [urlOrgId, urlDomain, urlOrgSlug, detectedDomain, organizationId, organizationSlug]);

  // Fetch organization - prefer orgId if provided, otherwise lookup by domain
  const {
    data: orgData,
    isLoading,
    error: orgError,
  } = useQuery<OrganizationResponse>({
    queryKey: urlOrgId 
      ? ["organization-by-id", urlOrgId]
      : ["organization-by-domain", detectedDomain],
    queryFn: async () => {
      const apiBaseUrl = getApiBaseUrl();

      // If orgId is provided, fetch by ID
      if (urlOrgId) {
        try {
          const url = `${apiBaseUrl}/api/external/organization/${urlOrgId}`;
          console.log("🔍 Fetching organization by ID:", urlOrgId);
          const response = await apiFetch<OrganizationData>(url);
          
          return {
            success: true,
            data: response,
          };
        } catch (error) {
          console.error("Failed to fetch by ID, trying domain lookup:", error);
          // Fall through to domain lookup
        }
      }

      // Fallback to domain lookup
      if (!detectedDomain) {
        throw new Error("No domain or organization ID provided");
      }

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
    enabled: !!(urlOrgId || detectedDomain),
    retry: 1,
  });

  // Update state when orgData is loaded
  useEffect(() => {
    if (orgData?.data) {
      if (orgData.data.organizationId && !organizationId) {
        setOrganizationId(orgData.data.organizationId);
      }
      if (orgData.data.organizationSlug && !organizationSlug) {
        setOrganizationSlug(orgData.data.organizationSlug);
      }
    }
  }, [orgData, organizationId, organizationSlug]);

  const handleContinueWithWeb = () => {
    const orgId = organizationId || orgData?.data?.organizationId;
    const orgSlug = organizationSlug || orgData?.data?.organizationSlug;

    if (!orgId) {
      toast.error("Organization not found. Please try again.");
      return;
    }

    // Store org context in sessionStorage for sign-out redirect and auth flow
    if (orgSlug) {
      sessionStorage.setItem("sourceOrganization", orgSlug);
      console.log("✅ Stored sourceOrganization:", orgSlug);
    }
    sessionStorage.setItem("externalAppOrgId", orgId);

    setShowSignInForm(true);
  };

  const handleInstallMobile = () => {
    const orgId = organizationId || orgData?.data?.organizationId;
    if (!orgId) {
      toast.error("Organization not found. Please try again.");
      return;
    }
    setShowQRModal(true);
  };

  const finalOrgId = organizationId || orgData?.data?.organizationId;

  // Fetch install info (APK URL) for QR code - fetch as soon as we have orgId
  const {
    data: installData,
    isLoading: installLoading,
    error: installError,
  } = useQuery<{
    organizationId: string;
    organizationName: string;
    organizationSlug: string | null;
    apk: {
      available: boolean;
      downloadUrl: string | null;
      source: string | null;
    };
    qrCode: {
      available: boolean;
      imageUrl: string | null;
    };
    deepLink: string;
    universalLink: string;
    installPageUrl: string;
  }>({
    queryKey: ["install-info", finalOrgId],
    queryFn: async () => {
      if (!finalOrgId) throw new Error("Organization ID required");
      const apiBaseUrl = getApiBaseUrl();
      console.log("🔍 Fetching install info for org:", finalOrgId);
      try {
        // apiFetch extracts data.data, so we get just the data object
        const response = await apiFetch<{
          organizationId: string;
          organizationName: string;
          organizationSlug: string | null;
          apk: {
            available: boolean;
            downloadUrl: string | null;
            source: string | null;
          };
          qrCode: {
            available: boolean;
            imageUrl: string | null;
          };
          deepLink: string;
          universalLink: string;
          installPageUrl: string;
        }>(`${apiBaseUrl}/api/install/${finalOrgId}`);
        console.log("✅ Install info loaded:", response);
        return response;
      } catch (error) {
        console.error("❌ Failed to fetch install info:", error);
        throw error;
      }
    },
    enabled: !!finalOrgId, // Fetch as soon as we have orgId
    retry: 2,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Get direct APK download URL - only return if we have it
  const getQRCodeValue = (): string | null => {
    const url = installData?.apk?.downloadUrl || null;
    console.log("🔍 getQRCodeValue:", { 
      hasInstallData: !!installData,
      hasApk: !!installData?.apk,
      hasDownloadUrl: !!installData?.apk?.downloadUrl,
      url 
    });
    return url;
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
            Choose how you'd like to access the booking system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showSignInForm ? (
            <>
              <SignInForm
                onSwitchToSignUp={() => {}}
                orgId={finalOrgId ?? undefined}
                callbackURL={
                  finalOrgId
                    ? `${window.location.origin}/login?org=${finalOrgId}`
                    : undefined
                }
              />
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setShowSignInForm(false)}
              >
                ← Back
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handleContinueWithWeb}
                className="w-full h-14 text-lg"
                size="lg"
              >
                <Globe className="mr-2 h-5 w-5" />
                Continue with the web
              </Button>

              <Button
                onClick={handleInstallMobile}
                variant="outline"
                className="w-full h-14 text-lg border-2"
                size="lg"
                disabled={!finalOrgId}
              >
                <Smartphone className="mr-2 h-5 w-5" />
                Install the mobile app
              </Button>

              {!finalOrgId && (
                <p className="text-xs text-center text-muted-foreground">
                  Organization ID is required to install the mobile app
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* QR Code Modal */}
      <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan to Install Mobile App</DialogTitle>
            <DialogDescription>
              Point your Android camera at this QR code to download and install
              the app for {orgName}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 p-4">
            {(() => {
              console.log("🔍 QR Modal render check:", {
                finalOrgId,
                installLoading,
                hasInstallError: !!installError,
                installData,
                qrCodeValue: getQRCodeValue(),
                apkAvailable: installData?.apk?.available,
              });
              return null;
            })()}
            {!finalOrgId ? (
              <p className="text-sm text-destructive">
                Organization ID is required. Please try again.
              </p>
            ) : installLoading ? (
              <div className="flex flex-col items-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading APK download link...</p>
              </div>
            ) : installError ? (
              <p className="text-sm text-destructive">
                Failed to load APK download link. Error: {installError instanceof Error ? installError.message : 'Unknown error'}
                <br />
                <span className="text-xs text-muted-foreground">Please refresh the page and try again.</span>
              </p>
            ) : installData?.apk?.available === false ? (
              <p className="text-sm text-destructive">
                APK is not available for this organization. Please contact support.
              </p>
            ) : getQRCodeValue() ? (
              <>
                <div className="p-4 bg-white rounded-lg border-2 border-primary">
                  <QRCodeSVG
                    value={getQRCodeValue()!}
                    size={256}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Scan this QR code to directly download the APK file.
                </p>
                <p className="text-xs text-center text-muted-foreground">
                  Note: Enable "Install unknown apps" in your phone settings
                  (Settings → Apps → Special app access).
                </p>
                <a
                  href={getQRCodeValue()!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline font-medium"
                  download
                >
                  Or click here to download APK directly
                </a>
              </>
            ) : (
              <p className="text-sm text-destructive">
                Unable to generate QR code. APK download URL is not available.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

