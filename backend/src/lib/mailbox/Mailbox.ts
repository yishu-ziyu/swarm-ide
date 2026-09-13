// ============================================================================
// Mailbox - Inter-agent message passing system
// ============================================================================

// ============================================================================
// Types
// ============================================================================

export type MessageType =
  | "directive"      // Task directive
  | "result"         // Task result
  | "progress"       // Progress update
  | "error"          // Error occurred
  | "permission"     // Permission request
  | "permission_response" // Permission response
  | "stop"           // Stop agent
  | "heartbeat";     // Keepalive

export interface MailboxMessage {
  id: string;
  type: MessageType;
  from: string;
  to: string;
  content: unknown;
  timestamp: Date;
  replyTo?: string;
  metadata?: Record<string, unknown>;
}

export interface MessageHandler {
  (message: MailboxMessage): void | Promise<void>;
}

// ============================================================================
// Mailbox
// ============================================================================

export class Mailbox {
  private agentId: string;
  private queues: Map<string, MailboxMessage[]> = new Map();
  private handlers: Map<MessageType, Set<MessageHandler>> = new Map();
  private globalHandlers: Set<MessageHandler> = new Set();
  private listeners: Set<(message: MailboxMessage) => void> = new Set();

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  // ============================================================================
  // Identity
  // ============================================================================

  getAddress(): string {
    return this.agentId;
  }

  // ============================================================================
  // Message Sending
  // ============================================================================

  /**
   * Send a message to another agent's mailbox
   */
  send(to: string, type: MessageType, content: unknown, metadata?: Record<string, unknown>): MailboxMessage {
    const message: MailboxMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      from: this.agentId,
      to,
      content,
      timestamp: new Date(),
      metadata,
    };

    // Store in recipient's queue
    const queue = this.getOrCreateQueue(to);
    queue.push(message);

    // Notify listeners
    this.notifyListeners(message);

    return message;
  }

  /**
   * Reply to a message
   */
  reply(original: MailboxMessage, type: MessageType, content: unknown): MailboxMessage {
    return this.send(original.from, type, content, { replyTo: original.id });
  }

  /**
   * Broadcast to multiple agents
   */
  broadcast(to: string[], type: MessageType, content: unknown): MailboxMessage[] {
    return to.map((recipient) => this.send(recipient, type, content));
  }

  // ============================================================================
  // Message Receiving
  // ============================================================================

  /**
   * Check if there are messages
   */
  hasMessages(): boolean {
    const queue = this.queues.get(this.agentId);
    return queue !== undefined && queue.length > 0;
  }

  /**
   * Get message count
   */
  getMessageCount(): number {
    const queue = this.queues.get(this.agentId);
    return queue?.length || 0;
  }

  /**
   * Peek at next message without removing it
   */
  peek(): MailboxMessage | undefined {
    const queue = this.queues.get(this.agentId);
    return queue?.[0];
  }

  /**
   * Receive (pop) next message
   */
  receive(): MailboxMessage | undefined {
    const queue = this.queues.get(this.agentId);
    if (!queue || queue.length === 0) {
      return undefined;
    }
    return queue.shift();
  }

  /**
   * Receive all messages
   */
  receiveAll(): MailboxMessage[] {
    const queue = this.queues.get(this.agentId);
    if (!queue || queue.length === 0) {
      return [];
    }
    const messages = [...queue];
    queue.length = 0;
    return messages;
  }

  /**
   * Wait for next message (async)
   */
  async waitForMessage(timeoutMs?: number): Promise<MailboxMessage | null> {
    return new Promise((resolve) => {
      // Check if message already exists
      const existing = this.receive();
      if (existing) {
        resolve(existing);
        return;
      }

      const timeout = setTimeout(() => {
        this.globalHandlers.delete(handler);
        resolve(null);
      }, timeoutMs || 30000);

      const handler: MessageHandler = (message) => {
        if (message.to === this.agentId) {
          clearTimeout(timeout);
          this.globalHandlers.delete(handler);
          resolve(message);
        }
      };

      this.globalHandlers.add(handler);
    });
  }

  // ============================================================================
  // Filtering
  // ============================================================================

  /**
   * Get messages by type
   */
  getMessagesByType(type: MessageType): MailboxMessage[] {
    const queue = this.queues.get(this.agentId);
    if (!queue) return [];
    return queue.filter((msg) => msg.type === type);
  }

  /**
   * Get messages from specific agent
   */
  getMessagesFrom(from: string): MailboxMessage[] {
    const queue = this.queues.get(this.agentId);
    if (!queue) return [];
    return queue.filter((msg) => msg.from === from);
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Register handler for specific message type
   */
  on(type: MessageType, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  /**
   * Register handler for all messages
   */
  onAny(handler: MessageHandler): () => void {
    this.globalHandlers.add(handler);
    return () => this.globalHandlers.delete(handler);
  }

  /**
   * Register listener for all messages (for debugging/logging)
   */
  addListener(listener: (message: MailboxMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(message: MailboxMessage): void {
    // Call type-specific handlers
    const typeHandlers = this.handlers.get(message.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        try {
          handler(message);
        } catch {
          // Ignore handler errors
        }
      }
    }

    // Call global handlers
    for (const handler of this.globalHandlers) {
      try {
        handler(message);
      } catch {
        // Ignore handler errors
      }
    }

    // Call listeners
    for (const listener of this.listeners) {
      try {
        listener(message);
      } catch {
        // Ignore listener errors
      }
    }
  }

  // ============================================================================
  // Queue Management
  // ============================================================================

  private getOrCreateQueue(agentId: string): MailboxMessage[] {
    if (!this.queues.has(agentId)) {
      this.queues.set(agentId, []);
    }
    return this.queues.get(agentId)!;
  }

  /**
   * Clear all messages for this agent
   */
  clear(): void {
    this.queues.delete(this.agentId);
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queues.size;
  }
}

// ============================================================================
// Mailbox Registry - Manages mailboxes for all agents
// ============================================================================

class MailboxRegistry {
  private mailboxes: Map<string, Mailbox> = new Map();

  /**
   * Get or create mailbox for an agent
   */
  getMailbox(agentId: string): Mailbox {
    if (!this.mailboxes.has(agentId)) {
      this.mailboxes.set(agentId, new Mailbox(agentId));
    }
    return this.mailboxes.get(agentId)!;
  }

  /**
   * Check if mailbox exists
   */
  hasMailbox(agentId: string): boolean {
    return this.mailboxes.has(agentId);
  }

  /**
   * Remove mailbox
   */
  removeMailbox(agentId: string): boolean {
    return this.mailboxes.delete(agentId);
  }

  /**
   * Get all agent IDs with mailboxes
   */
  getAgentIds(): string[] {
    return Array.from(this.mailboxes.keys());
  }

  /**
   * Clear all mailboxes
   */
  clear(): void {
    this.mailboxes.clear();
  }
}

// ============================================================================
// Singleton
// ============================================================================

export const mailboxRegistry = new MailboxRegistry();

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get mailbox for an agent
 */
export function getMailbox(agentId: string): Mailbox {
  return mailboxRegistry.getMailbox(agentId);
}

/**
 * Send message between agents
 */
export function sendMessage(
  from: string,
  to: string,
  type: MessageType,
  content: unknown,
  metadata?: Record<string, unknown>
): MailboxMessage {
  const mailbox = getMailbox(from);
  return mailbox.send(to, type, content, metadata);
}
