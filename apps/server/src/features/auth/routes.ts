import type { FastifyPluginAsync } from "fastify";
import { auth } from "@booking-for-all/auth";

const authRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/auth/signout
   *
   * Server-side sign-out via direct browser navigation (window.location.href).
   * This avoids cross-origin fetch/CORS complexities that can prevent the
   * Set-Cookie clearing header from being applied by the browser.
   *
   * Flow:
   * 1. Browser navigates here with session cookie attached automatically
   * 2. We forward the request to Better Auth's sign-out handler
   * 3. Better Auth deletes the session from DB and returns Set-Cookie: ...; Max-Age=0
   * 4. We forward the Set-Cookie header in the 302 redirect response
   * 5. Browser clears the cookie, then follows the redirect to /login
   */
  app.get("/signout", async (request, reply) => {
    try {
      const cfg = (app as any).config as any;
      const betterAuthUrl =
        cfg?.BETTER_AUTH_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000";

      // Forward all incoming headers (including Cookie) to Better Auth
      const headers = new Headers();
      Object.entries(request.headers).forEach(([key, value]) => {
        if (value) {
          headers.append(
            key,
            Array.isArray(value) ? value.join(", ") : value.toString()
          );
        }
      });

      // Call Better Auth sign-out as a POST (its required method)
      const response = await auth.handler(
        new Request(`${betterAuthUrl}/api/auth/sign-out`, {
          method: "POST",
          headers,
          body: JSON.stringify({}),
        })
      );

      // Forward all response headers (especially Set-Cookie) BEFORE the redirect
      response.headers.forEach((value: string, key: string) => {
        // Skip headers that would conflict with the redirect response
        if (
          key.toLowerCase() !== "content-length" &&
          key.toLowerCase() !== "content-type" &&
          key.toLowerCase() !== "transfer-encoding"
        ) {
          reply.header(key, value);
        }
      });

      app.log.info(`🔓 Sign-out: Better Auth responded with status ${response.status}`);
    } catch (error) {
      app.log.error(error, "🔓 Sign-out handler error — redirecting anyway");
    }

    // Redirect to frontend login page
    const cfg = (app as any).config as any;
    const frontendUrl =
      cfg?.FRONTEND_URL ||
      cfg?.CORS_ORIGIN ||
      process.env.FRONTEND_URL ||
      process.env.CORS_ORIGIN ||
      "http://localhost:3001";

    reply.redirect(frontendUrl, 302);
  });
};

export default authRoutes;
