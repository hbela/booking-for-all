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
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/apiFetch";
import { useTranslation } from "react-i18next";

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

interface Organization {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  logo?: string;
  enabled: boolean;
  members?: any[];
  apkKey?: string | null;
}

interface CreateOrgData {
  name: string;
  slug: string;
  domain: string; // Required and unique
  logo?: string;
  ownerName: string;
  ownerEmail: string;
}

// API functions
const fetchOrganizations = async (): Promise<Organization[]> => {
  return apiFetch<Organization[]>(
    `${import.meta.env.VITE_SERVER_URL}/api/admin/organizations`
  );
};

const createOrganization = async (data: CreateOrgData): Promise<any> => {
  return apiFetch<any>(
    `${import.meta.env.VITE_SERVER_URL}/api/admin/organizations/create`,
    {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        slug: data.slug,
        domain: data.domain,
        logo: data.logo || undefined,
        ownerName: data.ownerName,
        ownerEmail: data.ownerEmail,
      }),
    }
  );
};

const deleteOrganization = async (orgId: string): Promise<void> => {
  // DELETE requests don't need Content-Type header when there's no body
  const res = await fetch(
    `${import.meta.env.VITE_SERVER_URL}/api/admin/organizations/${orgId}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: {
        // Don't set Content-Type for DELETE requests without body
      },
    }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = data?.message || "Request failed";
    const code = data?.code || "UNKNOWN_ERROR";
    throw new ApiError(message, code, res.status);
  }

  // DELETE requests may return 204 No Content
  if (res.status === 204) {
    return;
  }

  const data = await res.json().catch(() => null);
  // Handle unified response format: { success: true, data: ... }
  if (data && typeof data === "object" && "success" in data) {
    return;
  }
};

const uploadApk = async (orgId: string, file: File): Promise<{ key: string }> => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(
    `${import.meta.env.VITE_SERVER_URL}/api/admin/organizations/${orgId}/upload-apk`,
    {
      method: "POST",
      credentials: "include",
      body: formData,
    }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = data?.message || "Upload failed";
    const code = data?.code || "UPLOAD_ERROR";
    throw new ApiError(message, code, res.status);
  }

  const data = await res.json();
  if (data.success && data.data) {
    return data.data;
  }
  throw new ApiError("Invalid response from server", "INVALID_RESPONSE", res.status);
};

const createCheckout = async (
  orgId: string
): Promise<{ checkoutUrl: string }> => {
  const data = await apiFetch<{ checkoutUrl: string }>(
    `${import.meta.env.VITE_SERVER_URL}/api/subscriptions/create-checkout`,
    {
      method: "POST",
      body: JSON.stringify({ organizationId: orgId }),
    }
  );
  return data;
};

function AdminComponent() {
  const { session } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Query for organizations
  const {
    data: organizations = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin", "organizations"],
    queryFn: fetchOrganizations,
    enabled: false, // Don't auto-fetch, user clicks button
  });

  // Create organization mutation
  const createOrgMutation = useMutation({
    mutationFn: createOrganization,
    onSuccess: (data) => {
      toast.success(data.message || t("admin.organizationCreatedSuccessfully"));
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("admin.failedToCreateOrganization"));
      }
    },
  });

  // Delete organization mutation
  const deleteOrgMutation = useMutation({
    mutationFn: deleteOrganization,
    onSuccess: () => {
      toast.success(t("admin.organizationDeletedSuccessfully"));
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
      setOrgToDelete(null);
      setShowDeleteDialog(false);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.code === "ORG_CANNOT_DELETE_ACTIVE") {
          toast.error(
            t("admin.cannotDeleteActiveOrganization") || error.message
          );
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error(t("admin.failedToDeleteOrganization"));
      }
      setOrgToDelete(null);
      setShowDeleteDialog(false);
    },
  });

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: createCheckout,
    onSuccess: (data, orgId) => {
      // Find org name for toast
      const org = organizations.find((o) => o.id === orgId);
      toast.success(
        t("admin.redirectingToCheckout", {
          orgName: org?.name || t("admin.organization"),
        })
      );
      window.location.href = data.checkoutUrl;
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(error.message || t("admin.failedToCreateCheckout"));
      }
    },
  });

  // Upload APK mutation
  const uploadApkMutation = useMutation({
    mutationFn: ({ orgId, file }: { orgId: string; file: File }) =>
      uploadApk(orgId, file),
    onSuccess: () => {
      toast.success(t("admin.apkUploadedSuccessfully") || "APK uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("admin.failedToUploadApk") || "Failed to upload APK");
      }
    },
  });

  // TanStack Form for create organization
  const form = useForm({
    defaultValues: {
      name: "",
      slug: "",
      domain: "",
      logo: "",
      ownerName: "",
      ownerEmail: "",
    } as CreateOrgData,
    onSubmit: async ({ value }) => {
      await createOrgMutation.mutateAsync(value);
      form.reset();
    },
  });

  // State for delete confirmation dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null);

  const handleDeleteOrg = (org: Organization) => {
    // Only allow deletion of pending organizations
    if (org.enabled) {
      toast.error(
        t("admin.cannotDeleteActiveOrganization") ||
          "Only organizations with pending status can be deleted"
      );
      return;
    }
    setOrgToDelete(org);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (orgToDelete) {
      await deleteOrgMutation.mutateAsync(orgToDelete.id);
    }
  };

  const handleSubscribe = async (orgId: string) => {
    await subscribeMutation.mutateAsync(orgId);
  };

  const handleApkUpload = async (orgId: string, file: File | null) => {
    if (!file) {
      toast.error(t("admin.noFileSelected") || "Please select a file");
      return;
    }
    if (!file.name.endsWith(".apk")) {
      toast.error(t("admin.apkFileRequired") || "APK file required");
      return;
    }
    await uploadApkMutation.mutateAsync({ orgId, file });
  };

  const isLoadingAny =
    isLoading ||
    createOrgMutation.isPending ||
    deleteOrgMutation.isPending ||
    subscribeMutation.isPending ||
    uploadApkMutation.isPending;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">{t("admin.adminDashboard")}</h1>
        <p className="text-muted-foreground">
          {t("admin.welcomeAdmin", { name: session.data?.user.name })}
        </p>
        <div className="mt-4">
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/admin/api-keys" })}
            className="mr-2"
          >
            {t("admin.manageApiKeys")}
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Create Organization */}
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.createOrganization")}</CardTitle>
            <CardDescription>{t("admin.addNewOrganization")}</CardDescription>
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
                    if (!value || value.trim().length === 0) {
                      return t("admin.organizationNameRequired");
                    }
                    return undefined;
                  },
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>
                      {t("admin.organizationName")}
                    </Label>
                    <Input
                      id={field.name}
                      placeholder={t("admin.organizationNamePlaceholder")}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      disabled={createOrgMutation.isPending}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p className="text-sm text-red-500">
                        {field.state.meta.errors[0]}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              <form.Field
                name="slug"
                validators={{
                  onChange: ({ value }) => {
                    if (!value || value.trim().length === 0) {
                      return t("admin.slugRequired");
                    }
                    if (!/^[a-z0-9-]+$/.test(value)) {
                      return t("admin.slugInvalid");
                    }
                    return undefined;
                  },
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>{t("admin.slug")}</Label>
                    <Input
                      id={field.name}
                      placeholder={t("admin.slugPlaceholder")}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      disabled={createOrgMutation.isPending}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p className="text-sm text-red-500">
                        {field.state.meta.errors[0]}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              <form.Field
                name="domain"
                validators={{
                  onChange: ({ value }) => {
                    // Domain is required
                    if (!value || value.trim().length === 0) {
                      return t("admin.domainRequired") || "Domain is required";
                    }
                    // Basic domain validation (allows comma-separated for dev)
                    const domains = value
                      .split(",")
                      .map((d) => d.trim())
                      .filter((d) => d.length > 0);
                    if (domains.length === 0) {
                      return t("admin.domainRequired") || "Domain is required";
                    }
                    for (const domain of domains) {
                      // Allow domains with alphanumeric, dots, hyphens
                      // Examples: wellness.hu, wellness.appointer.hu, localhost
                      if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i.test(domain)) {
                        return (
                          t("admin.domainInvalid") ||
                          "Invalid domain format. Use alphanumeric characters, dots, and hyphens only."
                        );
                      }
                      // Must be at least 2 characters
                      if (domain.length < 2) {
                        return (
                          t("admin.domainInvalid") ||
                          "Domain must be at least 2 characters"
                        );
                      }
                    }
                    return undefined;
                  },
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>
                      {t("admin.domain")}{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id={field.name}
                      placeholder={
                        t("admin.domainPlaceholder") ||
                        "wellness.appointer.hu or wellness.appointer.hu,wellness.hu"
                      }
                      value={field.state.value || ""}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      disabled={createOrgMutation.isPending}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("admin.domainHelp") ||
                        "For production: single domain. For development: comma-separated domains (e.g., wellness.appointer.hu,wellness.hu)"}
                    </p>
                    {field.state.meta.errors.length > 0 && (
                      <p className="text-sm text-red-500">
                        {field.state.meta.errors[0]}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              <form.Field
                name="ownerName"
                validators={{
                  onChange: ({ value }) => {
                    if (!value || value.trim().length === 0) {
                      return t("admin.ownerNameRequired");
                    }
                    return undefined;
                  },
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>{t("admin.ownerName")}</Label>
                    <Input
                      id={field.name}
                      placeholder={t("admin.ownerNamePlaceholder")}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      disabled={createOrgMutation.isPending}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p className="text-sm text-red-500">
                        {field.state.meta.errors[0]}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              <form.Field
                name="ownerEmail"
                validators={{
                  onChange: ({ value }) => {
                    if (!value || value.trim().length === 0) {
                      return t("admin.ownerEmailRequired");
                    }
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                      return t("owner.validEmailAddress");
                    }
                    return undefined;
                  },
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>{t("admin.ownerEmail")}</Label>
                    <Input
                      id={field.name}
                      type="email"
                      placeholder={t("admin.ownerEmailPlaceholder")}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      disabled={createOrgMutation.isPending}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p className="text-sm text-red-500">
                        {field.state.meta.errors[0]}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              <form.Field
                name="logo"
                validators={{
                  onChange: ({ value }) => {
                    if (value && value.trim().length > 0) {
                      try {
                        new URL(value);
                      } catch {
                        return t("admin.logoUrlInvalid");
                      }
                    }
                    return undefined;
                  },
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>{t("admin.logoUrl")}</Label>
                    <Input
                      id={field.name}
                      type="url"
                      placeholder={t("admin.logoUrlPlaceholder")}
                      value={field.state.value || ""}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      disabled={createOrgMutation.isPending}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p className="text-sm text-red-500">
                        {field.state.meta.errors[0]}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              <Button
                type="submit"
                disabled={createOrgMutation.isPending}
                className="w-full"
              >
                {createOrgMutation.isPending
                  ? t("admin.creating")
                  : t("admin.createOrganizationButton")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Organizations List */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t("admin.allOrganizations")}</CardTitle>
          <CardDescription>{t("admin.manageAllOrganizations")}</CardDescription>
          <Button
            onClick={() => refetch()}
            disabled={isLoading}
            className="mt-2"
          >
            {isLoading ? t("admin.loading") : t("admin.loadOrganizations")}
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="text-sm text-red-500 mb-4">
              {t("admin.errorLoadingOrganizations", { message: error.message })}
            </p>
          )}
          {organizations.length === 0 && !isLoading ? (
            <p className="text-sm text-muted-foreground">
              {t("admin.noOrganizationsLoaded")}
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
                          {org.enabled ? t("admin.active") : t("admin.pending")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t("admin.slugLabel")}: {org.slug}
                      </p>
                      {org.domain && (
                        <p className="text-sm text-muted-foreground">
                          {t("admin.domainLabel") || "Domain"}: {org.domain}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {t("admin.idLabel")}: {org.id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("admin.members")}: {org.members?.length || 0}
                      </p>
                      {/* APK Management */}
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-semibold mb-2">
                          {t("admin.apkManagement") || "APK Management"}
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            accept=".apk"
                            id={`apk-upload-${org.id}`}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleApkUpload(org.id, file);
                                // Reset input
                                e.target.value = "";
                              }
                            }}
                            disabled={uploadApkMutation.isPending}
                          />
                          <label
                            htmlFor={`apk-upload-${org.id}`}
                            className="cursor-pointer"
                          >
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              asChild
                              disabled={uploadApkMutation.isPending}
                            >
                              <span>
                                {org.apkKey
                                  ? t("admin.replaceApk") || "Replace APK"
                                  : t("admin.uploadApk") || "Upload APK"}
                              </span>
                            </Button>
                          </label>
                          {org.apkKey && (
                            <span className="text-xs text-green-600">
                              {t("admin.apkUploaded") || "✓ APK uploaded"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!org.enabled && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleSubscribe(org.id)}
                        disabled={isLoadingAny}
                      >
                        {t("admin.subscribe")}
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteOrg(org)}
                      disabled={isLoadingAny || org.enabled}
                      title={
                        org.enabled
                          ? t("admin.cannotDeleteActiveOrganization") ||
                            "Only organizations with pending status can be deleted"
                          : undefined
                      }
                    >
                      {t("admin.deleteAction")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.deleteOrganization") || "Delete Organization"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.areYouSureDeleteOrganization") ||
                "Are you sure you want to delete this organization? This action cannot be undone."}
              {orgToDelete && (
                <div className="mt-2">
                  <strong>{t("admin.organization") || "Organization"}:</strong>{" "}
                  {orgToDelete.name}
                  <br />
                  <strong>{t("admin.slugLabel") || "Slug"}:</strong>{" "}
                  {orgToDelete.slug}
                  {orgToDelete.domain && (
                    <>
                      <br />
                      <strong>
                        {t("admin.domainLabel") || "Domain"}:
                      </strong>{" "}
                      {orgToDelete.domain}
                    </>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setOrgToDelete(null);
                setShowDeleteDialog(false);
              }}
            >
              {t("common.cancel") || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteOrgMutation.isPending}
            >
              {deleteOrgMutation.isPending
                ? t("admin.deleting") || "Deleting..."
                : t("common.deleteAction") || "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
