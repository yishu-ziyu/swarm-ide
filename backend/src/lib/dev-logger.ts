// ============================================================================
// Development Logger - Real-time log synchronization
// ============================================================================

export type LogLevel = "info" | "success" | "warning" | "error" | "phase";

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  phase?: string;
  details?: string;
}

export interface DevLogSync {
  projectPath: string;
  obsidianPath: string;
}

// ============================================================================
// Log Store
// ============================================================================

class DevLogger {
  private logs: LogEntry[] = [];
  private listeners: Set<(log: LogEntry) => void> = new Set();
  private syncTargets: string[] = [];

  constructor() {
    this.syncTargets = [
      "~/Desktop/AI产品经理/swarm-ide_副本/backend/src/lib/.dev-log.json",
      "~/Desktop/黑曜石/swarm-ide-dev-log.md",
    ];
  }

  // ============================================================================
  // Logging
  // ============================================================================

  private generateId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  log(level: LogLevel, message: string, phase?: string, details?: string): LogEntry {
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      level,
      message,
      phase,
      details,
    };

    this.logs.push(entry);
    this.notifyListeners(entry);
    this.syncToTargets(entry);

    return entry;
  }

  info(message: string, details?: string): LogEntry {
    return this.log("info", message, undefined, details);
  }

  success(message: string, phase?: string, details?: string): LogEntry {
    return this.log("success", message, phase, details);
  }

  warning(message: string, details?: string): LogEntry {
    return this.log("warning", message, undefined, details);
  }

  error(message: string, details?: string): LogEntry {
    return this.log("error", message, undefined, details);
  }

  phase(phaseName: string, message: string, details?: string): LogEntry {
    return this.log("phase", message, phaseName, details);
  }

  // ============================================================================
  // Query
  // ============================================================================

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((l) => l.level === level);
  }

  getLogsByPhase(phase: string): LogEntry[] {
    return this.logs.filter((l) => l.phase === phase);
  }

  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  clearLogs(): void {
    this.logs = [];
  }

  // ============================================================================
  // Listeners (for SSE)
  // ============================================================================

  addListener(listener: (log: LogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(log: LogEntry): void {
    for (const listener of this.listeners) {
      try {
        listener(log);
      } catch {
        // Ignore listener errors
      }
    }
  }

  // ============================================================================
  // Sync to targets
  // ============================================================================

  private async syncToTargets(entry: LogEntry): Promise<void> {
    // Sync to JSON file (project)
    await this.syncToJsonFile(entry);

    // Sync to Markdown file (Obsidian)
    await this.syncToMarkdownFile(entry);
  }

  private async syncToJsonFile(entry: LogEntry): Promise<void> {
    try {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");

      const logPath = path.resolve("src/lib/.dev-log.json");
      const existingLogs: LogEntry[] = [];

      try {
        const content = await fs.readFile(logPath, "utf-8");
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          existingLogs.push(...parsed);
        }
      } catch {
        // File doesn't exist yet
      }

      // Keep last 500 entries
      const allLogs = [...existingLogs, entry].slice(-500);
      await fs.writeFile(logPath, JSON.stringify(allLogs, null, 2), "utf-8");
    } catch {
      // Ignore sync errors
    }
  }

  private async syncToMarkdownFile(entry: LogEntry): Promise<void> {
    try {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const os = await import("node:os");

      const obsidianPath = path.join(os.homedir(), "Desktop/黑曜石/swarm-ide-dev-log.md");

      const time = entry.timestamp.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const levelIcon: Record<LogLevel, string> = {
        info: "ℹ️",
        success: "✅",
        warning: "⚠️",
        error: "❌",
        phase: "🔄",
      };

      const icon = levelIcon[entry.level];
      const phaseTag = entry.phase ? `**[${entry.phase}]** ` : "";
      const details = entry.details ? `\n   > ${entry.details}` : "";

      const line = `- [${time}] ${icon} ${phaseTag}${entry.message}${details}\n`;

      // Read existing content
      let content = "";
      try {
        content = await fs.readFile(obsidianPath, "utf-8");
      } catch {
        // File doesn't exist, create with header
        content = `# 蜂群IDE 开发日志\n\n`;
      }

      // Append new log
      content += line;

      // Write back
      await fs.writeFile(obsidianPath, content, "utf-8");
    } catch {
      // Ignore sync errors
    }
  }

  // ============================================================================
  // Export
  // ============================================================================

  exportToMarkdown(): string {
    let md = `# 蜂群IDE 开发日志\n\n`;
    md += `> 自动生成于 ${new Date().toLocaleString("zh-CN")}\n\n`;
    md += `---\n\n`;

    for (const entry of this.logs) {
      const time = entry.timestamp.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const levelIcon: Record<LogLevel, string> = {
        info: "ℹ️",
        success: "✅",
        warning: "⚠️",
        error: "❌",
        phase: "🔄",
      };

      const icon = levelIcon[entry.level];
      const phaseTag = entry.phase ? `**[${entry.phase}]** ` : "";
      const details = entry.details ? `\n  > ${entry.details}` : "";

      md += `- [${time}] ${icon} ${phaseTag}${entry.message}${details}\n`;
    }

    return md;
  }

  exportToJson(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// ============================================================================
// Singleton
// ============================================================================

export const devLogger = new DevLogger();

// Initialize with welcome logs
devLogger.phase("Phase 1.1", "Tool系统初始化完成", "Tool.ts, registry.ts, 7个内置工具");
devLogger.phase("Phase 1.2", "Agent系统初始化完成", "AgentContext.ts, AgentRunner.ts, AgentManager.ts");
devLogger.success("开发仪表板已就绪", "Phase 3", "访问 http://localhost:3000/dev-dashboard 查看实时更新");
devLogger.phase("Phase 1.3", "权限模型完成", "PermissionHandler.ts, swarmHandler.ts, 7种权限模式");
devLogger.phase("Phase 2", "Coordinator和Mailbox完成", "Mailbox.ts, CoordinatorAgent.ts, 多Agent协调");
devLogger.phase("Phase 3", "Query引擎和上下文管理完成", "QueryEngine.ts, SystemContext.ts, 流式响应");
devLogger.phase("Phase 4", "前端集成完成", "AgentRuntimeBridge.ts, API路由集成, 完整架构就绪");

export default DevLogger;
