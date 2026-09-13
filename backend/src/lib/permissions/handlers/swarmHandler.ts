// ============================================================================
// Swarm Permission Handler
// ============================================================================

import type { PermissionRequest, PermissionDecision } from "../types";

// ============================================================================
// Swarm Permission Events
// ============================================================================

export type SwarmPermissionEventType =
  | "permission_request"
  | "permission_response"
  | "permission_timeout"
  | "permission_cancelled";

export interface SwarmPermissionEvent {
  type: SwarmPermissionEventType;
  requestId: string;
  workerAgentId: string;
  leaderAgentId: string;
  toolName: string;
  timestamp: Date;
  decision?: PermissionDecision;
}

/**
 * Swarm Permission Handler - manages permission passing between leader and workers
 */
export class SwarmPermissionHandler {
  private pendingRequests: Map<string, PermissionRequest> = new Map();
  private eventListeners: Set<(event: SwarmPermissionEvent) => void> = new Set();
  private timeoutMs: number = 60000; // 60 second timeout

  /**
   * Create a permission request from a worker
   */
  createWorkerPermissionRequest(
    workerAgentId: string,
    leaderAgentId: string,
    toolName: string,
    toolInput: unknown
  ): PermissionRequest {
    const request: PermissionRequest = {
      id: `perm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      toolName,
      toolInput,
      context: {
        workspaceId: "",
        agentId: workerAgentId,
        agentType: "worker",
        parentAgentId: leaderAgentId,
        permissionMode: "bubble",
      },
      timestamp: new Date(),
      status: "pending",
    };

    this.pendingRequests.set(request.id, request);
    this.emitEvent({
      type: "permission_request",
      requestId: request.id,
      workerAgentId,
      leaderAgentId,
      toolName,
      timestamp: new Date(),
    });

    return request;
  }

  /**
   * Respond to a permission request (called by leader)
   */
  respondToRequest(
    requestId: string,
    decision: PermissionDecision
  ): boolean {
    const request = this.pendingRequests.get(requestId);

    if (!request) {
      return false;
    }

    request.status = decision.behavior === "allow" ? "approved" : "denied";
    request.response = decision;

    this.emitEvent({
      type: "permission_response",
      requestId,
      workerAgentId: request.context.agentId,
      leaderAgentId: request.context.parentAgentId || "",
      toolName: request.toolName,
      timestamp: new Date(),
      decision,
    });

    return true;
  }

  /**
   * Get pending requests for a leader
   */
  getPendingRequestsForLeader(leaderAgentId: string): PermissionRequest[] {
    return Array.from(this.pendingRequests.values()).filter(
      (req) =>
        req.context.parentAgentId === leaderAgentId && req.status === "pending"
    );
  }

  /**
   * Cancel a pending request
   */
  cancelRequest(requestId: string): boolean {
    const request = this.pendingRequests.get(requestId);

    if (!request || request.status !== "pending") {
      return false;
    }

    request.status = "expired";

    this.emitEvent({
      type: "permission_cancelled",
      requestId,
      workerAgentId: request.context.agentId,
      leaderAgentId: request.context.parentAgentId || "",
      toolName: request.toolName,
      timestamp: new Date(),
    });

    return true;
  }

  /**
   * Check if a request has timed out
   */
  hasRequestTimedOut(request: PermissionRequest): boolean {
    if (request.status !== "pending") {
      return false;
    }

    const elapsed = Date.now() - request.timestamp.getTime();
    return elapsed > this.timeoutMs;
  }

  /**
   * Set timeout for requests
   */
  setTimeout(ms: number): void {
    this.timeoutMs = ms;
  }

  /**
   * Add event listener
   */
  addListener(listener: (event: SwarmPermissionEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(event: SwarmPermissionEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Clean up expired requests
   */
  cleanupExpiredRequests(): void {
    for (const [id, request] of this.pendingRequests) {
      if (this.hasRequestTimedOut(request)) {
        request.status = "expired";
        this.emitEvent({
          type: "permission_timeout",
          requestId: id,
          workerAgentId: request.context.agentId,
          leaderAgentId: request.context.parentAgentId || "",
          toolName: request.toolName,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Get all pending requests
   */
  getPendingRequests(): PermissionRequest[] {
    return Array.from(this.pendingRequests.values()).filter(
      (req) => req.status === "pending"
    );
  }

  /**
   * Clear all requests
   */
  clear(): void {
    this.pendingRequests.clear();
  }
}

// ============================================================================
// Singleton
// ============================================================================

export const swarmPermissionHandler = new SwarmPermissionHandler();
