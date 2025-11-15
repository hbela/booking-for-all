import { useEffect } from "react";
import * as Sentry from "@sentry/react";

// Use sessionStorage to ensure it only fires once per browser session
const SENTRY_SMOKE_TEST_KEY = "sentry_smoke_test_sent";

export function SentrySmokeTest() {
  useEffect(() => {
    // Only send once per browser session (survives page reloads)
    // To test again, clear sessionStorage: sessionStorage.removeItem('sentry_smoke_test_sent')
    if (sessionStorage.getItem(SENTRY_SMOKE_TEST_KEY) === "true") {
      console.log(
        "⏭️ Sentry smoke test already sent in this session. Clear sessionStorage to test again."
      );
      return;
    }

    sessionStorage.setItem(SENTRY_SMOKE_TEST_KEY, "true");

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

    console.log("🚀 About to send Sentry smoke test...");
    try {
      Sentry.captureException(error);
      console.log("✅ Sentry.captureException() called successfully");
      console.log("✅ Sentry smoke test sent:", {
        message: error.message,
        environment: import.meta.env.VITE_ENVIRONMENT ?? "production",
        release: import.meta.env.VITE_SENTRY_RELEASE ?? "unknown",
      });

      // Force flush to ensure event is sent immediately
      Sentry.flush(2000).then(() => {
        console.log("✅ Sentry flush completed - event should be sent");
      });
    } catch (err) {
      console.error("❌ Error sending to Sentry:", err);
    }
  }, []);

  return null;
}
