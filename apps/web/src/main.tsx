import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import ReactDOM from "react-dom/client";
import React from "react";
import Loader from "./components/loader";
import { routeTree } from "./routeTree.gen";

import * as Sentry from "@sentry/react";
import "./i18n";

// Validate routeTree
console.log("🔍 Router setup:", {
  routeTreeExists: !!routeTree,
  routeTreeType: typeof routeTree,
  routeTreeKeys: routeTree ? Object.keys(routeTree) : [],
});

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPendingComponent: () => <Loader />,
  context: {},
});

console.log("✅ Router created:", {
  routerExists: !!router,
  routerState: router.state.status,
});

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
const isDev = import.meta.env.DEV;

// Debug logging
console.log("🚀 App Initialization:", {
  env: import.meta.env.MODE,
  dev: isDev,
  sentryDsn: sentryDsn ? "✅ Set" : "❌ Not set",
  serverUrl: import.meta.env.VITE_SERVER_URL || "❌ Not set",
  environment: import.meta.env.VITE_ENVIRONMENT || "not set",
  release: import.meta.env.VITE_SENTRY_RELEASE || "not set",
  currentUrl: window.location.href,
  pathname: window.location.pathname,
  sentryEnabled: !isDev && !!sentryDsn,
});

// Only initialize Sentry in production
if (sentryDsn && !isDev) {
  // Add breadcrumb for app initialization
  Sentry.addBreadcrumb({
    category: "app",
    message: "App initialization started",
    level: "info",
    data: {
      env: import.meta.env.MODE,
      serverUrl: import.meta.env.VITE_SERVER_URL,
      pathname: window.location.pathname,
    },
  });

  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.VITE_ENVIRONMENT ?? "production",
    release: import.meta.env.VITE_SENTRY_RELEASE,
    debug: import.meta.env.DEV, // Only enable debug in development
    // Use tunnel to bypass ad blockers
    // In production, use absolute URL to API server since web and API are on different subdomains
    // In development, use full URL since web and server are on different ports
    tunnel: (() => {
      // Check if we have VITE_SERVER_URL set (build-time variable) - this is the preferred method
      if (import.meta.env.VITE_SERVER_URL) {
        return `${import.meta.env.VITE_SERVER_URL}/api/sentry-tunnel`;
      }
      // In dev mode (when running vite dev), use localhost
      if (import.meta.env.DEV || import.meta.env.MODE === "development") {
        return "http://localhost:3000/api/sentry-tunnel";
      }
      // Fallback: use relative path (won't work across subdomains, but better than nothing)
      // This should not happen if VITE_SERVER_URL is properly set during build
      console.warn(
        "⚠️ VITE_SERVER_URL not set - Sentry tunnel may not work correctly"
      );
      return "/api/sentry-tunnel";
    })(),
    // Disable tracing in development to avoid HMR infinite loops
    tracesSampleRate: isDev ? 0 : 1.0,
    tracePropagationTargets: [
      "localhost",
      /^https:\/\/api\.appointer\.hu\/api/,
    ],
    integrations: [
      // Capture console errors and warnings
      Sentry.captureConsoleIntegration({
        levels: ["error", "warn"],
      }),
      // Add browser tracing in production only
      ...(isDev
        ? []
        : [
            Sentry.browserTracingIntegration({
              enableInp: true,
              enableLongTask: false,
              traceFetch: false,
              traceXHR: false,
              instrumentPageLoad: true,
              instrumentNavigation: true,
            }),
          ]),
    ],
    // Filter out expected API errors that are already logged on the server
    beforeSend(event, hint) {
      // Check if this is an error from a failed API request
      const error = hint.originalException;
      if (error instanceof Error) {
        // Filter out errors that are expected API failures (these are already logged on server)
        // These errors are handled by React Query's onError handler and don't need to be in Sentry
        const expectedApiErrors = [
          "Failed to create provider",
          "Failed to delete provider",
          "Failed to load",
          "Failed to fetch",
        ];

        if (expectedApiErrors.some((msg) => error.message.includes(msg))) {
          // This is an expected API error that's already logged on the server
          // Don't send it to Sentry web project
          return null;
        }
      }

      // Add additional context to all errors
      event.tags = {
        ...event.tags,
        environment: import.meta.env.VITE_ENVIRONMENT || "unknown",
        url: window.location.href,
      };

      return event;
    },
  });
}

