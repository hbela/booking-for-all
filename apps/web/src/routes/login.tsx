import { createFileRoute, redirect, isRedirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { apiFetch } from "@/lib/apiFetch";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    org: (search.org as string) || undefined,
  }),
  beforeLoad: async ({ search }) => {
    const session = await authClient.getSession();

    // Not authenticated — send back to connect or home
    if (!session.data) {
      throw redirect({ to: "/" });
    }

    const user = session.data.user as any;

    // System admin → admin panel
    if (user.isSystemAdmin) {
      throw redirect({ to: "/admin" });
    }

    const apiBase = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

    // Resolve orgId: prefer URL param, fall back to sessionStorage set by /connect page.
    // Better Auth may strip query params from callbackURL during OAuth redirect,
    // so sessionStorage is the reliable source.
    const orgId = search.org
      || (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("externalAppOrgId") : null)
      || undefined;

    // Ensure the member record exists for this org before checking memberships.
    if (orgId) {
      try {
        await apiFetch(`${apiBase}/api/members/${orgId}/ensure`, {
          method: "POST",
        });
      } catch {
        // Non-fatal — proceed and let memberships check handle it
      }
    }

    // Determine role from Member records (org-scoped) or User.role (global)
    try {
      const memberships = await apiFetch<any[]>(
        `${apiBase}/api/members/my-organizations`
      );

      const hasOwner = memberships.some((m: any) => m.role === "OWNER");
      const hasProvider = memberships.some((m: any) => m.role === "PROVIDER");
      const hasClient = memberships.some((m: any) => m.role === "CLIENT");

      if (hasOwner) {
        throw redirect({ to: "/owner/" });
      }
      if (hasProvider) {
        throw redirect({ to: "/provider/" });
      }
      if (hasClient) {
        throw redirect({ to: "/client/" });
      }
    } catch (error) {
      // Re-throw TanStack Router redirects
      if (isRedirect(error)) {
        throw error;
      }
      // Fall through to role-based fallback on API error
    }

    // Fallback: use global User.role
    if (user.role === "OWNER") {
      throw redirect({ to: "/owner/" });
    }
    if (user.role === "PROVIDER") {
      throw redirect({ to: "/provider/" });
    }

    // CLIENT or unknown → client dashboard
    throw redirect({ to: "/client/" });
  },
  component: () => null,
});
