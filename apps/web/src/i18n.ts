import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "@booking-for-all/i18n/locales/en";
import hu from "@booking-for-all/i18n/locales/hu";
import de from "@booking-for-all/i18n/locales/de";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { 
      en: { translation: en }, 
      hu: { translation: hu }, 
      de: { translation: de } 
    },
    fallbackLng: "en",
    supportedLngs: ["en", "hu", "de"],
    detection: {
      order: ["cookie", "localStorage", "navigator"],
      caches: ["cookie", "localStorage"],
      cookieMinutes: 365 * 24 * 60,
      lookupCookie: "lang",
      lookupLocalStorage: "i18nextLng"
    },
    interpolation: { escapeValue: false },
    react: {
      useSuspense: false
    }
  })
  .then(() => {
    console.log("i18n initialized with language:", i18n.language);
  })
  .catch((err) => {
    console.error("i18n initialization error:", err);
  });

export default i18n;

