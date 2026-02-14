import { UserRole } from "@prisma/client";
import { Organization } from "@prisma/client";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      name?: string;
      role?: string; // Global role (if needed)
    };
    session?: {
      id: string;
      userId: string;
      expiresAt: Date;
    };
    organization?: {
      id: string;
      role: UserRole; // ✅ Per-organization role from Member
      organization?: Organization;
    };
    organizationId?: string; // Legacy - kept for backward compatibility
    provider?: any; // Provider entity
  }
}
