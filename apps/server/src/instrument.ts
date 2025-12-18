import * as Sentry from "@sentry/node";

type SentryConfig = {
  SENTRY_DSN?: string;
  SENTRY_RELEASE?: string;
  NODE_ENV?: string;
};

export function instrument(config: SentryConfig) {
  const { SENTRY_DSN, SENTRY_RELEASE, NODE_ENV } = config;

  // Only initialize Sentry in production
  if (NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log(
      "[Sentry] Sentry is disabled in development mode.",
    );
    return;
  }

  if (!SENTRY_DSN) {
    // eslint-disable-next-line no-console
    console.warn(
      "[Sentry] SENTRY_DSN is not set for the server – Sentry will be disabled.",
    );
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: NODE_ENV,
    release: SENTRY_RELEASE,
    tracesSampleRate: 1.0,
    // Enable verbose logging in non-production to see why events might not be sent
    debug: NODE_ENV !== "production",
  });
}

export function captureException(error: Error) {
  // Only capture in production
  if (process.env.NODE_ENV !== "development") {
    Sentry.captureException(error);
  }
}

export function captureMessage(message: string) {
  // Only capture in production
  if (process.env.NODE_ENV !== "development") {
    Sentry.captureMessage(message);
  }
}
