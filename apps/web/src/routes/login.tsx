import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useMemberRole } from "@/hooks/useMemberRole";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
  beforeLoad: async () => {
    // Check if user is already authenticated
    // Add a small delay to ensure cookies are available after page reload
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    try {
      const session = await authClient.getSession();
      const isSystemAdmin = (session.data?.user as any)?.isSystemAdmin;
      
      console.log("🔐 Login route beforeLoad - Session check:", {
        hasSession: !!session.data,
        hasUser: !!session.data?.user,
        userId: session.data?.user?.id,
        isSystemAdmin,
      });
      
      if (session.data?.user) {
        // System admin redirects to admin panel
        if (isSystemAdmin) {
          console.log("🔐 System admin authenticated, redirecting to /admin");
          throw redirect({ to: "/admin" });
        }
        
        // Check for organization context in URL or sessionStorage
        const urlParams = new URLSearchParams(window.location.search);
        const orgId = urlParams.get("org") || (typeof window !== "undefined" ? sessionStorage.getItem("externalAppOrgId") : null);
        
        // If there's an orgId, we'll let the component handle fetching the member role
        // and redirecting appropriately. Otherwise, redirect to home to choose organization.
        if (!orgId) {
          console.log("🔐 User authenticated but no org context, redirecting to home");
          throw redirect({ to: "/" });
        }
        
        // If there's an orgId, let the component handle the redirect based on member role
        console.log("🔐 User authenticated with org context, component will handle redirect");
      }
    } catch (error) {
      // If it's a redirect, re-throw it
      if (error && typeof error === 'object' && 'to' in error) {
        throw error;
      }
      // Otherwise, log the error but don't block
      console.warn("🔐 Error checking session in login beforeLoad:", error);
    }
  },
  head: () => ({
    meta: [
      {
        title: "Login - Booking for All",
      },
      {
        name: "description",
        content: "Sign in to manage your appointments and bookings",
      },
      {
        property: "og:title",
        content: "Login - Booking for All",
      },
      {
        property: "og:description",
        content: "Sign in to manage your appointments and bookings",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:url",
        content: "/login",
      },
      {
        name: "twitter:card",
        content: "summary",
      },
      {
        name: "twitter:title",
        content: "Login - Booking for All",
      },
      {
        name: "twitter:description",
        content: "Sign in to manage your appointments and bookings",
      },
    ],
    links: [
      {
        rel: "canonical",
        href: "/login",
      },
    ],
  }),
});

function RouteComponent() {
  const [showSignIn, setShowSignIn] = useState(true);
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();
  
  // Get org context from URL
  const urlParams = new URLSearchParams(window.location.search);
  const orgId = urlParams.get("org") || sessionStorage.getItem("externalAppOrgId");
  
  // Fetch member role if there's an orgId
  const { member, isLoading: isLoadingMember } = useMemberRole({ 
    organizationId: orgId || undefined,
    enabled: !!session?.user && !!orgId
  });

  // Debug logging
  useEffect(() => {
    console.log("🔐 Login route component mounted");
    console.log("   showSignIn:", showSignIn);
    console.log("   current URL:", window.location.href);
    console.log("   pathname:", window.location.pathname);
    console.log("   session:", session ? "✅ Has session" : "❌ No session");
    console.log("   isPending:", isPending);
    console.log("   orgId:", orgId);
    console.log("   member:", member);
  }, [showSignIn, session, isPending, orgId, member]);

  // Handle OAuth callback - trigger session refresh if oauth=success is in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccess = urlParams.get("oauth");
    
    if (oauthSuccess === "success") {
      console.log("🔐 OAuth success detected, triggering session refresh");
      // Trigger session refresh event
      window.dispatchEvent(new CustomEvent('auth:session-changed'));
      // Clean up URL parameter
      urlParams.delete("oauth");
      const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '');
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // Redirect if user becomes authenticated (handles case where session loads after component mount)
  useEffect(() => {
    if (!isPending && session?.user && !isLoadingMember) {
      const isSystemAdmin = (session.user as any)?.isSystemAdmin;
      
      // System admin redirects to admin panel
      if (isSystemAdmin) {
        console.log("🔐 System admin detected, redirecting to /admin");
        navigate({ to: "/admin" });
        return;
      }
      
      // If there's an orgId and we have the member role, redirect based on role
      if (orgId && member) {
        let redirectPath = "/";
        
        if (member.role === "OWNER") {
          redirectPath = "/owner/";
        } else if (member.role === "PROVIDER") {
          redirectPath = "/provider/";
        } else if (member.role === "CLIENT") {
          redirectPath = orgId ? `/client/organizations/${orgId}` : "/client/";
        }
        
        console.log("🔐 Session detected with org context, redirecting to:", redirectPath);
        navigate({ to: redirectPath as any });
        return;
      }
      
      // If no orgId, redirect to home to choose organization
      if (!orgId) {
        console.log("🔐 Session detected without org context, redirecting to home");
        navigate({ to: "/" });
      }
    }
  }, [session, isPending, member, isLoadingMember, orgId, navigate]);

  // Store external app referrer and organization context for sign-out redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const referrer = urlParams.get("referrer") || document.referrer;
    const orgId = urlParams.get("org");
    const orgSlug = urlParams.get("orgSlug");
    const externalOrigin = urlParams.get("externalOrigin");
    const error = urlParams.get("error");

    if (referrer && referrer !== window.location.origin) {
      sessionStorage.setItem("externalAppReferrer", referrer);
    }

    if (orgId) {
      sessionStorage.setItem("externalAppOrgId", orgId);
    }

    // Store organization slug and origin from URL parameters
    // This is necessary because sessionStorage is origin-specific
    // and doesn't persist across different origins (e.g., 127.0.0.1:5500 -> localhost:3001)
    if (orgSlug) {
      sessionStorage.setItem("sourceOrganization", orgSlug);
      console.log("✅ Stored sourceOrganization from URL:", orgSlug);
    }

    if (externalOrigin) {
      sessionStorage.setItem("externalAppOrigin", externalOrigin);
      console.log("✅ Stored externalAppOrigin from URL:", externalOrigin);
    }

    // Show error message if redirected due to access denial
    if (error) {
      const errorMessage = decodeURIComponent(error);
      toast.error(errorMessage, {
        duration: 5000,
      });
    }
  }, []);

  return showSignIn ? (
    <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
  ) : (
    <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
  );
}
