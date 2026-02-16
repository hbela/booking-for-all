import { createFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { Calendar, Clock, Users, Bell } from "lucide-react";

export const Route = createFileRoute("/provider/about")({
  component: ProviderAbout,
});

function ProviderAbout() {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {t("providerAbout.title")}
        </h1>
        <p className="text-muted-foreground">
          {t("providerAbout.subtitle")}
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("providerAbout.whatIsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{t("providerAbout.whatIsDescription")}</p>
            <p className="text-muted-foreground">
              {t("providerAbout.whatIsDetail")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("providerAbout.howItWorksTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex gap-3">
                <Calendar className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold">
                    {t("providerAbout.setAvailabilityTitle")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("providerAbout.setAvailabilityDesc")}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Users className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold">
                    {t("providerAbout.receiveBookingsTitle")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("providerAbout.receiveBookingsDesc")}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Clock className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold">
                    {t("providerAbout.manageScheduleTitle")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("providerAbout.manageScheduleDesc")}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Bell className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold">
                    {t("providerAbout.stayInformedTitle")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("providerAbout.stayInformedDesc")}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("providerAbout.gettingStartedTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>{t("providerAbout.step1")}</li>
              <li>{t("providerAbout.step2")}</li>
              <li>{t("providerAbout.step3")}</li>
              <li>{t("providerAbout.step4")}</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
