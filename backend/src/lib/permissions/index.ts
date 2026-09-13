// ============================================================================
// Permissions System - Main Export
// ============================================================================

export {
  PermissionHandler,
  createPermissionHandler,
} from "./PermissionHandler";

export {
  SwarmPermissionHandler,
  swarmPermissionHandler,
} from "./handlers/swarmHandler";

export {
  type PermissionMode,
  type PermissionDecision,
  type PermissionContext,
  type PermissionRequest,
  type ToolPermissionRequirement,
  type ClassifierConfig,
  PERMISSION_MODE_DESCRIPTIONS,
  TOOL_DANGER_LEVELS,
} from "./types";
