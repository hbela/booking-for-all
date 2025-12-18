import i18next from "i18next";
import Backend from "i18next-fs-backend";
import path from "path";
import { fileURLToPath } from "node:url";

// In ESM, __dirname is not available by default – reconstruct it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initI18n() {
  // Get the package root directory (where locales folder is located)
  // __dirname will be dist/ after build, so we go up one level to package root
  const packageRoot = path.resolve(__dirname, "..");
  const localesPath = path.join(packageRoot, "locales", "{{lng}}.json");
  
  await i18next
    .use(Backend)
    .init({
      fallbackLng: "en",
      supportedLngs: ["en", "hu", "de"],
      backend: {
        loadPath: localesPath,
      },
      interpolation: { escapeValue: false }
    });

  // Only preload the fallback language (en) during initialization
  // Other languages will be loaded on-demand when first used
  // This is more memory-efficient when supporting many languages (e.g., 20+)
  await i18next.loadLanguages(["en"]);

  return i18next;
}

export const supportedLanguages = ["en", "hu", "de"] as const;
export type SupportedLanguage = typeof supportedLanguages[number];

