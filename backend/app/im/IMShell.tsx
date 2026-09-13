import type { ReactNode } from "react";
import { useState, useCallback, useRef, useEffect } from "react";

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
          background: "#0d0d0d",
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
              ? "bg-[#a78bfa]"
              : "bg-[#2a2a2a] hover:bg-[#3a3a3a]"
          }`}
          onPointerDown={handleLeftDragStart}
        />
      )}

      {isMidVisible && (
        <div className="flex-1 h-full overflow-hidden min-w-0 bg-[#0d0d0d]">
          {mid}
        </div>
      )}

      {isMidVisible && isRightVisible && (
        <div
          className={`w-px cursor-col-resize flex-shrink-0 transition-colors duration-200 ${
            isDraggingLeft || isDraggingRight
              ? "bg-[#a78bfa]"
              : "bg-[#2a2a2a] hover:bg-[#3a3a3a]"
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
          className="fixed top-4 right-4 z-50 px-4 py-2 text-caption font-medium bg-[#ef4444] text-white rounded-lg shadow-lg hover:bg-[#dc2626] transition-all"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
          onClick={() => onFocusModeChange?.("none")}
        >
          退出专注
        </button>
      )}

      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-1 p-1 rounded-card"
        style={{
          background: "rgba(26, 26, 26, 0.8)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <button
          className={`px-3 py-2 text-caption font-medium rounded-lg transition-all ${
            focusMode === "left"
              ? "bg-[#a78bfa] text-white"
              : "bg-transparent text-ink-3 hover:bg-[rgba(255,255,255,0.04)] hover:text-ink"
          }`}
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
          onClick={() => toggleFocusMode("left")}
        >
          左侧
        </button>
        <button
          className={`px-3 py-2 text-caption font-medium rounded-lg transition-all ${
            focusMode === "mid"
              ? "bg-[#a78bfa] text-white"
              : "bg-transparent text-ink-3 hover:bg-[rgba(255,255,255,0.04)] hover:text-ink"
          }`}
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
          onClick={() => toggleFocusMode("mid")}
        >
          中间
        </button>
        <button
          className={`px-3 py-2 text-caption font-medium rounded-lg transition-all ${
            focusMode === "right"
              ? "bg-[#a78bfa] text-white"
              : "bg-transparent text-ink-3 hover:bg-[rgba(255,255,255,0.04)] hover:text-ink"
          }`}
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
          onClick={() => toggleFocusMode("right")}
        >
          右侧
        </button>
      </div>
    </div>
  );
}
