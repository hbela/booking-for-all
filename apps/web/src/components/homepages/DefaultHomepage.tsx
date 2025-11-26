import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Building2, Users, Shield, ArrowRight, CheckCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export function DefaultHomepage() {
  const { t } = useTranslation();
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
              <Link to="/login">
                <Button size="lg" className="text-lg px-8 py-6">
                  {t("homepage.getStarted")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="lg" className="text-lg px-8 py-6">
                  {t("homepage.signIn")}
                </Button>
              </Link>
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

          {/* CTA Section */}
          <Card className="bg-gradient-to-r from-primary to-blue-600 text-white border-0">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl mb-2">{t("homepage.readyToGetStarted")}</CardTitle>
              <CardDescription className="text-white/90 text-lg">
                {t("homepage.joinThousands")}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link to="/login">
                <Button size="lg" variant="secondary" className="text-lg px-8 py-6">
                  {t("homepage.signInToAccount")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

