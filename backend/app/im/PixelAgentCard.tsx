'use client';

import { motion } from "framer-motion";
import { Bot, Activity } from "lucide-react";

type AgentStatus = "idle" | "thinking" | "running" | "offline";

type PixelAgentCardProps = {
  name: string;
  role: string;
  status: AgentStatus;
  description?: string;
  progress?: number;
  isActive?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  pixelAvatar?: string;
};

const statusConfig = {
  idle: {
    color: "#34d399",
    label: "Idle",
    glow: "shadow-[0_0_8px_rgba(52,211,153,0.4)]",
  },
  thinking: {
    color: "#f59e0b",
    label: "Thinking",
    glow: "shadow-[0_0_8px_rgba(245,158,11,0.4)]",
  },
  running: {
    color: "#a78bfa",
    label: "Running",
    glow: "shadow-[0_0_8px_rgba(167,139,250,0.4)]",
  },
  offline: {
    color: "#6b6b6b",
    label: "Offline",
    glow: "",
  },
};

export function PixelAgentCard({
  name,
  role,
  status,
  description = "",
  progress = 0,
  isActive = false,
  isSelected = false,
  onClick,
  pixelAvatar,
}: PixelAgentCardProps) {
  const config = statusConfig[status];
  const isOffline = status === "offline";

  return (
    <motion.div
      style={{
        padding: 16,
        background: isSelected
          ? "rgba(124, 58, 237, 0.08)"
          : "rgba(26, 26, 26, 0.6)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: 16,
        border: isSelected
          ? "1px solid rgba(124, 58, 237, 0.3)"
          : "1px solid rgba(255, 255, 255, 0.06)",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
      whileHover={{
        y: -2,
        borderColor: "rgba(124, 58, 237, 0.2)",
        boxShadow: "0 8px 30px rgba(0, 0, 0, 0.3)",
      }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={isOffline ? "opacity-50" : ""}
    >
      {/* Status glow effect */}
      {!isOffline && (
        <div
          style={{
            position: "absolute",
            top: -20,
            right: -20,
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: config.color,
            opacity: 0.06,
            filter: "blur(20px)",
          }}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        {/* Avatar */}
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: isOffline ? "#2a2a2a" : `${config.color}15`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `1px solid ${isOffline ? "#3a3a3a" : `${config.color}25`}`,
          flexShrink: 0,
        }}>
          {pixelAvatar ? (
            <img src={pixelAvatar} alt={name} style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }} />
          ) : (
            <Bot size={20} color={isOffline ? "#6b6b6b" : config.color} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#f5f5f7",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {name}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: config.color,
                  boxShadow: isOffline ? "none" : `0 0 6px ${config.color}80`,
                }}
              />
              <span style={{ fontSize: 10, color: "#86868b", fontWeight: 500 }}>
                {config.label}
              </span>
            </div>
          </div>
          <p style={{ fontSize: 11, color: "#86868b", margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {role}
          </p>
        </div>
      </div>

      {description && (
        <p style={{ fontSize: 11, color: "#6b6b6b", margin: "0 0 10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {description}
        </p>
      )}

      {!isOffline && (
        <div style={{ display: "flex", gap: 3 }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                height: 3,
                flex: 1,
                borderRadius: 2,
                background: i <= Math.ceil(progress / 25)
                  ? config.color
                  : "rgba(255,255,255,0.06)",
                transition: "background 0.3s ease",
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default PixelAgentCard;
