import type { FastifyPluginAsync } from "fastify";

const authRoutes: FastifyPluginAsync = async (app) => {
  // Password-related endpoints removed - only Google Sign-In is supported
  // Sign-up and sign-in are handled by Better Auth directly
  // Organization membership is handled via /api/members/join endpoint
};

export default authRoutes;
