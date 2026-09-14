'use client';

import { useLanguage } from "../_components/LanguageContext";
import { Hexagon, Sun, Moon, Settings } from "lucide-react";
import { motion } from "framer-motion";

type PixelHeaderProps = {
  title?: string;
  onThemeToggle?: () => void;
  isDark?: boolean;
  onSettingsClick?: () => void;
};

export function PixelHeader({
  title,
  onThemeToggle,
  isDark = true,
  onSettingsClick
}: PixelHeaderProps) {
  const { t } = useLanguage();
  const headerTitle = title ?? t.workspace;

  return (
    <header
      aria-label={headerTitle}
      style={{
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        background: "var(--ui-topbar)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--ui-chip-border)",
        flexShrink: 0,
      }}
    >
      {/* Left Section */}
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        {/* Logo */}
        <motion.div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 14,
            fontWeight: 700,
            color: "var(--ink)",
            letterSpacing: "-0.02em",
          }}
          whileHover={{ scale: 1.02 }}
        >
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "var(--ui-accent-tint-3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid var(--ui-accent-line-soft)",
          }}
          >
            <Hexagon size={20} color="var(--ui-accent)" />
          </div>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 14 }}>
            Swarm IDE
          </span>
        </motion.div>

        <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              color: "var(--ink)",
              background: "var(--ui-fill-2)",
            }}
          >
            {t.workspace}
          </span>
        </nav>
      </div>

      {/* Right Section */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={onThemeToggle}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--ui-fill)",
            border: "1px solid var(--ui-chip-border)",
            color: "var(--ui-text-tertiary)",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          title={isDark ? t.switchToLight : t.switchToDark}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--ui-fill-hover)";
            e.currentTarget.style.color = "var(--ink)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--ui-fill)";
            e.currentTarget.style.color = "var(--ui-muted)";
          }}
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button
          onClick={onSettingsClick}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--ui-fill)",
            border: "1px solid var(--ui-chip-border)",
            color: "var(--ui-text-tertiary)",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          title={t.settings}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--ui-fill-hover)";
            e.currentTarget.style.color = "var(--ink)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--ui-fill)";
            e.currentTarget.style.color = "var(--ui-muted)";
          }}
        >
          <Settings size={20} />
        </button>
      </div>
    </header>
  );
}

export function DarkPixelHeader({ onThemeToggle, onSettingsClick }: Omit<PixelHeaderProps, 'isDark'>) {
  return <PixelHeader isDark={true} onThemeToggle={onThemeToggle} onSettingsClick={onSettingsClick} />;
}
