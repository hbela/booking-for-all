import * as Sentry from "@sentry/node";

type SentryConfig = {
  SENTRY_DSN?: string;
  SENTRY_RELEASE?: string;
  NODE_ENV?: string;
};

export function instrument(config: SentryConfig) {
  const { SENTRY_DSN, SENTRY_RELEASE, NODE_ENV } = config;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: NODE_ENV,
    release: SENTRY_RELEASE,
    tracesSampleRate: 1.0,
    // Enable verbose logging in non-production to see why events might not be sent
    debug: NODE_ENV !== "production",
  });

  if (!SENTRY_DSN) {
    // eslint-disable-next-line no-console
    console.warn(
      "[Sentry] SENTRY_DSN is not set for the server – Sentry will be disabled.",
    );
  }
}

export function captureException(error: Error) {
  Sentry.captureException(error);
}

export function captureMessage(message: string) {
  Sentry.captureMessage(message);
}
