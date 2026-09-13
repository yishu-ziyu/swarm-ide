"use client";

import { useState, useEffect, useCallback } from "react";

// ============================================================================
// Types
// ============================================================================

type LogLevel = "info" | "success" | "warning" | "error" | "phase";

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  phase?: string;
  details?: string;
}

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

interface Phase {
  name: string;
  status: "pending" | "in_progress" | "completed";
  progress: number;
}

// ============================================================================
// Constants
// ============================================================================

const PHASES: Phase[] = [
  { name: "Phase 1.1: Tool系统", status: "completed", progress: 100 },
  { name: "Phase 1.2: Agent系统", status: "completed", progress: 100 },
  { name: "Phase 1.3: 权限模型", status: "pending", progress: 0 },
  { name: "Phase 2: 协调器", status: "pending", progress: 0 },
  { name: "Phase 3: 会话管理", status: "pending", progress: 0 },
  { name: "Phase 4: 前端集成", status: "pending", progress: 0 },
];

// ============================================================================
// Components
// ============================================================================

function FileTree({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);

  const indent = depth * 16;
  const isDir = node.type === "directory";

  return (
    <div style={{ fontSize: "13px", fontFamily: "monospace" }}>
      <div
        style={{
          paddingLeft: indent,
          paddingTop: "2px",
          paddingBottom: "2px",
          cursor: isDir ? "pointer" : "default",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
        onClick={() => isDir && setExpanded(!expanded)}
      >
        <span style={{ color: "var(--ink-3)", fontSize: "12px" }}>
          {isDir ? (expanded ? "▼" : "▶") : "📄"}
        </span>
        <span style={{ color: isDir ? "#F59E0B" : "#E8E8E8" }}>{node.name}</span>
      </div>
      {isDir && expanded && node.children?.map((child, i) => (
        <FileTree key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function LogEntry({ log }: { log: LogEntry }) {
  const levelColors: Record<LogLevel, string> = {
    info: "#3B82F6",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    phase: "#A855F7",
  };

  const levelIcons: Record<LogLevel, string> = {
    info: "ℹ️",
    success: "✅",
    warning: "⚠️",
    error: "❌",
    phase: "🔄",
  };

  const time = new Date(log.timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div
      style={{
        padding: "6px 8px",
        borderBottom: "1px solid #2a2a2a",
        fontSize: "12px",
        fontFamily: "monospace",
        backgroundColor: log.level === "phase" ? "rgba(168, 85, 247, 0.1)" : "transparent",
      }}
    >
      <span style={{ color: "var(--ink-3)", marginRight: "8px" }}>[{time}]</span>
      <span style={{ marginRight: "6px" }}>{levelIcons[log.level]}</span>
      {log.phase && (
        <span
          style={{
            backgroundColor: levelColors[log.level],
            color: "#fff",
            padding: "1px 6px",
            borderRadius: "8px",
            fontSize: "12px",
            marginRight: "8px",
          }}
        >
          {log.phase}
        </span>
      )}
      <span style={{ color: levelColors[log.level] }}>{log.message}</span>
      {log.details && (
        <div style={{ color: "var(--ink-3)", marginTop: "2px", marginLeft: "24px" }}>
          {log.details}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ phase }: { phase: Phase }) {
  const colors: Record<string, string> = {
    pending: "#444",
    in_progress: "#3B82F6",
    completed: "#22C55E",
  };

  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "13px", color: "var(--ink)" }}>{phase.name}</span>
        <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>{phase.progress}%</span>
      </div>
      <div
        style={{
          height: "8px",
          backgroundColor: "#2a2a2a",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${phase.progress}%`,
            height: "100%",
            backgroundColor: colors[phase.status],
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function DevDashboard() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [fileTree, setFileTree] = useState<FileNode>({
    name: "src",
    path: "src",
    type: "directory",
    children: [
      {
        name: "lib",
        path: "src/lib",
        type: "directory",
        children: [
          { name: "tools", path: "src/lib/tools", type: "directory", children: [
            { name: "Tool.ts", path: "src/lib/tools/Tool.ts", type: "file" },
            { name: "registry.ts", path: "src/lib/tools/registry.ts", type: "file" },
            { name: "builtInTools/", path: "src/lib/tools/builtInTools", type: "directory", children: [
              { name: "AgentTool.ts", path: "src/lib/tools/AgentTool.ts", type: "file" },
              { name: "BashTool.ts", path: "src/lib/tools/BashTool.ts", type: "file" },
              { name: "FileReadTool.ts", path: "src/lib/tools/FileReadTool.ts", type: "file" },
              { name: "FileWriteTool.ts", path: "src/lib/tools/FileWriteTool.ts", type: "file" },
              { name: "SearchTool.ts", path: "src/lib/tools/SearchTool.ts", type: "file" },
              { name: "GlobTool.ts", path: "src/lib/tools/GlobTool.ts", type: "file" },
              { name: "TaskTool.ts", path: "src/lib/tools/TaskTool.ts", type: "file" },
              { name: "index.ts", path: "src/lib/tools/index.ts", type: "file" },
            ]},
          ]},
          { name: "agents", path: "src/lib/agents", type: "directory", children: [
            { name: "AgentContext.ts", path: "src/lib/agents/AgentContext.ts", type: "file" },
            { name: "AgentRunner.ts", path: "src/lib/agents/AgentRunner.ts", type: "file" },
            { name: "AgentManager.ts", path: "src/lib/agents/AgentManager.ts", type: "file" },
            { name: "index.ts", path: "src/lib/agents/index.ts", type: "file" },
          ]},
          { name: "dev-logger.ts", path: "src/lib/dev-logger.ts", type: "file" },
        ],
      },
      { name: "app", path: "src/app", type: "directory", children: [
        { name: "api/dev-logs/", path: "src/app/api/dev-logs", type: "directory", children: [
          { name: "route.ts", path: "src/app/api/dev-logs/route.ts", type: "file" },
        ]},
        { name: "dev-dashboard/", path: "src/app/dev-dashboard", type: "directory", children: [
          { name: "page.tsx", path: "src/app/dev-dashboard/page.tsx", type: "file" },
        ]},
      ]},
    ],
  });
  const [phases] = useState<Phase[]>(PHASES);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  // Connect to SSE for real-time logs
  useEffect(() => {
    let eventSource: EventSource;

    const connect = () => {
      eventSource = new EventSource("/api/dev-logs");

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "initial") {
            setLogs(data.logs || []);
          } else if (data.type === "log") {
            setLogs((prev) => [...prev.slice(-99), data.log]);
          }

          setLastUpdate(new Date().toLocaleTimeString("zh-CN"));
        } catch {
          // Ignore parse errors
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        // Reconnect after 3 seconds
        setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      eventSource?.close();
    };
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#1A1A1A",
        color: "var(--ink)",
        padding: "20px",
        fontFamily: '-apple-system, "SF Pro Text", "SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif',
        letterSpacing: "-0.15px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
          paddingBottom: "16px",
          borderBottom: "2px solid #333",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "24px" }}>🐝</span>
          <h1 style={{ fontSize: "24px", fontWeight: 600, margin: 0 }}>
            蜂群IDE - 开发仪表板
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>
            最后更新: {lastUpdate || "连接中..."}
          </span>
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: lastUpdate ? "#22C55E" : "#F59E0B",
              animation: lastUpdate ? "none" : "pulse 1.5s infinite",
            }}
          />
        </div>
      </div>

      {/* Main Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
        }}
      >
        {/* File Tree */}
        <div
          style={{
            backgroundColor: "#242424",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #333",
          }}
        >
          <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            📁 项目结构
          </h2>
          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            <FileTree node={fileTree} />
          </div>
        </div>

        {/* Logs */}
        <div
          style={{
            backgroundColor: "#242424",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #333",
          }}
        >
          <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            📜 开发日志
          </h2>
          <div
            style={{
              maxHeight: "400px",
              overflowY: "auto",
              backgroundColor: "#1A1A1A",
              borderRadius: "8px",
              border: "1px solid #333",
            }}
          >
            {logs.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--ink-3)" }}>
                等待日志更新...
              </div>
            ) : (
              logs.map((log) => <LogEntry key={log.id} log={log} />)
            )}
          </div>
        </div>

        {/* Progress */}
        <div
          style={{
            backgroundColor: "#242424",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #333",
          }}
        >
          <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            📊 开发进度
          </h2>
          {phases.map((phase) => (
            <ProgressBar key={phase.name} phase={phase} />
          ))}
        </div>

        {/* Todo */}
        <div
          style={{
            backgroundColor: "#242424",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #333",
          }}
        >
          <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            📝 待办事项
          </h2>
          <div style={{ fontSize: "13px" }}>
            {[
              "Phase 1.3: 权限模型完善",
              "Phase 2: Coordinator 协调器实现",
              "Phase 2.2: Mailbox 通信系统",
              "Phase 3: Query 引擎",
              "Phase 3.2: 上下文构建",
              "Phase 4: 状态管理与 SSE",
            ].map((todo, i) => (
              <div
                key={i}
                style={{
                  padding: "8px 0",
                  borderBottom: "1px solid #333",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span style={{ color: "var(--ink-3)" }}>☐</span>
                <span style={{ color: "var(--ink-3)" }}>{todo}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
