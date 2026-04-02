import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/subscribe")({
  component: SubscribePage,
  head: () => ({
    meta: [
      { title: "Subscribe - Booking for All" },
      {
        name: "description",
        content:
          "Request the creation of your organization in the Booking for All system.",
      },
    ],
  }),
});

interface Plan {
  id: string;
  priceId: string | undefined;
  priceCents: number;
  currency: string;
  interval: string;
}

interface SubscribeRequestData {
  organizationName: string;
  ownerName: string;
  ownerEmail: string;
  description: string;
}

const fetchPlans = (): Promise<{ success: boolean; data: Plan[] }> =>
  apiFetch(`${import.meta.env.VITE_SERVER_URL}/api/subscriptions/plans`);

const sendSubscribeRequest = (data: SubscribeRequestData): Promise<{ success: boolean }> =>
  apiFetch(`${import.meta.env.VITE_SERVER_URL}/api/contact/subscribe-request`, {
    method: "POST",
    body: JSON.stringify(data),
  });

function SubscribePage() {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);

  const { data: plansData } = useQuery({
    queryKey: ["subscriptions", "plans"],
    queryFn: fetchPlans,
    staleTime: 1000 * 60 * 60, // 1 hour — prices rarely change
  });

  const plans = plansData?.data ?? [];

  const mutation = useMutation({
    mutationFn: sendSubscribeRequest,
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("errors.somethingWentWrong"));
      }
    },
  });

  const form = useForm({
    defaultValues: {
      organizationName: "",
      ownerName: "",
      ownerEmail: "",
      description: "",
    } as SubscribeRequestData,
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="flex justify-center mb-2">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle>{t("subscribe.successTitle")}</CardTitle>
            <CardDescription>{t("subscribe.successMessage")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      {/* Page header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">{t("subscribe.pageTitle")}</h1>
        <p className="text-muted-foreground">{t("subscribe.pageSubtitle")}</p>
      </div>

      {/* Pricing cards */}
      {plans.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">{t("subscribe.pricingTitle")}</h2>
          <div className="grid grid-cols-2 gap-4">
            {plans.map((plan) => (
              <Card key={plan.id} className="text-center">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {plan.interval === "month"
                      ? t("subscribe.monthly")
                      : t("subscribe.yearly")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">
                    ${(plan.priceCents / 100).toFixed(0)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {plan.interval === "month"
                      ? t("subscribe.perMonth")
                      : t("subscribe.perYear")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Request form */}
      <Card>
        <CardHeader>
          <CardTitle>{t("subscribe.pageTitle")}</CardTitle>
          <CardDescription>{t("subscribe.pageSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-5"
          >
            <form.Field
              name="organizationName"
              validators={{
                onChange: ({ value }) =>
                  !value || value.trim().length === 0
                    ? t("subscribe.requiredField")
                    : undefined,
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>{t("subscribe.organizationName")}</Label>
                  <Input
                    id={field.name}
                    placeholder={t("subscribe.organizationNamePlaceholder")}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    disabled={mutation.isPending}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field
              name="ownerName"
              validators={{
                onChange: ({ value }) =>
                  !value || value.trim().length === 0
                    ? t("subscribe.requiredField")
                    : undefined,
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>{t("subscribe.ownerName")}</Label>
                  <Input
                    id={field.name}
                    placeholder={t("subscribe.ownerNamePlaceholder")}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    disabled={mutation.isPending}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field
              name="ownerEmail"
              validators={{
                onChange: ({ value }) => {
                  if (!value || value.trim().length === 0) {
                    return t("subscribe.requiredField");
                  }
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    return t("subscribe.invalidEmail");
                  }
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>{t("subscribe.ownerEmail")}</Label>
                  <Input
                    id={field.name}
                    type="email"
                    placeholder={t("subscribe.ownerEmailPlaceholder")}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    disabled={mutation.isPending}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="description">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>{t("subscribe.description")}</Label>
                  <textarea
                    id={field.name}
                    placeholder={t("subscribe.descriptionPlaceholder")}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    disabled={mutation.isPending}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              )}
            </form.Field>

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? t("subscribe.submitting") : t("subscribe.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
