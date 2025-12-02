import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReactDOM from "react-dom/client";
import Loader from "./components/loader";
import { routeTree } from "./routeTree.gen";

import * as Sentry from "@sentry/react";
import "./i18n";

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPendingComponent: () => <Loader />,
  context: {},
});

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
console.log("Sentry DSN:", sentryDsn);

if (sentryDsn) {
  const isDev = import.meta.env.DEV;

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
      if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
        return "http://localhost:3000/api/sentry-tunnel";
      }
      // Fallback: use relative path (won't work across subdomains, but better than nothing)
      // This should not happen if VITE_SERVER_URL is properly set during build
      console.warn('⚠️ VITE_SERVER_URL not set - Sentry tunnel may not work correctly');
      return "/api/sentry-tunnel";
    })(),
    // Disable tracing in development to avoid HMR infinite loops
    tracesSampleRate: isDev ? 0 : 1.0,
    tracePropagationTargets: [
      "localhost",
      /^https:\/\/api\.appointer\.hu\/api/,
    ],
    integrations: isDev
      ? [
          // Basic integrations for error tracking (no tracing to avoid HMR issues)
        ]
      : [
          Sentry.browserTracingIntegration({
            enableInp: true,
            enableLongTask: false,
            traceFetch: false,
            traceXHR: false,
            instrumentPageLoad: true,
            instrumentNavigation: true,
          }),
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
        
        if (expectedApiErrors.some(msg => error.message.includes(msg))) {
          // This is an expected API error that's already logged on the server
          // Don't send it to Sentry web project
          return null;
        }
      }
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

const AppRoot = () => (
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>
);

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("app");

if (!rootElement) {
  throw new Error("Root element not found");
}

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  const content = sentryDsn ? (
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

  root.render(content);
}