// Create a QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const AppRoot = () => {
  // Debug: Check router before rendering
  console.log("🔍 AppRoot rendering, router state:", {
    routerExists: !!router,
    routerStatus: router?.state?.status,
    routerIsLoading: router?.state?.isLoading,
    routerMatches: router?.state?.matches?.length || 0,
  });

  if (!router) {
    console.error("❌ CRITICAL: Router is null/undefined!");
    return (
      <div style={{ padding: "20px", backgroundColor: "red", color: "white" }}>
        Router is null!
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {import.meta.env.DEV && (
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-left"
        />
      )}
    </QueryClientProvider>
  );
};

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("app");

if (!rootElement) {
  const error = new Error("Root element '#app' not found in DOM");
  console.error("❌", error);
  if (sentryDsn && !isDev) {
    Sentry.captureException(error);
  }
  throw error;
}

console.log("✅ Root element found:", rootElement);

if (!rootElement.innerHTML) {
  console.log("🚀 Rendering React app...");
  const root = ReactDOM.createRoot(rootElement);

  // Track route changes with Sentry (using periodic check instead of subscribe)
  if (sentryDsn && !isDev) {
    let lastPathname = router.state.location?.pathname;
    setInterval(() => {
      const currentPathname = router.state.location?.pathname;
      if (currentPathname && currentPathname !== lastPathname) {
        Sentry.addBreadcrumb({
          category: "navigation",
          message: `Navigating to ${currentPathname}`,
          level: "info",
          data: {
            pathname: currentPathname,
          },
        });
        lastPathname = currentPathname;
      }
    }, 1000);
  }

  const content =
    sentryDsn && !isDev ? (
      <Sentry.ErrorBoundary
        fallback={({ error }) => (
          <div className="p-6 text-center">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-muted-foreground">
              Our team has been notified. Please refresh the page.
            </p>
            {import.meta.env.DEV && (
              <pre className="mt-4 overflow-x-auto rounded bg-muted p-4 text-left text-sm">
                {error && typeof error === "object" && "message" in error
                  ? (error as { message: string }).message
                  : String(error)}
              </pre>
            )}
          </div>
        )}
      >
        <AppRoot />
      </Sentry.ErrorBoundary>
    ) : (
      <AppRoot />
    );

  // Wrap render in try-catch to catch any errors
  try {
    root.render(content);
    console.log("✅ React app rendered successfully");
  } catch (error) {
    console.error("❌ CRITICAL ERROR during render:", error);
    if (sentryDsn && !isDev) {
      Sentry.captureException(error);
    }
  }

  // Immediate router state check
  setTimeout(() => {
    const currentState = router.state;
    console.log("🔍 Initial router state:", {
      status: currentState.status,
      isLoading: currentState.isLoading,
      pathname: currentState.location?.pathname,
      matches: currentState.matches?.length || 0,
    });
  }, 100);

  // Log router state changes periodically for debugging
  const logRouterState = () => {
    const state = router.state;
    console.log("🔍 Router state:", {
      status: state.status,
      isLoading: state.isLoading,
      pathname: state.location?.pathname,
      matches: state.matches?.length || 0,
    });

    if (state.status === "idle" && !state.isLoading) {
      console.log("✅ Router ready, current route:", state.location?.pathname);
    } else if (state.isLoading) {
      console.log("⏳ Router still loading...");
      // Check again in 1 second
      setTimeout(logRouterState, 1000);
    }
  };

  // Start logging router state
  setTimeout(logRouterState, 500);
} else {
  console.warn("⚠️ Root element already has content, skipping render");
}
