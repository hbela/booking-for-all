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

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.VITE_ENVIRONMENT ?? "production",
    tracesSampleRate: 1.0,
    integrations: [Sentry.browserTracingIntegration()],
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
