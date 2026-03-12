import { createFileRoute } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { DefaultHomepage } from "@/components/homepages/DefaultHomepage";
import { AdminHomepage } from "@/components/homepages/AdminHomepage";

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

function HomeComponent() {
  const { data: session, isPending } = authClient.useSession();
  const isSystemAdmin = (session?.user as any)?.isSystemAdmin;

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (session?.user && isSystemAdmin) {
    return <AdminHomepage />;
  }

  return <DefaultHomepage />;
}
