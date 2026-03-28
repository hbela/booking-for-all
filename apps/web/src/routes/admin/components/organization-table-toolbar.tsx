import type { Table } from "@tanstack/react-table";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Organization, OrganizationStatus } from "./organization-columns";

interface OrganizationTableToolbarProps {
  table: Table<Organization>;
}

const STATUS_OPTIONS: { value: OrganizationStatus; labelKey: string }[] = [
  { value: "PENDING", labelKey: "admin.pending" },
  { value: "SUBSCRIBED", labelKey: "admin.subscribed" },
  { value: "SUBSCRIPTION_DELETED", labelKey: "admin.subscriptionDeleted" },
  { value: "PAYMENT_FAILED", labelKey: "admin.paymentFailed" },
  { value: "SUSPENDED", labelKey: "admin.suspended" },
];

export function OrganizationTableToolbar({
  table,
}: OrganizationTableToolbarProps) {
  const { t } = useTranslation();
  const isFiltered = table.getState().columnFilters.length > 0;

  const selectedStatuses = (
    (table.getColumn("status")?.getFilterValue() as OrganizationStatus[]) ?? []
  );

  const toggleStatus = (status: OrganizationStatus) => {
    const current = selectedStatuses;
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    table.getColumn("status")?.setFilterValue(next.length > 0 ? next : undefined);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pb-4">
      <Input
        placeholder={t("admin.searchOrganizations")}
        value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
        onChange={(e) =>
          table.getColumn("name")?.setFilterValue(e.target.value)
        }
        className="h-8 w-64"
      />

      <div className="flex flex-wrap gap-1">
        {STATUS_OPTIONS.map(({ value, labelKey }) => {
          const active = selectedStatuses.includes(value);
          return (
            <button
              key={value}
              onClick={() => toggleStatus(value)}
              className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors cursor-pointer ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {t(labelKey)}
            </button>
          );
        })}
      </div>

      {isFiltered && (
        <Button
          variant="ghost"
          onClick={() => table.resetColumnFilters()}
          className="h-8 px-2 lg:px-3"
        >
          Reset
          <X className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
