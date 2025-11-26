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
import { apiFetch, ApiError } from "@/lib/apiFetch";
import { useTranslation } from "react-i18next";

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
        try {
          const organizations = await apiFetch<any[]>(
            `${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}/api/organizations/my-organizations`
          );
          if (!organizations || organizations.length === 0) {
            throw redirect({
              to: "/login",
            });
          }
        } catch (error) {
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
  const data = await apiFetch<any[]>(
    `${import.meta.env.VITE_SERVER_URL}/api/organizations/my-organizations`
  );
  // User has OWNER role, filter only enabled organizations
  return data.filter((org: any) => org.enabled);
};

const fetchDepartments = async (organizationId: string): Promise<any[]> => {
  return apiFetch<any[]>(
    `${import.meta.env.VITE_SERVER_URL}/api/departments?organizationId=${organizationId}`
  );
};

const fetchProviders = async (organizationId: string): Promise<any[]> => {
  return apiFetch<any[]>(
    `${import.meta.env.VITE_SERVER_URL}/api/providers?organizationId=${organizationId}`
  );
};

const createDepartment = async (data: { name: string; organizationId: string }): Promise<any> => {
  return apiFetch<any>(
    `${import.meta.env.VITE_SERVER_URL}/api/owner/departments`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
};

const deleteDepartment = async (departmentId: string): Promise<void> => {
  await apiFetch(
    `${import.meta.env.VITE_SERVER_URL}/api/owner/departments/${departmentId}`,
    {
      method: "DELETE",
    }
  );
};

interface CreateDepartmentData {
  name: string;
}

function DepartmentsComponent() {
  const { session } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
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
      toast.success(t("owner.departmentCreatedSuccessfully"));
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["departments", { organizationId: selectedOrgId }] });
      queryClient.invalidateQueries({ queryKey: ["providers", { organizationId: selectedOrgId }] });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("owner.failedToCreateDepartment"));
      }
    },
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => {
      toast.success(t("owner.departmentDeletedSuccessfully"));
      queryClient.invalidateQueries({ queryKey: ["departments", { organizationId: selectedOrgId }] });
      queryClient.invalidateQueries({ queryKey: ["providers", { organizationId: selectedOrgId }] });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("owner.failedToDeleteDepartment"));
      }
    },
  });

  // TanStack Form for create department
  const form = useForm<CreateDepartmentData>({
    defaultValues: {
      name: "",
    },
    onSubmit: async ({ value }) => {
      if (!selectedOrgId) {
        toast.error(t("owner.pleaseSelectOrganization"));
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
      toast.error(t("owner.errorLoadingOrganizations"));
    }
    if (departmentsError) {
      toast.error(t("owner.errorLoadingDepartments"));
    }
    if (providersError) {
      toast.error(t("owner.errorLoadingProviders"));
    }
  }, [organizationsError, departmentsError, providersError, t]);

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
        <h1 className="text-3xl font-bold">{t("owner.departmentsTitle")}</h1>
        <p className="text-muted-foreground">
          {t("owner.manageDepartmentsProviders")}
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

          <div className="grid gap-6 md:grid-cols-2">
            {/* Create Department */}
            <Card>
              <CardHeader>
                <CardTitle>{t("owner.createDepartment")}</CardTitle>
                <CardDescription>
                  {t("owner.addNewDepartment", { orgName: selectedOrg?.name })}
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
                          return t("owner.departmentNameMinChars");
                        }
                        return undefined;
                      },
                    }}
                  >
                    {(field) => (
                      <div className="space-y-2">
                        <Label htmlFor="dept-name">{t("owner.departmentName")}</Label>
                        <Input
                          id="dept-name"
                          placeholder={t("owner.departmentNamePlaceholder")}
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
                          ? t("owner.creating")
                          : t("owner.createDepartmentButton")}
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
                      {t("owner.totalDepartments")}
                    </span>
                    <span className="text-2xl font-bold">
                      {departments.length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {t("owner.totalProviders")}
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
              <CardTitle>{t("owner.departmentsList")}</CardTitle>
              <CardDescription>
                {t("owner.manageDepartmentsProvidersDesc")}
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
                    {t("owner.noDepartmentsYet")}
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
                                ? t("owner.provider")
                                : t("owner.providersPlural")}
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
                            {t("common.delete")}
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
            <AlertDialogTitle>{t("owner.deleteDepartment")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("owner.areYouSureDeleteDepartment")}
              {departmentToDelete && (
                <div className="mt-2">
                  <strong>{t("owner.department")}:</strong> {departmentToDelete.name}
                  {(() => {
                    const deptProviders = providers.filter(
                      (p) => p.departmentId === departmentToDelete.id
                    );
                    return deptProviders.length > 0 ? (
                      <div className="mt-1 text-destructive">
                        <strong>{t("owner.warning")}:</strong> {t("owner.departmentHasProviders", { count: deptProviders.length })}
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDepartmentToDelete(null)}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteDepartmentMutation.isPending}
            >
              {deleteDepartmentMutation.isPending ? t("owner.deleting") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
