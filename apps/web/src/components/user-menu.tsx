import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  PROVIDER: "Provider",
  CLIENT: "Client",
};

export default function UserMenu() {
  const { data: session, isPending, refetch } = authClient.useSession();
  const [forceRefresh, setForceRefresh] = useState(0);
  const isSystemAdmin = !!(session?.user as any)?.isSystemAdmin;

  const { data: memberships = [] } = useQuery<any[]>({
    queryKey: ["members", "my-organizations"],
    queryFn: () =>
      apiFetch<any[]>(
        `${import.meta.env.VITE_SERVER_URL}/api/members/my-organizations`
      ),
    enabled: !!session?.user && !isSystemAdmin,
    staleTime: 5 * 60 * 1000,
  });

  const distinctRoles = [...new Set(memberships.map((m: any) => m.role as string))];

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
    return null;
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
          {isSystemAdmin ? (
            <span className="text-xs text-muted-foreground">
              System Administrator
            </span>
          ) : (
            distinctRoles.map((role) => (
              <span key={role} className="text-xs text-muted-foreground">
                {ROLE_LABELS[role] ?? role}
              </span>
            ))
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => {
              const orgSlug = sessionStorage.getItem("sourceOrganization");
              const connectReturnUrl = sessionStorage.getItem("connectReturnUrl");
              const externalAppOrigin = sessionStorage.getItem("externalAppOrigin");

              console.log("🔓 Sign out - Org:", orgSlug, "ConnectReturnUrl:", connectReturnUrl, "Origin:", externalAppOrigin);

              if (connectReturnUrl) {
                // Owner came from connect page: redirect back to it
                sessionStorage.clear();
                authClient.signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      window.location.href = connectReturnUrl;
                    },
                    onError: () => {
                      window.location.href = connectReturnUrl;
                    },
                  },
                });
              } else if (orgSlug) {
                // Org user: sign out via JS and redirect back to org's local page
                const env = import.meta.env.MODE === "production" ? "production" : "development";
                const normalizedSlug = orgSlug.toLowerCase();
                const localPath =
                  env === "production"
                    ? `${normalizedSlug}_local.html`
                    : `${normalizedSlug}/${normalizedSlug}_local.html`;

                const envOrigins = {
                  development:
                    import.meta.env.VITE_EXTERNAL_DEV_ORIGIN ??
                    `http://${normalizedSlug}.hu`,
                  production:
                    import.meta.env.VITE_EXTERNAL_PROD_HOST_TEMPLATE?.replace(
                      "{slug}",
                      normalizedSlug
                    ) ?? `https://${normalizedSlug}.hu`,
                };
                const resolvedOrigin = envOrigins[env]?.replace(/\/$/, "");
                const orgRedirectUrl = resolvedOrigin
                  ? `${resolvedOrigin}/${localPath}`
                  : externalAppOrigin
                  ? `${externalAppOrigin.replace(/\/$/, "")}/${localPath}`
                  : null;

                sessionStorage.clear();
                authClient.signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      window.location.href = orgRedirectUrl ?? "/admin/login";
                    },
                    onError: () => {
                      // Even on error, leave the app
                      window.location.href = orgRedirectUrl ?? "/admin/login";
                    },
                  },
                });
              } else {
                // Admin / no-org user: sign out and redirect to /admin
                // (which will redirect to /login, then back to /admin after re-login)
                sessionStorage.clear();
                authClient.signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      window.location.href = "/admin/login";
                    },
                    onError: () => {
                      window.location.href = "/admin/login";
                    },
                  },
                });
              }
            }}
          >
            Sign Out
          </Button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
