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

const navItems: NavItem[] = [
  { id: "fleet", label: "Fleet", icon: Users },
  { id: "modules", label: "Modules", icon: Puzzle },
  { id: "terminal", label: "Terminal", icon: Terminal },
  { id: "logs", label: "Logs", icon: ScrollText },
  { id: "deploy", label: "Deploy", icon: Rocket },
];

export function PixelNavSidebar({
  version = "0.8.1-BETA",
  activeNav = "fleet",
  onNavChange,
  onDeployAgent,
}: PixelNavSidebarProps) {
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
        background: "rgba(13, 13, 13, 0.95)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRight: "1px solid rgba(255, 255, 255, 0.06)",
        zIndex: 40,
      }}
    >
      {/* Logo Section */}
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "rgba(245, 158, 11, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(245, 158, 11, 0.15)",
            }}
          >
            <Hexagon size={20} color="#f59e0b" />
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
                color: "var(--ink-3)",
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
                background: isActive ? "rgba(167, 139, 250, 0.1)" : "transparent",
                color: isActive ? "#a78bfa" : "#86868b",
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
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  e.currentTarget.style.color = "#f5f5f7";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#86868b";
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
      <div style={{ padding: "12px 12px 8px", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
        <motion.button
          style={{
            width: "100%",
            padding: "10px 16px",
            borderRadius: 8,
            background: "#7c3aed",
            color: "white",
            border: "none",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: '"JetBrains Mono", monospace',
            letterSpacing: "0.03em",
            boxShadow: "0 2px 8px rgba(124, 58, 237, 0.3)",
          }}
          whileHover={{
            background: "#6d28d9",
            boxShadow: "0 4px 12px rgba(124, 58, 237, 0.4)",
            y: -1,
          }}
          whileTap={{ scale: 0.98 }}
          onClick={onDeployAgent}
        >
          Deploy Agent
        </motion.button>
      </div>

      {/* Bottom Actions */}
      <div
        style={{
          padding: "8px 12px",
          display: "flex",
          justifyContent: "space-around",
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        {[
          { icon: Cpu, label: "System" },
          { icon: HelpCircle, label: "Help" },
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
              color: "var(--ink-3)",
              cursor: "pointer",
              transition: "all 0.2s",
              fontSize: 12,
              fontFamily: '"JetBrains Mono", monospace',
              letterSpacing: "0.03em",
              textTransform: "uppercase",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#f5f5f7";
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#6b6b6b";
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
