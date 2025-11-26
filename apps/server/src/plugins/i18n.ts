import fp from "fastify-plugin";
import { initI18n, supportedLanguages } from "@booking-for-all/i18n";
import type { FastifyInstance, FastifyRequest } from "fastify";

export default fp(async (fastify: FastifyInstance) => {
  const i18n = await initI18n();

  fastify.decorate("t", (key: string, lng?: string) => {
    return i18n.t(key, { lng });
  });

  fastify.addHook("onRequest", async (request: FastifyRequest, reply) => {
    // Try to get language from cookie
    let lang: string | undefined;
    
    // Parse cookie header manually if @fastify/cookie is not registered
    const cookieHeader = request.headers.cookie;
    if (cookieHeader) {
      const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split("=");
        if (key && value) {
          acc[key] = decodeURIComponent(value);
        }
        return acc;
      }, {} as Record<string, string>);
      lang = cookies.lang;
    }
    
    // Fallback to Accept-Language header or default
    lang = lang ||
      request.headers["accept-language"]?.split(",")[0]?.split("-")[0] ||
      "en";

    if (!supportedLanguages.includes(lang as any)) lang = "en";
    request.language = lang as "en" | "hu" | "de";
  });
});

