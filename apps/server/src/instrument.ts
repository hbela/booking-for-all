import * as Sentry from "@sentry/node";

export function instrument() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0,
  });
}

export function captureException(error: Error) {
  Sentry.captureException(error);
}

export function captureMessage(message: string) {
  Sentry.captureMessage(message);
}
