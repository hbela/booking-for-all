import { createFileRoute } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { DefaultHomepage } from "@/components/homepages/DefaultHomepage";
import { AdminHomepage } from "@/components/homepages/AdminHomepage";
import { OwnerHomepage } from "@/components/homepages/OwnerHomepage";
import { ProviderHomepage } from "@/components/homepages/ProviderHomepage";
import { ClientHomepage } from "@/components/homepages/ClientHomepage";

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

  // Show loading state while checking session
  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // If user is logged in, show role-specific homepage
  if (session?.user) {
    const role = session.user.role as string;

    switch (role) {
      case "ADMIN":
        return <AdminHomepage />;
      case "OWNER":
        return <OwnerHomepage />;
      case "PROVIDER":
        return <ProviderHomepage />;
      case "CLIENT":
        return <ClientHomepage />;
      default:
        return <DefaultHomepage />;
    }
  }

  // Show default homepage for non-logged-in users
  return <DefaultHomepage />;
}
