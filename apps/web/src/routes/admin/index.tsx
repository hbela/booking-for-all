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
import { apiFetch, ApiError } from "@/lib/apiFetch";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { OrganizationTable } from "./components/organization-table";
import { CreateOrganizationDialog } from "./components/create-organization-dialog";
import { EditOrganizationDialog } from "./components/edit-organization-dialog";
import type { Organization } from "./components/organization-columns";

export const Route = createFileRoute("/admin/")({
  component: AdminComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
      });
    }

    // @ts-ignore - isSystemAdmin is boolean field
    if (!session.data.user.isSystemAdmin) {
      throw redirect({
        to: "/",
      });
    }

    return { session };
  },
});

// API functions
const fetchOrganizations = async (): Promise<Organization[]> => {
  return apiFetch<Organization[]>(
    `${import.meta.env.VITE_SERVER_URL}/api/admin/organizations`,
  );
};

const deleteOrganization = async (orgId: string): Promise<void> => {
  const res = await fetch(
    `${import.meta.env.VITE_SERVER_URL}/api/admin/organizations/${orgId}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = data?.message || "Request failed";
    const code = data?.code || "UNKNOWN_ERROR";
    throw new ApiError(message, code, res.status);
  }

  if (res.status === 204) return;

  const data = await res.json().catch(() => null);
  if (data && typeof data === "object" && "success" in data) return;
};

const createCheckout = async (
  orgId: string,
): Promise<{ checkoutUrl: string }> => {
  return apiFetch<{ checkoutUrl: string }>(
    `${import.meta.env.VITE_SERVER_URL}/api/subscriptions/create-checkout`,
    {
      method: "POST",
      body: JSON.stringify({ organizationId: orgId }),
    },
  );
};

const suspendOrganization = async (
  id: string,
  suspend: boolean,
): Promise<Organization> => {
  return apiFetch<Organization>(
    `${import.meta.env.VITE_SERVER_URL}/api/admin/organizations/${id}/suspend`,
    {
      method: "PATCH",
      body: JSON.stringify({ suspend }),
    },
  );
};

function AdminComponent() {
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  // Organizations query — auto-loads
  const {
    data: organizations = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin", "organizations"],
    queryFn: fetchOrganizations,
  });

  // Delete mutation
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
          toast.error(t("admin.cannotDeleteNonPendingOrganization") || error.message);
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
      const org = organizations.find((o) => o.id === orgId);
      toast.success(
        t("admin.redirectingToCheckout", {
          orgName: org?.name || t("admin.organization"),
        }),
      );
      window.location.href = data.checkoutUrl;
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("admin.failedToCreateCheckout"));
      }
    },
  });

  // Suspend mutation
  const suspendMutation = useMutation({
    mutationFn: ({ id, suspend }: { id: string; suspend: boolean }) =>
      suspendOrganization(id, suspend),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.suspend
          ? t("admin.organizationSuspendedSuccessfully")
          : t("admin.organizationUnsuspendedSuccessfully"),
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
      setSuspendTarget(null);
      setShowSuspendDialog(false);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("admin.failedToSuspendOrganization"));
      }
      setSuspendTarget(null);
      setShowSuspendDialog(false);
    },
  });

  // Dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null);

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [orgToEdit, setOrgToEdit] = useState<Organization | null>(null);

  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<Organization | null>(null);

  // Row action handlers (stable references via useCallback)
  const handleEdit = useCallback((org: Organization) => {
    setOrgToEdit(org);
    setShowEditDialog(true);
  }, []);

  const handleSuspend = useCallback((org: Organization) => {
    setSuspendTarget(org);
    setShowSuspendDialog(true);
  }, []);

  const handleDelete = useCallback((org: Organization) => {
    setOrgToDelete(org);
    setShowDeleteDialog(true);
  }, []);

  const handleSubscribe = useCallback(
    (org: Organization) => {
      subscribeMutation.mutate(org.id);
    },
    [subscribeMutation],
  );

  const handleSuspendConfirm = async () => {
    if (!suspendTarget) return;
    const isSuspended = suspendTarget.status === "SUSPENDED";
    await suspendMutation.mutateAsync({
      id: suspendTarget.id,
      suspend: !isSuspended,
    });
  };

  const handleDeleteConfirm = async () => {
    if (orgToDelete) {
      await deleteOrgMutation.mutateAsync(orgToDelete.id);
    }
  };

  if (isSessionPending || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (error) {
    toast.error(t("admin.errorLoadingOrganizations", { message: (error as Error).message }));
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("admin.manageOrganizations")}</h1>
          <p className="text-muted-foreground">
            {t("admin.welcomeAdmin", { name: session.user.name })}
          </p>
        </div>
        <CreateOrganizationDialog
          onSuccess={() =>
            queryClient.invalidateQueries({
              queryKey: ["admin", "organizations"],
            })
          }
        />
      </div>

      {/* Organizations Table */}
      <OrganizationTable
        data={organizations}
        isLoading={isLoading}
        onEdit={handleEdit}
        onSuspend={handleSuspend}
        onDelete={handleDelete}
        onSubscribe={handleSubscribe}
      />

      {/* Edit Dialog */}
      <EditOrganizationDialog
        org={orgToEdit}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={() =>
          queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] })
        }
      />

      {/* Suspend / Unsuspend Confirmation */}
      <AlertDialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {suspendTarget?.status === "SUSPENDED"
                ? t("admin.unsuspendConfirmTitle")
                : t("admin.suspendConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {suspendTarget?.status === "SUSPENDED"
                ? t("admin.unsuspendConfirmDescription", {
                    name: suspendTarget?.name,
                  })
                : t("admin.suspendConfirmDescription", {
                    name: suspendTarget?.name,
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setSuspendTarget(null);
                setShowSuspendDialog(false);
              }}
            >
              {t("common.cancel") || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSuspendConfirm}
              disabled={suspendMutation.isPending}
            >
              {suspendMutation.isPending
                ? "..."
                : suspendTarget?.status === "SUSPENDED"
                  ? t("admin.unsuspendOrganization")
                  : t("admin.suspendOrganization")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.deleteOrganization")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.areYouSureDeleteOrganization")}
              {orgToDelete && (
                <div className="mt-2 text-foreground">
                  <strong>{t("admin.organization")}:</strong> {orgToDelete.name}
                  <br />
                  <strong>{t("admin.slugLabel")}:</strong> {orgToDelete.slug}
                  {orgToDelete.domain && (
                    <>
                      <br />
                      <strong>{t("admin.domainLabel")}:</strong>{" "}
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
