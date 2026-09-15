"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Tree } from "react-arborist";
import type { NodeRendererProps } from "react-arborist";

type AgentItem = {
  id: string;
  role: string;
  parentId?: string | null;
  status?: string;
};

type TreeNode = {
  id: string;
  name: string;
  role: string;
  status?: string;
  children?: TreeNode[];
};

type Props = {
  agents: AgentItem[];
  onSelect: (agentId: string) => void;
  selectedId?: string | null;
};

function statusDot(status?: string) {
  if (status === "BUSY") return "#ef4444";
  if (status === "WAKING") return "#facc15";
  return "#22c55e";
}

function AgentNodeRow({ node, style, dragHandle }: NodeRendererProps<TreeNode>) {
  const isSelected = node.isSelected;
  return (
    <div
      ref={dragHandle}
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "0 8px 0 " + (8 + node.level * 14) + "px",
        cursor: "pointer",
        borderRadius: 6,
        background: isSelected ? "rgba(14,165,233,0.1)" : "transparent",
        userSelect: "none",
      }}
      onClick={() => node.activate()}
    >
      {/* Expand/collapse caret */}
      {node.data.children && node.data.children.length > 0 && (
        <span
          style={{
            fontSize: 10,
            color: "var(--ui-muted)",
            width: 12,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
          }}
          onClick={(e) => {
            e.stopPropagation();
            node.toggle();
          }}
        >
          {node.isOpen ? "▾" : "▸"}
        </span>
      )}
      {/* Status dot */}
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          flexShrink: 0,
          background: statusDot(node.data.status),
        }}
      />
      {/* Role label */}
      <span
        style={{
          fontSize: 12,
          fontWeight: isSelected ? 600 : 400,
          color: isSelected ? "var(--ink)" : "var(--ui-muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {node.data.role}
      </span>
    </div>
  );
}

export function AgentTree({ agents, onSelect, selectedId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(400);

  // Measure container for react-arborist virtualized list
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(([entry]) => {
      const h = entry?.contentRect.height;
      if (h && h > 0) setHeight(h);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Convert flat agent list → nested tree
  const data = useMemo<TreeNode[]>(() => {
    const map = new Map<string, TreeNode>();
    for (const a of agents) {
      map.set(a.id, { id: a.id, name: a.role, role: a.role, status: a.status });
    }
    const roots: TreeNode[] = [];
    for (const a of agents) {
      const node = map.get(a.id)!;
      const parentOk = a.parentId && a.parentId !== a.id && map.has(a.parentId);
      if (parentOk) {
        const parent = map.get(a.parentId!)!;
        parent.children = parent.children ?? [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }, [agents]);

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflow: "hidden", minHeight: 0 }}
    >
      <Tree<TreeNode>
        data={data}
        onActivate={(node) => onSelect(node.data.id)}
        selection={selectedId ?? undefined}
        openByDefault
        rowHeight={30}
        height={height}
        width="100%"
        indent={0}
      >
        {AgentNodeRow}
      </Tree>
    </div>
  );
}
