// ============================================================================
// Coordinator Agent - Multi-agent orchestration
// ============================================================================

import { AgentContext } from "../AgentContext";
import { AgentRunner, type AgentMessage } from "../AgentRunner";
import { getMailbox, type MailboxMessage, type MessageType } from "../../mailbox";
import { swarmPermissionHandler } from "../../permissions";

// ============================================================================
// Types
// ============================================================================

export interface CoordinatorTask {
  id: string;
  description: string;
  status: "pending" | "assigned" | "running" | "completed" | "failed";
  assignedWorker?: string;
  result?: unknown;
  error?: string;
}

export interface CoordinatorState {
  tasks: Map<string, CoordinatorTask>;
  workers: Map<string, { status: "idle" | "busy"; currentTask?: string }>;
  results: Map<string, unknown>;
}

// ============================================================================
// Coordinator Agent
// ============================================================================

export class CoordinatorAgent {
  private context: AgentContext;
  private mailbox = getMailbox("");
  private state: CoordinatorState;
  private isRunning = false;

  constructor(context: AgentContext) {
    this.context = context;
    this.state = {
      tasks: new Map(),
      workers: new Map(),
      results: new Map(),
    };

    // Set mailbox address
    this.mailbox = getMailbox(context.id);
  }

  // ============================================================================
  // Task Management
  // ============================================================================

  /**
   * Create a new task
   */
  createTask(description: string): CoordinatorTask {
    const task: CoordinatorTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      description,
      status: "pending",
    };

