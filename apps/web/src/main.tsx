import { RouterProvider, createRouter } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import Loader from "./components/loader";
import { routeTree } from "./routeTree.gen";

import * as Sentry from "@sentry/react";

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
    tunnel: import.meta.env.DEV
      ? "http://localhost:3000/api/sentry-tunnel"
      : import.meta.env.VITE_SERVER_URL
      ? `${import.meta.env.VITE_SERVER_URL}/api/sentry-tunnel`
      : "/api/sentry-tunnel", // Fallback to relative if VITE_SERVER_URL not set
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
  });
}

const AppRoot = () => <RouterProvider router={router} />;

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
