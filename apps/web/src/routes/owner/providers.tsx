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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { useEffect, useState, useRef } from "react";
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

const createProvider = async (data: {
  name: string;
  email: string;
  organizationId: string;
  departmentId: string;
}): Promise<{ tempPassword: string }> => {
  const response = await fetch(
    `${import.meta.env.VITE_SERVER_URL}/api/owner/providers/create-user`,
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
    throw new Error(error.error || "Failed to create provider");
  }
  return response.json();
};

const deleteProvider = async (providerId: string): Promise<void> => {
  const response = await fetch(
    `${import.meta.env.VITE_SERVER_URL}/api/owner/providers/${providerId}`,
    {
      method: "DELETE",
      credentials: "include",
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete provider");
  }
};

interface CreateProviderData {
  name: string;
  email: string;
  departmentId: string;
}

function ProvidersComponent() {
  const { session } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const departmentFieldInteracted = useRef(false);

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
  const createProviderMutation = useMutation({
    mutationFn: createProvider,
    onSuccess: (data) => {
      toast.success(`Provider created! Temporary password: ${data.tempPassword}`, {
        duration: 10000,
        description:
          "The provider will need to change this password on first login.",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["providers", { organizationId: selectedOrgId }] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create provider");
    },
  });

  const deleteProviderMutation = useMutation({
    mutationFn: deleteProvider,
    onSuccess: () => {
      toast.success("Provider deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["providers", { organizationId: selectedOrgId }] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete provider");
    },
  });

  // TanStack Form for create provider
  const form = useForm<CreateProviderData>({
    defaultValues: {
      name: "",
      email: "",
      departmentId: "",
    },
    onSubmit: async ({ value }) => {
      if (!selectedOrgId) {
        toast.error("Please select an organization");
        return;
      }
      await createProviderMutation.mutateAsync({
        name: value.name,
        email: value.email,
        organizationId: selectedOrgId,
        departmentId: value.departmentId,
      });
    },
  });

  // Auto-select first department when departments load
  useEffect(() => {
    if (departments.length > 0 && !form.state.values.departmentId) {
      // Use setFieldValue without triggering validation
      form.setFieldValue("departmentId", departments[0].id);
    }
  }, [departments, form]);

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

  const handleDeleteProvider = (providerId: string) => {
    if (!confirm("Are you sure you want to delete this provider?")) {
      return;
    }
    deleteProviderMutation.mutate(providerId);
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
                              return "Provider name must be at least 2 characters";
                            }
                            return undefined;
                          },
                        }}
                      >
                        {(field) => (
                          <div className="space-y-2">
                            <Label htmlFor="provider-name">Provider Name</Label>
                            <Input
                              id="provider-name"
                              placeholder="e.g., Dr. John Smith"
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
                      <form.Field
                        name="email"
                        validators={{
                          onChange: ({ value }) => {
                            if (!value) {
                              return "Email is required";
                            }
                            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                            if (!emailRegex.test(value)) {
                              return "Please enter a valid email address";
                            }
                            return undefined;
                          },
                        }}
                      >
                        {(field) => (
                          <div className="space-y-2">
                            <Label htmlFor="provider-email">Email</Label>
                            <Input
                              id="provider-email"
                              type="email"
                              placeholder="john.smith@example.com"
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
                      <form.Field
                        name="departmentId"
                        validators={{
                          onBlur: ({ value }) => {
                            if (!value) {
                              return "Department is required";
                            }
                            return undefined;
                          },
                          onSubmit: ({ value }) => {
                            if (!value) {
                              return "Department is required";
                            }
                            return undefined;
                          },
                        }}
                      >
                        {(field) => {
                          // Only show error if user has interacted with the field or form has been submitted
                          const shouldShowError = 
                            (departmentFieldInteracted.current || form.state.isSubmitted) &&
                            field.state.meta.errors.length > 0 &&
                            !field.state.value;
                          
                          return (
                            <div className="space-y-2">
                              <Label htmlFor="provider-dept">Department</Label>
                              <Select
                                value={field.state.value}
                                onValueChange={(value) => {
                                  departmentFieldInteracted.current = true;
                                  field.handleChange(value);
                                }}
                                onOpenChange={(open) => {
                                  if (open) {
                                    departmentFieldInteracted.current = true;
                                  }
                                }}
                              >
                                <SelectTrigger 
                                  id="provider-dept"
                                  onFocus={() => {
                                    departmentFieldInteracted.current = true;
                                  }}
                                >
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
                              {shouldShowError && (
                                <p className="text-sm text-destructive">
                                  {field.state.meta.errors[0]}
                                </p>
                              )}
                            </div>
                          );
                        }}
                      </form.Field>
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
                      <form.Subscribe
                        selector={(state) => [state.canSubmit, state.isSubmitting]}
                      >
                        {([canSubmit, isSubmitting]) => (
                          <Button
                            type="submit"
                            disabled={!canSubmit || loading || isSubmitting}
                            className="w-full"
                          >
                            {isSubmitting || createProviderMutation.isPending
                              ? "Creating..."
                              : "Create Provider"}
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
                                disabled={loading || deleteProviderMutation.isPending}
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
