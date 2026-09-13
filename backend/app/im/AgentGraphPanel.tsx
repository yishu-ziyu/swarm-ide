"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Network, User, Briefcase, Code2, Minus, Plus, RotateCcw } from "lucide-react";

type UUID = string;

type GraphNode = {
  id: UUID;
  role: string;
  parentId: UUID | null;
};

type GraphEdge = {
  from: UUID;
  to: UUID;
  count: number;
};

type AgentStatus = "IDLE" | "BUSY" | "WAKING";

type StatusMap = Record<string, AgentStatus>;

const NODE_SIZE = 48;
const SESSION_KEY = "agent-wechat.session.v1";

interface AgentGraphPanelProps {
  className?: string;
  onNodeClick?: (agentId: UUID) => void;
}

function loadSession(): { workspaceId: UUID } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fetchGraphData(workspaceId: UUID) {
  const res = await fetch(`/api/agent-graph?workspaceId=${workspaceId}&limitMessages=2000`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }>;
}

// Simple tree layout algorithm
function computeLayout(
  nodes: GraphNode[],
  edges: GraphEdge[]
): Map<UUID, { x: number; y: number }> {
  const positions = new Map<UUID, { x: number; y: number }>();
  const children = new Map<UUID, UUID[]>();

  // Build children map
  for (const node of nodes) {
    if (node.parentId) {
      const list = children.get(node.parentId) || [];
      list.push(node.id);
      children.set(node.parentId, list);
    }
  }

  // Find root (human or first node without parent)
  const root = nodes.find((n) => n.role === "human") || nodes[0];
  if (!root) return positions;

  // BFS layout
  const queue: UUID[] = [root.id];
  const visited = new Set<UUID>();
  const levelMap = new Map<UUID, number>();

  positions.set(root.id, { x: 160, y: 40 });
  levelMap.set(root.id, 0);
  visited.add(root.id);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const level = levelMap.get(current)!;
    const childrenList = children.get(current) || [];
    const childCount = childrenList.length;

    childrenList.forEach((childId, idx) => {
      if (visited.has(childId)) return;
      visited.add(childId);

      const totalWidth = childCount * 80;
      const startX = positions.get(current)!.x - totalWidth / 2 + 40;
      const x = startX + idx * 80;
      const y = 40 + (level + 1) * 80;

      positions.set(childId, { x, y });
      levelMap.set(childId, level + 1);
      queue.push(childId);
    });
  }

  return positions;
}

function getNodeIcon(role: string) {
  switch (role) {
    case "productmanager":
      return Briefcase;
    case "coder":
      return Code2;
    case "assistant":
      return Network;
    default:
      return User;
  }
}

function getNodeColor(role: string, status: AgentStatus): string {
  if (role === "human") return "#4a9eff";
  if (status === "BUSY") return "#22c55e";
  if (status === "WAKING") return "#f59e0b";
  return "#8b5cf6";
}

