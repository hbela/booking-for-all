import { authClient } from "@/lib/auth-client";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/login")({
  component: AdminLoginComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    // Already authenticated as admin → go straight to panel
    if (session.data?.user && (session.data.user as any).isSystemAdmin) {
      throw redirect({ to: "/admin" });
    }
  },
});

function AdminLoginComponent() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        toast.error(result.error.message || "Invalid credentials.");
        return;
      }
      // Verify the signed-in user is actually the system admin
      const session = await authClient.getSession();
      if (!(session.data?.user as any)?.isSystemAdmin) {
        await authClient.signOut();
        toast.error("Access denied. Admin only.");
        return;
      }
      navigate({ to: "/admin" });
    } catch {
      toast.error("Sign-in failed. Check your credentials.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm p-8 border rounded-xl shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-bold">Admin Login</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
