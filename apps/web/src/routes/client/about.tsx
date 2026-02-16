import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/client/about")({
  component: ClientAbout,
});

function ClientAbout() {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">About Our App</h1>
        <p className="text-muted-foreground">
          Welcome to the Booking for All Client Portal.
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>For Clients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              This application is designed to make your appointment booking experience seamless and efficient.
            </p>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Key Features:</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Easy appointment booking with your favorite organizations</li>
                <li>Real-time availability checking</li>
                <li>Manage your upcoming and past bookings</li>
                <li>Receive notifications and reminders</li>
              </ul>
            </div>
            <p>
              Whether you are booking a consultation, a service, or a meeting, our platform connects you directly with providers.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
