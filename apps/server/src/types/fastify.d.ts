import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user?: any;
    session?: any;
    organizationId?: string;
    provider?: any;
    language?: "en" | "hu" | "de";
  }
  
  interface FastifyInstance {
    t(key: string, options?: { lng?: string; [key: string]: any }): string;
    ensureLanguageLoaded(lng: string): Promise<void>;
  }
}


