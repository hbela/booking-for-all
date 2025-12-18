import fp from "fastify-plugin";
import { initI18n, supportedLanguages } from "@booking-for-all/i18n";
import type { FastifyInstance, FastifyRequest } from "fastify";

export default fp(async (fastify: FastifyInstance) => {
  const i18n = await initI18n();
  
  // Track which languages have been loaded to avoid duplicate loads
  const loadedLanguages = new Set<string>(["en"]); // "en" is preloaded
  // Track loading promises to avoid duplicate concurrent loads
  const loadingPromises = new Map<string, Promise<void>>();

  // Synchronous translation function (for most use cases)
  // Languages are loaded on-demand in the background
  fastify.decorate("t", (key: string, options?: { lng?: string; [key: string]: any }) => {
    // If a specific language is requested, ensure it's loaded
    if (options?.lng && !loadedLanguages.has(options.lng)) {
      // Check if language is supported before loading
      if (supportedLanguages.includes(options.lng as any)) {
        // Check if already loading
        let loadPromise = loadingPromises.get(options.lng);
        if (!loadPromise) {
          // Start loading in background (fire and forget)
          loadPromise = i18n.loadLanguages([options.lng]).then(() => {
            loadedLanguages.add(options.lng);
            loadingPromises.delete(options.lng);
          }).catch(() => {
            loadingPromises.delete(options.lng);
          });
          loadingPromises.set(options.lng, loadPromise);
        }
        // Note: First call might use fallback language, but subsequent calls will work
        // For critical paths (like email sending), use ensureLanguageLoaded() first
      }
    }
    // Return translation immediately (may use fallback on first call if language not yet loaded)
    return i18n.t(key, options || {});
  });

  // Async helper to ensure a language is loaded before translating (for critical paths)
  fastify.decorate("ensureLanguageLoaded", async (lng: string): Promise<void> => {
    if (!loadedLanguages.has(lng) && supportedLanguages.includes(lng as any)) {
      // Wait for existing load or start new one
      let loadPromise = loadingPromises.get(lng);
      if (!loadPromise) {
        loadPromise = i18n.loadLanguages([lng]).then(() => {
          loadedLanguages.add(lng);
          loadingPromises.delete(lng);
        }).catch(() => {
          loadingPromises.delete(lng);
        });
        loadingPromises.set(lng, loadPromise);
      }
      await loadPromise;
    }
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

