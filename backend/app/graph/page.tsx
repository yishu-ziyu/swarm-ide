"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "../_components/LanguageContext";
import LanguageSwitcher from "../_components/LanguageSwitcher";
import { Network, MessageSquare, ArrowLeft, Activity, GitBranch, Share2, Bot } from "lucide-react";

type UUID = string;

type WorkspaceDefaults = {
  workspaceId: UUID;
  humanAgentId: UUID;
  assistantAgentId: UUID;
  defaultGroupId: UUID;
};

type GraphNode = { id: UUID; role: string; parentId: UUID | null };
type GraphEdge = { from: UUID; to: UUID; count: number; lastSendTime: string };

const SESSION_KEY = "agent-wechat.session.v1";

function loadSession(): WorkspaceDefaults | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WorkspaceDefaults;
  } catch {
    return null;
  }
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

// Decorative network illustration
function NetworkIllustration() {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" fill="none" style={{ opacity: 0.3 }}>
      <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Nodes */}
      {[0, 60, 120, 180, 240, 300].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const x = (100 + 50 * Math.cos(rad)).toFixed(3);
        const y = (100 + 50 * Math.sin(rad)).toFixed(3);
        return (
          <motion.circle
            key={i}
            cx={x}
            cy={y}
            r="6"
            fill={i % 2 === 0 ? "#a78bfa" : "#34d399"}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.1, type: "spring" }}
          />
        );
      })}
      {/* Center node */}
      <motion.circle
        cx="100"
        cy="100"
        r="10"
        fill="#a78bfa"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.6, type: "spring" }}
      />
      {/* Connections */}
      {[0, 60, 120, 180, 240, 300].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const x = (100 + 50 * Math.cos(rad)).toFixed(3);
        const y = (100 + 50 * Math.sin(rad)).toFixed(3);
        return (
          <motion.line
            key={`line-${i}`}
            x1="100"
            y1="100"
            x2={x}
            y2={y}
            stroke="rgba(167, 139, 250, 0.2)"
            strokeWidth="1"
            strokeDasharray="4,4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
          />
        );
      })}
    </svg>
  );
}

// Stat card component
function StatCard({ icon: Icon, label, value, color, delay }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      style={{
        background: "rgba(26, 26, 26, 0.6)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: 16,
        padding: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: `${color}15`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `1px solid ${color}20`,
        }}>
          <Icon size={14} color={color} />
        </div>
        <span style={{ fontSize: 13, color: "var(--ink-3)", fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{
        fontSize: 24,
        fontWeight: 700,
        color: "var(--ink)",
        letterSpacing: "-0.02em",
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {value}
      </div>
    </motion.div>
  );
}

// Edge row component
function EdgeRow({ edge, fromLabel, toLabel }: {
  edge: GraphEdge;
  fromLabel: string;
  toLabel: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      style={{
        padding: "14px 18px",
        borderRadius: 16,
        background: "rgba(26, 26, 26, 0.4)",
        border: "1px solid rgba(255, 255, 255, 0.05)",
        marginBottom: 8,
        transition: "all 0.2s",
        cursor: "default",
      }}
      whileHover={{
        background: "rgba(26, 26, 26, 0.7)",
        borderColor: "rgba(124, 58, 237, 0.15)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ink)",
            background: "rgba(167, 139, 250, 0.1)",
            padding: "2px 8px",
            borderRadius: 8,
            whiteSpace: "nowrap",
          }}>
            {fromLabel}
          </span>
          <span style={{ color: "var(--ink-3)", fontSize: 12 }}>→</span>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#34d399",
            background: "rgba(52, 211, 153, 0.1)",
            padding: "2px 8px",
            borderRadius: 8,
            whiteSpace: "nowrap",
          }}>
            {toLabel}
          </span>
        </div>
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--ink)",
          fontFamily: "'JetBrains Mono', monospace",
          flexShrink: 0,
        }}>
          ×{edge.count}
        </span>
      </div>
      <div style={{
        fontSize: 12,
        color: "var(--ink-3)",
        fontFamily: "'JetBrains Mono', monospace",
        marginTop: 8,
      }}>
        {new Date(edge.lastSendTime).toLocaleString()} • {edge.from.slice(0, 8)}… → {edge.to.slice(0, 8)}…
      </div>
    </motion.div>
  );
}

