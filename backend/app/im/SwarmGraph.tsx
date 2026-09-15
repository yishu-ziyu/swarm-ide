"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type AgentItem = {
  id: string;
  name?: string;
  role: string;
  parentId?: string | null;
  status?: string;
};

type CustomEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

export type SwarmGraphProps = {
  agents: AgentItem[];
  edges?: CustomEdge[];
  onAgentSelect?: (agentId: string) => void;
  selectedAgentId?: string | null;
  className?: string;
  style?: React.CSSProperties;
};

function statusRing(status?: string) {
  if (status === "BUSY") return "#ef4444";
  if (status === "WAKING") return "#facc15";
  return "#22c55e";
}

function roleAccent(role: string) {
  if (role === "human") return "#f8fafc";
  if (role === "assistant") return "#38bdf8";
  if (role === "productmanager") return "#fb7185";
  if (role === "coder") return "#4ade80";
  return "#a78bfa";
}

// Simple hierarchical auto-layout (BFS, left-to-right per depth)
function buildLayout(agents: AgentItem[]) {
  const byId = new Map(agents.map((a) => [a.id, a]));
  const childrenOf = new Map<string, string[]>();
  const roots: string[] = [];

  for (const a of agents) {
    const parentOk = a.parentId && a.parentId !== a.id && byId.has(a.parentId);
    if (parentOk) {
      const kids = childrenOf.get(a.parentId!) ?? [];
      kids.push(a.id);
      childrenOf.set(a.parentId!, kids);
    } else {
      roots.push(a.id);
    }
  }

  const positions = new Map<string, { x: number; y: number }>();
  // Assign leaf indices per depth, then center parents
  let leafIdx = 0;
  const leafIdxMap = new Map<string, number>();

  const assignLeaf = (id: string) => {
    const kids = childrenOf.get(id) ?? [];
    if (kids.length === 0) {
      leafIdxMap.set(id, leafIdx++);
    } else {
      for (const k of kids) assignLeaf(k);
    }
  };
  for (const r of roots) assignLeaf(r);

  const assignPos = (id: string, depth: number) => {
    const kids = childrenOf.get(id) ?? [];
    if (kids.length === 0) {
      const idx = leafIdxMap.get(id) ?? 0;
      positions.set(id, { x: idx * 160, y: depth * 130 });
    } else {
      for (const k of kids) assignPos(k, depth + 1);
      const first = positions.get(kids[0]!)!;
      const last = positions.get(kids[kids.length - 1]!)!;
      positions.set(id, { x: (first.x + last.x) / 2, y: depth * 130 });
    }
  };
  for (const r of roots) assignPos(r, 0);

  // Fallback for any agent not yet positioned
  for (const a of agents) {
    if (!positions.has(a.id)) positions.set(a.id, { x: leafIdx++ * 160, y: 0 });
  }

  return positions;
}

export function SwarmGraph({
  agents,
  edges: customEdges,
  onAgentSelect,
  selectedAgentId,
  className,
  style,
}: SwarmGraphProps) {
  const { nodes, edges } = useMemo(() => {
    const positions = buildLayout(agents);
    const byId = new Map(agents.map((a) => [a.id, a]));

    const nodes: Node[] = agents.map((a) => {
      const ring = statusRing(a.status);
      const selected = selectedAgentId === a.id;
      return {
        id: a.id,
        position: positions.get(a.id) ?? { x: 0, y: 0 },
        data: { label: a.name ?? a.role },
        style: {
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "#09090b",
          border: `2px solid ${selected ? "#0ea5e9" : ring}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 700,
          color: roleAccent(a.role),
          boxShadow: selected
            ? "0 0 0 4px rgba(14,165,233,0.25)"
            : `0 0 12px ${ring}33`,
          cursor: "pointer",
        },
      };
    });

    // Edges from parentId hierarchy
    const hierarchyEdges: Edge[] = agents
      .filter((a) => a.parentId && a.parentId !== a.id && byId.has(a.parentId))
      .map((a) => ({
        id: `e-${a.parentId}-${a.id}`,
        source: a.parentId!,
        target: a.id,
        style: { stroke: "rgba(148,163,184,0.35)", strokeWidth: 1.5 },
      }));

    const extra: Edge[] = (customEdges ?? []).map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      style: { stroke: "#38bdf8", strokeWidth: 1.5, strokeDasharray: "6 3" },
    }));

    return { nodes, edges: [...hierarchyEdges, ...extra] };
  }, [agents, customEdges, selectedAgentId]);

  const onNodeClick = useCallback(
    (_evt: React.MouseEvent, node: Node) => {
      onAgentSelect?.(node.id);
    },
    [onAgentSelect]
  );

  return (
    <div
      className={className}
      style={{ width: "100%", height: "100%", minHeight: 360, ...style }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.35 }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(148,163,184,0.12)"
        />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
