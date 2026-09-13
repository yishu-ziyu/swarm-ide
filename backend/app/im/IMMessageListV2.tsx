"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Sparkles,
  User,
  Bot,
} from "lucide-react";

export type Message = {
  id: string;
  senderId: string;
  content: string;
  contentType: string;
  sendTime: string;
};

export type StreamingState = {
  content: string;
  reasoning: string;
  tools: string;
};

interface IMMessageListV2Props {
  messages: Message[];
  humanAgentId: string;
  streamingState?: StreamingState;
  isStreaming?: boolean;
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ThinkingBlock({
  content,
  isExpanded = true,
}: {
  content: string;
  isExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(isExpanded);

  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="bg-[#0c0c0f]/80 backdrop-blur border border-[#27272a] rounded-xl overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-3 border-b border-[#27272a] flex items-center justify-between bg-[#18181b]/50 hover:bg-[#18181b]/70 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#34d399] animate-pulse" />
            <span className="text-xs font-semibold text-[#34d399]">
              Thinking...
            </span>
          </div>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-[#a1a1aa]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#a1a1aa]" />
          )}
        </button>

        {/* Content */}
        {expanded && (
          <div className="p-4 text-xs font-mono text-[#a1a1aa] leading-relaxed">
            <pre className="whitespace-pre-wrap">{content}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

function AIMessage({
  message,
  streamingContent,
  isStreaming,
}: {
  message: Message;
  streamingContent?: string;
  isStreaming?: boolean;
}) {
  const displayContent = isStreaming ? streamingContent : message.content;

  return (
    <div className="flex gap-4 max-w-4xl mx-auto w-full">
      {/* AI Avatar */}
      <div className="w-8 h-8 rounded-lg bg-[#a78bfa] flex-shrink-0 flex items-center justify-center">
        <Bot className="w-5 h-5 text-white" />
      </div>

      {/* Message Content */}
      <div className="space-y-4 flex-1">
        <div className="bg-[#121215] border border-[#27272a] rounded-2xl rounded-tl-none p-5 text-[#fafafa] leading-relaxed text-sm">
          {displayContent || (
            <span className="text-[#a1a1aa] animate-pulse">
              等待回复...
            </span>
          )}
        </div>

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="flex items-center gap-2 text-xs text-[#a1a1aa]">
            <div className="w-2 h-2 rounded-full bg-[#a78bfa] animate-pulse" />
            <span>正在思考...</span>
          </div>
        )}
      </div>
    </div>
  );
}

function HumanMessage({ message }: { message: Message }) {
  return (
    <div className="flex justify-end gap-4 max-w-4xl mx-auto w-full">
      {/* Message Content */}
      <div className="max-w-2xl bg-[#a78bfa] text-white border border-[#a78bfa]/20 rounded-2xl rounded-tr-none p-5 shadow-lg text-sm">
        {message.content}
      </div>

      {/* User Avatar */}
      <div className="w-8 h-8 rounded-lg bg-[#18181b] border border-[#27272a] flex-shrink-0 overflow-hidden">
        <User className="w-full h-full text-[#a1a1aa]" />
      </div>
    </div>
  );
}

function SystemMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-center">
      <p className="text-[11px] text-[#a1a1aa] font-mono tracking-widest uppercase bg-[#18181b] px-4 py-1.5 rounded-full border border-[#27272a]">
        {content}
      </p>
    </div>
  );
}

export function IMMessageListV2({
  messages,
  humanAgentId,
  streamingState,
  isStreaming = false,
}: IMMessageListV2Props) {
  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
      {/* System Message */}
      <SystemMessage content="Session initialized • Agent cluster ready" />

      {/* Thinking Block - Show when streaming reasoning */}
      {streamingState?.reasoning && (
        <ThinkingBlock content={streamingState.reasoning} />
      )}

      {/* Messages */}
      {messages.map((message) => {
        const isHuman = message.senderId === humanAgentId;

        if (isHuman) {
          return <HumanMessage key={message.id} message={message} />;
        }

        return (
          <AIMessage
            key={message.id}
            message={message}
            streamingContent={streamingState?.content}
            isStreaming={isStreaming}
          />
        );
      })}

      {/* Streaming content (when agent is actively streaming) */}
      {isStreaming && streamingState?.content && (
        <AIMessage
          message={{
            id: "streaming",
            senderId: "agent",
            content: "",
            contentType: "text",
            sendTime: new Date().toISOString(),
          }}
          streamingContent={streamingState.content}
          isStreaming={true}
        />
      )}

      {/* Tool streaming indicator */}
      {isStreaming && streamingState?.tools && (
        <div className="max-w-3xl mx-auto w-full">
          <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-3 text-xs">
            <div className="flex items-center gap-2 text-[#a78bfa] mb-2">
              <Sparkles className="w-3 h-3" />
              <span className="font-medium">Tool Execution</span>
            </div>
            <pre className="text-[#a1a1aa] font-mono overflow-x-auto">
              {streamingState.tools}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default IMMessageListV2;
