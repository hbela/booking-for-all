import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const languages = [
  { code: "en", name: "English" },
  { code: "hu", name: "Magyar" },
  { code: "de", name: "Deutsch" },
];

export function LanguageSwitcher() {
  const { i18n: i18nInstance, ready } = useTranslation();

  const handleLanguageChange = (lang: string) => {
    i18nInstance.changeLanguage(lang).then(() => {
      // Set cookie for language preference (1 year expiration)
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 1);
      document.cookie = `lang=${lang}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
      // Also update localStorage
      localStorage.setItem("i18nextLng", lang);
      console.log("Language changed to:", lang);
    });
  };

  // Get current language, defaulting to "en" if not ready
  const currentLang = ready ? (i18nInstance.language || "en") : "en";
  
  // Normalize language code (e.g., "en-US" -> "en")
  const normalizedLang = currentLang.split("-")[0];

  return (
    <Select
      value={normalizedLang}
      onValueChange={handleLanguageChange}
    >
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder="Language" />
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

