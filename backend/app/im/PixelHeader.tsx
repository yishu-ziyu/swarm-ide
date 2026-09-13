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
  title = "Workspace",
  onThemeToggle,
  isDark = true,
  onSettingsClick
}: PixelHeaderProps) {
  const { t } = useLanguage();

  return (
    <header
      style={{
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        background: "rgba(9, 9, 11, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
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
            fontSize: 16,
            fontWeight: 700,
            color: "#f5f5f7",
            letterSpacing: "-0.02em",
          }}
          whileHover={{ scale: 1.02 }}
        >
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "rgba(167, 139, 250, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid rgba(167, 139, 250, 0.2)",
          }}
          >
            <Hexagon size={16} color="#a78bfa" />
          </div>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 14 }}>
            Swarm IDE
          </span>
        </motion.div>

        {/* Navigation */}
        <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {["Workspace", "Agents", "Projects"].map((item, i) => (
            <button
              key={item}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                color: i === 0 ? "#a78bfa" : "#86868b",
                background: i === 0 ? "rgba(167, 139, 250, 0.08)" : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s",
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
              }}
              onMouseEnter={(e) => {
                if (i !== 0) {
                  e.currentTarget.style.color = "#f5f5f7";
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                }
              }}
              onMouseLeave={(e) => {
                if (i !== 0) {
                  e.currentTarget.style.color = "#86868b";
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {item}
            </button>
          ))}
        </nav>
      </div>

      {/* Right Section */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={onThemeToggle}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "#86868b",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          title={isDark ? "切换到浅色模式" : "切换到暗色模式"}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            e.currentTarget.style.color = "#f5f5f7";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            e.currentTarget.style.color = "#86868b";
          }}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <button
          onClick={onSettingsClick}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "#86868b",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          title="设置"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            e.currentTarget.style.color = "#f5f5f7";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            e.currentTarget.style.color = "#86868b";
          }}
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}

export function DarkPixelHeader({ onThemeToggle, onSettingsClick }: Omit<PixelHeaderProps, 'isDark'>) {
  return <PixelHeader isDark={true} onThemeToggle={onThemeToggle} onSettingsClick={onSettingsClick} />;
}
