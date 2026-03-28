import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Users, Building2, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export function AdminHomepage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-md bg-primary/10 mb-6">
              <Shield className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">
              {t("admin.adminDashboard")}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t("admin.managePlatform")}
            </p>
          </div>

          {/* Uncluttered Professional Minimalism: Removed stock photography banner */}

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="border-border shadow-sm rounded-md transition-shadow duration-200">
              <CardHeader>
                <Building2 className="w-8 h-8 text-primary mb-2" />
                <CardTitle className="text-xl font-semibold tracking-tight">{t("admin.organizationManagement")}</CardTitle>
                <CardDescription>
                  {t("admin.organizationManagementDesc")}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border shadow-sm rounded-md transition-shadow duration-200">
              <CardHeader>
                <Users className="w-8 h-8 text-primary mb-2" />
                <CardTitle className="text-xl font-semibold tracking-tight">{t("admin.userAdministration")}</CardTitle>
                <CardDescription>
                  {t("admin.userAdministrationDesc")}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border shadow-sm rounded-md transition-shadow duration-200">
              <CardHeader>
                <Settings className="w-8 h-8 text-primary mb-2" />
                <CardTitle className="text-xl font-semibold tracking-tight">{t("admin.systemSettings")}</CardTitle>
                <CardDescription>
                  {t("admin.systemSettingsDesc")}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="border-border rounded-md shadow-sm">
            <CardHeader>
              <CardTitle>{t("admin.quickActions")}</CardTitle>
              <CardDescription>{t("admin.quickActionsDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Link to="/admin">
                  <Button size="lg">
                    <Shield className="mr-2 h-4 w-4" />
                    {t("admin.goToAdminDashboard")}
                  </Button>
                </Link>
                <Link to="/admin/api-keys">
                  <Button variant="outline" size="lg">
                    <Settings className="mr-2 h-4 w-4" />
                    {t("admin.manageApiKeys")}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

