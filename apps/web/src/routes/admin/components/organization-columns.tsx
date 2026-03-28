import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

export type OrganizationStatus =
  | "PENDING"
  | "SUBSCRIBED"
  | "SUBSCRIPTION_DELETED"
  | "PAYMENT_FAILED"
  | "SUSPENDED";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  logo?: string | null;
  enabled: boolean;
  status: OrganizationStatus;
  createdAt: string;
}

const statusConfig: Record<
  OrganizationStatus,
  { labelKey: string; className: string }
> = {
  PENDING: {
    labelKey: "admin.pending",
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  },
  SUBSCRIBED: {
    labelKey: "admin.subscribed",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  SUBSCRIPTION_DELETED: {
    labelKey: "admin.subscriptionDeleted",
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
  PAYMENT_FAILED: {
    labelKey: "admin.paymentFailed",
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
  SUSPENDED: {
    labelKey: "admin.suspended",
    className:
      "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  },
};

export function createOrganizationColumns(
  t: TFunction,
  onEdit: (org: Organization) => void,
  onSuspend: (org: Organization) => void,
  onDelete: (org: Organization) => void,
  onSubscribe: (org: Organization) => void,
): ColumnDef<Organization>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {t("admin.organizationName")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("name")}</div>
      ),
    },
    {
      accessorKey: "slug",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {t("admin.slug")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs font-mono">
          {row.getValue("slug")}
        </span>
      ),
    },
    {
      accessorKey: "domain",
      header: t("admin.domainLabel"),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {row.getValue("domain") || "—"}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      filterFn: (row, id, value: OrganizationStatus[]) => {
        return value.includes(row.getValue(id));
      },
      cell: ({ row }) => {
        const status = row.getValue("status") as OrganizationStatus;
        const config = statusConfig[status] ?? statusConfig.PENDING;
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}
          >
            {t(config.labelKey)}
          </span>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {t("admin.createdAt")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue("createdAt"));
        return (
          <span className="text-muted-foreground text-sm">
            {date.toLocaleDateString()}
          </span>
        );
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const org = row.original;
        const isSuspended = org.status === "SUSPENDED";
        const isPending = org.status === "PENDING";

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(org)}>
                {t("admin.updateOrganization")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isPending && (
                <DropdownMenuItem onClick={() => onSubscribe(org)}>
                  {t("admin.subscribe")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onSuspend(org)}>
                {isSuspended
                  ? t("admin.unsuspendOrganization")
                  : t("admin.suspendOrganization")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(org)}
                disabled={!isPending}
                className="text-destructive focus:text-destructive"
              >
                {t("admin.deleteAction")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
