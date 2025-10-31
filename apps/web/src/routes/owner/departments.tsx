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

export const Route = createFileRoute("/owner/departments")({
  component: DepartmentsComponent,
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

function DepartmentsComponent() {
  const { session } = Route.useRouteContext();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [departments, setDepartments] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [newDepartment, setNewDepartment] = useState({
    name: "",
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

  // Load departments when organization is selected
  useEffect(() => {
    if (selectedOrgId) {
      loadDepartments();
      loadProviders();
    }
  }, [selectedOrgId]);

  const loadDepartments = async () => {
    if (!selectedOrgId) return;

    setLoading(true);
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
      } else {
        toast.error("Failed to load departments");
      }
    } catch (err) {
      console.error("Error loading departments:", err);
      toast.error("Error loading departments");
    } finally {
      setLoading(false);
    }
  };

  const loadProviders = async () => {
    if (!selectedOrgId) return;

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
      }
    } catch (err) {
      console.error("Error loading providers:", err);
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDepartment.name || !selectedOrgId) {
      toast.error("Department name and organization are required");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/departments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            name: newDepartment.name,
            organizationId: selectedOrgId,
          }),
        }
      );

      if (response.ok) {
        toast.success("Department created successfully");
        setNewDepartment({ name: "" });
        loadDepartments();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create department");
      }
    } catch (err) {
      toast.error("Error creating department");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDepartment = async (departmentId: string) => {
    if (!confirm("Are you sure you want to delete this department?")) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/departments/${departmentId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
        toast.success("Department deleted successfully");
        loadDepartments();
        loadProviders();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete department");
      }
    } catch (err) {
      toast.error("Error deleting department");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getProvidersForDepartment = (departmentId: string) => {
    return providers.filter((p) => p.departmentId === departmentId);
  };

  const selectedOrg = organizations.find((org) => org.id === selectedOrgId);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Departments</h1>
        <p className="text-muted-foreground">
          Manage departments and providers for your organization
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

          <div className="grid gap-6 md:grid-cols-2">
            {/* Create Department */}
            <Card>
              <CardHeader>
                <CardTitle>Create Department</CardTitle>
                <CardDescription>
                  Add a new department to {selectedOrg?.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateDepartment} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="dept-name">Department Name</Label>
                    <Input
                      id="dept-name"
                      placeholder="e.g., Cardiology, Pediatrics"
                      value={newDepartment.name}
                      onChange={(e) =>
                        setNewDepartment({ name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Creating..." : "Create Department"}
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
                      Total Departments
                    </span>
                    <span className="text-2xl font-bold">
                      {departments.length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Total Providers
                    </span>
                    <span className="text-2xl font-bold">
                      {providers.length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Departments List */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Departments</CardTitle>
              <CardDescription>
                Manage departments and their providers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <div className="h-20 bg-muted animate-pulse rounded-lg" />
                  <div className="h-20 bg-muted animate-pulse rounded-lg" />
                </div>
              ) : departments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    No departments yet. Create your first department to get
                    started.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {departments.map((dept) => {
                    const deptProviders = getProvidersForDepartment(dept.id);
                    return (
                      <div
                        key={dept.id}
                        className="rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">
                              {dept.name}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {deptProviders.length}{" "}
                              {deptProviders.length === 1
                                ? "provider"
                                : "providers"}
                            </p>

                            {/* List providers */}
                            {deptProviders.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {deptProviders.map((provider) => (
                                  <div
                                    key={provider.id}
                                    className="flex items-center gap-2 text-sm bg-background rounded px-2 py-1"
                                  >
                                    <span className="font-medium">
                                      {provider.user?.name}
                                    </span>
                                    <span className="text-muted-foreground">
                                      ({provider.user?.email})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteDepartment(dept.id)}
                            disabled={loading}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
