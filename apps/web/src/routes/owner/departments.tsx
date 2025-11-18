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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
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

// API functions
const fetchMyOrganizations = async (): Promise<any[]> => {
  const response = await fetch(
    `${import.meta.env.VITE_SERVER_URL}/api/organizations/my-organizations`,
    {
      credentials: "include",
    }
  );
  if (!response.ok) {
    throw new Error("Failed to load organizations");
  }
  const data = await response.json();
  // User has OWNER role, filter only enabled organizations
  return data.filter((org: any) => org.enabled);
};

const fetchDepartments = async (organizationId: string): Promise<any[]> => {
  const response = await fetch(
    `${import.meta.env.VITE_SERVER_URL}/api/departments?organizationId=${organizationId}`,
    {
      credentials: "include",
    }
  );
  if (!response.ok) {
    throw new Error("Failed to load departments");
  }
  return response.json();
};

const fetchProviders = async (organizationId: string): Promise<any[]> => {
  const response = await fetch(
    `${import.meta.env.VITE_SERVER_URL}/api/providers?organizationId=${organizationId}`,
    {
      credentials: "include",
    }
  );
  if (!response.ok) {
    throw new Error("Failed to load providers");
  }
  return response.json();
};

const createDepartment = async (data: { name: string; organizationId: string }): Promise<any> => {
  const response = await fetch(
    `${import.meta.env.VITE_SERVER_URL}/api/departments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create department");
  }
  return response.json();
};

const deleteDepartment = async (departmentId: string): Promise<void> => {
  const response = await fetch(
    `${import.meta.env.VITE_SERVER_URL}/api/departments/${departmentId}`,
    {
      method: "DELETE",
      credentials: "include",
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete department");
  }
};

interface CreateDepartmentData {
  name: string;
}

function DepartmentsComponent() {
  const { session } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [departmentToDelete, setDepartmentToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Query for organizations
  const {
    data: organizations = [],
    isLoading: isLoadingOrganizations,
    error: organizationsError,
  } = useQuery<any[]>({
    queryKey: ["organizations", "my-organizations"],
    queryFn: fetchMyOrganizations,
  });

  // Auto-select first organization when organizations load
  useEffect(() => {
    if (organizations.length > 0 && !selectedOrgId) {
      setSelectedOrgId(organizations[0].id);
    }
  }, [organizations, selectedOrgId]);

  // Query for departments (enabled when organization is selected)
  const {
    data: departments = [],
    isLoading: isLoadingDepartments,
    error: departmentsError,
  } = useQuery<any[]>({
    queryKey: ["departments", { organizationId: selectedOrgId }],
    queryFn: () => fetchDepartments(selectedOrgId),
    enabled: !!selectedOrgId,
  });

  // Query for providers (enabled when organization is selected)
  const {
    data: providers = [],
    isLoading: isLoadingProviders,
    error: providersError,
  } = useQuery<any[]>({
    queryKey: ["providers", { organizationId: selectedOrgId }],
    queryFn: () => fetchProviders(selectedOrgId),
    enabled: !!selectedOrgId,
  });

  // Mutations
  const createDepartmentMutation = useMutation({
    mutationFn: createDepartment,
    onSuccess: () => {
      toast.success("Department created successfully");
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["departments", { organizationId: selectedOrgId }] });
      queryClient.invalidateQueries({ queryKey: ["providers", { organizationId: selectedOrgId }] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create department");
    },
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => {
      toast.success("Department deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["departments", { organizationId: selectedOrgId }] });
      queryClient.invalidateQueries({ queryKey: ["providers", { organizationId: selectedOrgId }] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete department");
    },
  });

  // TanStack Form for create department
  const form = useForm<CreateDepartmentData>({
    defaultValues: {
      name: "",
    },
    onSubmit: async ({ value }) => {
      if (!selectedOrgId) {
        toast.error("Please select an organization");
        return;
      }
      await createDepartmentMutation.mutateAsync({
        name: value.name,
        organizationId: selectedOrgId,
      });
    },
  });

  const loading = isLoadingOrganizations || isLoadingDepartments || isLoadingProviders;

  // Show errors
  useEffect(() => {
    if (organizationsError) {
      toast.error("Error loading organizations");
    }
    if (departmentsError) {
      toast.error("Error loading departments");
    }
    if (providersError) {
      toast.error("Error loading providers");
    }
  }, [organizationsError, departmentsError, providersError]);

  const handleDeleteClick = (departmentId: string) => {
    const department = departments.find((d) => d.id === departmentId);
    if (department) {
      setDepartmentToDelete({ id: department.id, name: department.name });
      setShowDeleteDialog(true);
    }
  };

  const handleDeleteConfirm = () => {
    if (departmentToDelete) {
      deleteDepartmentMutation.mutate(departmentToDelete.id);
      setShowDeleteDialog(false);
      setDepartmentToDelete(null);
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
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    form.handleSubmit();
                  }}
                  className="space-y-4"
                >
                  <form.Field
                    name="name"
                    validators={{
                      onChange: ({ value }) => {
                        if (!value || value.length < 2) {
                          return "Department name must be at least 2 characters";
                        }
                        return undefined;
                      },
                    }}
                  >
                    {(field) => (
                      <div className="space-y-2">
                        <Label htmlFor="dept-name">Department Name</Label>
                        <Input
                          id="dept-name"
                          placeholder="e.g., Cardiology, Pediatrics"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                        {field.state.meta.errors.length > 0 && (
                          <p className="text-sm text-destructive">
                            {field.state.meta.errors[0]}
                          </p>
                        )}
                      </div>
                    )}
                  </form.Field>
                  <form.Subscribe
                    selector={(state) => [state.canSubmit, state.isSubmitting]}
                  >
                    {([canSubmit, isSubmitting]) => (
                      <Button
                        type="submit"
                        disabled={!canSubmit || loading || isSubmitting}
                        className="w-full"
                      >
                        {isSubmitting || createDepartmentMutation.isPending
                          ? "Creating..."
                          : "Create Department"}
                      </Button>
                    )}
                  </form.Subscribe>
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
                            onClick={() => handleDeleteClick(dept.id)}
                            disabled={loading || deleteDepartmentMutation.isPending}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this department? This action cannot be
              undone.
              {departmentToDelete && (
                <div className="mt-2">
                  <strong>Department:</strong> {departmentToDelete.name}
                  {(() => {
                    const deptProviders = providers.filter(
                      (p) => p.departmentId === departmentToDelete.id
                    );
                    return deptProviders.length > 0 ? (
                      <div className="mt-1 text-destructive">
                        <strong>Warning:</strong> This department has {deptProviders.length}{" "}
                        {deptProviders.length === 1 ? "provider" : "providers"}. They will
                        need to be reassigned or removed.
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDepartmentToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteDepartmentMutation.isPending}
            >
              {deleteDepartmentMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
