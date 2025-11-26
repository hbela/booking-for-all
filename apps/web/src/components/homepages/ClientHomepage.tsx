import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Search, Clock, CheckCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export function ClientHomepage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 dark:from-purple-950 dark:to-pink-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-purple-500/10 mb-6">
              <Calendar className="w-12 h-12 text-purple-600 dark:text-purple-400" />
            </div>
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
              {t("client.bookYourAppointment")}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t("client.findProviders")}
            </p>
          </div>

          {/* Image Section */}
          <div className="mb-12 rounded-2xl overflow-hidden shadow-2xl">
            <img
              src="https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=1200&h=600&fit=crop"
              alt="Appointment Booking"
              className="w-full h-[400px] object-cover"
            />
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card>
              <CardHeader>
                <Search className="w-8 h-8 text-purple-600 dark:text-purple-400 mb-2" />
                <CardTitle>{t("client.findProvidersTitle")}</CardTitle>
                <CardDescription>
                  {t("client.findProvidersDesc")}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Clock className="w-8 h-8 text-purple-600 dark:text-purple-400 mb-2" />
                <CardTitle>{t("client.bookAppointmentsTitle")}</CardTitle>
                <CardDescription>
                  {t("client.bookAppointmentsDesc")}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CheckCircle className="w-8 h-8 text-purple-600 dark:text-purple-400 mb-2" />
                <CardTitle>{t("client.manageBookings")}</CardTitle>
                <CardDescription>
                  {t("client.manageBookingsDesc")}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="bg-purple-500/5 border-purple-500/20">
            <CardHeader>
              <CardTitle>{t("client.quickActions")}</CardTitle>
              <CardDescription>{t("client.quickActionsDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Link to="/client">
                  <Button size="lg" className="bg-purple-600 hover:bg-purple-700">
                    <Calendar className="mr-2 h-4 w-4" />
                    {t("client.browseOrganizations")}
                  </Button>
                </Link>
                <Link to="/client/bookings">
                  <Button variant="outline" size="lg">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {t("client.myBookings")}
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

