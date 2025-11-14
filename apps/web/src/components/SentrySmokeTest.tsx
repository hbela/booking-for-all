import { useEffect, useRef } from "react";
import * as Sentry from "@sentry/react";

export function SentrySmokeTest() {
  const hasSent = useRef(false);

  useEffect(() => {
    if (!hasSent.current) {
      hasSent.current = true;
      const error = new Error(
        `Sentry smoke-test ${new Date().toISOString()} - Environment: ${
          import.meta.env.VITE_ENVIRONMENT ?? "production"
        }`
      );

      // Add context to the error
      Sentry.setContext("smoke_test", {
        timestamp: new Date().toISOString(),
        environment: import.meta.env.VITE_ENVIRONMENT ?? "production",
        release: import.meta.env.VITE_SENTRY_RELEASE ?? "unknown",
      });

      Sentry.captureException(error);
      console.log("✅ Sentry smoke test sent:", {
        message: error.message,
        environment: import.meta.env.VITE_ENVIRONMENT ?? "production",
        release: import.meta.env.VITE_SENTRY_RELEASE ?? "unknown",
      });
    }
  }, []);

  return null;
}
