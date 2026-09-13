"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Plus,
  Minus,
  RotateCcw,
  Hand,
  ZoomIn,
  ZoomOut,
  Send,
  X,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { useLanguage } from "../_components/LanguageContext";
import type { Translations } from "../i18n";

// ============================================================================
// Types
// ============================================================================

type NodeType = "master" | "live" | "doc" | "security";

export interface CanvasNode {
  id: string;
  type: NodeType;
  title: string;
  description: string;
  x: number;
  y: number;
  data?: {
    tpm?: string;
    status?: string;
    [key: string]: unknown;
  };
}

export interface CanvasConnection {
  id: string;
  from: string;
  to: string;
  color: string;
}

export interface VizBeam {
  id: string;
  fromId: string;
  toId: string;
  kind: "create" | "message";
  label?: string;
  createdAt: number;
}

interface Transform {
  x: number;
  y: number;
  scale: number;
}

interface CanvasViewProps {
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  onNodeClick?: (nodeId: string) => void;
  onNodeDrag?: (nodeId: string, x: number, y: number) => void;
  onAddNode?: () => void;
  chatGroupId?: string | null;
  chatSenderId?: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const NODE_COLORS: Record<NodeType, { border: string; bg: string; text: string }> = {
  master: { border: "var(--ui-canvas-accent)", bg: "var(--ui-canvas-surface)", text: "var(--ui-canvas-accent)" },
  live: { border: "var(--ui-canvas-green)", bg: "var(--ui-canvas-surface)", text: "var(--ui-canvas-green)" },
  doc: { border: "var(--ui-canvas-doc)", bg: "var(--ui-canvas-surface)", text: "var(--ui-canvas-doc)" },
  security: { border: "var(--ui-canvas-danger)", bg: "var(--ui-canvas-surface)", text: "var(--ui-canvas-danger)" },
};

function buildDefaultNodes(t: Translations): CanvasNode[] {
  return [
    {
      id: "node-1",
      type: "master",
      title: "Swarm_Core_01",
      description: t.canvasNodeOrchestrating,
      x: 150,
      y: 120,
    },
    {
      id: "node-2",
      type: "live",
      title: "Analytic_Node",
      description: t.canvasNodeTelemetry,
      x: 550,
      y: 400,
      data: { tpm: "14.2k" },
    },
    {
      id: "node-3",
      type: "doc",
      title: "Docu_Gen",
      description: t.canvasNodeDocs,
      x: 850,
      y: 200,
    },
    {
      id: "node-4",
      type: "security",
      title: "Security_Sentry",
      description: t.canvasNodeAnomaly,
      x: 250,
      y: 600,
    },
  ];
}

const DEFAULT_CONNECTIONS: CanvasConnection[] = [
  { id: "conn-1", from: "node-1", to: "node-2", color: "var(--ui-canvas-accent)" },
  { id: "conn-2", from: "node-2", to: "node-3", color: "var(--ui-canvas-accent)" },
  { id: "conn-3", from: "node-1", to: "node-4", color: "var(--ui-canvas-green)" },
];

// ============================================================================
// MiniMap Component
// ============================================================================

function MiniMap({
  nodes,
  transform,
  canvasRef,
  onMiniMapClick,
}: {
  nodes: CanvasNode[];
  transform: Transform;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  onMiniMapClick?: (x: number, y: number) => void;
}) {
  const MINIMAP_WIDTH = 180;
  const MINIMAP_HEIGHT = 120;
  const CANVAS_WIDTH = 1200;
  const CANVAS_HEIGHT = 800;

  const scaleX = MINIMAP_WIDTH / CANVAS_WIDTH;
  const scaleY = MINIMAP_HEIGHT / CANVAS_HEIGHT;

  const viewportRect = {
    x: (-transform.x / transform.scale) * scaleX,
    y: (-transform.y / transform.scale) * scaleY,
    width: (CANVAS_WIDTH / transform.scale) * scaleX,
    height: (CANVAS_HEIGHT / transform.scale) * scaleY,
  };

  const handleMiniMapClick = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert mini-map coordinates to canvas coordinates
    const canvasX = (clickX / scaleX) * transform.scale + transform.x;
    const canvasY = (clickY / scaleY) * transform.scale + transform.y;

    onMiniMapClick?.(canvasX, canvasY);
  };