    this.state.tasks.set(task.id, task);
    return task;
  }

  /**
   * Assign task to worker
   */
  assignTask(taskId: string, workerId: string): boolean {
    const task = this.state.tasks.get(taskId);
    if (!task || task.status !== "pending") {
      return false;
    }

    task.status = "assigned";
    task.assignedWorker = workerId;

    // Update worker status
    this.state.workers.set(workerId, { status: "busy", currentTask: taskId });

    // Send directive to worker
    this.mailbox.send(workerId, "directive", {
      taskId,
      description: task.description,
    });

    return true;
  }

  /**
   * Complete a task with result
   */
  completeTask(taskId: string, result: unknown): boolean {
    const task = this.state.tasks.get(taskId);
    if (!task) {
      return false;
    }

    task.status = "completed";
    task.result = result;
    this.state.results.set(taskId, result);

    // Free up worker
    if (task.assignedWorker) {
      const worker = this.state.workers.get(task.assignedWorker);
      if (worker) {
        worker.status = "idle";
        worker.currentTask = undefined;
      }
    }

    return true;
  }

  /**
   * Fail a task with error
   */
  failTask(taskId: string, error: string): boolean {
    const task = this.state.tasks.get(taskId);
    if (!task) {
      return false;
    }

    task.status = "failed";
    task.error = error;

    // Free up worker
    if (task.assignedWorker) {
      const worker = this.state.workers.get(task.assignedWorker);
      if (worker) {
        worker.status = "idle";
        worker.currentTask = undefined;
      }
    }

    return true;
  }

  // ============================================================================
  // Worker Management
  // ============================================================================

  /**
   * Register a worker
   */
  registerWorker(workerId: string): void {
    this.state.workers.set(workerId, { status: "idle" });
  }

  /**
   * Unregister a worker
   */
  unregisterWorker(workerId: string): boolean {
    return this.state.workers.delete(workerId);
  }

  /**
   * Get idle workers
   */
  getIdleWorkers(): string[] {
    return Array.from(this.state.workers.entries())
      .filter(([_, worker]) => worker.status === "idle")
      .map(([id]) => id);
  }

  // ============================================================================
  // Message Handling
  // ============================================================================

  /**
   * Handle incoming message
   */
  async handleMessage(message: MailboxMessage): Promise<void> {
    switch (message.type) {
      case "result":
        this.handleResultMessage(message);
        break;
      case "error":
        this.handleErrorMessage(message);
        break;
      case "progress":
        this.handleProgressMessage(message);
        break;
      case "permission":
        await this.handlePermissionMessage(message);
        break;
      case "stop":
        this.handleStopMessage(message);
        break;
    }
  }

  private handleResultMessage(message: MailboxMessage): void {
    const content = message.content as { taskId: string; result: unknown };
    this.completeTask(content.taskId, content.result);
  }

  private handleErrorMessage(message: MailboxMessage): void {
    const content = message.content as { taskId: string; error: string };
    this.failTask(content.taskId, content.error);
  }

  private handleProgressMessage(message: MailboxMessage): void {
    // Progress updates - could emit events or update UI
    console.log(`[Coordinator] Worker ${message.from} progress:`, message.content);
  }

  private async handlePermissionMessage(message: MailboxMessage): Promise<void> {
    const content = message.content as { toolName: string; taskId: string };

    // Forward to permission handler
    const request = swarmPermissionHandler.createWorkerPermissionRequest(
      message.from,
      this.context.id,
      content.toolName,
      content
    );

    // Wait for decision
    const startTime = Date.now();
    const timeout = 60000;

    while (request.status === "pending" && Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Send response back to worker
    if (request.response) {
      this.mailbox.send(message.from, "permission_response", {
        requestId: request.id,
        decision: request.response,
      });
    }
  }

  private handleStopMessage(message: MailboxMessage): void {
    // Stop all workers
    for (const workerId of this.state.workers.keys()) {
      this.mailbox.send(workerId, "stop", { reason: "Coordinator stopped" });
    }
    this.isRunning = false;
  }

  // ============================================================================
  // Execution
  // ============================================================================

  /**
   * Start coordination loop
   */
  async *run(): AsyncGenerator<AgentMessage, void, unknown> {
    this.isRunning = true;

    yield {
      type: "message",
      role: "system",
      content: `Coordinator ${this.context.id} started`,
    };

    while (this.isRunning) {
      // Check for messages
      const messages = this.mailbox.receiveAll();

      for (const message of messages) {
        await this.handleMessage(message);
        yield {
          type: "message",
          role: "system",
          content: `Handled ${message.type} from ${message.from}`,
        };
      }

      // Auto-assign pending tasks to idle workers
      await this.autoAssignTasks();

      // Small delay to prevent busy loop
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    yield {
      type: "done",
      content: "Coordinator stopped",
    };
  }

  /**
   * Auto-assign pending tasks to idle workers
   */
  private async autoAssignTasks(): Promise<void> {
    const idleWorkers = this.getIdleWorkers();

    for (const workerId of idleWorkers) {
      // Find first pending task
      for (const [taskId, task] of this.state.tasks) {
        if (task.status === "pending") {
          this.assignTask(taskId, workerId);
          break;
        }
      }
    }
  }

  /**
   * Stop the coordinator
   */
  stop(): void {
    this.isRunning = false;
    for (const workerId of this.state.workers.keys()) {
      this.mailbox.send(workerId, "stop", { reason: "Coordinator stopped" });
    }
  }

  /**
   * Get current state
   */
  getState(): CoordinatorState {
    return this.state;
  }

  /**
   * Get summary
   */
  getSummary(): {
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    failedTasks: number;
    idleWorkers: number;
    busyWorkers: number;
  } {
    const tasks = Array.from(this.state.tasks.values());
    return {
      totalTasks: tasks.length,
      completedTasks: tasks.filter((t) => t.status === "completed").length,
      pendingTasks: tasks.filter((t) => t.status === "pending").length,
      failedTasks: tasks.filter((t) => t.status === "failed").length,
      idleWorkers: this.getIdleWorkers().length,
      busyWorkers: this.state.workers.size - this.getIdleWorkers().length,
    };
  }
}

// ============================================================================
// Coordinator System Prompt
// ============================================================================

export const COORDINATOR_SYSTEM_PROMPT = `You are a coordinator agent. Your job is to orchestrate multiple worker agents to accomplish complex tasks.

## Your Responsibilities

1. **Task Decomposition**: Break down complex requests into smaller, manageable subtasks
2. **Worker Assignment**: Assign tasks to appropriate workers based on their capabilities
3. **Progress Monitoring**: Track the progress of all workers and tasks
4. **Result Synthesis**: Combine results from multiple workers into a coherent response
5. **Error Handling**: Handle failures and retry when necessary

## Your Tools

- **Agent**: Spawn a new worker agent to handle a subtask
- **Task**: Create and track tasks
- **Read**: Read files for context
- **Bash**: Execute commands when needed

## Worker Communication

Workers communicate with you via a mailbox system. You'll receive:
- **result**: Worker completed a task with result
- **error**: Worker encountered an error
- **progress**: Worker sent a progress update
- **permission**: Worker needs permission for a dangerous operation

## Guidelines

- Spawn multiple workers in parallel when tasks are independent
- Monitor worker progress and synthesize results
- If a worker fails, try reassigning to another worker or handle the failure gracefully
- Always report progress clearly to the user`;

export default CoordinatorAgent;
