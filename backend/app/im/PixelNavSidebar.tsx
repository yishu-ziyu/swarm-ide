'use client';

import { motion } from "framer-motion";
import {
  Hexagon,
  Users,
  Puzzle,
  Terminal,
  ScrollText,
  Rocket,
  Cpu,
  HelpCircle,
} from "lucide-react";
import { useLanguage } from "../_components/LanguageContext";

type NavItem = {
  id: string;
  label: string;
  icon: React.ElementType;
};

type PixelNavSidebarProps = {
  version?: string;
  activeNav?: string;
  onNavChange?: (id: string) => void;
  onDeployAgent?: () => void;
};

export function PixelNavSidebar({
  version = "0.8.1-BETA",
  activeNav = "fleet",
  onNavChange,
  onDeployAgent,
}: PixelNavSidebarProps) {
  const { t } = useLanguage();

  const navItems: NavItem[] = [
    { id: "fleet", label: t.fleet, icon: Users },
    { id: "modules", label: t.modules, icon: Puzzle },
    { id: "terminal", label: t.terminal, icon: Terminal },
    { id: "logs", label: t.logs, icon: ScrollText },
    { id: "deploy", label: t.deploy, icon: Rocket },
  ];

  return (
    <aside
      style={{
        position: "fixed",
        left: 0,
        top: 56,
        bottom: 0,
        width: 240,
        display: "flex",
        flexDirection: "column",
        background: "var(--ui-shell)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRight: "1px solid var(--ui-chip-border)",
        zIndex: 40,
      }}
    >
      {/* Logo Section */}
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--ui-chip-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--ui-amber-tint)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid var(--ui-amber-border)",
            }}
          >
            <Hexagon size={20} color="var(--ui-amber)" />
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--ink)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                fontFamily: '"JetBrains Mono", monospace',
              }}
            >
              Swarm Control
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--ui-text-tertiary)",
                marginTop: 2,
                fontFamily: '"JetBrains Mono", monospace',
              }}
            >
              V.{version}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
        {navItems.map((item, index) => {
          const isActive = activeNav === item.id;
          const Icon = item.icon;
          return (
            <motion.button
              key={item.id}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 14px",
                borderRadius: 8,
                marginBottom: 2,
                border: "none",
                background: isActive ? "var(--ui-accent-tint-2)" : "transparent",
                color: isActive ? "var(--ui-accent)" : "var(--ui-muted)",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: isActive ? 600 : 500,
                fontFamily: '"JetBrains Mono", monospace',
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                transition: "all 0.2s",
                textAlign: "left",
              }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavChange?.(item.id)}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "var(--ui-fill)";
                  e.currentTarget.style.color = "var(--ink)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--ui-muted)";
                }
              }}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Icon size={14} />
              <span>{item.label}</span>
            </motion.button>
          );
        })}
      </nav>

      {/* Deploy Button */}
      <div style={{ padding: "12px 12px 8px", borderTop: "1px solid var(--ui-chip-border)" }}>
        <motion.button
          style={{
            width: "100%",
            padding: "10px 16px",
            borderRadius: 8,
            background: "var(--ui-accent-solid)",
            color: "var(--ui-on-accent)",
            border: "none",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: '"JetBrains Mono", monospace',
            letterSpacing: "0.03em",
            boxShadow: "0 2px 8px var(--ui-accent-shadow)",
          }}
          whileHover={{
            background: "var(--ui-accent-solid-hover)",
            boxShadow: "0 4px 12px var(--ui-accent-shadow-hover)",
            y: -1,
          }}
          whileTap={{ scale: 0.98 }}
          onClick={onDeployAgent}
        >
          {t.deployAgent}
        </motion.button>
      </div>

      {/* Bottom Actions */}
      <div
        style={{
          padding: "8px 12px",
          display: "flex",
          justifyContent: "space-around",
          borderTop: "1px solid var(--ui-chip-border)",
        }}
      >
        {[
          { icon: Cpu, label: t.system },
          { icon: HelpCircle, label: t.help },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "6px 10px",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "var(--ui-text-tertiary)",
              cursor: "pointer",
              transition: "all 0.2s",
              fontSize: 12,
              fontFamily: '"JetBrains Mono", monospace',
              letterSpacing: "0.03em",
              textTransform: "uppercase",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--ink)";
              e.currentTarget.style.background = "var(--ui-fill)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--ui-muted-2)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

export default PixelNavSidebar;
