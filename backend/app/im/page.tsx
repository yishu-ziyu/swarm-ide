"use client";

import { useSearchParams } from "next/navigation";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from "react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Briefcase, ChevronDown, ChevronRight, Code2, Network, User } from "lucide-react";
import { Streamdown } from "streamdown";
import { createCodePlugin } from "@streamdown/code";
import { mermaid } from "@streamdown/mermaid";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { IMMessageList } from "./IMMessageList";
import { ResearchWorkbench } from "./ResearchWorkbench";
import { CommandPalette } from "./CommandPalette";
import { SwarmGraph } from "./SwarmGraph";
import { AgentTree } from "./AgentTree";
import { useLanguage } from "../_components/LanguageContext";

// Create code plugin with dark theme
const code = createCodePlugin({
  themes: ["github-dark", "github-dark"], // Use dark theme for both light/dark modes
});

type UUID = string;

type WorkspaceDefaults = {
  workspaceId: UUID;
  humanAgentId: UUID;
  assistantAgentId: UUID;
  defaultGroupId: UUID;
};

type AgentMeta = {
  id: UUID;
  role: string;
  parentId: UUID | null;
  createdAt: string;
};

type AgentStatus = "IDLE" | "BUSY" | "WAKING";

type Group = {
  id: UUID;
  name: string | null;
  memberIds: UUID[];
  unreadCount: number;
  contextTokens: number;
  lastMessage?: {
    content: string;
    contentType: string;
    sendTime: string;
    senderId: UUID;
  };
  updatedAt: string;
  createdAt: string;
};

type Message = {
  id: UUID;
  senderId: UUID;
  content: string;
  contentType: string;
  sendTime: string;
};

type AppSettings = {
  llmProvider?: "ark" | "openrouter" | "minimax";
  arkApiKey?: string;
  arkBaseUrl?: string;
  arkModel?: string;
  arkApiKeyConfigured?: boolean;
  openRouterApiKey?: string;
  openRouterBaseUrl?: string;
  openRouterModel?: string;
  openRouterApiKeyConfigured?: boolean;
  minimaxApiKey?: string;
  minimaxBaseUrl?: string;
  minimaxModel?: string;
  minimaxApiKeyConfigured?: boolean;
  allowHostBash?: boolean;
  researchMaxAgents?: number;
};

type UiStreamEvent = {
  id?: number;
  at?: number;
  event: string;
  data: Record<string, any>;
};

type VizEvent = {
  id: string;
  kind: "agent" | "message" | "llm" | "tool" | "db";
  label: string;
  at: number;
};

type VizBeam = {
  id: string;
  fromId: UUID;
  toId: UUID;
  kind: "create" | "message";
  label?: string;
  createdAt: number;
};

type VizDebugEntry = {
  id: string;
  at: number;
  type: "message_event" | "beam_created" | "beam_skipped";
  data: Record<string, unknown>;
};

type RightPanelId = "history" | "content" | "reasoning" | "tools";
type RightPanelState = {
  id: RightPanelId;
  title: string;
  size: number;
  collapsed: boolean;
};

// Streamdown plugins for markdown rendering
const streamdownPlugins = { code, mermaid };

// Helper component for rendering markdown content
function MarkdownContent({ content, className = "" }: { content: string; className?: string }) {
  if (!content) return <span className="muted">—</span>;
  return (
    <div className={className}>
      <Streamdown plugins={streamdownPlugins}>{content}</Streamdown>
    </div>
  );
}

type AgentStreamEvent =
  | {
      id: number;
      at: number;
      event: "agent.stream";
      data: {
        kind: "reasoning" | "content" | "tool_calls" | "tool_result";
        delta: string;
        tool_call_id?: string;
        tool_call_name?: string;
      };
    }
  | {
      id: number;
      at: number;
      event: "agent.wakeup";
      data: { agentId: string; reason?: string | null };
    }
  | {
      id: number;
      at: number;
      event: "agent.unread";
      data: { agentId: string; batches: Array<{ groupId: string; messageIds: string[] }> };
    }
  | { id: number; at: number; event: "agent.done"; data: { finishReason?: string | null } }
  | { id: number; at: number; event: "agent.error"; data: { message: string } };

const SESSION_KEY = "agent-wechat.session.v1";
const RIGHT_PANEL_MIN_HEIGHT = 120;
const RIGHT_PANEL_HEADER_HEIGHT = 32;
const MID_CHAT_MIN_HEIGHT = 0;
const MID_GRAPH_MIN_HEIGHT = 160;
const MID_SPLITTER_SIZE = 6;

function loadSession(): WorkspaceDefaults | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WorkspaceDefaults;
  } catch {
    return null;
  }
}