export default function GraphPage() {
  const { t } = useLanguage();
  const [session] = useState<WorkspaceDefaults | null>(() => loadSession());
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    void (async () => {
      try {
        const q = new URLSearchParams({ workspaceId: session.workspaceId, limitMessages: "2000" });
        const res = await api<{ nodes: GraphNode[]; edges: GraphEdge[] }>(`/api/agent-graph?${q.toString()}`);
        setNodes(res.nodes);
        setEdges(res.edges);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [session]);

  const roleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nodes) map.set(n.id, n.role);
    return map;
  }, [nodes]);

  const stats = useMemo(() => {
    const totalEdges = edges.length;
    const totalMessages = edges.reduce((sum, e) => sum + e.count, 0);
    return { totalEdges, totalMessages };
  }, [edges]);

  if (!session) {
    return (
      <div className="compact-apple" style={{
        minHeight: "100vh",
        background: "#0d0d0d",
        color: "var(--ink)",
        padding: 40,
      }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center", paddingTop: 80 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <NetworkIllustration />
            <h1 style={{ margin: "24px 0 12px", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>
              {t.agentGraph}
            </h1>
            <p style={{ color: "var(--ink-3)", marginBottom: 24, fontSize: 14 }}>
              {t.graphCardDescription}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 32 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-3)" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#a78bfa" }} />
                {t.agentNodes}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-3)" }}>
                <div style={{ width: 16, height: 1, background: "rgba(167, 139, 250, 0.3)" }} />
                {t.messageConnections}
              </div>
            </div>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ color: "var(--ink-3)", marginBottom: 20 }}
          >
            {t.noWorkspacesTip}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Link
              href="/im"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                background: "#7c3aed",
                color: "white",
                borderRadius: 16,
                fontWeight: 500,
                fontSize: 14,
                textDecoration: "none",
                boxShadow: "0 2px 8px rgba(124, 58, 237, 0.3)",
              }}
            >
              <MessageSquare size={14} />
              {t.openIM}
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="compact-apple" style={{
      minHeight: "100vh",
      background: "#0d0d0d",
      color: "var(--ink)",
      padding: "40px 24px",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 32,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 16,
              background: "rgba(52, 211, 153, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(52, 211, 153, 0.15)",
            }}>
              <Network size={20} color="#34d399" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>
                {t.agentGraph}
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-3)" }}>
                {t.workspacesTip}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <LanguageSwitcher />
            <Link
              href="/im"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                color: "var(--ink-3)",
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
                transition: "all 0.2s",
              }}
            >
              <ArrowLeft size={14} />
              {t.openIM}
            </Link>
          </div>
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: 16,
              padding: 16,
              marginBottom: 24,
              color: "#ef4444",
              fontSize: 13,
            }}
          >
            {error}
          </motion.div>
        )}

        {/* Stats */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}>
          <StatCard icon={GitBranch} label={t.edges} value={stats.totalEdges} color="#a78bfa" delay={0.1} />
          <StatCard icon={Activity} label={t.messages} value={stats.totalMessages} color="#34d399" delay={0.2} />
        </div>

        {/* Edges List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            background: "rgba(26, 26, 26, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div style={{
            padding: "18px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <Activity size={14} color="#86868b" />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
              {t.recentActivity}
            </span>
            <span style={{
              marginLeft: "auto",
              fontSize: 12,
              color: "var(--ink-3)",
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {edges.length} {t.connections}
            </span>
          </div>
          <div style={{ padding: 16, maxHeight: 600, overflow: "auto" }}>
            {edges.length === 0 ? (
              <div style={{
                textAlign: "center",
                padding: 48,
                color: "var(--ink-3)",
                fontSize: 13,
              }}>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <Share2 size={20} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                  <p>{t.noMessagesYet}</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>{t.messagesWillAppearHere}</p>
                </motion.div>
              </div>
            ) : (
              edges.slice(0, 80).map((e, i) => (
                <EdgeRow
                  key={`${e.from}=>${e.to}`}
                  edge={e}
                  fromLabel={roleById.get(e.from) ?? e.from.slice(0, 8)}
                  toLabel={roleById.get(e.to) ?? e.to.slice(0, 8)}
                />
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
