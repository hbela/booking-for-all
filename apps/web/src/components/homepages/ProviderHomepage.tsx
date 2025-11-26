import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Users, CheckCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export function ProviderHomepage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-500/10 mb-6">
              <Calendar className="w-12 h-12 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
              {t("provider.providerPortal")}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t("provider.manageCalendarDesc")}
            </p>
          </div>

          {/* Image Section */}
          <div className="mb-12 rounded-2xl overflow-hidden shadow-2xl">
            <img
              src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&h=600&fit=crop"
              alt="Service Provider Calendar"
              className="w-full h-[400px] object-cover"
            />
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card>
              <CardHeader>
                <Calendar className="w-8 h-8 text-green-600 dark:text-green-400 mb-2" />
                <CardTitle>{t("provider.scheduleManagement")}</CardTitle>
                <CardDescription>
                  {t("provider.scheduleManagementDesc")}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Users className="w-8 h-8 text-green-600 dark:text-green-400 mb-2" />
                <CardTitle>{t("provider.clientAppointments")}</CardTitle>
                <CardDescription>
                  {t("provider.clientAppointmentsDesc")}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400 mb-2" />
                <CardTitle>{t("provider.availabilityControl")}</CardTitle>
                <CardDescription>
                  {t("provider.availabilityControlDesc")}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="bg-green-500/5 border-green-500/20">
            <CardHeader>
              <CardTitle>{t("provider.quickActions")}</CardTitle>
              <CardDescription>{t("provider.quickActionsDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Link to="/provider">
                  <Button size="lg" className="bg-green-600 hover:bg-green-700">
                    <Calendar className="mr-2 h-4 w-4" />
                    {t("provider.goToProviderDashboard")}
                  </Button>
                </Link>
                <Link to="/provider/calendar">
                  <Button variant="outline" size="lg">
                    <Clock className="mr-2 h-4 w-4" />
                    {t("provider.manageCalendar")}
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

