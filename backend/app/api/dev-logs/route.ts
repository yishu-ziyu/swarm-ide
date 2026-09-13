import { NextResponse } from "next/server";
import { devLogger, type LogEntry } from "@/lib/dev-logger";

// ============================================================================
// SSE endpoint for real-time dev logs
// ============================================================================

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial logs
      const initialLogs = devLogger.getLogs();
      const initialData = `data: ${JSON.stringify({ type: "initial", logs: initialLogs })}\n\n`;
      controller.enqueue(encoder.encode(initialData));

      // Listen for new logs
      const unsubscribe = devLogger.addListener((log: LogEntry) => {
        const data = `data: ${JSON.stringify({ type: "log", log })}\n\n`;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // Client disconnected
        }
      });

      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 30000);

      // Cleanup on close
      return () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
