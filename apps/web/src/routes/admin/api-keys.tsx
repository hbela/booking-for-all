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
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Trash2, Key, Calendar, User } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/apiFetch";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/admin/api-keys")({
  component: ApiKeysComponent,
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

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  metadata: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  expiresAt: string | null;
  lastRequest: string | null;
  enabled: boolean;
  remaining: number | null;
  requestCount: number;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
}

interface GenerateKeyData {
  organizationId: string;
  name: string;
  expiresInDays?: number;
}

// API functions
const fetchApiKeys = async (): Promise<ApiKey[]> => {
  return apiFetch<ApiKey[]>(
    `${import.meta.env.VITE_SERVER_URL}/api/admin/api-keys`
  );
};

const fetchOrganizations = async (): Promise<Organization[]> => {
  return apiFetch<Organization[]>(
    `${import.meta.env.VITE_SERVER_URL}/api/admin/organizations`
  );
};

const generateApiKey = async (
  data: GenerateKeyData
): Promise<{ key: string }> => {
  const result = await apiFetch<{ key: string }>(
    `${import.meta.env.VITE_SERVER_URL}/api/admin/api-keys/generate`,
    {
      method: "POST",
      body: JSON.stringify({
        organizationId: data.organizationId,
        name: data.name,
        expiresInDays: data.expiresInDays || undefined,
      }),
    }
  );
  return result;
};

const revokeApiKey = async (keyId: string): Promise<void> => {
  await apiFetch(
    `${import.meta.env.VITE_SERVER_URL}/api/admin/api-keys/${keyId}`,
    {
      method: "DELETE",
    }
  );
};

function ApiKeysComponent() {
  const { session } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showGeneratedKey, setShowGeneratedKey] = useState(false);

  // Query for API keys
  const {
    data: apiKeys = [],
    isLoading: isLoadingKeys,
    error: keysError,
    refetch: refetchKeys,
  } = useQuery({
    queryKey: ["admin", "api-keys"],
    queryFn: fetchApiKeys,
  });

  // Query for organizations
  const {
    data: organizations = [],
    isLoading: isLoadingOrgs,
    error: orgsError,
  } = useQuery({
    queryKey: ["admin", "organizations"],
    queryFn: fetchOrganizations,
  });

  // Generate API key mutation
  const generateKeyMutation = useMutation({
    mutationFn: generateApiKey,
    onSuccess: (data) => {
      setGeneratedKey(data.key);
      setShowGeneratedKey(true);
      form.reset();
      toast.success(t("admin.apiKeyGeneratedSuccessfully"));
      queryClient.invalidateQueries({ queryKey: ["admin", "api-keys"] });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("admin.failedToGenerateApiKey"));
      }
    },
  });

  // Revoke API key mutation
  const revokeKeyMutation = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => {
      toast.success(t("admin.apiKeyRevokedSuccessfully"));
      queryClient.invalidateQueries({ queryKey: ["admin", "api-keys"] });
    },
    onError: () => {
      toast.error(t("admin.failedToRevokeApiKey"));
    },
  });

  // TanStack Form for generate API key
  const form = useForm({
    defaultValues: {
      organizationId: "",
      name: "",
      expiresInDays: "",
    } as {
      organizationId: string;
      name: string;
      expiresInDays: string;
    },
    onSubmit: async ({ value }) => {
      await generateKeyMutation.mutateAsync({
        organizationId: value.organizationId,
        name: value.name,
        expiresInDays: value.expiresInDays
          ? parseInt(value.expiresInDays)
          : undefined,
      });
    },
  });

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("admin.copiedToClipboard"));
    } catch (err) {
      toast.error(t("admin.failedToCopyToClipboard"));
    }
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return t("admin.never");
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Check if key is expired
  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const handleRevokeKey = async (keyId: string) => {
    if (
      !confirm(t("admin.areYouSureRevokeApiKey"))
    ) {
      return;
    }
    await revokeKeyMutation.mutateAsync(keyId);
  };

  const isLoadingAny =
    isLoadingKeys ||
    isLoadingOrgs ||
    generateKeyMutation.isPending ||
    revokeKeyMutation.isPending;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">{t("admin.apiKeyManagement")}</h1>
        <p className="text-muted-foreground">
          {t("admin.manageApiKeysForIntegration")}
        </p>
      </div>

      {/* Generated Key Modal */}
      {showGeneratedKey && generatedKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                {t("admin.apiKeyGenerated")}
              </CardTitle>
              <CardDescription>
                {t("admin.copyKeyNow")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-muted rounded-lg font-mono text-sm break-all">
                {generatedKey}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => copyToClipboard(generatedKey)}
                  className="flex-1"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {t("admin.copyKey")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowGeneratedKey(false);
                    setGeneratedKey(null);
                  }}
                >
                  {t("admin.close")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6">
        {/* Generate New API Key */}
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.generateNewApiKey")}</CardTitle>
            <CardDescription>
              {t("admin.createNewApiKey")}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <form.Field
                  name="organizationId"
                  validators={{
                    onChange: ({ value }) => {
                      if (!value || value.trim().length === 0) {
                        return t("admin.organizationRequired");
                      }
                      return undefined;
                    },
                  }}
                >
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>{t("admin.organization")}</Label>
                      <Select
                        value={field.state.value}
                        onValueChange={(value) => field.handleChange(value)}
                        disabled={generateKeyMutation.isPending}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("admin.selectOrganization")} />
                        </SelectTrigger>
                        <SelectContent>
                          {organizations.map((org) => (
                            <SelectItem key={org.id} value={org.id}>
                              {org.name} {!org.enabled && t("admin.disabled")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {field.state.meta.errors.length > 0 && (
                        <p className="text-sm text-red-500">
                          {field.state.meta.errors[0]}
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>

                <form.Field
                  name="name"
                  validators={{
                    onChange: ({ value }) => {
                      if (!value || value.trim().length === 0) {
                        return t("admin.keyNameRequired");
                      }
                      return undefined;
                    },
                  }}
                >
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>{t("admin.keyName")}</Label>
                      <Input
                        id={field.name}
                        placeholder={t("admin.keyNamePlaceholder")}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        disabled={generateKeyMutation.isPending}
                      />
                      {field.state.meta.errors.length > 0 && (
                        <p className="text-sm text-red-500">
                          {field.state.meta.errors[0]}
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>
              </div>

              <form.Field
                name="expiresInDays"
                validators={{
                  onChange: ({ value }) => {
                    if (value && value.trim().length > 0) {
                      const days = parseInt(value);
                      if (isNaN(days) || days < 1) {
                        return t("admin.expirationDaysInvalid");
                      }
                    }
                    return undefined;
                  },
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>
                      {t("admin.expiresInDays")}
                    </Label>
                    <Input
                      id={field.name}
                      type="number"
                      placeholder={t("admin.expiresInDaysPlaceholder")}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      disabled={generateKeyMutation.isPending}
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
                disabled={generateKeyMutation.isPending}
                className="w-full"
              >
                {generateKeyMutation.isPending
                  ? t("admin.generating")
                  : t("admin.generateApiKey")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* API Keys List */}
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.apiKeys")}</CardTitle>
            <CardDescription>{t("admin.manageExistingApiKeys")}</CardDescription>
            <Button
              onClick={() => refetchKeys()}
              disabled={isLoadingKeys}
              variant="outline"
              className="mt-2"
            >
              {isLoadingKeys ? t("admin.loading") : t("admin.refresh")}
            </Button>
          </CardHeader>
          <CardContent>
            {keysError && (
              <p className="text-sm text-red-500 mb-4">
                {t("admin.errorLoadingApiKeys", { message: keysError.message })}
              </p>
            )}
            {apiKeys.length === 0 && !isLoadingKeys ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("admin.noApiKeysFound")}
              </p>
            ) : (
              <div className="space-y-4">
                {apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Key className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{key.name}</h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              isExpired(key.expiresAt)
                                ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                : key.enabled
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                            }`}
                          >
                            {isExpired(key.expiresAt)
                              ? t("admin.expired")
                              : key.enabled
                              ? t("admin.active")
                              : t("admin.inactive")}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t("admin.organizationLabel")}{" "}
                          {(() => {
                            try {
                              const metadata = JSON.parse(key.metadata || "{}");
                              const orgId = metadata.organizationId;
                              return (
                                organizations.find((org) => org.id === orgId)
                                  ?.name ||
                                orgId ||
                                t("admin.unknown")
                              );
                            } catch {
                              return t("admin.unknown");
                            }
                          })()}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {t("admin.createdBy", { name: key.user.name })}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {t("admin.created", { date: formatDate(key.createdAt) })}
                          </div>
                          {key.lastRequest && (
                            <div className="flex items-center gap-1">
                              {t("admin.lastUsed", { date: formatDate(key.lastRequest) })}
                            </div>
                          )}
                          {key.expiresAt && (
                            <div className="flex items-center gap-1">
                              {t("admin.expires", { date: formatDate(key.expiresAt) })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRevokeKey(key.id)}
                        disabled={isLoadingAny}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {t("admin.revoke")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
