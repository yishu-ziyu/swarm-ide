import type { ReactNode } from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import { useLanguage } from "../_components/LanguageContext";

type FocusMode = "none" | "left" | "mid" | "right";

type IMShellProps = {
  left: ReactNode;
  mid: ReactNode;
  right: ReactNode;
  focusMode?: FocusMode;
  onFocusModeChange?: (mode: FocusMode) => void;
  leftWidth?: number;
  rightWidth?: number;
  onLeftWidthChange?: (width: number) => void;
  onRightWidthChange?: (width: number) => void;
};

export function IMShell({
  left,
  mid,
  right,
  focusMode = "none",
  onFocusModeChange,
  leftWidth = 240,
  rightWidth = 320,
  onLeftWidthChange,
  onRightWidthChange,
}: IMShellProps) {
  const { t } = useLanguage();
  const [currentLeftWidth, setCurrentLeftWidth] = useState(leftWidth);
  const [currentRightWidth, setCurrentRightWidth] = useState(rightWidth);
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleLeftDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDraggingLeft(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleRightDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDraggingRight(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;

      if (isDraggingLeft) {
        const newWidth = e.clientX - containerRect.left;
        const clampedWidth = Math.min(Math.max(newWidth, 120), 400);
        setCurrentLeftWidth(clampedWidth);
        onLeftWidthChange?.(clampedWidth);
      }

      if (isDraggingRight) {
        const newWidth = containerRect.right - e.clientX;
        const clampedWidth = Math.min(Math.max(newWidth, 200), 500);
        setCurrentRightWidth(clampedWidth);
        onRightWidthChange?.(clampedWidth);
      }
    },
    [isDraggingLeft, isDraggingRight, onLeftWidthChange, onRightWidthChange]
  );

  const handleDragEnd = useCallback(() => {
    setIsDraggingLeft(false);
    setIsDraggingRight(false);
  }, []);

  useEffect(() => {
    if (isDraggingLeft || isDraggingRight) {
      const handlePointerMove = (e: PointerEvent) => {
        handleDrag(e as unknown as React.PointerEvent);
      };
      const handlePointerUp = () => {
        handleDragEnd();
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);

      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
    }
  }, [isDraggingLeft, isDraggingRight, handleDrag, handleDragEnd]);

  const toggleFocusMode = useCallback(
    (mode: FocusMode) => {
      onFocusModeChange?.(mode === focusMode ? "none" : mode);
    },
    [focusMode, onFocusModeChange]
  );

  const isLeftVisible = focusMode === "none" || focusMode === "left";
  const isMidVisible = focusMode === "none" || focusMode === "mid";
  const isRightVisible = focusMode === "none" || focusMode === "right";

  return (
    <div
      ref={containerRef}
      className="compact-apple flex flex-col md:flex-row h-full w-full overflow-hidden"
      style={
        {
          "--left-width": `${currentLeftWidth}px`,
          "--right-width": `${currentRightWidth}px`,
          background: "var(--ui-bg)",
        } as React.CSSProperties
      }
    >
      {isLeftVisible && (
        <div
          className="im-shell-left flex-shrink-0 overflow-hidden"
          style={{ width: currentLeftWidth }}
        >
          {left}
        </div>
      )}

      {isLeftVisible && isMidVisible && (
        <div
          className={`hidden md:block w-px cursor-col-resize flex-shrink-0 transition-colors duration-200 ${
            isDraggingLeft || isDraggingRight
              ? "bg-[var(--ui-accent)]"
              : "bg-[var(--ui-border)] hover:bg-[var(--ui-border-4)]"
          }`}
          onPointerDown={handleLeftDragStart}
        />
      )}

      {isMidVisible && (
        <div className="flex-1 h-full overflow-hidden min-w-0 bg-[var(--ui-bg)]">
          {mid}
        </div>
      )}

      {isMidVisible && isRightVisible && (
        <div
          className={`w-px cursor-col-resize flex-shrink-0 transition-colors duration-200 ${
            isDraggingLeft || isDraggingRight
              ? "bg-[var(--ui-accent)]"
              : "bg-[var(--ui-border)] hover:bg-[var(--ui-border-4)]"
          }`}
          onPointerDown={handleRightDragStart}
        />
      )}

      {isRightVisible && (
        <div
          className="im-shell-right flex-shrink-0 overflow-hidden"
          style={{ width: currentRightWidth }}
        >
          {right}
        </div>
      )}

      {focusMode !== "none" && (
        <button
          className="fixed top-4 right-4 z-50 px-4 py-2 text-caption font-medium bg-[var(--ui-error)] text-[var(--ui-on-accent)] rounded-lg shadow-lg hover:bg-[var(--ui-danger-strong)] transition-all"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
          onClick={() => onFocusModeChange?.("none")}
        >
          {t.exitFocus}
        </button>
      )}

      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-1 p-1 rounded-card"
        style={{
          background: "var(--ui-glass-hover)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid var(--ui-chip-border)",
        }}
      >
        <button
          className={`px-3 py-2 text-caption font-medium rounded-lg transition-all ${
            focusMode === "left"
              ? "bg-[var(--ui-accent)] text-[var(--ui-on-accent)]"
              : "bg-transparent text-[color:var(--ui-text-tertiary)] hover:bg-[var(--ui-fill)] hover:text-ink"
          }`}
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
          onClick={() => toggleFocusMode("left")}
        >
          {t.focusLeft}
        </button>
        <button
          className={`px-3 py-2 text-caption font-medium rounded-lg transition-all ${
            focusMode === "mid"
              ? "bg-[var(--ui-accent)] text-[var(--ui-on-accent)]"
              : "bg-transparent text-[color:var(--ui-text-tertiary)] hover:bg-[var(--ui-fill)] hover:text-ink"
          }`}
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
          onClick={() => toggleFocusMode("mid")}
        >
          {t.focusMiddle}
        </button>
        <button
          className={`px-3 py-2 text-caption font-medium rounded-lg transition-all ${
            focusMode === "right"
              ? "bg-[var(--ui-accent)] text-[var(--ui-on-accent)]"
              : "bg-transparent text-[color:var(--ui-text-tertiary)] hover:bg-[var(--ui-fill)] hover:text-ink"
          }`}
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
          onClick={() => toggleFocusMode("right")}
        >
          {t.focusRight}
        </button>
      </div>
    </div>
  );
}
