import { z } from "zod";
import type { ReactNode } from "react";

// ============================================================================
// Core Tool Types
// ============================================================================

export type ToolProgressData = Record<string, unknown>;

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export type CanUseToolFn = (toolName: string) => boolean;

export interface ToolUseContext {
  workspaceId: string;
  agentId: string;
  messages: Array<{
    role: "user" | "assistant" | "system" | "tool";
    content: string;
  }>;
  continueSignal?: AbortSignal;
}

export interface PermissionResult {
  behavior: "allow" | "ask" | "deny" | "passthrough";
  updatedInput?: unknown;
  message?: string;
}

export type ToolCallProgress<P extends ToolProgressData = ToolProgressData> = (
  data: P
) => void;

export interface ToolCallOptions<P extends ToolProgressData = ToolProgressData> {
  context: ToolUseContext;
  canUseTool: CanUseToolFn;
  onProgress?: ToolCallProgress<P>;
  signal?: AbortSignal;
}

// ============================================================================
// Tool Interface
// ============================================================================

export interface Tool<Input = any, Output = any, P extends ToolProgressData = ToolProgressData> {
  readonly name: string;
  readonly description: string | (() => string | Promise<string>);
  readonly inputSchema: z.ZodType<any>;
  readonly outputSchema?: z.ZodType<any>;

  call(args: Input, options: ToolCallOptions<P>): Promise<ToolResult<Output>>;
  isConcurrencySafe(input: Input): boolean;
  isReadOnly(input: Input): boolean;
  isDestructive(input: Input): boolean;
  isEnabled(): boolean;
  checkPermissions(input: Input, context: ToolUseContext): Promise<PermissionResult>;

  renderToolResultMessage?(
    content: Output,
    progress: P,
    options: { format: "compact" | "detailed" }
  ): ReactNode;

  renderToolCallMessage?(
    args: Input,
    options: { format: "compact" | "detailed" }
  ): ReactNode;
}

// ============================================================================
// Tool Definition (for buildTool parameter)
// ============================================================================

export interface BaseToolDef {
  name: string;
  description: string | (() => string | Promise<string>);
  inputSchema: z.ZodType<any>;
  outputSchema?: z.ZodType<any>;
  isEnabled?: () => boolean;
  isConcurrencySafe?: (input: any) => boolean;
  isReadOnly?: (input: any) => boolean;
  isDestructive?: (input: any) => boolean;
  checkPermissions?: (input: any, context: ToolUseContext) => Promise<PermissionResult>;
  toAutoClassifierInput?: (input: any) => string;
  userFacingName?: () => string;
}

// ============================================================================
// Built Tool
// ============================================================================

export interface BuiltTool extends Tool {
  readonly name: string;
  readonly toolDef: BaseToolDef;
}

// ============================================================================
// Tool Defaults
// ============================================================================

const TOOL_DEFAULTS = {
  isEnabled: () => true,
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isDestructive: () => false,
  checkPermissions: () => Promise.resolve({ behavior: "allow" } as PermissionResult),
  toAutoClassifierInput: () => "",
  userFacingName: () => "",
};

// ============================================================================
// buildTool Factory
// ============================================================================

export function buildTool<D extends BaseToolDef>(def: D): BuiltTool {
  const tool = {
    ...TOOL_DEFAULTS,
    ...def,
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    outputSchema: def.outputSchema,

    async call(args: any, options: ToolCallOptions): Promise<ToolResult> {
      const input = def.inputSchema.parse(args);
      return { success: true, data: input };
    },

    isEnabled(): boolean {
      return def.isEnabled?.() ?? true;
    },

    isConcurrencySafe(input: any): boolean {
      return def.isConcurrencySafe?.(input) ?? false;
    },

    isReadOnly(input: any): boolean {
      return def.isReadOnly?.(input) ?? false;
    },

    isDestructive(input: any): boolean {
      return def.isDestructive?.(input) ?? false;
    },

    async checkPermissions(input: any, context: ToolUseContext): Promise<PermissionResult> {
      return def.checkPermissions?.(input, context) ?? { behavior: "allow" };
    },

    toolDef: def,
  } as BuiltTool;

  return tool;
}

// ============================================================================
// Tool Result Helpers
// ============================================================================

export function successResult<T>(data: T): ToolResult<T> {
  return { success: true, data };
}

export function errorResult<T>(error: string): ToolResult<T> {
  return { success: false, error };
}

// ============================================================================
// Type Exports
// ============================================================================

export type { BaseToolDef as AnyToolDef };
