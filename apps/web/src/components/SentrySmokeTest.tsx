import { useEffect, useRef } from "react";
import * as Sentry from "@sentry/react";

export function SentrySmokeTest() {
  const hasSent = useRef(false);

  useEffect(() => {
    if (!hasSent.current) {
      hasSent.current = true;
      const error = new Error(
        `Manual Sentry smoke-test ${new Date().toISOString()}`
      );
      Sentry.captureException(error);
      console.log("Sentry production smoke test sent:", error.message);
    }
  }, []);

  return null;
}
