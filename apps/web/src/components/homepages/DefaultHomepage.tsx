import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, Building2, Users, Shield, CheckCircle, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { apiFetch } from "@/lib/apiFetch";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

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

export function DefaultHomepage() {
  const { t } = useTranslation();
  const [showQRModal, setShowQRModal] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Determine API base URL based on environment
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

  // Auto-detect domain from current hostname
  const detectedDomain =
    typeof window !== "undefined" ? window.location.hostname : "";

  // Fetch organization by domain
  const {
    data: orgData,
    isLoading: isLoadingOrg,
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

      const response = await apiFetch<OrganizationResponse>(url);

      if (!response || !response.success) {
        throw new Error("Organization lookup failed");
      }

      // Store organization info
      if (response.data.organizationId) {
        setOrganizationId(response.data.organizationId);
      }

      return response;
    },
    enabled: !!detectedDomain,
    retry: false, // Don't retry if not found - that's okay, mobile app may not be org-specific
  });

  const handleInstallMobile = () => {
    const orgId = organizationId || orgData?.data?.organizationId;
    if (!orgId) {
      toast.error("Organization not found. Please try again.");
      return;
    }
    setShowQRModal(true);
  };

  // Generate QR code URL with organizationId
  const getQRCodeValue = () => {
    const apiBaseUrl = getApiBaseUrl();
    const orgId = organizationId || orgData?.data?.organizationId;
    if (!orgId) return "";

    // Use download page that handles deep linking with orgId in query param
    return `${apiBaseUrl}/org/${orgId}/app?orgId=${orgId}`;
  };

  const finalOrgId = organizationId || orgData?.data?.organizationId;
  const orgName = orgData?.data?.organizationName || "Organization";
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-950 dark:to-indigo-950">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-br from-primary to-primary/60 mb-8 shadow-lg">
              <Calendar className="w-14 h-14 text-white" />
            </div>
            <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {t("homepage.bookingForAll")}
            </h1>
            <p className="text-2xl text-muted-foreground max-w-3xl mx-auto mb-8">
              {t("homepage.tagline")}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/subscribe">
                <Button size="lg" className="text-lg px-8 py-6">
                  {t("navigation.subscription")}
                </Button>
              </Link>
              {finalOrgId && (
                <Button
                  variant="outline"
                  size="lg"
                  className="text-lg px-8 py-6"
                  onClick={handleInstallMobile}
                >
                  <Smartphone className="mr-2 h-5 w-5" />
                  Download Mobile App
                </Button>
              )}
            </div>
          </div>

          {/* Main Image Section */}
          <div className="mb-16 rounded-3xl overflow-hidden shadow-2xl border-4 border-primary/20">
            <img
              src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=600&fit=crop"
              alt="Booking for All - Appointment Management System"
              className="w-full h-[500px] object-cover"
            />
          </div>

          {/* What is Booking for All Section */}
          <Card className="mb-16 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
            <CardHeader className="text-center">
              <CardTitle className="text-4xl mb-4">{t("homepage.whatIsBookingForAll")}</CardTitle>
              <CardDescription className="text-lg">
                {t("homepage.powerfulSolution")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-lg leading-relaxed mb-4">
                  <strong>{t("homepage.bookingForAll")}</strong> {t("homepage.description")}
                </p>
                <p className="text-lg leading-relaxed mb-4">
                  {t("homepage.platformSupports")}
                </p>
                <ul className="space-y-3 text-lg">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 mt-1 flex-shrink-0" />
                    <span><strong>{t("navigation.organizations")}</strong> {t("homepage.organizationsFeature")}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 mt-1 flex-shrink-0" />
                    <span><strong>{t("navigation.providers")}</strong> {t("homepage.providersFeature")}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 mt-1 flex-shrink-0" />
                    <span><strong>{t("client.clientDashboard")}</strong> {t("homepage.clientsFeature")}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 mt-1 flex-shrink-0" />
                    <span><strong>{t("admin.adminDashboard")}</strong> {t("homepage.adminsFeature")}</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <Shield className="w-10 h-10 text-primary mb-3" />
                <CardTitle>{t("homepage.secureReliable")}</CardTitle>
                <CardDescription>
                  {t("homepage.secureDescription")}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <Building2 className="w-10 h-10 text-primary mb-3" />
                <CardTitle>{t("homepage.multiOrganization")}</CardTitle>
                <CardDescription>
                  {t("homepage.multiOrganizationDescription")}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <Users className="w-10 h-10 text-primary mb-3" />
                <CardTitle>{t("homepage.teamManagement")}</CardTitle>
                <CardDescription>
                  {t("homepage.teamManagementDescription")}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <Calendar className="w-10 h-10 text-primary mb-3" />
                <CardTitle>{t("homepage.smartScheduling")}</CardTitle>
                <CardDescription>
                  {t("homepage.smartSchedulingDescription")}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Mobile App Download Section */}
          {finalOrgId && (
            <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl mb-4">📱 Download Mobile App</CardTitle>
                <CardDescription className="text-lg">
                  Get the mobile app for {orgName} on your Android device
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <Button
                  size="lg"
                  className="text-lg px-8 py-6 mb-4"
                  onClick={handleInstallMobile}
                >
                  <Smartphone className="mr-2 h-5 w-5" />
                  Download Mobile App
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  Scan the QR code to download and install the app on your device
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

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
            {finalOrgId && getQRCodeValue() ? (
              <>
                <div className="p-4 bg-white rounded-lg border-2 border-primary">
                  <QRCodeSVG
                    value={getQRCodeValue()}
                    size={256}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Note: Enable "Install unknown apps" in your phone settings
                  (Settings → Apps → Special app access).
                </p>
                <a
                  href={getQRCodeValue()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Or click for direct download
                </a>
              </>
            ) : (
              <p className="text-sm text-destructive">
                Unable to generate QR code. Please try again.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

