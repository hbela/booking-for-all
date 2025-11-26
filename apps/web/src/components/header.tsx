import { Link } from "@tanstack/react-router";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";
import { LanguageSwitcher } from "./language-switcher";
import { authClient } from "@/lib/auth-client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export default function Header() {
  const { t } = useTranslation();
  const [userRole, setUserRole] = useState<
    "ADMIN" | "OWNER" | "PROVIDER" | null
  >(null);
  const [apiConnected, setApiConnected] = useState(false);
  const { data: session } = authClient.useSession();

  useEffect(() => {
    // Check API connection
    fetch(`${import.meta.env.VITE_SERVER_URL}/health`)
      .then((res) => res.json())
      .then(() => setApiConnected(true))
      .catch(() => setApiConnected(false));
  }, []);

  useEffect(() => {
    if (session?.user) {
      // @ts-ignore - role is UserRole enum
      const role = session.user.role;

      // Role is directly available from user object - no API calls needed!
      if (role === "ADMIN") {
        setUserRole("ADMIN");
      } else if (role === "PROVIDER") {
        setUserRole("PROVIDER");
      } else if (role === "OWNER") {
        setUserRole("OWNER");
      } else {
        setUserRole(null); // CLIENT or no role
      }
    } else {
      setUserRole(null);
    }
  }, [session]);

  // Determine navigation links based on user role
  const getLinks = () => {
    const baseLinks = [{ to: "/", label: t("navigation.home") }];

    // Add Book Appointment and Bookings links for authenticated users, but NOT for owners, admins, or providers
    // Owners manage the organization and don't need to book appointments
    // Admins have administrative duties and don't book appointments
    // Providers manage their own calendar and appointments - they don't book as clients
    if (session?.user && userRole !== "OWNER" && userRole !== "ADMIN" && userRole !== "PROVIDER") {
      baseLinks.push({ to: "/client/", label: t("navigation.bookAppointment") });
      baseLinks.push({ to: "/client/bookings", label: t("navigation.bookings") });
    }

    if (userRole === "ADMIN") {
      return [...baseLinks, { to: "/admin/", label: t("navigation.admin") }];
    } else if (userRole === "OWNER") {
      return [
        ...baseLinks,
        { to: "/owner/", label: t("navigation.dashboard") },
        { to: "/owner/departments", label: t("navigation.departments") },
        { to: "/owner/providers", label: t("navigation.providers") },
      ];
    } else if (userRole === "PROVIDER") {
      return [
        ...baseLinks,
        { to: "/provider/", label: t("navigation.dashboard") },
        { to: "/provider/calendar", label: t("navigation.myCalendar") },
      ];
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
                className={isAdminLink ? "text-orange-500 font-semibold" : ""}
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
