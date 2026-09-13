"use client";

import { useLanguage } from "./LanguageContext";
import { Language } from "../i18n";
import { motion } from "framer-motion";
import { Sun, Moon, Globe } from "lucide-react";

export default function LanguageSwitcher() {
  const { language, setLanguage, theme, setTheme, t } = useLanguage();

  const languages: { code: Language; label: string }[] = [
    { code: "zh", label: "中文" },
    { code: "en", label: "EN" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ display: "flex", alignItems: "center", gap: 10 }}
    >
      {/* Theme Toggle */}
      <motion.button
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "var(--ink-3)",
          cursor: "pointer",
          transition: "all 0.2s",
        }}
        title={theme === "light" ? t.switchToDark : t.switchToLight}
        whileHover={{ scale: 1.05, background: "rgba(255,255,255,0.08)", color: "var(--ink)" }}
        whileTap={{ scale: 0.95 }}
      >
        {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
      </motion.button>

      {/* Language Toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Globe size={14} color="#6b6b6b" />
        <div style={{ display: "flex", gap: 3 }}>
          {languages.map((lang) => (
            <motion.button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              style={{
                padding: "4px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: language === lang.code ? 600 : 400,
                background: language === lang.code ? "rgba(167, 139, 250, 0.15)" : "transparent",
                color: language === lang.code ? "#a78bfa" : "#86868b",
                border: language === lang.code ? "1px solid rgba(167, 139, 250, 0.25)" : "1px solid transparent",
                cursor: "pointer",
                transition: "all 0.2s",
                fontFamily: "'JetBrains Mono', monospace",
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {lang.label}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