  return (
    <div
      className="absolute bottom-4 right-4 w-[180px] h-[120px] bg-[var(--ui-canvas-deep)] border border-[var(--ui-canvas-border)] rounded-lg overflow-hidden cursor-pointer"
      onClick={handleMiniMapClick}
    >
      {/* Nodes on minimap */}
      {nodes.map((node) => (
        <div
          key={node.id}
          className="absolute w-2 h-2 rounded-full"
          style={{
            left: node.x * scaleX,
            top: node.y * scaleY,
            backgroundColor: NODE_COLORS[node.type].border,
          }}
        />
      ))}

      {/* Viewport indicator */}
      <div
        className="absolute border border-[var(--ui-canvas-viewport-border)] bg-[var(--ui-canvas-viewport-fill)]"
        style={{
          left: viewportRect.x,
          top: viewportRect.y,
          width: Math.max(viewportRect.width, 10),
          height: Math.max(viewportRect.height, 10),
        }}
      />
    </div>
  );
}

// ============================================================================
// MiniChatWidget Component
// ============================================================================

type MiniChatMessage = { id: string; text: string; isUser: boolean };

function MiniChatWidget({
  onClose,
  groupId,
  senderId,
}: {
  onClose?: () => void;
  groupId?: string | null;
  senderId?: string | null;
}) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<MiniChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 拉取该 group 的真实消息（与 IMShell 主流程同源：GET /api/groups/:id/messages）
  const loadMessages = useCallback(async (): Promise<MiniChatMessage[] | null> => {
    if (!groupId || !senderId) return null;
    try {
      const res = await fetch(
        `/api/groups/${groupId}/messages?readerId=${encodeURIComponent(senderId)}`
      );
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
      }
      const data = (await res.json()) as {
        messages: Array<{ id: string; senderId: string; content: string }>;
      };
      const next = (data.messages ?? []).map((m) => ({
        id: m.id,
        text: m.content,
        isUser: m.senderId === senderId,
      }));
      setMessages(next);
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, [groupId, senderId]);

  useEffect(() => {
    setError(null);
    void loadMessages();
  }, [loadMessages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    if (!groupId || !senderId) {
      setError(t.sessionNotReadyDetail);
      return;
    }

    const optimisticId = `local-${Date.now()}`;
    setMessages((prev) => [...prev, { id: optimisticId, text, isUser: true }]);
    setInput("");
    setIsSending(true);
    setError(null);

    // 与 IMShell 主流程同源：POST /api/groups/:id/messages（agent 由后端唤醒）
    try {
      const res = await fetch(`/api/groups/${groupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderId, content: text, contentType: "text" }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText} ${detail}`);
      }

      // 轮询等待真实回复到达
      for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise((r) => setTimeout(r, 2000));
        const next = await loadMessages();
        if (next && next.length > messages.length + 1) break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="absolute bottom-4 left-4 w-80 bg-[var(--ui-canvas-surface)] border border-[var(--ui-canvas-border)] rounded-card overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--ui-canvas-border)] flex items-center justify-between bg-[var(--ui-canvas-surface-2)]">
        <span className="text-emphasis font-semibold text-[color:var(--ui-canvas-ink)]">{t.quickChat}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-[color:var(--ui-canvas-ink-2)] hover:text-[color:var(--ui-canvas-ink)] transition-colors"
          >
            {isMinimized ? (
              <Maximize2 className="w-3.5 h-3.5" />
            ) : (
              <Minimize2 className="w-3.5 h-3.5" />
            )}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-[color:var(--ui-canvas-ink-2)] hover:text-[color:var(--ui-canvas-ink)] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {!isMinimized && (
        <>
          <div className="h-48 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {messages.length === 0 && !error && (
              <div className="text-caption text-[color:var(--ui-canvas-ink-2)] text-center py-8">
                {groupId && senderId ? t.noMessages : t.sessionNotReady}
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`text-caption p-2 rounded-lg ${
                  msg.isUser
                    ? "bg-[var(--ui-accent)] text-[color:var(--ui-on-accent)] ml-8"
                    : "bg-[var(--ui-canvas-surface-2)] text-[color:var(--ui-canvas-ink-2)] mr-8"
                }`}
              >
                {msg.text}
              </div>
            ))}
            {error && (
              <div className="text-caption p-2 rounded-lg bg-[var(--ui-canvas-danger-bg)] text-[color:var(--ui-canvas-danger-text)]">
                {t.sendFailed} {error}
              </div>
            )}
            {isSending && (
              <div className="text-caption text-[color:var(--ui-canvas-ink-2)] text-center">{t.waitingForReply}</div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-[var(--ui-canvas-border)] flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSend();
              }}
              placeholder={t.newMessage}
              className="flex-1 bg-[var(--ui-canvas-surface-2)] border border-[var(--ui-canvas-border)] rounded-lg px-3 py-2 text-caption text-[color:var(--ui-canvas-ink)] outline-none focus:border-[var(--ui-accent)]"
            />
            <button
              onClick={() => void handleSend()}
              disabled={isSending}
              className="p-2 bg-[var(--ui-accent)] rounded-lg hover:bg-[var(--ui-accent-hover)] transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 text-[color:var(--ui-on-accent)]" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// CanvasControls Component
// ============================================================================

function CanvasControls({
  onZoomIn,
  onZoomOut,
  onReset,
  onAddNode,
  transform,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onAddNode?: () => void;
  transform: Transform;
}) {
  const { t } = useLanguage();

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[var(--ui-canvas-surface)] border border-[var(--ui-canvas-border)] rounded-lg p-2">
      <button
        onClick={onZoomOut}
        className="p-2 text-[color:var(--ui-canvas-ink-2)] hover:text-[color:var(--ui-canvas-ink)] hover:bg-[var(--ui-canvas-surface-2)] rounded-lg transition-colors"
        title={t.zoomOut}
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>

      <div className="px-3 text-caption text-[color:var(--ui-canvas-ink-2)] font-mono min-w-[60px] text-center">
        {Math.round(transform.scale * 100)}%
      </div>

      <button
        onClick={onZoomIn}
        className="p-2 text-[color:var(--ui-canvas-ink-2)] hover:text-[color:var(--ui-canvas-ink)] hover:bg-[var(--ui-canvas-surface-2)] rounded-lg transition-colors"
        title={t.zoomIn}
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>

      <div className="w-px h-5 bg-[var(--ui-canvas-border)]" />

      <button
        onClick={onReset}
        className="p-2 text-[color:var(--ui-canvas-ink-2)] hover:text-[color:var(--ui-canvas-ink)] hover:bg-[var(--ui-canvas-surface-2)] rounded-lg transition-colors"
        title={t.resetView}
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>

      <div className="w-px h-5 bg-[var(--ui-canvas-border)]" />

      {onAddNode && (
        <button
          onClick={onAddNode}
          className="p-2 text-[color:var(--ui-canvas-ink-2)] hover:text-[color:var(--ui-canvas-ink)] hover:bg-[var(--ui-canvas-surface-2)] rounded-lg transition-colors"
          title={t.addNode}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Node Component
// ============================================================================

function CanvasNodeComponent({
  node,
  isSelected,
  onSelect,
  onPointerDown,
}: {
  node: CanvasNode;
  isSelected?: boolean;
  onSelect?: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const colors = NODE_COLORS[node.type];

  return (
    <div
      className={`absolute w-48 bg-[var(--ui-canvas-surface)] border-2 rounded-card p-4 cursor-grab active:cursor-grabbing select-none transition-shadow ${
        isSelected ? "shadow-2xl shadow-[color:var(--ui-canvas-glow)]" : ""
      }`}
      style={{
        left: node.x,
        top: node.y,
        borderColor: colors.border,
      }}
      onPointerDown={onPointerDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {/* Node Header */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: colors.border }}
        />
        <span className="text-caption font-semibold uppercase tracking-wider" style={{ color: colors.text }}>
          {node.type}
        </span>
      </div>

      {/* Node Title */}
      <h3 className="text-emphasis font-bold text-[color:var(--ui-canvas-ink)] mb-1 truncate">{node.title}</h3>

      {/* Node Description */}
      <p className="text-caption text-[color:var(--ui-canvas-ink-2)] line-clamp-2">{node.description}</p>

      {/* Node Data (if any) */}
      {node.data?.tpm && (
        <div className="mt-3 pt-3 border-t border-[var(--ui-canvas-border)]">
          <span className="text-caption text-[color:var(--ui-canvas-ink-2)]">TPM: </span>
          <span className="text-caption font-mono text-[color:var(--ui-canvas-green)]">{node.data.tpm}</span>
        </div>
      )}

      {/* Status indicator */}
      <div className="absolute bottom-2 right-2">
        <div className="w-2 h-2 rounded-full bg-[var(--ui-canvas-green)] animate-pulse" />
      </div>
    </div>
  );
}

// ============================================================================
// Main CanvasView Component
// ============================================================================

export function CanvasView({
  nodes: propNodes,
  connections: propConnections,
  onNodeClick,
  onNodeDrag,
  onAddNode,
  chatGroupId,
  chatSenderId,
}: CanvasViewProps) {
  // Use prop nodes or defaults
  const { t } = useLanguage();
  const [nodes, setNodes] = useState<CanvasNode[]>(() =>
    propNodes.length > 0 ? propNodes : buildDefaultNodes(t)
  );
  const [connections] = useState<CanvasConnection[]>(
    propConnections.length > 0 ? propConnections : DEFAULT_CONNECTIONS
  );

  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showMiniChat, setShowMiniChat] = useState(true);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Sync external nodes
  useEffect(() => {
    if (propNodes.length > 0) {
      setNodes(propNodes);
    }
  }, [propNodes]);

  // Re-localize the demo nodes' descriptions when the language changes
  useEffect(() => {
    if (propNodes.length > 0) return;
    const localized = buildDefaultNodes(t);
    setNodes((prev) =>
      prev.map((n) => {
        const match = localized.find((d) => d.id === n.id);
        return match ? { ...n, description: match.description } : n;
      })
    );
  }, [t, propNodes.length]);

  // Pointer handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.target === canvasRef.current || (e.target as HTMLElement).tagName === "svg") {
        setIsPanning(true);
        setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
        setSelectedNodeId(null);
      }
    },
    [transform]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (draggingNodeId) {
        setNodes((prevNodes) =>
          prevNodes.map((n) => {
            if (n.id === draggingNodeId) {
              const newX = (e.clientX - transform.x) / transform.scale - dragOffset.x;
              const newY = (e.clientY - transform.y) / transform.scale - dragOffset.y;
              return { ...n, x: newX, y: newY };
            }
            return n;
          })
        );
        onNodeDrag?.(draggingNodeId, nodes.find((n) => n.id === draggingNodeId)?.x || 0, nodes.find((n) => n.id === draggingNodeId)?.y || 0);
      } else if (isPanning) {
        setTransform({
          ...transform,
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      }
    },
    [draggingNodeId, isPanning, transform, panStart, dragOffset, nodes, onNodeDrag]
  );

  const handlePointerUp = useCallback(() => {
    setDraggingNodeId(null);
    setIsPanning(false);
  }, []);

  const handleNodePointerDown = useCallback(
    (e: React.PointerEvent, node: CanvasNode) => {
      e.stopPropagation();
      setDraggingNodeId(node.id);
      setDragOffset({
        x: (e.clientX - transform.x) / transform.scale - node.x,
        y: (e.clientY - transform.y) / transform.scale - node.y,
      });
    },
    [transform]
  );

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setTransform((t) => ({ ...t, scale: Math.min(t.scale * 1.2, 3) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setTransform((t) => ({ ...t, scale: Math.max(t.scale / 1.2, 0.3) }));
  }, []);

  const handleReset = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  // Add new node
  const handleAddNode = useCallback(() => {
    const newNode: CanvasNode = {
      id: `node-${Date.now()}`,
      type: "live",
      title: `Agent_${Date.now().toString(36).slice(-4).toUpperCase()}`,
      description: t.newAgentNode,
      x: 400 + Math.random() * 200,
      y: 300 + Math.random() * 200,
    };
    setNodes((prev) => [...prev, newNode]);
    onAddNode?.();
  }, [onAddNode, t]);

  // Get node positions for connection lines
  const getNodeCenter = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    return {
      x: node.x + 96, // Half of node width (192/2)
      y: node.y + 60, // Approximate center
    };
  };

  // Generate SVG path for connection
  const getConnectionPath = (from: string, to: string) => {
    const start = getNodeCenter(from);
    const end = getNodeCenter(to);
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    // Bezier curve control points
    return `M ${start.x} ${start.y} Q ${midX} ${start.y} ${midX} ${midY} T ${end.x} ${end.y}`;
  };

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-full bg-[var(--ui-canvas-deep)] overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Grid Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle, var(--ui-canvas-border) 1px, transparent 1px)
          `,
          backgroundSize: `${20 * transform.scale}px ${20 * transform.scale}px`,
          backgroundPosition: `${transform.x}px ${transform.y}px`,
        }}
      />

      {/* Transform Container */}
      <div
        className="absolute"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
        }}
      >
        {/* SVG Connections Layer */}
        <svg className="absolute inset-0 w-[2000px] h-[2000px] pointer-events-none -translate-x-1/2 -translate-y-1/2">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="var(--ui-canvas-accent)" />
            </marker>
          </defs>

          {connections.map((conn) => {
            const fromNode = nodes.find((n) => n.id === conn.from);
            const toNode = nodes.find((n) => n.id === conn.to);
            if (!fromNode || !toNode) return null;

            const start = getNodeCenter(conn.from);
            const end = getNodeCenter(conn.to);

            return (
              <g key={conn.id}>
                {/* Glow effect */}
                <path
                  d={getConnectionPath(conn.from, conn.to)}
                  fill="none"
                  stroke={conn.color}
                  strokeWidth="6"
                  strokeOpacity="0.2"
                  strokeLinecap="round"
                />
                {/* Main line */}
                <path
                  d={getConnectionPath(conn.from, conn.to)}
                  fill="none"
                  stroke={conn.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </g>
            );
          })}
        </svg>

        {/* Nodes Layer */}
        {nodes.map((node) => (
          <CanvasNodeComponent
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            onSelect={() => {
              setSelectedNodeId(node.id);
              onNodeClick?.(node.id);
            }}
            onPointerDown={(e) => handleNodePointerDown(e, node)}
          />
        ))}
      </div>

      {/* Mini Map */}
      <MiniMap
        nodes={nodes}
        transform={transform}
        canvasRef={canvasRef}
        onMiniMapClick={(x, y) => {
          setTransform({
            ...transform,
            x: -x + window.innerWidth / 2,
            y: -y + window.innerHeight / 2,
          });
        }}
      />

      {/* Mini Chat Widget */}
      {showMiniChat && (
        <MiniChatWidget
          onClose={() => setShowMiniChat(false)}
          groupId={chatGroupId}
          senderId={chatSenderId}
        />
      )}

      {/* Canvas Controls */}
      <CanvasControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
        onAddNode={handleAddNode}
        transform={transform}
      />
    </div>
  );
}

export default CanvasView;
