"use client";

import { useEffect, useRef } from "react";
import { Command } from "cmdk";

type AgentRef = { id: string; role: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents?: AgentRef[];
  onSelectAgent?: (agentId: string) => void;
  onFocusComposer?: () => void;
};

export function CommandPalette({
  open,
  onOpenChange,
  agents = [],
  onSelectAgent,
  onFocusComposer,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  if (!open) return null;

  const dismiss = () => onOpenChange(false);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "18vh",
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(4px)",
      }}
      onClick={dismiss}
    >
      <div
        style={{
          width: 520,
          maxWidth: "90vw",
          background: "var(--ui-surface)",
          border: "1px solid var(--ui-border-2)",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow:
            "0 24px 64px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.04)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Command>
          <Command.Input
            ref={inputRef}
            placeholder="搜索 Agent、跳转操作…"
            style={{
              width: "100%",
              padding: "14px 16px",
              fontSize: 14,
              border: "none",
              borderBottom: "1px solid var(--ui-border-2)",
              background: "transparent",
              color: "var(--ink)",
              outline: "none",
              fontFamily:
                '"PingFang SC", "苹方-简", "Noto Sans SC", -apple-system, sans-serif',
            }}
          />
          <Command.List
            style={{ maxHeight: 380, overflowY: "auto", padding: "6px" }}
          >
            <Command.Empty
              style={{
                padding: "24px 16px",
                textAlign: "center",
                color: "var(--ui-muted)",
                fontSize: 13,
              }}
            >
              没有找到结果
            </Command.Empty>

            {/* Agent group */}
            {agents.length > 0 && (
              <Command.Group
                heading="Agent 会话"
                style={{
                  fontSize: 11,
                  color: "var(--ui-muted)",
                  fontWeight: 500,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  padding: "6px 12px 2px",
                }}
              >
                {agents.map((a) => (
                  <Command.Item
                    key={a.id}
                    value={a.role + " " + a.id}
                    onSelect={() => {
                      onSelectAgent?.(a.id);
                      dismiss();
                    }}
                    className="cmd-item"
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      outline: "none",
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#22c55e",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontWeight: 500, color: "var(--ink)" }}>
                      {a.role}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--ui-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {a.id.slice(0, 8)}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Actions group */}
            <Command.Group
              heading="操作"
              style={{
                fontSize: 11,
                color: "var(--ui-muted)",
                fontWeight: 500,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                padding: "6px 12px 2px",
              }}
            >
              <Command.Item
                value="focus composer input message"
                onSelect={() => {
                  onFocusComposer?.();
                  dismiss();
                }}
                className="cmd-item"
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  outline: "none",
                }}
              >
                <span style={{ fontWeight: 500, color: "var(--ink)" }}>
                  聚焦输入框
                </span>
                <span style={{ fontSize: 11, color: "var(--ui-muted)" }}>
                  跳到消息输入
                </span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
      <style>{`
        [cmdk-item][aria-selected="true"] { background: var(--ui-fill-hover); }
        [cmdk-item]:hover { background: var(--ui-fill); }
        [cmdk-group-heading] { font-size: 11px; color: var(--ui-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; padding: 6px 12px 2px; }
      `}</style>
    </div>
  );
}
