import { Button } from "@/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomeComponent,
  head: () => ({
    meta: [
      {
        title: "Booking for All - Appointment Management System",
      },
      {
        name: "description",
        content: "Efficient appointment booking and management platform for businesses and organizations",
      },
      {
        property: "og:title",
        content: "Booking for All - Appointment Management System",
      },
      {
        property: "og:description",
        content: "Efficient appointment booking and management platform for businesses and organizations",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:url",
        content: "/",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:title",
        content: "Booking for All - Appointment Management System",
      },
      {
        name: "twitter:description",
        content: "Efficient appointment booking and management platform for businesses and organizations",
      },
    ],
    links: [
      {
        rel: "canonical",
        href: "/",
      },
    ],
  }),
});

const TITLE_TEXT = `Better`;

function HomeComponent() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-2">
      <pre className="overflow-x-auto font-mono text-sm">{TITLE_TEXT}</pre>
      <div className="grid gap-6">
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">API Status</h2>
        </section>
      </div>
    </div>
  );
}
