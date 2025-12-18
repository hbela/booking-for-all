import type { FastifyPluginAsync } from "fastify";

const apiRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => {
    return {
      name: "Booking For All API",
      version: "1.0.0",
      status: "operational",
      endpoints: {
        health: "/health",
        auth: "/api/auth",
        organizations: "/api/organizations",
        admin: "/api/admin",
        owner: "/api/owner",
        provider: "/api/provider",
        providers: "/api/providers",
        departments: "/api/departments",
        bookings: "/api/bookings",
        events: "/api/events",
        client: "/api/client",
        external: "/api/external",
        members: "/api/members",
        subscriptions: "/api/subscriptions",
        webhooks: "/api/webhooks",
        voiceAgent: "/api/voice-agent",
        testEmail: "/api/test-email",
        sendmail: "/api/sendmail",
      },
      documentation: "/docs",
      timestamp: new Date().toISOString(),
    };
  });
};

export default apiRoutes;
