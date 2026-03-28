import { useEffect } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiError } from "@/lib/apiFetch";
import type { Organization } from "./organization-columns";

interface UpdateOrgData {
  name: string;
  slug: string;
  domain: string;
  logo: string;
}

const updateOrganization = async (
  id: string,
  data: Partial<UpdateOrgData>,
): Promise<Organization> => {
  return apiFetch<Organization>(
    `${import.meta.env.VITE_SERVER_URL}/api/admin/organizations/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
  );
};

interface EditOrganizationDialogProps {
  org: Organization | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditOrganizationDialog({
  org,
  open,
  onOpenChange,
  onSuccess,
}: EditOrganizationDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const updateOrgMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UpdateOrgData> }) =>
      updateOrganization(id, data),
    onSuccess: () => {
      toast.success(t("admin.organizationUpdatedSuccessfully"));
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
      onOpenChange(false);
      onSuccess();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("admin.failedToUpdateOrganization"));
      }
    },
  });

  const form = useForm({
    defaultValues: {
      name: org?.name ?? "",
      slug: org?.slug ?? "",
      domain: org?.domain ?? "",
      logo: org?.logo ?? "",
    } as UpdateOrgData,
    onSubmit: async ({ value }) => {
      if (!org) return;
      await updateOrgMutation.mutateAsync({ id: org.id, data: value });
    },
  });

  // Re-populate form when org changes
  useEffect(() => {
    if (org) {
      form.setFieldValue("name", org.name);
      form.setFieldValue("slug", org.slug);
      form.setFieldValue("domain", org.domain ?? "");
      form.setFieldValue("logo", org.logo ?? "");
    }
  }, [org]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("admin.editOrganizationDialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("admin.editOrganizationDialogDescription")}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4 pt-2"
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
                <Label htmlFor={`edit-${field.name}`}>
                  {t("admin.organizationName")}
                </Label>
                <Input
                  id={`edit-${field.name}`}
                  placeholder={t("admin.organizationNamePlaceholder")}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={updateOrgMutation.isPending}
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
                <Label htmlFor={`edit-${field.name}`}>{t("admin.slug")}</Label>
                <Input
                  id={`edit-${field.name}`}
                  placeholder={t("admin.slugPlaceholder")}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={updateOrgMutation.isPending}
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
                if (!value || value.trim().length === 0) {
                  return t("admin.domainRequired") || "Domain is required";
                }
                if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i.test(value)) {
                  return t("admin.domainInvalid") || "Invalid domain format.";
                }
                return undefined;
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={`edit-${field.name}`}>
                  {t("admin.domain")}
                </Label>
                <Input
                  id={`edit-${field.name}`}
                  placeholder={t("admin.domainPlaceholder") || "wellness.appointer.hu"}
                  value={field.state.value || ""}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={updateOrgMutation.isPending}
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
                <Label htmlFor={`edit-${field.name}`}>
                  {t("admin.logoUrl")}
                </Label>
                <Input
                  id={`edit-${field.name}`}
                  type="url"
                  placeholder={t("admin.logoUrlPlaceholder")}
                  value={field.state.value || ""}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={updateOrgMutation.isPending}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-red-500">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={updateOrgMutation.isPending}
            >
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button
              type="submit"
              disabled={updateOrgMutation.isPending}
              className="flex-1"
            >
              {updateOrgMutation.isPending
                ? t("admin.updating")
                : t("admin.updateOrganizationButton")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
