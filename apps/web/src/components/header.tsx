import { Link } from "@tanstack/react-router";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";
import { LanguageSwitcher } from "./language-switcher";
import { authClient } from "@/lib/auth-client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMyOrganizations } from "@/hooks/useMemberRole";

export default function Header() {
  const { t } = useTranslation();
  const [apiConnected, setApiConnected] = useState(true); // Start optimistic
  const { data: session } = authClient.useSession();
  const isSystemAdmin = (session?.user as any)?.isSystemAdmin;

  useEffect(() => {
    // Check API connection periodically
    const checkConnection = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/health`, {
          credentials: 'include', // Include cookies for CORS
          cache: 'no-cache', // Don't cache health checks
        });
        if (response.ok) {
          setApiConnected(true);
        } else {
          setApiConnected(false);
        }
      } catch (error) {
        setApiConnected(false);
      }
    };

    // Check immediately
    checkConnection();

    // Then check every 30 seconds
    const interval = setInterval(checkConnection, 30000);

    return () => clearInterval(interval);
  }, []);

  // Determine navigation links - simplified for global header
  // Organization-specific navigation should be handled within routes
  const { data: organizations } = useMyOrganizations();

  const getLinks = () => {
    const isClient = organizations?.some(org => org.role === 'CLIENT');
    const isProvider = organizations?.some(org => org.role === 'PROVIDER');
    const isOwner = organizations?.some(org => org.role === 'OWNER');

    const baseLinks = [];

    // Home link depends on user role
    if (isOwner) {
      baseLinks.push({ to: "/owner/", label: t("navigation.home") || "Dashboard" });
    } else if (isProvider) {
      baseLinks.push({ to: "/provider/", label: t("navigation.home") });
    } else if (isClient) {
      baseLinks.push({ to: "/client", label: t("navigation.home") });
    } else {
      baseLinks.push({ to: "/", label: t("navigation.home") });
    }

    if (isClient && !isProvider) {
      baseLinks.push({ to: "/client/about", label: t("navigation.about") });
    }

    if (isProvider) {
      baseLinks.push({ to: "/provider/about", label: t("navigation.about") });
    }

    // Owner management links — shown whenever the user is an owner of any org.
    // The route pages handle the case where orgs have no departments/providers yet.
    if (isOwner) {
      baseLinks.push({ to: "/owner/departments", label: t("navigation.departments") });
      baseLinks.push({ to: "/owner/providers", label: t("navigation.providers") });
    }

    // System admins get access to admin panel
    if (isSystemAdmin) {
      baseLinks.push({ to: "/admin/", label: t("navigation.admin") });
    }

    return baseLinks;
  };

  const links = getLinks();

  return (
    <div>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        <nav className="flex gap-4 text-lg">
          {links.map(({ to, label }) => {
            const isAdminLink = to === "/admin/" || to === "/admin";
            return (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: true }}
                activeProps={{ className: isAdminLink ? "text-orange-500 font-semibold underline" : "font-semibold underline" }}
                inactiveProps={{ className: isAdminLink ? "text-orange-500 font-semibold" : "" }}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          {/* API Status Indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 text-xs">
            <div
              className={`w-2 h-2 rounded-full ${
                apiConnected ? "bg-green-500" : "bg-red-500"
              }`}
              title={apiConnected ? t("api.connected") : t("api.disconnected")}
            />
            <span className="text-muted-foreground">
              {apiConnected ? t("api.api") : t("api.offline")}
            </span>
          </div>
          <LanguageSwitcher />
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
      <hr />
    </div>
  );
}
