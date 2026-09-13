import type {
  PermissionMode,
  PermissionDecision,
  PermissionContext,
  ToolPermissionRequirement,
} from "./types";
import { TOOL_DANGER_LEVELS } from "./types";

// ============================================================================
// Permission Handler
// ============================================================================

export class PermissionHandler {
  private context: PermissionContext;

  constructor(context: PermissionContext) {
    this.context = context;
  }

  /**
   * Update the context
   */
  updateContext(context: Partial<PermissionContext>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Get the current context
   */
  getContext(): PermissionContext {
    return this.context;
  }

  /**
   * Check if a tool requires permission
   */
  requiresPermission(toolName: string): boolean {
    const requirement = TOOL_DANGER_LEVELS[toolName];

    if (!requirement) {
      return false;
    }

    // Bypass mode never requires permission
    if (this.context.permissionMode === "bypass") {
      return false;
    }

    // High/Critical danger always requires confirmation
    if (requirement.dangerLevel === "high" || requirement.dangerLevel === "critical") {
      return true;
    }

    // Medium danger requires confirmation based on mode
    if (requirement.dangerLevel === "medium") {
      if (this.context.permissionMode === "acceptEdits") {
        return false;
      }
      if (this.context.permissionMode === "plan") {
        return true;
      }
    }

    return requirement.requiresConfirmation;
  }

  /**
   * Get danger level for a tool
   */
  getDangerLevel(toolName: string): "none" | "low" | "medium" | "high" | "critical" {
    return TOOL_DANGER_LEVELS[toolName]?.dangerLevel || "none";
  }

  /**
   * Make a permission decision for a tool
   */
  async decide(
    toolName: string,
    toolInput: unknown
  ): Promise<PermissionDecision> {
    const { permissionMode } = this.context;

    switch (permissionMode) {
      case "bypass":
        return this.decideBypass(toolName, toolInput);

      case "dontAsk":
        return this.decideDontAsk(toolName, toolInput);

      case "acceptEdits":
        return this.decideAcceptEdits(toolName, toolInput);

      case "plan":
        return this.decidePlan(toolName, toolInput);

      case "bubble":
        return this.decideBubble(toolName, toolInput);

      case "auto":
        return this.decideAuto(toolName, toolInput);

      case "default":
      default:
        return this.decideDefault(toolName, toolInput);
    }
  }

  /**
   * Bypass mode - always allow
   */
  private decideBypass(
    _toolName: string,
    _toolInput: unknown
  ): PermissionDecision {
    return {
      behavior: "allow",
      reason: "bypass mode",
    };
  }

  /**
   * DontAsk mode - deny dangerous, allow safe
   */
  private decideDontAsk(
    toolName: string,
    _toolInput: unknown
  ): PermissionDecision {
    const dangerLevel = this.getDangerLevel(toolName);

    if (dangerLevel === "high" || dangerLevel === "critical") {
      return {
        behavior: "deny",
        reason: "dontAsk mode: dangerous operations denied",
        message: `危险操作 ${toolName} 在 dontAsk 模式下被静默拒绝`,
      };
    }

    return {
      behavior: "allow",
      reason: "dontAsk mode: safe operation",
    };
  }

  /**
   * AcceptEdits mode - allow edits, check other dangerous
   */
  private decideAcceptEdits(
    toolName: string,
    _toolInput: unknown
  ): PermissionDecision {
    const dangerLevel = this.getDangerLevel(toolName);

    // Allow safe and medium danger
    if (dangerLevel === "none" || dangerLevel === "low" || dangerLevel === "medium") {
      return {
        behavior: "allow",
        reason: "acceptEdits mode",
      };
    }

    // High/Critical still needs explicit permission
    if (dangerLevel === "high" || dangerLevel === "critical") {
      return {
        behavior: "ask",
        reason: "acceptEdits mode: high danger still requires permission",
      };
    }

    return {
      behavior: "allow",
      reason: "acceptEdits mode",
    };
  }

  /**
   * Plan mode - only allow read-only
   */
  private decidePlan(
    toolName: string,
    _toolInput: unknown
  ): PermissionDecision {
    const dangerLevel = this.getDangerLevel(toolName);

    if (dangerLevel === "none" || dangerLevel === "low") {
      return {
        behavior: "allow",
        reason: "plan mode: safe operation",
      };
    }

    return {
      behavior: "deny",
      reason: "plan mode: non-read-only operations restricted",
      message: `计划模式下，${toolName} 操作被限制。仅允许只读操作。`,
    };
  }

  /**
   * Bubble mode - pass to parent agent
   */
  private decideBubble(
    _toolName: string,
    _toolInput: unknown
  ): PermissionDecision {
    if (!this.context.parentAgentId) {
      // No parent to bubble to, fall back to default
      return this.decideDefault(_toolName, _toolInput);
    }

    return {
      behavior: "passthrough",
      reason: "bubbling to parent agent",
      message: `权限请求已发送给父Agent (${this.context.parentAgentId}) 处理`,
    };
  }

  /**
   * Auto mode - use classifier (simplified for now)
   */
  private decideAuto(
    toolName: string,
    _toolInput: unknown
  ): PermissionDecision {
    const dangerLevel = this.getDangerLevel(toolName);

    // Safe operations auto-approve
    if (dangerLevel === "none" || dangerLevel === "low") {
      return {
        behavior: "allow",
        reason: "auto mode: low danger",
      };
    }

    // Medium operations use classifier (simplified)
    if (dangerLevel === "medium") {
      // Check whitelist
      if (this.context.dangerousOpsWhitelist?.includes(toolName)) {
        return {
          behavior: "allow",
          reason: "auto mode: whitelisted",
        };
      }
    }

    // High/Critical need explicit permission
    if (dangerLevel === "high" || dangerLevel === "critical") {
      return {
        behavior: "ask",
        reason: "auto mode: high danger requires confirmation",
      };
    }

    return {
      behavior: "ask",
      reason: "auto mode: default to ask",
    };
  }

  /**
   * Default mode - standard confirmation flow
   */
  private decideDefault(
    toolName: string,
    _toolInput: unknown
  ): PermissionDecision {
    const dangerLevel = this.getDangerLevel(toolName);

    // Check whitelist first
    if (this.context.dangerousOpsWhitelist?.includes(toolName)) {
      return {
        behavior: "allow",
        reason: "whitelisted tool",
      };
    }

    if (dangerLevel === "high" || dangerLevel === "critical") {
      return {
        behavior: "ask",
        reason: "high danger operation",
        message: `${toolName} 是危险操作，需要确认`,
      };
    }

    if (dangerLevel === "medium") {
      return {
        behavior: "ask",
        reason: "medium danger operation",
      };
    }

    return {
      behavior: "allow",
      reason: "safe operation",
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createPermissionHandler(context: PermissionContext): PermissionHandler {
  return new PermissionHandler(context);
}
