import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/")({
  component: OwnerComponent,
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
        const response = await fetch(
          `${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}/api/organizations/my-organizations`,
          {
            credentials: "include",
          }
        );
        
        if (response.ok) {
          const organizations = await response.json();
          if (!organizations || organizations.length === 0) {
            // Owner has no organizations - redirect to external app
            throw redirect({
              to: "/login",
              search: {
                error: "Access denied: You must access the system through your organization's website.",
              },
            });
          }
        }
      } catch (error) {
        console.error("Error checking organization membership:", error);
        // If check fails, still allow access but log the error
      }
    }

    return { session };
  },
});

function OwnerComponent() {
  const { session } = Route.useRouteContext();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [showSubscriptionDetails, setShowSubscriptionDetails] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [syncingOrgId, setSyncingOrgId] = useState<string | null>(null);

  // Load user's organizations and subscriptions
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load organizations
        const orgResponse = await fetch(
          `${
            import.meta.env.VITE_SERVER_URL
          }/api/organizations/my-organizations`,
          {
            credentials: "include",
          }
        );
        if (orgResponse.ok) {
          const orgData = await orgResponse.json();
          setOrganizations(orgData);
        }

        // Load subscriptions
        const subResponse = await fetch(
          `${
            import.meta.env.VITE_SERVER_URL
          }/api/subscriptions/my-subscriptions`,
          {
            credentials: "include",
          }
        );
        if (subResponse.ok) {
          const subData = await subResponse.json();
          setSubscriptions(subData);
        }
      } catch (err) {
        console.error("Error loading data:", err);
        toast.error("Error loading data");
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Check if returning from successful subscription
    const urlParams = new URLSearchParams(window.location.search);
    const subscribed = urlParams.get("subscribed");

    if (subscribed === "true") {
      toast.success(
        "🎉 Payment successful! Your organization is being activated...",
        {
          duration: 5000,
        }
      );

      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);

      // Reload organizations after a delay to get updated status
      setTimeout(() => {
        loadData();
      }, 2000);
    }
  }, []);

  // Helper functions
  const formatCurrency = (cents: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getSubscriptionForOrg = (orgId: string) => {
    return subscriptions.find((sub) => sub.organizationId === orgId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "expired":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const capitalizeStatus = (status: string) => {
    if (!status) return status;
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  };

  // Create checkout and redirect to Polar
  const handleSubscribe = async (orgId: string, orgName: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/subscriptions/create-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ organizationId: orgId }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success(`Redirecting to checkout for ${orgName}...`);

        // Redirect to Polar checkout
        window.location.href = data.checkoutUrl;
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create checkout");
      }
    } catch (err) {
      toast.error("Error creating checkout");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSubscriptionDetails = (orgId: string) => {
    setShowSubscriptionDetails(
      showSubscriptionDetails === orgId ? null : orgId
    );
  };

  // Sync subscription from Polar API
  const handleSyncSubscription = async (orgId: string, orgName: string) => {
    setSyncingOrgId(orgId);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/subscriptions/sync-from-polar`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ organizationId: orgId }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success(`Subscription synced successfully for ${orgName}!`);
        
        // Reload data to show updated subscription
        setTimeout(() => {
          const loadData = async () => {
            try {
              const orgResponse = await fetch(
                `${import.meta.env.VITE_SERVER_URL}/api/organizations/my-organizations`,
                { credentials: "include" }
              );
              if (orgResponse.ok) {
                const orgData = await orgResponse.json();
                setOrganizations(orgData);
              }

              const subResponse = await fetch(
                `${import.meta.env.VITE_SERVER_URL}/api/subscriptions/my-subscriptions`,
                { credentials: "include" }
              );
              if (subResponse.ok) {
                const subData = await subResponse.json();
                setSubscriptions(subData);
              }
            } catch (err) {
              console.error("Error reloading data:", err);
            }
          };
          loadData();
        }, 1000);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to sync subscription");
      }
    } catch (err) {
      toast.error("Error syncing subscription");
      console.error(err);
    } finally {
      setSyncingOrgId(null);
    }
  };

  // User role is OWNER, all their organizations are shown
  const ownedOrganizations = organizations;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Organization Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome, {session.data?.user.name} (Organization Owner)
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              My Organizations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {ownedOrganizations.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {subscriptions.filter((s) => s.status === "active").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {subscriptions.reduce(
                (acc, s) => acc + (s.payments?.length || 0),
                0
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Organizations */}
      <Card>
        <CardHeader>
          <CardTitle>My Organizations & Subscriptions</CardTitle>
          <CardDescription>
            Manage your organizations and billing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <div className="h-24 bg-muted animate-pulse rounded-lg" />
              <div className="h-24 bg-muted animate-pulse rounded-lg" />
            </div>
          ) : ownedOrganizations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                You don't own any organizations yet.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {ownedOrganizations.map((org) => {
                const subscription = getSubscriptionForOrg(org.id);
                const isExpanded = showSubscriptionDetails === org.id;

                return (
                  <div
                    key={org.id}
                    className="rounded-lg border bg-card overflow-hidden"
                  >
                    {/* Organization Header */}
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          {org.logo && (
                            <img
                              src={org.logo}
                              alt={org.name}
                              className="h-14 w-14 rounded-lg object-cover"
                            />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-semibold">
                                {org.name}
                              </h3>
                              <span className={`text-sm font-medium ${
                                org.enabled 
                                  ? "text-green-600 dark:text-green-400" 
                                  : "text-yellow-600 dark:text-yellow-400"
                              }`}>
                                {org.enabled ? "Active" : "Pending"}
                              </span>
                            </div>

                            {/* Subscription Info */}
                            {subscription && (
                              <div className="mt-3 space-y-1">
                                <div className="flex items-center gap-4 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">
                                      Plan:
                                    </span>{" "}
                                    <span className="font-medium">
                                      {subscription.product?.name}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      Price:
                                    </span>{" "}
                                    <span className="font-medium">
                                      {formatCurrency(
                                        subscription.product?.priceCents,
                                        subscription.product?.currency
                                      )}
                                      {subscription.product?.interval &&
                                        `/${subscription.product.interval}`}
                                    </span>
                                  </div>
                                  {subscription.currentPeriodEnd && (
                                    <div>
                                      <span className="text-muted-foreground">
                                        Next billing:
                                      </span>{" "}
                                      <span className="font-medium">
                                        {formatDate(
                                          subscription.currentPeriodEnd
                                        )}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {!org.enabled && !subscription && (
                              <p className="text-xs text-muted-foreground mt-2">
                                ⚠️ This organization requires a subscription to
                                be activated
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          {!org.enabled && !subscription && (
                            <Button
                              onClick={() => handleSubscribe(org.id, org.name)}
                              disabled={loading}
                            >
                              Subscribe Now
                            </Button>
                          )}
                          {!org.enabled && (
                            <Button
                              variant="outline"
                              onClick={() => handleSyncSubscription(org.id, org.name)}
                              disabled={syncingOrgId === org.id || loading}
                            >
                              {syncingOrgId === org.id ? "Syncing..." : "Sync Subscription"}
                            </Button>
                          )}
                          {subscription && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleSubscriptionDetails(org.id)}
                            >
                              {isExpanded ? "Hide Details" : "View Details"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Subscription Details (Expandable) */}
                    {isExpanded && subscription && (
                      <div className="border-t bg-muted/50 p-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          {/* Subscription Details */}
                          <div>
                            <h4 className="font-semibold mb-3">
                              Subscription Details
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Status:
                                </span>
                                <span className="font-medium capitalize">
                                  {subscription.status}
                                </span>
                              </div>
                              {subscription.currentPeriodStart && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Period Start:
                                  </span>
                                  <span className="font-medium">
                                    {formatDate(
                                      subscription.currentPeriodStart
                                    )}
                                  </span>
                                </div>
                              )}
                              {subscription.currentPeriodEnd && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Period End:
                                  </span>
                                  <span className="font-medium">
                                    {formatDate(subscription.currentPeriodEnd)}
                                  </span>
                                </div>
                              )}
                              {subscription.cancelledAt && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Cancelled:
                                  </span>
                                  <span className="font-medium text-red-600">
                                    {formatDate(subscription.cancelledAt)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Payment History */}
                          <div>
                            <h4 className="font-semibold mb-3">
                              Recent Payments
                            </h4>
                            {subscription.payments &&
                            subscription.payments.length > 0 ? (
                              <div className="space-y-2">
                                {subscription.payments.map((payment: any) => (
                                  <div
                                    key={payment.id}
                                    className="flex justify-between items-center text-sm bg-background rounded p-2"
                                  >
                                    <div>
                                      <div className="font-medium">
                                        {formatCurrency(
                                          payment.amount,
                                          payment.currency
                                        )}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {formatDate(payment.createdAt)}
                                      </div>
                                    </div>
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                        payment.status === "succeeded"
                                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                          : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                                      }`}
                                    >
                                      {payment.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                No payment history yet
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
