import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export default function UserMenu() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [userRole, setUserRole] = useState<string>("USER");

  // Determine user role - directly from user object
  useEffect(() => {
    if (session?.user) {
      // @ts-ignore - role is UserRole enum
      const role = session.user.role || "CLIENT";

      // Role is directly available - no API calls needed!
      setUserRole(role);

      console.log("👤 Logged in user:", {
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        needsPasswordChange: (session.user as any).needsPasswordChange,
      });
    }
  }, [session]);

  if (isPending) {
    return <Skeleton className="h-9 w-24" />;
  }

  if (!session) {
    return (
      <Button variant="outline" asChild>
        <Link to="/login">Sign In</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">{session.user.name}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="flex flex-col items-start">
          <span className="font-medium">{session.user.email}</span>
          <span className="text-xs text-muted-foreground">
            Role: {userRole}
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => {
              // Capture role and sessionStorage before signOut clears them
              const currentRole = userRole;
              const orgSlug = sessionStorage.getItem("sourceOrganization");
              const externalAppOrigin =
                sessionStorage.getItem("externalAppOrigin");

              console.log(
                "🔓 Sign out - Role:",
                currentRole,
                "Org:",
                orgSlug,
                "Origin:",
                externalAppOrigin
              );

              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    // Admins redirect to login page
                    if (currentRole === "ADMIN") {
                      console.log("🔓 Admin sign out - redirecting to /login");
                      navigate({ to: "/login" });
                      return;
                    }

                    const normalizedRole = currentRole?.toUpperCase();
                    const requiresExternalRedirect =
                      normalizedRole === "OWNER" ||
                      normalizedRole === "PROVIDER" ||
                      normalizedRole === "CLIENT";

                    if (orgSlug && requiresExternalRedirect) {
                      const env =
                        import.meta.env.MODE === "production"
                          ? "production"
                          : "development";
                      const normalizedSlug = orgSlug.toLowerCase();
                      // In production, files are at root: /{slug}_external.html
                      // In development, files may be in subfolders: /{slug}/{slug}_external.html
                      const externalPath =
                        env === "production"
                          ? `${normalizedSlug}_external.html`
                          : `${normalizedSlug}/${normalizedSlug}_external.html`;

                      const envOrigins = {
                        development:
                          import.meta.env.VITE_EXTERNAL_DEV_ORIGIN ??
                          "http://127.0.0.1:5500",
                        production:
                          import.meta.env.VITE_EXTERNAL_PROD_HOST_TEMPLATE?.replace(
                            "{slug}",
                            normalizedSlug
                          ) ?? `https://${normalizedSlug}.appointer.hu`,
                      };

                      const resolvedOrigin = envOrigins[env]?.replace(
                        /\/$/,
                        ""
                      );

                      if (resolvedOrigin) {
                        const resolvedUrl = `${resolvedOrigin}/${externalPath}`;
                        console.log(
                          "🔓 Organization user sign out - redirecting to slug-based URL:",
                          resolvedUrl
                        );
                        window.location.href = resolvedUrl;
                        return;
                      }
                    }

                    if (orgSlug && externalAppOrigin) {
                      // Redirect to the organization's external HTML page using the stored origin
                      // In production, files are at root: /{slug}_external.html (e.g., /wellness_external.html)
                      // In development, files may be in subfolders: /{slug}/{slug}_external.html
                      const env =
                        import.meta.env.MODE === "production"
                          ? "production"
                          : "development";
                      const baseUrl = externalAppOrigin.replace(/\/$/, ""); // Remove trailing slash if present
                      const redirectUrl =
                        env === "production"
                          ? `${baseUrl}/${orgSlug}_external.html`
                          : `${baseUrl}/${orgSlug}/${orgSlug}_external.html`;
                      console.log(
                        "🔓 Organization user sign out - redirecting via stored origin:",
                        redirectUrl
                      );
                      window.location.href = redirectUrl;
                    } else {
                      // No organization context, redirect to login
                      console.log(
                        "🔓 No organization context - redirecting to /login"
                      );
                      navigate({ to: "/login" });
                    }
                  },
                },
              });
            }}
          >
            Sign Out
          </Button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
