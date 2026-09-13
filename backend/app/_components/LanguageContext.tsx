"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Language, getTranslations, Translations } from "../i18n";

export type Theme = "light" | "dark";

type LanguageContextType = {
  language: Language;
  theme: Theme;
  t: Translations;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

const LANG_STORAGE_KEY = "swarm-ide-language";
const THEME_STORAGE_KEY = "swarm-ide-theme";

const defaultTranslations = getTranslations("zh");

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("zh");
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedLang = localStorage.getItem(LANG_STORAGE_KEY);
    if (storedLang === "en" || storedLang === "zh") {
      setLanguageState(storedLang);
    }

    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
      setThemeState(storedTheme);
    } else {
      setThemeState("dark");
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute("data-theme", theme);
      document.body.className = theme;
    }
  }, [theme, mounted]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    const newLang = language === "en" ? "zh" : "en";
    setLanguage(newLang);
  }, [language, setLanguage]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
  }, [theme, setTheme]);

  const t = getTranslations(language);

  const value = {
    language,
    theme,
    t: mounted ? t : defaultTranslations,
    setLanguage,
    toggleLanguage,
    setTheme,
    toggleTheme,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
