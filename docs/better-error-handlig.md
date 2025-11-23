Here is a **production-grade, complete, clean, modern error handling system** for your **Fastify + React (TanStack Query) + Sentry** stack.

It includes:

### ✅ AppError class (typed business logic errors)

### ✅ Global Fastify error handler

### ✅ Zod validation error formatting

### ✅ Automatic Sentry logging

### ✅ Unified API response format

### ✅ React/TanStack Query error wrapper & nice messages

### ✅ fetch wrapper with typed errors

### ✅ Logger integration

---

# 🎯 1. `src/errors/AppError.ts`

A standard typed application error.

```ts
export class AppError extends Error {
  statusCode: number;
  code: string;
  isAppError = true;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;

    // Fix for Error subclass prototype issues
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
```

Examples:

```ts
throw new AppError("Email already exists", "USER_EXISTS", 409);
throw new AppError("Not authorized", "NOT_AUTHORIZED", 403);
```

---

# 🎯 2. Create a global error handler

`src/plugins/errorHandler.ts`

```ts
import { AppError } from "../errors/AppError";
import * as Sentry from "@sentry/node";

export function errorHandler(app) {
  app.setErrorHandler((error, request, reply) => {
    // Zod validation error
    if (error.name === "ZodError") {
      return reply.status(422).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        issues: error.issues,
      });
    }

    // Known business error thrown by AppError
    if (error.isAppError) {
      return reply.status(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    // Unexpected error — log to Sentry & server logs
    request.log.error(error);
    Sentry.captureException(error);

    return reply.status(500).send({
      success: false,
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
    });
  });
}
```

---

# 🎯 3. Register it in `app.ts`

```ts
import fastify from "fastify";
import { errorHandler } from "./plugins/errorHandler";
import * as Sentry from "@sentry/node";

const app = fastify({ logger: true });

// Sentry init
Sentry.init({
  dsn: process.env.SENTRY_DSN_SERVER,
  tracesSampleRate: 1.0,
});

errorHandler(app);

// register routes...
export default app;
```

---

# 🎯 4. Rewrite your route to use `AppError`

Remove all reply.status() business errors.

```ts
import { AppError } from "../../errors/AppError";

if (!member) {
  throw new AppError(
    "You are not a member of this organization",
    "NOT_ORG_MEMBER",
    403
  );
}

if (!hasSubscription) {
  throw new AppError(
    "Valid subscription required",
    "NO_SUBSCRIPTION",
    403
  );
}

if (existingUser) {
  throw new AppError(
    "User with this email already exists",
    "USER_EXISTS",
    409
  );
}
```

And remove the big try/catch (only keep small try around non-critical code like email).

---

# 🎯 5. Unified API response format

**Success responses:**

```json
{
  "success": true,
  "data": { ... }
}
```

**Handled errors:**

```json
{
  "success": false,
  "message": "User already exists",
  "code": "USER_EXISTS"
}
```

**Validation errors:**

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "issues": [...]
}
```

**Unhandled errors:**

```json
{
  "success": false,
  "code": "INTERNAL_ERROR",
  "message": "Something went wrong"
}
```

---

# 🎯 6. Create a frontend `apiFetch` wrapper

`src/lib/apiFetch.ts`

```ts
export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.message || "Request failed";
    const code = data?.code || "UNKNOWN_ERROR";
    throw new ApiError(message, code, res.status);
  }

  return data;
}
```

---

# 🎯 7. Update your React mutation to use the wrapper

```ts
const createProvider = (data) => {
  return apiFetch<{ tempPassword: string }>(
    `${import.meta.env.VITE_SERVER_URL}/api/owner/providers/create-user`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
};
```

---

# 🎯 8. Handle errors nicely in TanStack Query

```ts
const createProviderMutation = useMutation({
  mutationFn: createProvider,
  onSuccess: (data) => {
    toast.success(`Provider created: Temporary password ${data.tempPassword}`);
  },
  onError: (error) => {
    if (error instanceof ApiError) {
      toast.error(error.message);
    } else {
      toast.error("Unexpected error");
    }
  },
});
```

---

# 🎯 9. Optional: Add Sentry breadcrumbs for client errors

```ts
import * as Sentry from "@sentry/react";

onError: (error) => {
  Sentry.captureException(error);
  toast.error(error.message);
}
```

---

# ⭐ Final result — what you now have

### ✔️ Consistent error responses

### ✔️ Centralized server error handling

### ✔️ No giant try/catch in routes

### ✔️ Clean business logic

### ✔️ Automatic Sentry reporting

### ✔️ Clean client experience

### ✔️ Typed errors in both backend + frontend

### ✔️ Much easier debugging

---

# If you'd like, I can also generate:

✅ A folder structure for your Fastify project
✅ Logging middleware with pino prettifier
✅ Sentry performance traces
✅ Error helper: `assertOrThrow(condition, error)`
✅ Prebuilt `createUserService` isolated from the route

Just say: **“generate the full folder structure + services layer”**
