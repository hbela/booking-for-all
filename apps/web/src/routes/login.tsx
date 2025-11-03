import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
});

function RouteComponent() {
  const [showSignIn, setShowSignIn] = useState(true);

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
