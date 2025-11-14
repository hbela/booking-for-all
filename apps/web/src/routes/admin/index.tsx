import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  component: AdminComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
      });
    }

    // Check if user has ADMIN role
    // @ts-ignore - role is UserRole enum
    if (session.data.user.role !== "ADMIN") {
      throw redirect({
        to: "/owner",
      });
    }

    return { session };
  },
});

function AdminComponent() {
  const { session } = Route.useRouteContext();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [newOrg, setNewOrg] = useState({
    name: "",
    slug: "",
    logo: "",
    ownerName: "",
    ownerEmail: "",
  });

  // Load organizations
  const loadOrganizations = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/admin/organizations`,
        {
          credentials: "include",
        }
      );
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data);
      } else {
        toast.error("Failed to load organizations");
      }
    } catch (err) {
      toast.error("Error loading organizations");
    } finally {
      setLoading(false);
    }
  };

  // Create organization
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !newOrg.name ||
      !newOrg.slug ||
      !newOrg.ownerName ||
      !newOrg.ownerEmail
    ) {
      toast.error("Name, slug, owner name, and owner email are required");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/admin/organizations/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            name: newOrg.name,
            slug: newOrg.slug,
            logo: newOrg.logo || undefined,
            ownerName: newOrg.ownerName,
            ownerEmail: newOrg.ownerEmail,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || "Organization created successfully");
        setNewOrg({
          name: "",
          slug: "",
          logo: "",
          ownerName: "",
          ownerEmail: "",
        });
        loadOrganizations();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create organization");
      }
    } catch (err) {
      toast.error("Error creating organization");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Delete organization
  const handleDeleteOrg = async (orgId: string) => {
    if (!confirm("Are you sure you want to delete this organization?")) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/admin/organizations/${orgId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
        toast.success("Organization deleted successfully");
        loadOrganizations();
      } else {
        toast.error("Failed to delete organization");
      }
    } catch (err) {
      toast.error("Error deleting organization");
    } finally {
      setLoading(false);
    }
  };

  // Create checkout and redirect to Polar
  const handleSubscribe = async (orgId: string, orgName: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/subscriptions/create-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ organizationId: orgId }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success(`Redirecting to checkout for ${orgName}...`);

        // Redirect to Polar checkout
        window.location.href = data.checkoutUrl;
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create checkout");
      }
    } catch (err) {
      toast.error("Error creating checkout");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome, {session.data?.user.name} (System Administrator)
        </p>
        <div className="mt-4">
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/admin/api-keys")}
            className="mr-2"
          >
            Manage API Keys
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Create Organization */}
        <Card>
          <CardHeader>
            <CardTitle>Create Organization</CardTitle>
            <CardDescription>
              Add a new organization to the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  placeholder="Acme Corp"
                  value={newOrg.name}
                  onChange={(e) =>
                    setNewOrg({ ...newOrg, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-slug">Slug (URL-friendly)</Label>
                <Input
                  id="org-slug"
                  placeholder="acme-corp"
                  value={newOrg.slug}
                  onChange={(e) =>
                    setNewOrg({ ...newOrg, slug: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-owner-name">Owner Name</Label>
                <Input
                  id="org-owner-name"
                  placeholder="John Smith"
                  value={newOrg.ownerName}
                  onChange={(e) =>
                    setNewOrg({ ...newOrg, ownerName: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-owner-email">Owner Email</Label>
                <Input
                  id="org-owner-email"
                  type="email"
                  placeholder="owner@example.com"
                  value={newOrg.ownerEmail}
                  onChange={(e) =>
                    setNewOrg({ ...newOrg, ownerEmail: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-logo">Logo URL (optional)</Label>
                <Input
                  id="org-logo"
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={newOrg.logo}
                  onChange={(e) =>
                    setNewOrg({ ...newOrg, logo: e.target.value })
                  }
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Creating..." : "Create Organization"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Organizations List */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>All Organizations</CardTitle>
          <CardDescription>
            Manage all organizations in the system
          </CardDescription>
          <Button
            onClick={loadOrganizations}
            disabled={loading}
            className="mt-2"
          >
            {loading ? "Loading..." : "Load Organizations"}
          </Button>
        </CardHeader>
        <CardContent>
          {organizations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No organizations loaded. Click "Load Organizations" to fetch.
            </p>
          ) : (
            <div className="space-y-4">
              {organizations.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    {org.logo && (
                      <img
                        src={org.logo}
                        alt={org.name}
                        className="h-10 w-10 rounded"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{org.name}</h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            org.enabled
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          }`}
                        >
                          {org.enabled ? "Active" : "Pending"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Slug: {org.slug}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ID: {org.id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Members: {org.members?.length || 0}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!org.enabled && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleSubscribe(org.id, org.name)}
                        disabled={loading}
                      >
                        Subscribe
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteOrg(org.id)}
                      disabled={loading}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
