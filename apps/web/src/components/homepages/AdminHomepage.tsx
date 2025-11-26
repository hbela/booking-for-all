import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Users, Building2, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export function AdminHomepage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 mb-6">
              <Shield className="w-12 h-12 text-primary" />
            </div>
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {t("admin.adminDashboard")}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t("admin.managePlatform")}
            </p>
          </div>

          {/* Image Section */}
          <div className="mb-12 rounded-2xl overflow-hidden shadow-2xl">
            <img
              src="https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&h=600&fit=crop"
              alt="Admin Dashboard"
              className="w-full h-[400px] object-cover"
            />
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card>
              <CardHeader>
                <Building2 className="w-8 h-8 text-primary mb-2" />
                <CardTitle>{t("admin.organizationManagement")}</CardTitle>
                <CardDescription>
                  {t("admin.organizationManagementDesc")}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Users className="w-8 h-8 text-primary mb-2" />
                <CardTitle>{t("admin.userAdministration")}</CardTitle>
                <CardDescription>
                  {t("admin.userAdministrationDesc")}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Settings className="w-8 h-8 text-primary mb-2" />
                <CardTitle>{t("admin.systemSettings")}</CardTitle>
                <CardDescription>
                  {t("admin.systemSettingsDesc")}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="bg-primary/5 border-primary/20">
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