export const AgentGraphPanel = memo(function AgentGraphPanel({
  className,
  onNodeClick,
}: AgentGraphPanelProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [statusMap, setStatusMap] = useState<StatusMap>({});
  const [positions, setPositions] = useState<Map<UUID, { x: number; y: number }>>(new Map());
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<UUID | null>(null);
  const panStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<{ workspaceId: UUID } | null>(null);

  useEffect(() => {
    setSession(loadSession());
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchGraphData(session.workspaceId)
      .then((data) => {
        setNodes(data.nodes);
        setEdges(data.edges);
        setPositions(computeLayout(data.nodes, data.edges));
      })
      .catch(console.error);
  }, [session]);

  // Poll for updates
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      fetchGraphData(session.workspaceId)
        .then((data) => {
          setNodes(data.nodes);
          setEdges(data.edges);
          setPositions(computeLayout(data.nodes, data.edges));
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [session]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setOffset({ x: panStartRef.current.ox + dx, y: panStartRef.current.oy + dy });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    panStartRef.current = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((s) => Math.min(Math.max(s + delta, 0.5), 2));
  }, []);

  const handleNodeClick = useCallback((nodeId: UUID) => {
    setActiveNodeId(nodeId);
    onNodeClick?.(nodeId);
  }, [onNodeClick]);

  const svgWidth = 320;
  const svgHeight = 400;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--bg-secondary)",
        borderLeft: "1px solid var(--border-color)",
      }}
    >
      {/* Header */}
      <div
        className="header"
        style={{
          borderBottom: "1px solid var(--border-color)",
          background: "var(--bg-secondary)",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13 }}>Agent Graph</div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            className="btn"
            style={{ padding: "2px 6px", fontSize: 12 }}
            onClick={() => setScale((s) => Math.min(s + 0.1, 2))}
          >
            <Plus size={14} />
          </button>
          <button
            className="btn"
            style={{ padding: "2px 6px", fontSize: 12 }}
            onClick={() => setScale((s) => Math.max(s - 0.1, 0.5))}
          >
            <Minus size={14} />
          </button>
          <button
            className="btn"
            style={{ padding: "2px 6px", fontSize: 12 }}
            onClick={() => {
              setScale(1);
              setOffset({ x: 0, y: 0 });
            }}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Graph Canvas */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          position: "relative",
          background: `
            radial-gradient(circle at 30% 30%, rgba(74, 158, 255, 0.08), transparent 50%),
            radial-gradient(circle at 70% 70%, rgba(139, 92, 246, 0.08), transparent 50%),
            linear-gradient(transparent 23px, rgba(45, 45, 68, 0.5) 24px),
            linear-gradient(90deg, transparent 23px, rgba(45, 45, 68, 0.5) 24px),
            var(--bg-tertiary)
          `,
          backgroundSize: "100% 100%, 100% 100%, 24px 24px, 24px 24px, 100% 100%",
          cursor: isPanning ? "grabbing" : "grab",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: 0 }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon
                points="0 0, 8 3, 0 6"
                fill="var(--accent-color)"
                opacity="0.5"
              />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map((edge) => {
            const fromPos = positions.get(edge.from);
            const toPos = positions.get(edge.to);
            if (!fromPos || !toPos) return null;

            const midY = (fromPos.y + toPos.y) / 2;
            const path = `M ${fromPos.x} ${fromPos.y} L ${fromPos.x} ${midY} L ${toPos.x} ${midY} L ${toPos.x} ${toPos.y}`;

            return (
              <path
                key={`${edge.from}-${edge.to}`}
                d={path}
                stroke="var(--border-hover)"
                strokeWidth={1.5}
                fill="none"
                opacity={0.6}
              />
            );
          })}

          {/* Active beam animation */}
          {activeNodeId && edges.some((e) => e.from === activeNodeId || e.to === activeNodeId) && (
            <g>
              {edges
                .filter((e) => e.from === activeNodeId || e.to === activeNodeId)
                .map((edge) => {
                  const fromPos = positions.get(edge.from);
                  const toPos = positions.get(edge.to);
                  if (!fromPos || !toPos) return null;
                  return (
                    <motion.line
                      key={`beam-${edge.from}-${edge.to}`}
                      x1={fromPos.x}
                      y1={fromPos.y}
                      x2={toPos.x}
                      y2={toPos.y}
                      stroke="var(--accent-color)"
                      strokeWidth={2}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  );
                })}
            </g>
          )}
        </svg>

        {/* Nodes */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          {nodes.map((node) => {
            const pos = positions.get(node.id);
            if (!pos) return null;

            const status = statusMap[node.id] || "IDLE";
            const color = getNodeColor(node.role, status);
            const Icon = getNodeIcon(node.role);
            const isActive = activeNodeId === node.id;

            return (
              <motion.div
                key={node.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
                style={{
                  position: "absolute",
                  left: pos.x - NODE_SIZE / 2,
                  top: pos.y - NODE_SIZE / 2,
                  width: NODE_SIZE,
                  height: NODE_SIZE,
                  cursor: "pointer",
                }}
                onClick={() => handleNodeClick(node.id)}
              >
                {/* Active ring */}
                {isActive && (
                  <div
                    style={{
                      position: "absolute",
                      inset: -6,
                      borderRadius: "50%",
                      border: "2px solid var(--accent-color)",
                      boxShadow: "0 0 20px var(--accent-color)",
                    }}
                  />
                )}

                {/* Node circle */}
                <div
                  style={{
                    width: NODE_SIZE,
                    height: NODE_SIZE,
                    borderRadius: "50%",
                    border: `2px solid ${color}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--bg-card)",
                    boxShadow: `0 0 16px ${color}44`,
                    transition: "box-shadow 0.2s",
                  }}
                >
                  <Icon size={20} color={color} />
                </div>

                {/* Status dot */}
                {status === "BUSY" && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "#22c55e",
                      border: "2px solid var(--bg-card)",
                      animation: "pulse 2s infinite",
                    }}
                  />
                )}

                {/* Label */}
                <div
                  style={{
                    position: "absolute",
                    top: NODE_SIZE + 4,
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--ink-2)",
                    whiteSpace: "nowrap",
                    textAlign: "center",
                    maxWidth: 80,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {node.role}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Scale indicator */}
      <div
        style={{
          padding: "6px 12px",
          borderTop: "1px solid var(--border-color)",
          fontSize: 12,
          fontFamily: "ui-monospace, monospace",
          color: "var(--ink-2)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>{nodes.length} agents</span>
        <span>{Math.round(scale * 100)}%</span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
});
