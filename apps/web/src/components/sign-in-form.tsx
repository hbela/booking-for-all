import { authClient } from "@/lib/auth-client";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import Loader from "./loader";
import { Button } from "./ui/button";

export default function SignInForm({
  onSwitchToSignUp,
}: {
  onSwitchToSignUp: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate({
    from: "/",
  });
  const { isPending } = authClient.useSession();

  const handleGoogleSignIn = async () => {
    // Extract organization ID from URL params or sessionStorage
    const urlParams = new URLSearchParams(window.location.search);
    const urlOrgId = urlParams.get("org");
    const externalAppOrgId = sessionStorage.getItem("externalAppOrgId");
    const orgId = urlOrgId || externalAppOrgId;

    // Note: orgId is optional - admins can sign in without organization context

    try {
      // Build callbackURL - include org param only if available
      const callbackURL = orgId
        ? `http://localhost:3001/login?org=${orgId}`
        : `http://localhost:3001/login`;

      // Use Better Auth's signIn.social with additionalData to pass orgId
      // callbackURL ensures user is redirected to frontend after OAuth
      // Validation will happen in afterSignIn hook
      await authClient.signIn.social({
        provider: "google",
        callbackURL,
        ...(orgId && {
          additionalData: {
            organizationId: orgId,
          },
        }),
      });
    } catch (error) {
      console.error("Google sign-in error:", error);
      toast.error(
        t("auth.signInFailed") || "Failed to sign in with Google"
      );
    }
  };

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="mx-auto w-full mt-10 max-w-md p-6">
      <h1 className="mb-6 text-center text-3xl font-bold">
        {t("auth.welcomeBack")}
      </h1>

      {/* Google Sign-In Button */}
      <div className="mt-6">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignIn}
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Sign in with Google
        </Button>
      </div>

      <div className="mt-4 text-center">
        <Button
          variant="link"
          onClick={onSwitchToSignUp}
          className="text-indigo-600 hover:text-indigo-800"
        >
          {t("auth.needAnAccount")}
        </Button>
      </div>
    </div>
  );
}