function saveSession(session: WorkspaceDefaults) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${text}`);
  }
  return (await res.json()) as T;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

export default function IMPage() {
  const { t } = useLanguage();
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>{t.loading}</div>}>
      <IMPageInner />
    </Suspense>
  );
}

function IMPageInner() {
  const { t, theme, toggleTheme } = useLanguage();
  const searchParams = useSearchParams();
  const workspaceOverrideId = searchParams.get("workspaceId");
  const [session, setSession] = useState<WorkspaceDefaults | null>(() => null);
  const [tokenLimit, setTokenLimit] = useState<number>(100000);
  const [groups, setGroups] = useState<Group[]>([]);
  const [agents, setAgents] = useState<AgentMeta[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"boot" | "groups" | "messages" | "send" | "idle">("boot");
  const [error, setError] = useState<string | null>(null);
  const [stoppingAgents, setStoppingAgents] = useState(false);
  const [researchTick, setResearchTick] = useState(0);
  const [workspaceList, setWorkspaceList] = useState<Array<{ id: string; name: string }>>([]);

  const [contentStream, setContentStream] = useState("");
  const [reasoningStream, setReasoningStream] = useState("");
  const [toolStream, setToolStream] = useState("");
  const [llmHistory, setLlmHistory] = useState("");
  const [agentError, setAgentError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [vizEvents, setVizEvents] = useState<VizEvent[]>([]);
  const [vizBeams, setVizBeams] = useState<VizBeam[]>([]);
  const [vizSize, setVizSize] = useState({ width: 640, height: 260 });
  const [vizScale, setVizScale] = useState(0.9);
  const [vizOffset, setVizOffset] = useState({ x: 0, y: 0 });
  const [vizIsPanning, setVizIsPanning] = useState(false);
  const [agentStatusById, setAgentStatusById] = useState<Record<string, AgentStatus>>({});
  const [vizDebug, setVizDebug] = useState<VizDebugEntry[]>([]);
  const [vizEventsCollapsed, setVizEventsCollapsed] = useState(false);
  const [rightPanels, setRightPanels] = useState<RightPanelState[]>([
    { id: "history", title: "", size: 320, collapsed: false },
    { id: "content", title: "", size: 220, collapsed: false },
    { id: "reasoning", title: "", size: 220, collapsed: false },
    { id: "tools", title: "", size: 200, collapsed: false },
  ]);

  // Initialize panel titles with translations
  useEffect(() => {
    setRightPanels([
      { id: "history", title: t.llmHistory, size: 320, collapsed: false },
      { id: "content", title: t.realtimeContent, size: 220, collapsed: false },
      { id: "reasoning", title: t.realtimeReasoning, size: 220, collapsed: false },
      { id: "tools", title: t.realtimeTools, size: 200, collapsed: false },
    ]);
  }, [t]);
  const [midSplitRatio, setMidSplitRatio] = useState(0.55);
  const [midStackHeight, setMidStackHeight] = useState(0);
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [collapsedAgents, setCollapsedAgents] = useState<Record<string, boolean>>({});
  const [activeNav, setActiveNav] = useState("fleet");
  const [focusMode, setFocusMode] = useState<"none" | "left" | "mid" | "right">("none");
  const [leftPanelWidth, setLeftPanelWidth] = useState(240);
  const [rightPanelWidth, setRightPanelWidth] = useState(320);

  // View mode state for UI switching
  const [viewMode, setViewMode] = useState<"chat" | "canvas">("chat");

  // Command palette
  const [cmdOpen, setCmdOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const activeGroupIdRef = useRef<string | null>(null);
  const streamAgentIdRef = useRef<string | null>(null);
  const streamAgentIdValueRef = useRef<string | null>(null);
  const agentRoleByIdRef = useRef<Map<string, string>>(new Map());
  const toolCallBuffersRef = useRef<Map<string, string>>(new Map());
  const toolResultBuffersRef = useRef<Map<string, string>>(new Map());
  const uiEsRef = useRef<EventSource | null>(null);
  const llmHistoryReqIdRef = useRef(0);
  const vizRef = useRef<HTMLDivElement | null>(null);
  const midStackRef = useRef<HTMLDivElement | null>(null);
  const midChatHeightRef = useRef(0);
  const nodeOffsetsRef = useRef<Record<string, { x: number; y: number }>>({});
  const groupsRef = useRef<Group[]>([]);
  const tRef = useRef(t);
  tRef.current = t;
  const beamTimeoutsRef = useRef<number[]>([]);
  const refreshQueueRef = useRef<{
    timer: number | null;
    pending: { groups: boolean; agents: boolean; messages: boolean; llmHistory: boolean };
  }>({ timer: null, pending: { groups: false, agents: false, messages: false, llmHistory: false } });
  const vizPanStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);


  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeGroupId) ?? null,
    [groups, activeGroupId]
  );

  const agentRoleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agents) map.set(a.id, a.role);
    return map;
  }, [agents]);

  const vizLayout = useMemo(() => {
    const width = Math.max(1, vizSize.width);
    const height = Math.max(1, vizSize.height);
    const paddingX = 70;
    const paddingY = 60;
    const byId = new Map(agents.map((a) => [a.id, a]));
    const parentById = new Map<string, string | null>();
    const childrenById = new Map<string, AgentMeta[]>();
    const roots: AgentMeta[] = [];

    for (const agent of agents) {
      const parentId = agent.parentId;
      if (parentId && parentId !== agent.id && byId.has(parentId)) {
        const list = childrenById.get(parentId) ?? [];
        list.push(agent);
        childrenById.set(parentId, list);
        parentById.set(agent.id, parentId);
      } else {
        roots.push(agent);
        parentById.set(agent.id, null);
      }
    }

    const byCreatedAt = (a: AgentMeta, b: AgentMeta) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

    for (const list of childrenById.values()) list.sort(byCreatedAt);
    roots.sort(byCreatedAt);

    if (session) {
      const humanIndex = roots.findIndex((a) => a.id === session.humanAgentId);
      if (humanIndex > -1) {
        const [human] = roots.splice(humanIndex, 1);
        roots.unshift(human);
      }
    }

    const nodeMeta = new Map<string, { xIndex: number; depth: number }>();
    let leafIndex = 0;
    let maxDepth = 0;
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const walk = (agent: AgentMeta, depth: number): { min: number; max: number } => {
      if (visited.has(agent.id)) {
        const meta = nodeMeta.get(agent.id);
        if (meta) return { min: meta.xIndex, max: meta.xIndex };
      }
      if (visiting.has(agent.id)) {
        const xIndex = leafIndex++;
        nodeMeta.set(agent.id, { xIndex, depth });
        return { min: xIndex, max: xIndex };
      }

      visiting.add(agent.id);
      maxDepth = Math.max(maxDepth, depth);
      const children = (childrenById.get(agent.id) ?? []).filter((child) => child.id !== agent.id);
      let range: { min: number; max: number };
      if (children.length === 0) {
        const xIndex = leafIndex++;
        nodeMeta.set(agent.id, { xIndex, depth });
        range = { min: xIndex, max: xIndex };
      } else {
        const ranges = children.map((child) => walk(child, depth + 1));
        const min = ranges[0]?.min ?? leafIndex;
        const max = ranges[ranges.length - 1]?.max ?? min;
        const xIndex = (min + max) / 2;
        nodeMeta.set(agent.id, { xIndex, depth });
        range = { min, max };
      }
      visiting.delete(agent.id);
      visited.add(agent.id);
      return range;
    };

    roots.forEach((root) => {
      walk(root, 0);
    });

    for (const agent of agents) {
      if (!nodeMeta.has(agent.id)) {
        walk(agent, 0);
      }
    }

    const leafCount = Math.max(1, leafIndex);
    const depthCount = Math.max(1, maxDepth + 1);
    const baseSpan = Math.max(1, width - paddingX * 2);
    const maxSpan =
      leafCount <= 2 ? Math.min(baseSpan, 360) : leafCount <= 4 ? Math.min(baseSpan, 520) : baseSpan;
    const xSpan = Math.max(1, maxSpan);
    const xStart = (width - xSpan) / 2;
    const ySpan = Math.max(1, height - paddingY * 2);
    const xStep = leafCount === 1 ? 0 : xSpan / (leafCount - 1);
    const yStep = depthCount === 1 ? 0 : ySpan / (depthCount - 1);

    const basePositions = new Map<string, { x: number; y: number }>();
    for (const agent of agents) {
      const meta = nodeMeta.get(agent.id);
      if (!meta) continue;
      basePositions.set(agent.id, {
        x: xStart + meta.xIndex * xStep,
        y: paddingY + meta.depth * yStep,
      });
    }

    const offsetCache = new Map<string, { x: number; y: number }>();
    const positions = new Map<string, { x: number; y: number }>();
    const getAccumulatedOffset = (id: string) => {
      if (offsetCache.has(id)) return offsetCache.get(id)!;
      let x = 0;
      let y = 0;
      const seen = new Set<string>();
      let current: string | null | undefined = id;
      while (current) {
        if (seen.has(current)) break;
        seen.add(current);
        const offset = nodeOffsets[current];
        if (offset) {
          x += offset.x;
          y += offset.y;
        }
        current = parentById.get(current) ?? null;
      }
      const total = { x, y };
      offsetCache.set(id, total);
      return total;
    };

    for (const agent of agents) {
      const base = basePositions.get(agent.id);
      if (!base) continue;
      const offset = getAccumulatedOffset(agent.id);
      positions.set(agent.id, { x: base.x + offset.x, y: base.y + offset.y });
    }

    const ordered = [...agents].sort((a, b) => {
      const da = nodeMeta.get(a.id)?.depth ?? 0;
      const db = nodeMeta.get(b.id)?.depth ?? 0;
      if (da !== db) return da - db;
      return byCreatedAt(a, b);
    });

    const edges: Array<{ fromId: UUID; toId: UUID }> = [];
    for (const [parentId, children] of childrenById.entries()) {
      for (const child of children) {
        edges.push({ fromId: parentId, toId: child.id });
      }
    }

    return { positions, ordered, edges, parentById };
  }, [agents, session, vizSize.height, vizSize.width, nodeOffsets]);

  const getGroupLabel = useCallback(
    (g: Group | null | undefined) => {
      if (!g) return t.group;
      if (g.name) return g.name;
      if (g.id === session?.defaultGroupId) return t.p2pHumanAssistant;

      const memberRoles = g.memberIds
        .filter((id) => id !== session?.humanAgentId)
        .map((id) => agentRoleById.get(id) ?? id.slice(0, 8));

      if (memberRoles.length === 1) return `P2P ↔ ${memberRoles[0]}`;
      if (memberRoles.length === 2) return `${memberRoles[0]} ↔ ${memberRoles[1]}`;
      if (memberRoles.length > 2) return `${t.group} (${memberRoles.length})`;
      return t.group;
    },
    [agentRoleById, session?.defaultGroupId, session?.humanAgentId, t]
  );

  const groupByAgentId = useMemo(() => {
    const map = new Map<string, Group>();
    if (!session) return map;
    for (const g of groups) {
      if (!g.memberIds.includes(session.humanAgentId)) continue;
      const others = g.memberIds.filter((id) => id !== session.humanAgentId);
      if (others.length === 1) {
        map.set(others[0], g);
      }
    }
    return map;
  }, [groups, session]);

  const agentTreeRows = useMemo(() => {
    if (!session)
      return [] as Array<{
        agent: AgentMeta;
        group: Group | null;
        depth: number;
        hasChildren: boolean;
        collapsed: boolean;
        guides: boolean[];
        isLast: boolean;
      }>;
    const byId = new Map(agents.map((a) => [a.id, a]));
    const childrenById = new Map<string, AgentMeta[]>();
    const roots: AgentMeta[] = [];
    const byCreatedAt = (a: AgentMeta, b: AgentMeta) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

    for (const agent of agents) {
      if (agent.role === "human") continue;
      const parentId = agent.parentId;
      const parent = parentId && parentId !== agent.id ? byId.get(parentId) : null;
      if (parent && parent.role !== "human" && parent.id !== agent.id) {
        const list = childrenById.get(parent.id) ?? [];
        list.push(agent);
        childrenById.set(parent.id, list);
      } else {
        roots.push(agent);
      }
    }

    for (const list of childrenById.values()) list.sort(byCreatedAt);
    roots.sort(byCreatedAt);

    const rows: Array<{
      agent: AgentMeta;
      group: Group | null;
      depth: number;
      hasChildren: boolean;
      collapsed: boolean;
      guides: boolean[];
      isLast: boolean;
    }> = [];
    const walk = (agent: AgentMeta, depth: number, guides: boolean[], isLast: boolean) => {
      const children = childrenById.get(agent.id) ?? [];
      const collapsed = !!collapsedAgents[agent.id];
      rows.push({
        agent,
        group: groupByAgentId.get(agent.id) ?? null,
        depth,
        hasChildren: children.length > 0,
        collapsed,
        guides,
        isLast,
      });
      if (collapsed) return;
      const nextGuides = [...guides, !isLast];
      children.forEach((child, index) => {
        walk(child, depth + 1, nextGuides, index === children.length - 1);
      });
    };
    roots.forEach((root, index) => walk(root, 0, [], index === roots.length - 1));
    return rows;
  }, [agents, collapsedAgents, groupByAgentId, session]);

  const extraGroups = useMemo(() => {
    if (!session) return groups;
    const mappedIds = new Set(Array.from(groupByAgentId.values()).map((g) => g.id));
    return groups.filter((g) => !mappedIds.has(g.id));
  }, [groupByAgentId, groups, session]);

  const streamAgentId = useMemo(() => {
    if (!session) return null;
    if (!activeGroupId) return session.assistantAgentId;
    const group = groups.find((g) => g.id === activeGroupId);
    if (!group) return session.assistantAgentId;
    return group.memberIds.find((id) => id !== session.humanAgentId) ?? session.assistantAgentId;
  }, [activeGroupId, groups, session]);

  const refreshAgents = useCallback(async (s: WorkspaceDefaults) => {
    const { agents } = await api<{ agents: AgentMeta[] }>(
      `/api/agents?workspaceId=${encodeURIComponent(s.workspaceId)}&meta=true`
    );
    setAgents(agents);
  }, []);

  const formatLlmHistory = useCallback((raw: string) => {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }, []);

  const refreshLlmHistory = useCallback(
    async (agentId: string) => {
      const reqId = (llmHistoryReqIdRef.current += 1);
      try {
        const res = await api<{ llmHistory: string }>(`/api/agents/${agentId}`);
        if (reqId !== llmHistoryReqIdRef.current) return;
        setLlmHistory(res.llmHistory ?? "");
      } catch (e) {
        if (reqId !== llmHistoryReqIdRef.current) return;
        setLlmHistory(
          e instanceof Error ? `(failed to load llm_history: ${e.message})` : "(failed to load llm_history)"
        );
      }
    },
    [formatLlmHistory]
  );

  const llmHistoryParsed = useMemo(() => {
    if (!llmHistory) return null;
    try {
      return JSON.parse(llmHistory);
    } catch {
      return null;
    }
  }, [llmHistory]);

  const llmHistoryFormatted = useMemo(() => {
    if (!llmHistory) return "";
    return formatLlmHistory(llmHistory);
  }, [formatLlmHistory, llmHistory]);

  const bootstrap = useCallback(async (overrideWorkspaceId: string | null) => {
    setError(null);
    setAgentError(null);
    setStatus("boot");

    setGroups([]);
    setMessages([]);
    setLlmHistory("");
    esRef.current?.close();

    if (overrideWorkspaceId) {
      const ensured = await api<WorkspaceDefaults>(
        `/api/workspaces/${overrideWorkspaceId}/defaults`
      );
      saveSession(ensured);
      setSession(ensured);
      setActiveGroupId(ensured.defaultGroupId);
      setStatus("idle");
      void refreshAgents(ensured);
      return;
    }

    const existing = loadSession();
    if (existing) {
      try {
        const ensured = await api<WorkspaceDefaults>(
          `/api/workspaces/${existing.workspaceId}/defaults`
        );
        saveSession(ensured);
        setSession(ensured);
        setActiveGroupId(ensured.defaultGroupId);
        setStatus("idle");
        void refreshAgents(ensured);
        return;
      } catch {
        // fall through
      }
    }

    try {
      const recent = await api<{
        workspaces: Array<{ id: string; name: string; createdAt: string }>;
      }>(`/api/workspaces`);
      if (recent.workspaces.length > 0) {
        const targetId = recent.workspaces[0]!.id;
        const ensured = await api<WorkspaceDefaults>(
          `/api/workspaces/${targetId}/defaults`
        );
        saveSession(ensured);
        setSession(ensured);
        setActiveGroupId(ensured.defaultGroupId);
        setStatus("idle");
        void refreshAgents(ensured);
        return;
      }
    } catch {
      // fall through
    }

    const created = await api<WorkspaceDefaults>(`/api/workspaces`, {
      method: "POST",
      body: JSON.stringify({ name: t.defaultWorkspaceName }),
    });
    saveSession(created);
    setSession(created);
    setActiveGroupId(created.defaultGroupId);
    setStatus("idle");
    void refreshAgents(created);
  }, [refreshAgents, t]);

  const createWorkspace = useCallback(async (name?: string) => {
    setError(null);
    setAgentError(null);
    setStatus("boot");
    const created = await api<WorkspaceDefaults>(`/api/workspaces`, {
      method: "POST",
      body: JSON.stringify({ name: name?.trim() || t.newWorkspaceName }),
    });
    saveSession(created);
    setSession(created);
    setActiveGroupId(created.defaultGroupId);
    setStatus("idle");
    window.history.replaceState(null, "", "/im");
    void refreshAgents(created);
    return created;
  }, [refreshAgents, t]);

  useEffect(() => {
    api<{ tokenLimit: number }>("/api/config")
      .then((c) => {
        setTokenLimit(c.tokenLimit);
        setAppSettings(c as AppSettings);
      })
      .catch(() => setTokenLimit(100000));
  }, []);

  const handleSaveSettings = async (updates: AppSettings) => {
    setSettingsSaving(true);
    try {
      const saved = await api<AppSettings>("/api/config", {
        method: "POST",
        body: JSON.stringify(updates),
      });
      setAppSettings(saved);
      setIsSettingsOpen(false);
      setSettingsNotice(t.settingsSaved);
      window.setTimeout(() => setSettingsNotice(null), 2400);
    } catch (e) {
      alert(t.failedToSaveSettings + ": " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSettingsSaving(false);
    }
  };

  const refreshGroups = useCallback(async (s: WorkspaceDefaults, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setStatus("groups");
    const q = new URLSearchParams({ workspaceId: s.workspaceId, agentId: s.humanAgentId });
    const { groups } = await api<{ groups: Group[] }>(`/api/groups?${q.toString()}`);
    setGroups(groups);
    if (!opts?.silent) setStatus("idle");
  }, []);

  const refreshMessages = useCallback(
    async (
      s: WorkspaceDefaults,
      groupId: string,
      opts?: { markRead?: boolean; silent?: boolean; skipGroupRefresh?: boolean }
    ) => {
      if (!opts?.silent) setStatus("messages");
      const q = new URLSearchParams();
      if (opts?.markRead ?? true) q.set("markRead", "true");
      q.set("readerId", s.humanAgentId);
      const suffix = q.size ? `?${q.toString()}` : "";
      const { messages } = await api<{ messages: Message[] }>(
        `/api/groups/${groupId}/messages${suffix}`
      );
      setMessages(messages);
      if (!opts?.silent) setStatus("idle");
      if (!opts?.skipGroupRefresh) {
        void refreshGroups(s, { silent: opts?.silent });
      }
      queueMicrotask(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    },
    [refreshGroups]
  );

  const pushVizEvent = useCallback(
    (event: UiStreamEvent, label: string, kind: VizEvent["kind"]) => {
      const at = typeof event.at === "number" ? event.at : Date.now();
      const id = `${event.id ?? at}-${Math.random().toString(16).slice(2)}`;
      setVizEvents((prev) => [...prev, { id, kind, label, at }].slice(-20));
    },
    []
  );

  const pushBeam = useCallback((beam: Omit<VizBeam, "id" | "createdAt">) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const createdAt = Date.now();
    setVizBeams((prev) => [...prev, { ...beam, id, createdAt }].slice(-12));
    const timeoutId = window.setTimeout(() => {
      setVizBeams((prev) => prev.filter((b) => b.id !== id));
    }, 2400);
    beamTimeoutsRef.current.push(timeoutId);
  }, []);

  const logVizDebug = useCallback((entry: Omit<VizDebugEntry, "id" | "at">) => {
    const record: VizDebugEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      at: Date.now(),
    };
    setVizDebug((prev) => [...prev, record].slice(-200));
    if (typeof window !== "undefined") {
      (window as any).__imVizDebug = (window as any).__imVizDebug ?? [];
      (window as any).__imVizDebug.push(record);
      // eslint-disable-next-line no-console
      console.debug("[im-viz]", record);
    }
  }, []);

  const scheduleWorkspaceRefresh = useCallback(
    (opts?: { groups?: boolean; agents?: boolean; messages?: boolean; llmHistory?: boolean }) => {
      if (!session) return;
      const pending = refreshQueueRef.current.pending;
      pending.groups = opts?.groups ?? true;
      pending.agents = opts?.agents ?? true;
      pending.messages = opts?.messages ?? true;
      pending.llmHistory = opts?.llmHistory ?? true;

      if (refreshQueueRef.current.timer !== null) return;
      refreshQueueRef.current.timer = window.setTimeout(() => {
        const next = refreshQueueRef.current.pending;
        refreshQueueRef.current.pending = {
          groups: false,
          agents: false,
          messages: false,
          llmHistory: false,
        };
        refreshQueueRef.current.timer = null;

        if (next.groups) void refreshGroups(session, { silent: true });
        if (next.agents) void refreshAgents(session);
        if (next.llmHistory && streamAgentIdValueRef.current) {
          void refreshLlmHistory(streamAgentIdValueRef.current);
        }
        if (next.messages && activeGroupIdRef.current) {
          void refreshMessages(session, activeGroupIdRef.current, {
            markRead: false,
            silent: true,
            skipGroupRefresh: true,
          });
        }
      }, 200);
    },
    [refreshAgents, refreshGroups, refreshLlmHistory, refreshMessages, session]
  );

  const connectAgentStream = useCallback(
    (agentId: string) => {
      if (streamAgentIdRef.current === agentId && esRef.current) return;
      streamAgentIdRef.current = agentId;

      esRef.current?.close();
      setLlmHistory("");
      setContentStream("");
      setReasoningStream("");
      setToolStream("");
      setAgentError(null);
      toolCallBuffersRef.current = new Map();
      toolResultBuffersRef.current = new Map();

      const groupId = activeGroupIdRef.current;
      const suffix = groupId ? `?groupId=${encodeURIComponent(groupId)}` : "";
      const es = new EventSource(`/api/agents/${agentId}/context-stream${suffix}`);
      esRef.current = es;

      es.onmessage = (evt) => {
        console.log("[IM-AGENT-STREAM] SSE event:", evt.data);
        try {
          const payload = JSON.parse(evt.data) as AgentStreamEvent;
          if (payload.event === "agent.stream") {
            const chunk = payload.data.delta;
            if (chunk) {
              if (payload.data.kind === "content") {
                setContentStream((t) => t + chunk);
              } else if (payload.data.kind === "reasoning") {
                setReasoningStream((t) => t + chunk);
              } else {
                const name = payload.data.tool_call_name ?? payload.data.tool_call_id ?? "tool_call";
                const key = payload.data.tool_call_id ?? name;
                const buffers =
                  payload.data.kind === "tool_result"
                    ? toolResultBuffersRef.current
                    : toolCallBuffersRef.current;
                const next = `${buffers.get(key) ?? ""}${chunk}`;
                buffers.set(key, next);
                const callLines = Array.from(toolCallBuffersRef.current.entries()).map(
                  ([id, value]) => `tool_calls[${id}]: ${value}`
                );
                const resultLines = Array.from(toolResultBuffersRef.current.entries()).map(
                  ([id, value]) => `tool_result[${id}]: ${value}`
                );
                setToolStream([...callLines, ...resultLines].join("\n\n"));
              }
            }
            return;
          }
          if (payload.event === "agent.wakeup") {
            setContentStream("");
            setReasoningStream("");
            setToolStream("");
            toolCallBuffersRef.current = new Map();
            toolResultBuffersRef.current = new Map();
            return;
          }
          if (payload.event === "agent.unread") {
            setContentStream("");
            setReasoningStream("");
            setToolStream("");
            toolCallBuffersRef.current = new Map();
            toolResultBuffersRef.current = new Map();
            return;
          }
          if (payload.event === "agent.done") {
            console.log("[IM-AGENT-STREAM] agent.done received");
            toolCallBuffersRef.current = new Map();
            toolResultBuffersRef.current = new Map();
            const groupId = activeGroupIdRef.current;
            const nextSession = loadSession();
            if (nextSession && groupId) void refreshMessages(nextSession, groupId, { markRead: false });
            if (nextSession) void refreshGroups(nextSession);
            const agentId = streamAgentIdRef.current;
            if (agentId) void refreshLlmHistory(agentId);
            return;
          }
          if (payload.event === "agent.error") {
            setAgentError(payload.data.message);
          }
        } catch {
          // ignore
        }
      };

      es.onerror = () => setAgentError("SSE disconnected");
    },
    [refreshGroups, refreshMessages]
  );

  const hireSubAgent = useCallback(async () => {
    if (!session) return;
    const role = (window.prompt(t.subAgentRole, "assistant") ?? "").trim();
    if (!role) return;

    setError(null);
    setAgentError(null);
    setStatus("boot");

    try {
      const created = await api<{ agentId: string; groupId: string }>(`/api/agents`, {
        method: "POST",
        body: JSON.stringify({
          workspaceId: session.workspaceId,
          creatorId: session.humanAgentId,
          role,
        }),
      });

      setStatus("idle");
      void refreshGroups(session);
      void refreshAgents(session);
      setActiveGroupId(created.groupId);
      connectAgentStream(created.agentId);
    } catch (e) {
      setStatus("idle");
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [connectAgentStream, refreshGroups, session]);

  const onInterruptAllAgents = useCallback(async () => {
    if (!session || stoppingAgents) return;

    setStoppingAgents(true);
    setError(null);
    setAgentError(null);

    try {
      const res = await api<{ ok: boolean; interrupted: number; agentIds: string[] }>(
        `/api/agents/interrupt-all`,
        {
          method: "POST",
          body: JSON.stringify({ workspaceId: session.workspaceId }),
        }
      );

      setAgentStatusById((prev) => {
        const next = { ...prev };
        const ids = res.agentIds.length > 0 ? res.agentIds : agents.map((agent) => agent.id);
        for (const id of ids) {
          next[id] = "IDLE";
        }
        return next;
      });
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStoppingAgents(false);
    }
  }, [agents, session, stoppingAgents]);

  const onSend = useCallback(async () => {
    if (!session || !activeGroupId) {
      console.log("[IM] onSend early return: session=", !!session, "activeGroupId=", activeGroupId);
      return;
    }
    const text = draft.trim();
    if (!text) {
      console.log("[IM] onSend early return: empty text");
      return;
    }

    console.log("[IM] onSend called", { text, activeGroupId, humanAgentId: session.humanAgentId });

    if (text.startsWith("/create") || text.startsWith("/hire")) {
      const role = text.replace(/^\/(create|hire)\s*/i, "").trim();
      if (!role) {
        setError(t.usageCreateRole);
        return;
      }

      setStatus("boot");
      setError(null);

      try {
        const created = await api<{ agentId: string; groupId: string }>(`/api/agents`, {
          method: "POST",
          body: JSON.stringify({
            workspaceId: session.workspaceId,
            creatorId: session.humanAgentId,
            role,
          }),
        });
        setDraft("");
        setStatus("idle");
        void refreshGroups(session);
        void refreshAgents(session);
        setActiveGroupId(created.groupId);
        connectAgentStream(created.agentId);
        return;
      } catch (e) {
        setStatus("idle");
        setError(e instanceof Error ? e.message : String(e));
        return;
      }
    }

    setStatus("send");
    setError(null);

    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      senderId: session.humanAgentId,
      content: text,
      contentType: "text",
      sendTime: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setDraft("");
    queueMicrotask(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));

    try {
      console.log("[IM] Calling POST /api/groups/" + activeGroupId + "/messages");
      await api(`/api/groups/${activeGroupId}/messages`, {
        method: "POST",
        body: JSON.stringify({ senderId: session.humanAgentId, content: text, contentType: "text" }),
      });
      console.log("[IM] POST succeeded");
    } catch (e) {
      console.error("[IM] POST failed:", e);
    } finally {
      // keep going
    }

    console.log("[IM] Setting status to idle");
    setStatus("idle");
    void refreshMessages(session, activeGroupId, { markRead: false });
    void refreshGroups(session);
  }, [
    activeGroupId,
    connectAgentStream,
    draft,
    refreshAgents,
    refreshGroups,
    refreshMessages,
    session,
  ]);

  useEffect(() => {
    void bootstrap(workspaceOverrideId).catch((e) =>
      setError(e instanceof Error ? e.message : String(e))
    );
  }, [bootstrap, workspaceOverrideId]);

  useEffect(() => {
    activeGroupIdRef.current = activeGroupId;
  }, [activeGroupId]);

  useEffect(() => {
    streamAgentIdValueRef.current = streamAgentId;
  }, [streamAgentId]);

  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  useEffect(() => {
    agentRoleByIdRef.current = agentRoleById;
  }, [agentRoleById]);

  useEffect(() => {
    nodeOffsetsRef.current = nodeOffsets;
  }, [nodeOffsets]);

  useEffect(() => {
    const el = vizRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.contentRect;
        if (!rect.width || !rect.height) continue;
        setVizSize({ width: rect.width, height: rect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = midStackRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.contentRect;
        if (!rect.height) continue;
        setMidStackHeight(rect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = vizRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setVizScale((s) => Math.min(Math.max(s + delta, 0.5), 2));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (!session) return;
    void refreshGroups(session).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    void refreshAgents(session).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    void api<{ workspaces: Array<{ id: string; name: string }> }>("/api/workspaces")
      .then((data) => setWorkspaceList(data.workspaces ?? []))
      .catch(() => undefined);
  }, [refreshGroups, session]);

  useEffect(() => {
    if (!session) return;
    uiEsRef.current?.close();
    const es = new EventSource(`/api/ui-stream?workspaceId=${encodeURIComponent(session.workspaceId)}`);
    uiEsRef.current = es;

    es.onmessage = (evt) => {
      console.log("[IM-UI] SSE event:", evt.data);
      let payload: UiStreamEvent | null = null;
      try {
        payload = JSON.parse(evt.data) as UiStreamEvent;
      } catch {
        payload = null;
      }
      if (payload) {
        if (payload.event === "ui.research.updated") {
          setResearchTick((n) => n + 1);
        } else if (payload.event === "ui.agent.created") {
          const role = payload.data?.agent?.role ?? "agent";
          const agentId = payload.data?.agent?.id as UUID | undefined;
          const parentId = payload.data?.agent?.parentId as UUID | null | undefined;
          pushVizEvent(payload, `${tRef.current.vizCreated} ${role}`, "agent");
          if (agentId) {
            const fromId = parentId || session.humanAgentId;
            pushBeam({ fromId, toId: agentId, kind: "create", label: role });
          }
          if (agentId) {
            setAgentStatusById((prev) => ({ ...prev, [agentId]: "IDLE" }));
          }
        } else if (payload.event === "ui.message.created") {
          console.log("[IM-UI] ui.message.created received", payload.data);
          const senderId = payload.data?.message?.senderId as UUID | undefined;
          const groupId = payload.data?.groupId as UUID | undefined;
          const senderRole = senderId
            ? agentRoleByIdRef.current.get(senderId) ?? senderId.slice(0, 6)
            : "unknown";
          pushVizEvent(payload, `${tRef.current.vizMessage}: ${senderRole}`, "message");
          logVizDebug({
            type: "message_event",
            data: {
              messageId: payload.data?.message?.id,
              groupId,
              senderId,
              senderRole,
              hasGroup: !!groupsRef.current.find((g) => g.id === groupId),
            },
          });
          if (senderId && groupId) {
            const payloadMembers = Array.isArray(payload.data?.memberIds) ? payload.data.memberIds : null;
            const groupMembers =
              payloadMembers ??
              groupsRef.current.find((g) => g.id === groupId)?.memberIds ??
              [];
            const targetIds = groupMembers.filter((id: UUID) => id !== senderId);
            if (targetIds.length === 0) {
              logVizDebug({
                type: "beam_skipped",
                data: { reason: "no_targets", groupId, senderId },
              });
            } else {
              targetIds.forEach((targetId) => {
                pushBeam({ fromId: senderId, toId: targetId, kind: "message" });
                logVizDebug({
                  type: "beam_created",
                  data: { groupId, senderId, targetId },
                });
              });
            }
          }
        } else if (payload.event === "ui.agent.llm.start" || payload.event === "ui.agent.llm.done") {
          const agentId = payload.data?.agentId as UUID | undefined;
          const role = agentId
            ? agentRoleByIdRef.current.get(agentId) ?? agentId.slice(0, 6)
            : "agent";
          const label = payload.event === "ui.agent.llm.start" ? `${tRef.current.llmStart}: ${role}` : `${tRef.current.llmEnd}: ${role}`;
          pushVizEvent(payload, label, "llm");
          if (agentId) {
            setAgentStatusById((prev) => ({
              ...prev,
              [agentId]: payload.event === "ui.agent.llm.start" ? "BUSY" : "IDLE",
            }));
          }
        } else if (
          payload.event === "ui.agent.tool_call.start" ||
          payload.event === "ui.agent.tool_call.done"
        ) {
          const agentId = payload.data?.agentId as UUID | undefined;
          const toolName = payload.data?.toolName ?? "tool";
          const role = agentId
            ? agentRoleByIdRef.current.get(agentId) ?? agentId.slice(0, 6)
            : "agent";
          const label =
            payload.event === "ui.agent.tool_call.start"
              ? `${tRef.current.toolStart}: ${role} · ${toolName}`
              : `${tRef.current.toolEnd}: ${role} · ${toolName}`;
          pushVizEvent(payload, label, "tool");
          if (agentId) {
            setAgentStatusById((prev) => ({
              ...prev,
              [agentId]: payload.event === "ui.agent.tool_call.start" ? "BUSY" : "IDLE",
            }));
          }
        } else if (payload.event === "ui.agent.interrupt_all") {
          pushVizEvent(payload, tRef.current.stopAllAgentsEvent, "agent");
          const ids = Array.isArray(payload.data?.agentIds)
            ? (payload.data.agentIds as UUID[])
            : [];
          setAgentStatusById((prev) => {
            const next = { ...prev };
            const targetIds = ids.length > 0 ? ids : Object.keys(next);
            for (const id of targetIds) {
              next[id] = "IDLE";
            }
            return next;
          });
        } else if (payload.event === "ui.db.write") {
          const table = payload.data?.table ?? "db";
          const action = payload.data?.action ?? "write";
          pushVizEvent(payload, `DB ${action}: ${table}`, "db");
        }
      }

      // any change in workspace => refresh lists (cheap enough for MVP)
      scheduleWorkspaceRefresh();
    };
    es.onerror = () => {
      // tolerate disconnects; user can refresh manually
    };

    return () => es.close();
  }, [
    logVizDebug,
    pushBeam,
    pushVizEvent,
    scheduleWorkspaceRefresh,
    session,
  ]);

  useEffect(() => {
    if (!streamAgentId) return;
    connectAgentStream(streamAgentId);
    setLlmHistory("");
    void refreshLlmHistory(streamAgentId);
  }, [connectAgentStream, refreshLlmHistory, streamAgentId]);

  useEffect(() => {
    if (!activeGroupId || !session) return;
    void refreshMessages(session, activeGroupId, { markRead: true }).catch((e) =>
      setError(e instanceof Error ? e.message : String(e))
    );
  }, [activeGroupId, refreshMessages, session]);

  useEffect(() => {
    return () => esRef.current?.close();
  }, []);

  useEffect(() => {
    return () => {
      beamTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      beamTimeoutsRef.current = [];
    };
  }, []);

  const roleColor = (role?: string) => {
    if (!role) return "#e4e4e7";
    if (role === "human") return "#f8fafc";
    if (role === "assistant") return "#38bdf8";
    if (role === "productmanager") return "#fb7185";
    if (role === "coder") return "#34d399";
    return "#fbbf24";
  };

  const statusColor = (status?: AgentStatus) => {
    if (status === "BUSY") return "#ef4444";
    if (status === "WAKING") return "#facc15";
    return "#22c55e";
  };

  const midChatHeight = useMemo(() => {
    if (!midStackHeight) return 0;
    const available = Math.max(0, midStackHeight - MID_SPLITTER_SIZE);
    if (available <= 0) return 0;
    const minChat = MID_CHAT_MIN_HEIGHT;
    const minGraph = MID_GRAPH_MIN_HEIGHT;
    if (available <= minGraph + minChat) {
      return Math.max(minChat, available - minGraph);
    }
    const maxChat = available - minGraph;
    const desired = available * midSplitRatio;
    return Math.min(maxChat, Math.max(minChat, desired));
  }, [midSplitRatio, midStackHeight]);

  useEffect(() => {
    midChatHeightRef.current = midChatHeight;
  }, [midChatHeight]);

  const toggleRightPanel = useCallback((id: RightPanelId) => {
    setRightPanels((prev) =>
      prev.map((panel) =>
        panel.id === id ? { ...panel, collapsed: !panel.collapsed } : panel
      )
    );
  }, []);

  const startMidResize = useCallback(
    (clientY: number) => {
      const container = midStackRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const available = Math.max(0, rect.height - MID_SPLITTER_SIZE);
      if (available <= 0) return;
      const minChat = MID_CHAT_MIN_HEIGHT;
      const minGraph = MID_GRAPH_MIN_HEIGHT;
      const maxChat = Math.max(minChat, available - minGraph);
      const startY = clientY;
      const startHeight = midChatHeightRef.current || available * midSplitRatio;

      const onMove = (e: PointerEvent | MouseEvent) => {
        const delta = e.clientY - startY;
        const next = Math.min(maxChat, Math.max(minChat, startHeight + delta));
        const ratio = available ? next / available : 0.5;
        setMidSplitRatio(ratio);
      };

      const onTouchMove = (e: TouchEvent) => {
        const touch = e.touches[0];
        if (!touch) return;
        const delta = touch.clientY - startY;
        const next = Math.min(maxChat, Math.max(minChat, startHeight + delta));
        const ratio = available ? next / available : 0.5;
        setMidSplitRatio(ratio);
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", onUp);
        document.body.style.cursor = "";
      };

      document.body.style.cursor = "row-resize";
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", onUp);
    },
    [midSplitRatio]
  );

  const handleMidResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      startMidResize(event.clientY);
    },
    [startMidResize]
  );

  const handleMidMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      startMidResize(event.clientY);
    },
    [startMidResize]
  );

  const handleMidTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      const touch = event.touches[0];
      if (!touch) return;
      startMidResize(touch.clientY);
    },
    [startMidResize]
  );

  // Handler for when a node is clicked in the graph panel
  const handleGraphNodeClick = useCallback(
    (agentId: UUID) => {
      // Find a group that contains this agent
      const groupWithAgent = groups.find((g) => g.memberIds.includes(agentId));
      if (groupWithAgent) {
        setActiveGroupId(groupWithAgent.id);
      }
    },
    [groups]
  );

  const handleRightPanelResizeStart = useCallback(
    (index: number, event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const first = rightPanels[index];
      const second = rightPanels[index + 1];
      if (!first || !second) return;
      if (first.collapsed || second.collapsed) return;

      const startY = event.clientY;
      const startFirst = first.size;
      const startSecond = second.size;
      const min = RIGHT_PANEL_MIN_HEIGHT;

      const onMove = (e: PointerEvent) => {
        const delta = e.clientY - startY;
        const total = startFirst + startSecond;
        const nextFirst = Math.min(total - min, Math.max(min, startFirst + delta));
        const nextSecond = total - nextFirst;
        setRightPanels((prev) => {
          if (!prev[index] || !prev[index + 1]) return prev;
          if (prev[index].collapsed || prev[index + 1].collapsed) return prev;
          const next = [...prev];
          next[index] = { ...next[index], size: nextFirst };
          next[index + 1] = { ...next[index + 1], size: nextSecond };
          return next;
        });
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
      };

      document.body.style.cursor = "row-resize";
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [rightPanels]
  );

  const startNodeDrag = useCallback(
    (id: string, clientX: number, clientY: number) => {
      const startOffset = nodeOffsetsRef.current[id] ?? { x: 0, y: 0 };
      const startX = clientX;
      const startY = clientY;

      const onMove = (e: PointerEvent | MouseEvent) => {
        const dx = (e.clientX - startX) / (vizScale || 1);
        const dy = (e.clientY - startY) / (vizScale || 1);
        setNodeOffsets((prev) => ({
          ...prev,
          [id]: { x: startOffset.x + dx, y: startOffset.y + dy },
        }));
      };

      const onTouchMove = (e: TouchEvent) => {
        const touch = e.touches[0];
        if (!touch) return;
        const dx = (touch.clientX - startX) / (vizScale || 1);
        const dy = (touch.clientY - startY) / (vizScale || 1);
        setNodeOffsets((prev) => ({
          ...prev,
          [id]: { x: startOffset.x + dx, y: startOffset.y + dy },
        }));
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", onUp);
        document.body.style.cursor = "";
      };

      document.body.style.cursor = "grabbing";
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", onUp);
    },
    [vizScale]
  );

  const handleNodePointerDown = useCallback(
    (id: string, event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      startNodeDrag(id, event.clientX, event.clientY);
    },
    [startNodeDrag]
  );

  const handleNodeMouseDown = useCallback(
    (id: string, event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      startNodeDrag(id, event.clientX, event.clientY);
    },
    [startNodeDrag]
  );

  const handleNodeTouchStart = useCallback(
    (id: string, event: ReactTouchEvent<HTMLDivElement>) => {
      event.stopPropagation();
      const touch = event.touches[0];
      if (!touch) return;
      startNodeDrag(id, touch.clientX, touch.clientY);
    },
    [startNodeDrag]
  );

  const summarizeHistoryEntry = useCallback((entry: any, index: number, opts?: { omitRole?: boolean }) => {
    const role = typeof entry?.role === "string" ? entry.role : "unknown";
    const toolCalls = Array.isArray(entry?.tool_calls) ? entry.tool_calls.length : 0;
    const toolName =
      typeof entry?.name === "string"
        ? entry.name
        : typeof entry?.tool_call_id === "string"
          ? entry.tool_call_id.slice(0, 6)
          : "";
    let contentText = "";
    if (typeof entry?.content === "string") {
      contentText = entry.content;
    } else if (entry?.content != null) {
      try {
        contentText = JSON.stringify(entry.content);
      } catch {
        contentText = String(entry.content);
      }
    }
    contentText = contentText.replace(/\s+/g, " ").slice(0, 80);
    const metaParts: string[] = [];
    if (!opts?.omitRole) metaParts.push(role);
    if (role === "tool" && toolName) {
      metaParts.push(toolName);
    } else if (toolCalls > 0) {
      metaParts.push(`tool_calls:${toolCalls}`);
    }
    const meta = metaParts.join(" · ");
    const prefix = meta ? `#${index + 1} ${meta}` : `#${index + 1}`;
    return contentText ? `${prefix} — ${contentText}` : prefix;
  }, []);

  const historyRole = useCallback((entry: any) => {
    return typeof entry?.role === "string" ? entry.role : "unknown";
  }, []);

  const historyAccent = useCallback((role?: string) => {
    if (!role) return "#94a3b8";
    if (role === "human") return "#f8fafc";
    if (role === "assistant") return "#38bdf8";
    if (role === "productmanager") return "#fb7185";
    if (role === "coder") return "#34d399";
    if (role === "tool") return "#fbbf24";
    if (role === "system") return "#a78bfa";
    return "#94a3b8";
  }, []);

  const title = getGroupLabel(activeGroup);

  const statusLabel: Record<string, string> = {
    boot: t.loading,
    groups: t.loadingGroups,
    messages: t.loadingMessages,
    send: t.sending,
    idle: "",
  };

  const toggleAgentCollapsed = useCallback((agentId: string) => {
    setCollapsedAgents((prev) => ({ ...prev, [agentId]: !prev[agentId] }));
  }, []);

  // ⌘K command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const cmdItems = useMemo(() => {
    const items: Array<{ id: string; label: string; description?: string; onSelect: () => void }> = [];
    for (const row of agentTreeRows) {
      if (row.group) {
        items.push({
          id: row.group.id,
          label: getGroupLabel(row.group),
          description: `Agent: ${row.agent.role}`,
          onSelect: () => setActiveGroupId(row.group!.id),
        });
      }
    }
    for (const g of groups) {
      if (!items.find((i) => i.id === g.id)) {
        items.push({ id: g.id, label: getGroupLabel(g), description: "群组", onSelect: () => setActiveGroupId(g.id) });
      }
    }
    items.push({ id: "__settings", label: "设置 / Settings", description: "LLM 配置", onSelect: () => setIsSettingsOpen(true) });
    items.push({ id: "__workspace", label: "新建工作区", description: "Create Workspace", onSelect: () => void createWorkspace() });
    return items;
  }, [agentTreeRows, groups, getGroupLabel, createWorkspace]);

  const renderGroupRow = (
    g: Group,
    tree?: {
      depth: number;
      hasChildren: boolean;
      collapsed: boolean;
      agentId: string;
      guides: boolean[];
      isLast: boolean;
    }
  ) => {
    const guideWidth = 14;
    const caretWidth = 18;
    const caretGap = 6;
    const depth = tree?.depth ?? 0;
    const prefixWidth = depth > 0 ? depth * guideWidth + guideWidth : 0;
    const previewIndent = tree ? prefixWidth + caretWidth + caretGap : 0;
    return (
      <button
        key={g.id}
        className={cx("row", g.id === activeGroupId && "active")}
        onClick={() => {
          setActiveGroupId(g.id);
        }}
        style={{ paddingLeft: 16 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {tree && tree.depth > 0 ? (
              <span className="tree-prefix">
                {tree.guides.map((hasLine, idx) => (
                  <span
                    key={`${g.id}-guide-${idx}`}
                    className={hasLine ? "tree-line" : "tree-blank"}
                  />
                ))}
                <span className={tree.isLast ? "tree-elbow last" : "tree-elbow"} />
              </span>
            ) : null}
            {tree?.hasChildren ? (
              <span
                role="button"
                tabIndex={0}
                className="tree-caret"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleAgentCollapsed(tree.agentId);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleAgentCollapsed(tree.agentId);
                  }
                }}
                title={tree.collapsed ? t.expand : t.collapse}
              >
                {tree.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </span>
            ) : tree ? (
              <span className="tree-caret-placeholder" />
            ) : null}
            <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {getGroupLabel(g)}
            </div>
          </div>
          {g.unreadCount > 0 && <span className="badge">{g.unreadCount}</span>}
        </div>
        {g.lastMessage ? (
          <div
            className="muted"
            style={{
              fontSize: 12,
              marginTop: 6,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginLeft: previewIndent,
            }}
          >
            {g.lastMessage.content}
          </div>
        ) : null}
        {g.contextTokens > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 2 }}>
              <span className="muted">{t.context}</span>
              <span className="mono" style={{ color: (g.contextTokens / tokenLimit) > 0.8 ? "var(--ui-error)" : (g.contextTokens / tokenLimit) > 0.5 ? "var(--ui-amber-strong)" : "var(--ui-green-strong)" }}>
                {g.contextTokens.toLocaleString()}
                <span className="muted" style={{ marginLeft: 4 }}>/ {tokenLimit.toLocaleString()}</span>
              </span>
            </div>
            <div style={{ height: 3, background: "var(--ui-surface-3)", borderRadius: 8, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, (g.contextTokens / tokenLimit) * 100)}%`,
                  background: (g.contextTokens / tokenLimit) > 0.8 ? "var(--ui-error)" : (g.contextTokens / tokenLimit) > 0.5 ? "var(--ui-amber-strong)" : "var(--ui-green-strong)",
                  borderRadius: 8,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        )}
      </button>
    );
  };

  // ── render ────────────────────────────────────────────────────────────────
  const wbFont = '"PingFang SC","苹方-简","Noto Sans SC",-apple-system,"SF Pro Text",sans-serif';

  return (
    <div
      data-theme={theme}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: "var(--ui-bg)",
        fontFamily: wbFont,
        color: "var(--ink)",
      }}
    >
      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <div
        style={{
          height: 44,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          borderBottom: "1px solid var(--ui-border-2)",
          background: "var(--ui-topbar)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: "rgba(14,165,233,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(14,165,233,0.25)",
            }}
          >
            <Network size={13} color="#0ea5e9" />
          </div>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Swarm IDE</span>
          <span style={{ fontSize: 11, color: "var(--ui-muted)" }}>
            {workspaceList.find((w) => w.id === session?.workspaceId)?.name ?? ""}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            style={{
              fontSize: 11,
              color: "var(--ui-muted)",
              background: "var(--ui-fill)",
              border: "1px solid var(--ui-border-2)",
              borderRadius: 6,
              padding: "3px 8px",
              cursor: "pointer",
            }}
            onClick={() => setCmdOpen(true)}
            title="⌘K"
          >
            ⌘K
          </button>
          <button
            className="btn"
            style={{ padding: "3px 8px", fontSize: 11 }}
            onClick={toggleTheme}
            title={theme === "dark" ? "切换亮色" : "切换暗色"}
          >
            {theme === "dark" ? "☀" : "◐"}
          </button>
          <button
            className="btn"
            style={{ padding: "3px 7px" }}
            title={t.settings}
            onClick={() => setIsSettingsOpen(true)}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            className="btn"
            style={{
              padding: "3px 8px",
              fontSize: 11,
              borderColor: "var(--ui-danger-deep)",
              background: stoppingAgents ? "var(--ui-danger-bg-active)" : "var(--ui-danger-bg)",
              color: "var(--ui-danger-text)",
            }}
            onClick={() => void onInterruptAllAgents()}
            disabled={!session || stoppingAgents}
          >
            {stoppingAgents ? t.stoppingAgents : t.stopAllAgents}
          </button>
          <span className="muted" style={{ fontSize: 11 }}>
            {status !== "idle" ? statusLabel[status] : ""}
          </span>
        </div>
      </div>

      {/* ── Three-column body ────────────────────────────────────────────── */}
      <PanelGroup orientation="horizontal" style={{ flex: 1, minHeight: 0, display: "flex" }}>

        {/* LEFT: Agent tree */}
        <Panel
          defaultSize={18}
          minSize={12}
          maxSize={30}
          style={{
            display: "flex",
            flexDirection: "column",
            background: "var(--ui-shell)",
            overflow: "hidden",
            borderRight: "1px solid var(--ui-border-2)",
          }}
        >
          {/* Workspace selector */}
          <div style={{ padding: "10px 10px 8px", borderBottom: "1px solid var(--ui-border-2)", flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--ui-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
              工作区
            </div>
            <select
              style={{
                width: "100%",
                fontSize: 12,
                padding: "4px 6px",
                background: "var(--ui-surface-2)",
                color: "var(--ink)",
                border: "1px solid var(--ui-border-2)",
                borderRadius: 6,
                cursor: "pointer",
              }}
              value={session?.workspaceId ?? ""}
              onChange={(e) => { window.location.href = `/im?workspaceId=${encodeURIComponent(e.target.value)}`; }}
            >
              {workspaceList.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          {/* Agent tree + extra groups */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <div style={{ padding: "0 10px 4px", fontSize: 10, fontWeight: 600, color: "var(--ui-muted)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
              Agent / 群组
            </div>
            <AgentTree
              agents={agents
                .filter((a) => a.role !== "human")
                .map((a) => ({
                  id: a.id,
                  role: a.role,
                  parentId: a.parentId,
                  status: agentStatusById[a.id],
                }))}
              onSelect={(agentId) => {
                const g = groupByAgentId.get(agentId);
                if (g) setActiveGroupId(g.id);
              }}
              selectedId={(() => {
                if (!activeGroupId || !session) return undefined;
                const g = groups.find((gr) => gr.id === activeGroupId);
                if (!g) return undefined;
                return g.memberIds.find((id) => id !== session.humanAgentId);
              })()}
            />
            {extraGroups.length > 0 && (
              <div style={{ flexShrink: 0, overflowY: "auto", padding: "4px 0" }}>
                {extraGroups.map((g) => renderGroupRow(g))}
              </div>
            )}
          </div>

          {/* Deploy */}
          <div style={{ padding: "8px 10px", borderTop: "1px solid var(--ui-border-2)", flexShrink: 0 }}>
            <button
              style={{
                width: "100%",
                padding: "7px",
                borderRadius: 7,
                background: "#0ea5e9",
                color: "white",
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: wbFont,
              }}
              onClick={() => setIsSettingsOpen(true)}
            >
              {t.deployAgent}
            </button>
          </div>
        </Panel>

        <PanelResizeHandle
          style={{
            width: 4,
            background: "transparent",
            cursor: "col-resize",
            flexShrink: 0,
            borderLeft: "1px solid var(--ui-border-2)",
            transition: "background 0.15s",
          }}
          
        />

        {/* MID: Chat or Topology */}
        <Panel
          minSize={30}
          style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--ui-bg)" }}
        >
          {/* Mid sub-header */}
          <div
            style={{
              height: 40,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 12px",
              borderBottom: "1px solid var(--ui-border-2)",
              background: "var(--ui-topbar)",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {title}
            </div>
            <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
              {(["chat", "canvas"] as const).map((mode) => (
                <button
                  key={mode}
                  style={{
                    padding: "2px 9px",
                    fontSize: 11,
                    borderRadius: 5,
                    cursor: "pointer",
                    background: viewMode === mode ? "rgba(14,165,233,0.12)" : "var(--ui-fill)",
                    color: viewMode === mode ? "#0ea5e9" : "var(--ui-muted)",
                    border: `1px solid ${viewMode === mode ? "rgba(14,165,233,0.3)" : "var(--ui-border-2)"}`,
                    fontWeight: viewMode === mode ? 600 : 400,
                    fontFamily: wbFont,
                  }}
                  onClick={() => setViewMode(mode)}
                >
                  {mode === "chat" ? "聊天" : "拓扑"}
                </button>
              ))}
            </div>
          </div>

          {viewMode === "canvas" ? (
            /* Topology view — React Flow */
            <SwarmGraph
              style={{ flex: 1 }}
              agents={agents.map((a) => ({
                id: a.id,
                role: a.role,
                parentId: a.parentId,
                status: agentStatusById[a.id],
              }))}
              onAgentSelect={(agentId) => {
                const g = groupByAgentId.get(agentId);
                if (g) setActiveGroupId(g.id);
              }}
              selectedAgentId={(() => {
                if (!activeGroupId || !session) return null;
                const g = groups.find((gr) => gr.id === activeGroupId);
                return g?.memberIds.find((id) => id !== session.humanAgentId) ?? null;
              })()}
            />
          ) : (
            /* Chat view */
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
              <div
                className="chat"
                style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 0" }}
              >
                <IMMessageList
                  messages={messages}
                  humanAgentId={session?.humanAgentId ?? null}
                  agentRoleById={agentRoleById}
                  fmtTime={fmtTime}
                  renderContent={(content) => <MarkdownContent content={content} />}
                  cx={cx}
                />
                <div ref={bottomRef} />
              </div>

              {/* Composer */}
              <div
                style={{
                  flexShrink: 0,
                  padding: "10px 12px",
                  borderTop: "1px solid var(--ui-border-2)",
                  background: "var(--ui-topbar)",
                }}
              >
                <div style={{ display: "flex", gap: 8 }}>
                  <textarea
                    ref={composerRef}
                    className="input"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={t.messagePlaceholder}
                    rows={2}
                    style={{ flex: 1, resize: "none", borderRadius: 8, padding: "7px 10px", fontSize: 13, lineHeight: 1.5, fontFamily: wbFont }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        void onSend();
                      }
                    }}
                  />
                  <button
                    className="btn btn-primary"
                    style={{ alignSelf: "flex-end", padding: "7px 14px", flexShrink: 0 }}
                    onClick={() => void onSend()}
                    disabled={!draft.trim() || status === "send"}
                  >
                    {t.send}
                  </button>
                </div>
              </div>
            </div>
          )}
        </Panel>

        <PanelResizeHandle
          style={{
            width: 4,
            background: "transparent",
            cursor: "col-resize",
            flexShrink: 0,
            borderLeft: "1px solid var(--ui-border-2)",
          }}
          
        />

        {/* RIGHT: Research Inspector */}
        <Panel
          defaultSize={27}
          minSize={20}
          maxSize={40}
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: "var(--ui-shell)",
            borderLeft: "1px solid var(--ui-border-2)",
          }}
        >
          <ResearchWorkbench
            groupId={activeGroupId}
            workspaceId={session?.workspaceId ?? null}
            humanAgentId={session?.humanAgentId ?? null}
            refreshToken={researchTick}
          />
        </Panel>
      </PanelGroup>

      {/* Toasts */}
      {error && <div className="toast">{error}</div>}
      {settingsNotice && <div className="toast toast-ok">{settingsNotice}</div>}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div
          className="modal-overlay"
          style={{ position: "fixed", inset: 0, background: "var(--ui-overlay)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
        >
          <div className="card" style={{ width: 460, maxWidth: "90vw", background: "var(--ui-surface-2)", padding: 24, borderRadius: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>{t.llmProviderSettings}</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--ink-2)" }}>{t.provider}</label>
              <select
                className="input"
                value={appSettings?.llmProvider || "minimax"}
                onChange={(e) => setAppSettings({ ...appSettings, llmProvider: e.target.value as AppSettings["llmProvider"] })}
                style={{ width: "100%", padding: "8px 12px", background: "var(--ui-surface-3)", color: "var(--ink)", border: "1px solid var(--ui-border-3)", borderRadius: 8 }}
              >
                <option value="minimax">MiniMax</option>
                <option value="ark">Ark (Volcengine)</option>
                <option value="openrouter">OpenRouter</option>
              </select>
            </div>
            {(appSettings?.llmProvider === "ark" || !appSettings?.llmProvider) && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--ink-2)" }}>{t.apiKey}</label>
                  <input className="input" type="password" placeholder={appSettings?.arkApiKeyConfigured ? t.apiKeyConfigured : t.arkApiKeyPlaceholder} value={appSettings?.arkApiKey || ""} onChange={(e) => setAppSettings({ ...appSettings, arkApiKey: e.target.value })} autoComplete="off" />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--ink-2)" }}>{t.model}</label>
                  <input className="input" placeholder="kimi-k2.5" value={appSettings?.arkModel || ""} onChange={(e) => setAppSettings({ ...appSettings, arkModel: e.target.value })} />
                </div>
              </>
            )}
            {appSettings?.llmProvider === "openrouter" && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--ink-2)" }}>{t.apiKey}</label>
                  <input className="input" type="password" placeholder={appSettings?.openRouterApiKeyConfigured ? t.apiKeyConfigured : t.openRouterApiKeyPlaceholder} value={appSettings?.openRouterApiKey || ""} onChange={(e) => setAppSettings({ ...appSettings, openRouterApiKey: e.target.value })} autoComplete="off" />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--ink-2)" }}>{t.model}</label>
                  <input className="input" placeholder="openai/gpt-4o" value={appSettings?.openRouterModel || ""} onChange={(e) => setAppSettings({ ...appSettings, openRouterModel: e.target.value })} />
                </div>
              </>
            )}
            {appSettings?.llmProvider === "minimax" && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--ink-2)" }}>{t.apiKey}</label>
                  <input className="input" type="password" placeholder={appSettings?.minimaxApiKeyConfigured ? t.apiKeyConfigured : t.minimaxApiKeyPlaceholder} value={appSettings?.minimaxApiKey || ""} onChange={(e) => setAppSettings({ ...appSettings, minimaxApiKey: e.target.value })} autoComplete="off" />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--ink-2)" }}>{t.model}</label>
                  <input className="input" placeholder="MiniMax-M2.1" value={appSettings?.minimaxModel || ""} onChange={(e) => setAppSettings({ ...appSettings, minimaxModel: e.target.value })} />
                </div>
              </>
            )}
            <div style={{ marginBottom: 12, marginTop: 8 }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--ink)" }}>
                <input type="checkbox" checked={Boolean(appSettings?.allowHostBash)} onChange={(e) => setAppSettings({ ...appSettings, allowHostBash: e.target.checked })} style={{ marginTop: 2 }} />
                <span>
                  {t.allowHostBash}
                  <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "var(--ink-2)" }}>{t.allowHostBashHint}</span>
                </span>
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
              <button className="btn" onClick={() => setIsSettingsOpen(false)}>{t.cancel}</button>
              <button className="btn btn-primary" disabled={settingsSaving || !appSettings} onClick={() => handleSaveSettings(appSettings!)}>
                {settingsSaving ? t.savingSettings : t.saveChanges}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⌘K Command Palette */}
      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        agents={agents.map((a) => ({ id: a.id, role: a.role }))}
        onSelectAgent={(agentId) => {
          const g = groupByAgentId.get(agentId);
          if (g) setActiveGroupId(g.id);
        }}
        onFocusComposer={() => composerRef.current?.focus()}
      />
    </div>
  );
}
