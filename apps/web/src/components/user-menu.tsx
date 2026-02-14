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
  const { data: session, isPending, refetch } = authClient.useSession();
  const [forceRefresh, setForceRefresh] = useState(0);

  // Listen for custom auth session change events (triggered after sign-in)
  useEffect(() => {
    const handleAuthChange = () => {
      // Refetch session when auth:session-changed event is fired (after sign-in)
      console.log("🔄 UserMenu: Auth session changed event received, refetching session");
      if (refetch) {
        refetch();
      } else {
        // If refetch is not available, force a re-render by updating state
        setForceRefresh(prev => prev + 1);
      }
    };

    window.addEventListener('auth:session-changed', handleAuthChange);

    return () => {
      window.removeEventListener('auth:session-changed', handleAuthChange);
    };
  }, [refetch]);

  // Debug logging
  useEffect(() => {
    console.log("👤 UserMenu - Session state:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      isPending,
      userEmail: session?.user?.email,
      userName: session?.user?.name,
      isSystemAdmin: (session?.user as any)?.isSystemAdmin,
      forceRefresh,
    });
  }, [session, isPending, forceRefresh]);

  if (isPending) {
    return <Skeleton className="h-9 w-24" />;
  }

  if (!session || !session.user) {
    console.log("👤 UserMenu - No session, showing Sign In button");
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
          {(session.user as any)?.isSystemAdmin && (
            <span className="text-xs text-muted-foreground">
              System Administrator
            </span>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => {
              // Capture sessionStorage before signOut clears them
              const orgSlug = sessionStorage.getItem("sourceOrganization");
              const externalAppOrigin =
                sessionStorage.getItem("externalAppOrigin");

              console.log(
                "🔓 Sign out - Org:",
                orgSlug,
                "Origin:",
                externalAppOrigin
              );

              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    // If there's an organization slug, redirect to org-specific page
                    if (orgSlug) {
                      const env =
                        import.meta.env.MODE === "production"
                          ? "production"
                          : "development";
                      const normalizedSlug = orgSlug.toLowerCase();
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

                      if (externalAppOrigin) {
                        const baseUrl = externalAppOrigin.replace(/\/$/, "");
                        const redirectUrl =
                          env === "production"
                            ? `${baseUrl}/${orgSlug}_external.html`
                            : `${baseUrl}/${orgSlug}/${orgSlug}_external.html`;
                        console.log(
                          "🔓 Organization user sign out - redirecting via stored origin:",
                          redirectUrl
                        );
                        window.location.href = redirectUrl;
                        return;
                      }
                    }

                    // Default: redirect to login
                    console.log(
                      "🔓 Sign out - redirecting to /login"
                    );
                    navigate({ to: "/login" });
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
