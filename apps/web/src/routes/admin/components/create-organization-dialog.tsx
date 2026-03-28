import { useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiError } from "@/lib/apiFetch";
import { Plus } from "lucide-react";

interface CreateOrgData {
  name: string;
  slug: string;
  domain: string;
  logo?: string;
  ownerName: string;
  ownerEmail: string;
}

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
    },
  );
};

interface CreateOrganizationDialogProps {
  onSuccess: () => void;
}

export function CreateOrganizationDialog({
  onSuccess,
}: CreateOrganizationDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const createOrgMutation = useMutation({
    mutationFn: createOrganization,
    onSuccess: (data) => {
      toast.success(data.message || t("admin.organizationCreatedSuccessfully"));
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
      setOpen(false);
      form.reset();
      onSuccess();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("admin.failedToCreateOrganization"));
      }
    },
  });

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
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t("admin.createOrganization")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("admin.createOrganizationDialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("admin.createOrganizationDialogDescription")}
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
                <Label htmlFor={field.name}>{t("admin.organizationName")}</Label>
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
                if (!value || value.trim().length === 0) {
                  return t("admin.domainRequired") || "Domain is required";
                }
                const domains = value
                  .split(",")
                  .map((d) => d.trim())
                  .filter((d) => d.length > 0);
                if (domains.length === 0) {
                  return t("admin.domainRequired") || "Domain is required";
                }
                for (const domain of domains) {
                  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i.test(domain)) {
                    return t("admin.domainInvalid") || "Invalid domain format.";
                  }
                  if (domain.length < 2) {
                    return t("admin.domainInvalid") || "Domain must be at least 2 characters";
                  }
                }
                return undefined;
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  {t("admin.domain")} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id={field.name}
                  placeholder={t("admin.domainPlaceholder") || "wellness.appointer.hu"}
                  value={field.state.value || ""}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={createOrgMutation.isPending}
                />
                <p className="text-xs text-muted-foreground">
                  {t("admin.domainHelp") || "Use a single domain for production."}
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

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={createOrgMutation.isPending}
            >
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button
              type="submit"
              disabled={createOrgMutation.isPending}
              className="flex-1"
            >
              {createOrgMutation.isPending
                ? t("admin.creating")
                : t("admin.createOrganizationButton")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
