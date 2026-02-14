import { createFileRoute, Link } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { useEffect } from "react";
import { DefaultHomepage } from "@/components/homepages/DefaultHomepage";
import { AdminHomepage } from "@/components/homepages/AdminHomepage";
import { useMyOrganizations } from "@/hooks/useMemberRole";
import { Button } from "@/components/ui/button";

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
  const { data: session, isPending, error } = authClient.useSession();
  const { data: organizations, isLoading: isLoadingOrgs } = useMyOrganizations();
  const isSystemAdmin = (session?.user as any)?.isSystemAdmin;

  // Debug logging
  useEffect(() => {
    console.log("🏠 HomeComponent mounted");
    console.log("   isPending:", isPending);
    console.log("   session:", session ? "✅ Has session" : "❌ No session");
    console.log("   isSystemAdmin:", isSystemAdmin);
    console.log("   error:", error);
  }, [isPending, session, error, isSystemAdmin]);

  // Show loading state while checking session
  if (isPending) {
    console.log("⏳ HomeComponent: Waiting for session check...");
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }
  
  if (error) {
    console.error("❌ HomeComponent: Session error:", error);
  }

  // If user is logged in
  if (session?.user) {
    // System admins get admin homepage
    if (isSystemAdmin) {
      return <AdminHomepage />;
    }

    // Other users get to choose their organization
    if (isLoadingOrgs) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">Loading organizations...</div>
        </div>
      );
    }

    // Show organization selector
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">My Organizations</h1>
        
        {!organizations || organizations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              You are not a member of any organization yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Contact your organization administrator for an invitation.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {organizations.map((membership) => (
              <div
                key={membership.id}
                className="border rounded-lg p-6 hover:border-primary transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold mb-2">
                      {membership.organization.name}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Role: <span className="font-medium">{membership.role}</span>
                    </p>
                    {membership.organization.domain && (
                      <p className="text-xs text-muted-foreground">
                        Domain: {membership.organization.domain}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {membership.role === 'OWNER' && (
                      <Button asChild>
                        <Link to="/owner/">Go to Dashboard</Link>
                      </Button>
                    )}
                    {membership.role === 'PROVIDER' && (
                      <Button asChild>
                        <Link to="/provider/">Go to Dashboard</Link>
                      </Button>
                    )}
                    {membership.role === 'CLIENT' && (
                      <Button asChild>
                        <Link to="/client/">Book Appointment</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Show default homepage for non-logged-in users
  return <DefaultHomepage />;
}
