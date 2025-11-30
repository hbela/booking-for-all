// DISABLED: "Break The World" button is disabled
// import * as Sentry from "@sentry/react";

/**
 * Small dev-only button to intentionally trigger a Sentry error from the web app.
 * This lets you verify frontend error monitoring without editing code each time.
 */
export function SentryBreakButton() {
  // DISABLED: "Break The World" button is disabled
  // To re-enable, uncomment the code below
  /*
  // Only show in development to avoid exposing this in production UI.
  if (!import.meta.env.DEV) return null;

  const handleClick = () => {
    const error = new Error(
      `Sentry Break-the-world button clicked at ${new Date().toISOString()} - Environment: ${
        import.meta.env.VITE_ENVIRONMENT ?? "development"
      }`,
    );

    // Add a bit of context for easier filtering in Sentry
    Sentry.setContext("break_button", {
      source: "SentryBreakButton",
      environment: import.meta.env.VITE_ENVIRONMENT ?? "development",
      release: import.meta.env.VITE_SENTRY_RELEASE ?? "unknown",
    });

    // Throwing the error ensures it's picked up by the ErrorBoundary / global handlers
    // and behaves like a real unhandled error in the app.
    throw error;
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="fixed bottom-4 right-4 z-50 rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-red-700"
    >
      Break the world
    </button>
  );
  */

  return null;
}


