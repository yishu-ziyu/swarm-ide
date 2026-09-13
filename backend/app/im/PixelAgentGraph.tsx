'use client';

import { motion } from "framer-motion";
import { Plus, Minus, RotateCcw, Bot, User } from "lucide-react";

type AgentNode = {
  id: string;
  name: string;
  role: string;
  status: "idle" | "thinking" | "running" | "offline";
  parentId?: string;
};

type PixelAgentGraphProps = {
  agents?: AgentNode[];
  onAgentClick?: (id: string) => void;
  selectedAgentId?: string;
};

const statusColors = {
  idle: "#34d399",
  thinking: "#f59e0b",
  running: "#a78bfa",
  offline: "#6b6b6b",
};

export function PixelAgentGraph({
  agents = [],
  onAgentClick,
  selectedAgentId,
}: PixelAgentGraphProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: "#0d0d0d",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        background: "rgba(26, 26, 26, 0.8)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <h3 style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontWeight: 600,
          fontSize: 13,
          letterSpacing: "0.05em",
          color: "var(--ink)",
          textTransform: "uppercase",
        }}>
          Agent Network
        </h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            color: "var(--ink-3)",
            cursor: "pointer",
            transition: "all 0.2s",
          }}>
            <Plus size={14} />
          </button>
          <button style={{
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            color: "var(--ink-3)",
            cursor: "pointer",
            transition: "all 0.2s",
          }}>
            <Minus size={14} />
          </button>
          <button style={{
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            color: "var(--ink-3)",
            cursor: "pointer",
            transition: "all 0.2s",
          }}>
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Graph Canvas */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", padding: 24 }}>
        {/* Grid Background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.08,
            backgroundImage: `
              linear-gradient(transparent 39px, rgba(124, 58, 237, 0.3) 40px),
              linear-gradient(90deg, transparent 39px, rgba(124, 58, 237, 0.3) 40px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Agent Nodes */}
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          {agents.length === 0 ? (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: "rgba(124, 58, 237, 0.08)",
                  border: "1px solid rgba(124, 58, 237, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}>
                  <Bot size={20} color="#a78bfa" />
                </div>
                <p style={{ fontSize: 14, color: "var(--ink-3)", fontWeight: 500 }}>
                  No agents yet
                </p>
                <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>
                  Deploy your first agent
                </p>
              </div>
            </div>
          ) : (
            agents.map((agent, index) => {
              const angle = (index / Math.max(agents.length, 1)) * 2 * Math.PI;
              const radius = 100;
              const x = 50 + radius * Math.cos(angle);
              const y = 50 + radius * Math.sin(angle);
              const isSelected = selectedAgentId === agent.id;
              const color = statusColors[agent.status];

              return (
                <motion.div
                  key={agent.id}
                  style={{
                    position: "absolute",
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: "translate(-50%, -50%)",
                    zIndex: isSelected ? 10 : 1,
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: index * 0.1, type: "spring", stiffness: 200 }}
                  onClick={() => onAgentClick?.(agent.id)}
                >
                  {/* Node */}
                  <motion.div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isSelected ? `${color}20` : "rgba(26, 26, 26, 0.9)",
                      border: `2px solid ${isSelected ? color : `${color}40`}`,
                      boxShadow: isSelected ? `0 0 20px ${color}40` : "none",
                      cursor: "pointer",
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {agent.role === "human" ? (
                      <User size={20} color={color} />
                    ) : (
                      <Bot size={20} color={color} />
                    )}
                  </motion.div>

                  {/* Status dot */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: -2,
                      right: -2,
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: color,
                      border: "2px solid #0d0d0d",
                      boxShadow: `0 0 6px ${color}60`,
                    }}
                  />

                  {/* Label */}
                  <div style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    whiteSpace: "nowrap",
                  }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "var(--ink)",
                      background: "rgba(0,0,0,0.6)",
                      padding: "2px 8px",
                      borderRadius: 8,
                    }}>
                      {agent.name}
                    </span>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Connection Lines */}
        {agents.length > 1 && (
          <svg style={{ position: "absolute", inset: 0, pointerEvents: "none", width: "100%", height: "100%" }}>
            {agents.map((agent) => {
              if (!agent.parentId) return null;
              const parent = agents.find(a => a.id === agent.parentId);
              if (!parent) return null;

              const parentIndex = agents.indexOf(parent);
              const childIndex = agents.indexOf(agent);
              const parentAngle = (parentIndex / agents.length) * 2 * Math.PI;
              const childAngle = (childIndex / agents.length) * 2 * Math.PI;
              const radius = 100;

              const x1 = 50 + radius * Math.cos(parentAngle);
              const y1 = 50 + radius * Math.sin(parentAngle);
              const x2 = 50 + radius * Math.cos(childAngle);
              const y2 = 50 + radius * Math.sin(childAngle);

              return (
                <motion.line
                  key={`${agent.id}-${parent.id}`}
                  x1={`${x1}%`}
                  y1={`${y1}%`}
                  x2={`${x2}%`}
                  y2={`${y2}%`}
                  stroke="rgba(124, 58, 237, 0.3)"
                  strokeWidth="1.5"
                  strokeDasharray="6,4"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                />
              );
            })}
          </svg>
        )}
      </div>

      {/* Footer Stats */}
      <div style={{
        padding: "12px 20px",
        borderTop: "1px solid rgba(255, 255, 255, 0.06)",
        background: "rgba(26, 26, 26, 0.6)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: '"JetBrains Mono", monospace' }}>
          {agents.length} agents
        </span>
        <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: '"JetBrains Mono", monospace' }}>
          {agents.filter(a => a.status !== "offline").length} active
        </span>
      </div>
    </div>
  );
}

export default PixelAgentGraph;
