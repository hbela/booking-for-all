import { authClient } from "@/lib/auth-client";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useState } from "react";
import Loader from "./loader";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export default function SignInForm({
  onSwitchToSignUp,
}: {
  onSwitchToSignUp: () => void;
}) {
  const navigate = useNavigate({
    from: "/",
  });
  const { isPending } = authClient.useSession();
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [showPasswordChangeDialog, setShowPasswordChangeDialog] =
    useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [pendingRedirectRole, setPendingRedirectRole] = useState<string | null>(
    null
  );

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
        },
        {
          onSuccess: async (context) => {
            // Wait for session to be set
            await new Promise((resolve) => setTimeout(resolve, 100));
            const session = await authClient.getSession();
            
            // @ts-ignore - role is UserRole enum
            const role = session.data?.user?.role;
            
            // Check if user is OWNER, PROVIDER, or CLIENT without organization context
            if (role === "OWNER" || role === "PROVIDER" || role === "CLIENT") {
              const externalAppOrgId = sessionStorage.getItem("externalAppOrgId");
              
              if (!externalAppOrgId) {
                // User is trying to sign in directly without organization context
                toast.error("Access Denied: This account must be accessed through your organization's website.");
                // Sign them out immediately
                await authClient.signOut();
                // Redirect to external app
                setTimeout(() => {
                  window.location.href = "http://localhost:8000/wellness_external.html";
                }, 2000);
                return;
              }
            }
            
            toast.success("Sign in successful");

            // Debug: Log the full context to see what we're getting
            console.log("🔍 Sign-in context:", context);
            console.log("🔍 User data from sign-in:", context.data?.user);
            console.log("🔍 Session data:", session);
            console.log("🔍 Session user:", session.data?.user);

            // @ts-ignore - needsPasswordChange is custom field
            const needsPasswordChange = session.data?.user?.needsPasswordChange;

            console.log("🔍 User role from session:", role);
            console.log(
              "🔍 Needs password change from session:",
              needsPasswordChange
            );

            // Check if user needs to change password
            if (needsPasswordChange) {
              console.log("✅ Password change required - showing dialog");
              setPendingRedirectRole(role || "CLIENT");
              setShowPasswordChangeDialog(true);
              return; // Don't redirect yet
            }

            // Redirect based on role - each role has its own dashboard
            console.log("🚀 Redirecting based on role:", role);
            if (role === "ADMIN") {
              navigate({ to: "/admin" });
            } else if (role === "OWNER") {
              navigate({ to: "/owner" });
            } else if (role === "PROVIDER") {
              navigate({ to: "/provider" });
            } else {
              // CLIENT or default
              console.log("⚠️ Defaulting to CLIENT dashboard");
              navigate({ to: "/client" });
            }
          },
          onError: (error) => {
            const errorMessage =
              (error as any)?.error?.message || "Sign in failed";
            toast.error(errorMessage);
            console.error("Sign in error:", error);
          },
        }
      );
    },
  });

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail) {
      toast.error("Please enter your email address");
      return;
    }

    setIsSendingReset(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: forgotPasswordEmail }),
        }
      );

      if (response.ok) {
        toast.success("Password reset email sent! Check your inbox.");
        setShowForgotPassword(false);
        setForgotPasswordEmail("");
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to send reset email");
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      toast.error("Failed to send reset email");
    } finally {
      setIsSendingReset(false);
    }
  };

  const handlePasswordChange = async () => {
    // Validate passwords
    if (!newPassword || newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/auth/update-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ newPassword }),
        }
      );

      if (response.ok) {
        toast.success("Password updated successfully!");
        setShowPasswordChangeDialog(false);
        setNewPassword("");
        setConfirmPassword("");

        // Now redirect to the appropriate dashboard
        if (pendingRedirectRole === "ADMIN") {
          navigate({ to: "/admin" });
        } else if (pendingRedirectRole === "OWNER") {
          navigate({ to: "/owner" });
        } else if (pendingRedirectRole === "PROVIDER") {
          navigate({ to: "/provider" });
        } else {
          // CLIENT or default
          navigate({ to: "/client" });
        }
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update password");
      }
    } catch (error) {
      console.error("Password update error:", error);
      toast.error("Failed to update password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="mx-auto w-full mt-10 max-w-md p-6">
      <h1 className="mb-6 text-center text-3xl font-bold">Welcome Back</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <div>
          <form.Field name="email">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Email</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.map((error, index) => (
                  <p key={index} className="text-red-500 text-sm">
                    {String(error)}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <div>
          <form.Field name="password">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Password</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.map((error, index) => (
                  <p key={index} className="text-red-500 text-sm">
                    {String(error)}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <form.Subscribe>
          {(state) => (
            <Button
              type="submit"
              className="w-full"
              disabled={!state.canSubmit || state.isSubmitting}
            >
              {state.isSubmitting ? "Submitting..." : "Sign In"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      {/* Forgot Password Section */}
      {showForgotPassword ? (
        <div className="mt-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="text-lg font-semibold mb-3">Reset Password</h3>
          <p className="text-sm text-gray-600 mb-4">
            Enter your email address and we'll send you a link to reset your
            password.
          </p>
          <div className="space-y-3">
            <div>
              <Label htmlFor="reset-email">Email Address</Label>
              <Input
                id="reset-email"
                type="email"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                placeholder="Enter your email"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleForgotPassword}
                disabled={isSendingReset}
                className="flex-1"
              >
                {isSendingReset ? "Sending..." : "Send Reset Email"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotPasswordEmail("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 text-center">
          <Button
            variant="link"
            onClick={() => setShowForgotPassword(true)}
            className="text-indigo-600 hover:text-indigo-800"
          >
            Forgot your password?
          </Button>
        </div>
      )}

      <div className="mt-4 text-center">
        <Button
          variant="link"
          onClick={onSwitchToSignUp}
          className="text-indigo-600 hover:text-indigo-800"
        >
          Need an account? Sign Up
        </Button>
      </div>

      {/* Mandatory Password Change Dialog */}
      <Dialog open={showPasswordChangeDialog} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Change Your Password</DialogTitle>
            <DialogDescription>
              For security reasons, you must change your temporary password
              before continuing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                disabled={isChangingPassword}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                disabled={isChangingPassword}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handlePasswordChange}
              disabled={isChangingPassword || !newPassword || !confirmPassword}
              className="w-full"
            >
              {isChangingPassword ? "Updating..." : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
