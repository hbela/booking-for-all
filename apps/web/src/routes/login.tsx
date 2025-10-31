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
    const error = urlParams.get("error");

    if (referrer && referrer !== window.location.origin) {
      sessionStorage.setItem("externalAppReferrer", referrer);
    }

    if (orgId) {
      sessionStorage.setItem("externalAppOrgId", orgId);
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
