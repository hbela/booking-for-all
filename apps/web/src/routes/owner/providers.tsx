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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/providers")({
  component: ProvidersComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
      });
    }

    // @ts-ignore - role is UserRole enum
    const role = session.data.user.role;

    // If user is ADMIN, redirect to admin dashboard
    if (role === "ADMIN") {
      throw redirect({
        to: "/admin/",
      });
    }

    // OWNER must have organization membership
    if (role === "OWNER") {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}/api/organizations/my-organizations`,
          {
            credentials: "include",
          }
        );
        
        if (response.ok) {
          const organizations = await response.json();
          if (!organizations || organizations.length === 0) {
            throw redirect({
              to: "/login",
            });
          }
        }
      } catch (error) {
        console.error("Error checking organization membership:", error);
      }
    }

    return { session };
  },
});

function ProvidersComponent() {
  const { session } = Route.useRouteContext();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [departments, setDepartments] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [newProvider, setNewProvider] = useState({
    name: "",
    email: "",
    departmentId: "",
  });

  // Load user's owned organizations
  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        const response = await fetch(
          `${
            import.meta.env.VITE_SERVER_URL
          }/api/organizations/my-organizations`,
          {
            credentials: "include",
          }
        );
        if (response.ok) {
          const data = await response.json();
          // User has OWNER role, filter only enabled organizations
          const ownedOrgs = data.filter((org: any) => org.enabled);
          setOrganizations(ownedOrgs);

          // Auto-select first organization
          if (ownedOrgs.length > 0) {
            setSelectedOrgId(ownedOrgs[0].id);
          }
        }
      } catch (err) {
        console.error("Error loading organizations:", err);
        toast.error("Error loading organizations");
      }
    };

    loadOrganizations();
  }, []);

  // Load departments and providers when organization is selected
  useEffect(() => {
    if (selectedOrgId) {
      loadDepartments();
      loadProviders();
    }
  }, [selectedOrgId]);

  const loadDepartments = async () => {
    if (!selectedOrgId) return;

    try {
      const response = await fetch(
        `${
          import.meta.env.VITE_SERVER_URL
        }/api/departments?organizationId=${selectedOrgId}`,
        {
          credentials: "include",
        }
      );
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
        // Auto-select first department if none selected
        if (data.length > 0 && !newProvider.departmentId) {
          setNewProvider((prev) => ({
            ...prev,
            departmentId: data[0].id,
          }));
        }
      }
    } catch (err) {
      console.error("Error loading departments:", err);
    }
  };

  const loadProviders = async () => {
    if (!selectedOrgId) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${
          import.meta.env.VITE_SERVER_URL
        }/api/providers?organizationId=${selectedOrgId}`,
        {
          credentials: "include",
        }
      );
      if (response.ok) {
        const data = await response.json();
        setProviders(data);
      } else {
        toast.error("Failed to load providers");
      }
    } catch (err) {
      console.error("Error loading providers:", err);
      toast.error("Error loading providers");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProvider.name || !newProvider.email || !newProvider.departmentId) {
      toast.error("Name, email, and department are required");
      return;
    }

    if (!selectedOrgId) {
      toast.error("Please select an organization");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/providers/create-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            name: newProvider.name,
            email: newProvider.email,
            organizationId: selectedOrgId,
            departmentId: newProvider.departmentId,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success(
          `Provider created! Temporary password: ${data.tempPassword}`,
          {
            duration: 10000,
            description:
              "The provider will need to change this password on first login.",
          }
        );
        setNewProvider({
          name: "",
          email: "",
          departmentId: newProvider.departmentId,
        });
        loadProviders();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create provider");
      }
    } catch (err) {
      toast.error("Error creating provider");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProvider = async (providerId: string) => {
    if (!confirm("Are you sure you want to delete this provider?")) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/providers/${providerId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
        toast.success("Provider deleted successfully");
        loadProviders();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete provider");
      }
    } catch (err) {
      toast.error("Error deleting provider");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getDepartmentName = (departmentId: string) => {
    const dept = departments.find((d) => d.id === departmentId);
    return dept?.name || "Unknown";
  };

  const selectedOrg = organizations.find((org) => org.id === selectedOrgId);

  // Group providers by department
  const providersByDepartment = departments.map((dept) => ({
    ...dept,
    providers: providers.filter((p) => p.departmentId === dept.id),
  }));

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Providers</h1>
        <p className="text-muted-foreground">
          Manage service providers for your organization
        </p>
      </div>

      {/* Organization Selector */}
      {organizations.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              You don't have any active organizations yet. Please activate your
              organization by completing the subscription.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {organizations.length > 1 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Select Organization</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {departments.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No departments available. Please create a department first in
                  the Departments section.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                {/* Create Provider */}
                <Card>
                  <CardHeader>
                    <CardTitle>Create Provider</CardTitle>
                    <CardDescription>
                      Add a new provider to {selectedOrg?.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateProvider} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="provider-name">Provider Name</Label>
                        <Input
                          id="provider-name"
                          placeholder="e.g., Dr. John Smith"
                          value={newProvider.name}
                          onChange={(e) =>
                            setNewProvider({
                              ...newProvider,
                              name: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="provider-email">Email</Label>
                        <Input
                          id="provider-email"
                          type="email"
                          placeholder="john.smith@example.com"
                          value={newProvider.email}
                          onChange={(e) =>
                            setNewProvider({
                              ...newProvider,
                              email: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="provider-dept">Department</Label>
                        <Select
                          value={newProvider.departmentId}
                          onValueChange={(value) =>
                            setNewProvider({
                              ...newProvider,
                              departmentId: value,
                            })
                          }
                          required
                        >
                          <SelectTrigger id="provider-dept">
                            <SelectValue placeholder="Select Department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="rounded-md bg-muted p-3 text-sm">
                        <p className="font-medium mb-1">Temporary Password:</p>
                        <p className="text-muted-foreground">
                          <code className="bg-background px-2 py-1 rounded">
                            password123
                          </code>
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Provider must change password on first login
                        </p>
                      </div>
                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full"
                      >
                        {loading ? "Creating..." : "Create Provider"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle>Overview</CardTitle>
                    <CardDescription>
                      Statistics for {selectedOrg?.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Total Providers
                        </span>
                        <span className="text-2xl font-bold">
                          {providers.length}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Departments
                        </span>
                        <span className="text-2xl font-bold">
                          {departments.length}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Providers by Department */}
              <div className="mt-6 space-y-6">
                {providersByDepartment.map((dept) => (
                  <Card key={dept.id}>
                    <CardHeader>
                      <CardTitle>{dept.name}</CardTitle>
                      <CardDescription>
                        {dept.providers.length}{" "}
                        {dept.providers.length === 1 ? "provider" : "providers"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {dept.providers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No providers in this department yet.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {dept.providers.map((provider) => (
                            <div
                              key={provider.id}
                              className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex-1">
                                <h4 className="font-semibold">
                                  {provider.user?.name}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {provider.user?.email}
                                </p>
                              </div>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  handleDeleteProvider(provider.id)
                                }
                                disabled={loading}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
