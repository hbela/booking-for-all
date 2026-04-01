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
import { apiFetch, ApiError } from "@/lib/apiFetch";
import { useTranslation } from "react-i18next";

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
        to: "/admin",
      });
    }

    // OWNER must have organization membership
    if (role === "OWNER") {
      try {
        try {
          const organizations = await apiFetch<any[]>(
            `${
              import.meta.env.VITE_SERVER_URL || "http://localhost:3000"
            }/api/organizations/my-organizations`
          );
          if (!organizations || organizations.length === 0) {
            throw redirect({
              to: "/login",
            });
          }
        } catch (error) {
          // Ignore API errors in beforeLoad, just redirect to login
          throw redirect({
            to: "/login",
          });
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
  return apiFetch<any[]>(
    `${import.meta.env.VITE_SERVER_URL}/api/organizations/my-organizations`
  );
};

const fetchDepartments = async (organizationId: string): Promise<any[]> => {
  return apiFetch<any[]>(
    `${
      import.meta.env.VITE_SERVER_URL
    }/api/departments?organizationId=${organizationId}`
  );
};

const fetchProviders = async (organizationId: string): Promise<any[]> => {
  return apiFetch<any[]>(
    `${
      import.meta.env.VITE_SERVER_URL
    }/api/providers?organizationId=${organizationId}`
  );
};

const createProvider = async (data: {
  name: string;
  email: string;
  organizationId: string;
  departmentId: string;
}): Promise<void> => {
  await apiFetch(
    `${import.meta.env.VITE_SERVER_URL}/api/owner/providers/create-user`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
};

const deleteProvider = async (providerId: string): Promise<void> => {
  await apiFetch(
    `${import.meta.env.VITE_SERVER_URL}/api/owner/providers/${providerId}`,
    {
      method: "DELETE",
    }
  );
};

function ProvidersComponent() {
  const { session } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
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
    onSuccess: () => {
      toast.success(t("owner.providerCreated"), { duration: 6000 });
      form.reset();
      queryClient.invalidateQueries({
        queryKey: ["providers", { organizationId: selectedOrgId }],
      });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("owner.unexpectedError"));
      }
    },
  });

  const deleteProviderMutation = useMutation({
    mutationFn: deleteProvider,
    onSuccess: () => {
      toast.success(t("owner.providerDeletedSuccessfully"));
      queryClient.invalidateQueries({
        queryKey: ["providers", { organizationId: selectedOrgId }],
      });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("owner.failedToDeleteProvider"));
      }
    },
  });

  // TanStack Form for create provider
  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      departmentId: "",
    },
    onSubmit: async ({ value }) => {
      if (!selectedOrgId) {
        toast.error(t("owner.pleaseSelectOrganization"));
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

  const loading =
    isLoadingOrganizations || isLoadingDepartments || isLoadingProviders;

  // Show errors
  useEffect(() => {
    if (organizationsError) {
      toast.error(t("owner.errorLoadingOrganizations"));
    }
    if (departmentsError) {
      toast.error(t("owner.errorLoadingDepartments"));
    }
    if (providersError) {
      toast.error(t("owner.errorLoadingProviders"));
    }
  }, [organizationsError, departmentsError, providersError, t]);

  const handleDeleteProvider = (providerId: string) => {
    if (!confirm(t("owner.areYouSureDeleteProvider"))) {
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
        <h1 className="text-3xl font-bold">{t("owner.providers")}</h1>
        <p className="text-muted-foreground">
          {t("owner.manageServiceProviders")}
        </p>
      </div>

      {/* Organization Selector */}
      {organizations.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              {t("owner.dontHaveActiveOrganizations")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {organizations.length > 1 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>{t("owner.selectOrganization")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("owner.selectOrganizationPlaceholder")} />
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
                  {t("owner.noDepartmentsAvailable")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                {/* Create Provider */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t("owner.createProvider")}</CardTitle>
                    <CardDescription>
                      {t("owner.addNewProvider", { orgName: selectedOrg?.name })}
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
                              return t("owner.providerNameMinChars");
                            }
                            return undefined;
                          },
                        }}
                      >
                        {(field) => (
                          <div className="space-y-2">
                            <Label htmlFor="provider-name">{t("owner.providerName")}</Label>
                            <Input
                              id="provider-name"
                              placeholder={t("owner.providerNamePlaceholder")}
                              value={field.state.value}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
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
                              return t("owner.emailRequired");
                            }
                            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                            if (!emailRegex.test(value)) {
                              return t("owner.validEmailAddress");
                            }
                            return undefined;
                          },
                        }}
                      >
                        {(field) => (
                          <div className="space-y-2">
                            <Label htmlFor="provider-email">{t("common.email")}</Label>
                            <Input
                              id="provider-email"
                              type="email"
                              placeholder="john.smith@example.com"
                              value={field.state.value}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
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
                              return t("owner.departmentRequired");
                            }
                            return undefined;
                          },
                          onSubmit: ({ value }) => {
                            if (!value) {
                              return t("owner.departmentRequired");
                            }
                            return undefined;
                          },
                        }}
                      >
                        {(field) => {
                          // Only show error if user has interacted with the field or form has been submitted
                          const shouldShowError =
                            (departmentFieldInteracted.current ||
                              form.state.isSubmitted) &&
                            field.state.meta.errors.length > 0 &&
                            !field.state.value;

                          return (
                            <div className="space-y-2">
                              <Label htmlFor="provider-dept">{t("owner.departments")}</Label>
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
                                  className="dark:bg-input/30"
                                  onFocus={() => {
                                    departmentFieldInteracted.current = true;
                                  }}
                                >
                                  <SelectValue placeholder={t("owner.selectDepartment")} />
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
                      <form.Subscribe
                        selector={(state) => [
                          state.canSubmit,
                          state.isSubmitting,
                        ]}
                      >
                        {([canSubmit, isSubmitting]) => (
                          <Button
                            type="submit"
                            disabled={!canSubmit || loading || isSubmitting}
                            className="w-full"
                          >
                            {isSubmitting || createProviderMutation.isPending
                              ? t("owner.creating")
                              : t("owner.createProvider")}
                          </Button>
                        )}
                      </form.Subscribe>
                    </form>
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t("owner.overview")}</CardTitle>
                    <CardDescription>
                      {t("owner.statisticsFor", { orgName: selectedOrg?.name })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          {t("owner.totalProviders")}
                        </span>
                        <span className="text-2xl font-bold">
                          {providers.length}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          {t("owner.departments")}
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
                        {dept.providers.length === 1 ? t("owner.provider") : t("owner.providersPlural")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {dept.providers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {t("owner.noProvidersInDepartment")}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {(dept.providers as any[]).map((provider: any) => (
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
                                disabled={
                                  loading || deleteProviderMutation.isPending
                                }
                              >
                                {t("owner.remove")}
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
