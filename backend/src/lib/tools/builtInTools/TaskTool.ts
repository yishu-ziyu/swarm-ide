import { z } from "zod";
import { buildTool, successResult, errorResult, type ToolCallOptions } from "../Tool";

// ============================================================================
// Task Tool - Task management operations
// ============================================================================

const TaskToolSchema = z.object({
  action: z.enum(["create", "update", "get", "list", "complete", "delete"]).describe("Task action to perform"),
  taskId: z.string().optional().describe("Task ID for actions requiring a specific task"),
  title: z.string().optional().describe("Task title"),
  description: z.string().optional().describe("Task description"),
  status: z.enum(["pending", "in_progress", "completed", "failed"]).optional().describe("Task status"),
  assignee: z.string().optional().describe("Agent ID to assign task to"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("Task priority"),
  parentId: z.string().optional().describe("Parent task ID for subtasks"),
  tags: z.array(z.string()).optional().describe("Task tags"),
});

export type TaskToolInput = z.infer<typeof TaskToolSchema>;

type Task = {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  priority: "low" | "medium" | "high" | "urgent";
  assignee?: string;
  parentId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

const taskStore: Map<string, Task> = new Map();

const TaskToolDef = buildTool({
  name: "Task",
  description: "Create, manage, and track tasks.",
  inputSchema: TaskToolSchema,
  outputSchema: z.any(),
  isReadOnly: (input: TaskToolInput) => input.action === "get" || input.action === "list",

  async call(
    input: TaskToolInput,
    _options: ToolCallOptions
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const { action, taskId, title, description, status, assignee, priority, parentId, tags } = input;

    try {
      switch (action) {
        case "create": {
          if (!title) {
            return errorResult("Title is required for creating a task");
          }
          const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const task: Task = {
            id,
            title,
            description,
            status: "pending",
            priority: priority || "medium",
            assignee,
            parentId,
            tags: tags || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          taskStore.set(id, task);
          return successResult({ task, action: "created" });
        }

        case "update": {
          if (!taskId) return errorResult("Task ID is required for update");
          const task = taskStore.get(taskId);
          if (!task) return errorResult(`Task not found: ${taskId}`);

          const updatedTask: Task = {
            ...task,
            ...(title !== undefined && { title }),
            ...(description !== undefined && { description }),
            ...(status !== undefined && { status }),
            ...(priority !== undefined && { priority }),
            ...(assignee !== undefined && { assignee }),
            ...(tags !== undefined && { tags }),
            updatedAt: new Date().toISOString(),
          };
          taskStore.set(taskId, updatedTask);
          return successResult({ task: updatedTask, action: "updated" });
        }

        case "get": {
          if (!taskId) return errorResult("Task ID is required for get");
          const task = taskStore.get(taskId);
          if (!task) return errorResult(`Task not found: ${taskId}`);
          return successResult({ task, action: "retrieved" });
        }

        case "list": {
          const allTasks = Array.from(taskStore.values());
          const filtered = allTasks.filter((task) => {
            if (status && task.status !== status) return false;
            if (assignee && task.assignee !== assignee) return false;
            if (parentId && task.parentId !== parentId) return false;
            return true;
          });
          return successResult({ tasks: filtered, total: filtered.length, action: "listed" });
        }

        case "complete": {
          if (!taskId) return errorResult("Task ID is required for complete");
          const task = taskStore.get(taskId);
          if (!task) return errorResult(`Task not found: ${taskId}`);
          task.status = "completed";
          task.updatedAt = new Date().toISOString();
          return successResult({ task, action: "completed" });
        }

        case "delete": {
          if (!taskId) return errorResult("Task ID is required for delete");
          if (!taskStore.has(taskId)) return errorResult(`Task not found: ${taskId}`);
          taskStore.delete(taskId);
          return successResult({ taskId, action: "deleted" });
        }

        default:
          return errorResult(`Unknown action: ${action}`);
      }
    } catch (err: any) {
      return errorResult(err.message);
    }
  },
});

export const TaskTool = TaskToolDef;

export function getTaskStore(): Map<string, Task> {
  return taskStore;
}

export function clearTaskStore(): void {
  taskStore.clear();
}
