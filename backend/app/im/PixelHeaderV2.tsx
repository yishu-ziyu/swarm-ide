"use client";

import React from "react";
import {
  Search,
  Settings,
  HelpCircle,
  Hexagon,
  User,
} from "lucide-react";

interface PixelHeaderV2Props {
  view: "chat" | "canvas";
  onViewChange: (view: "chat" | "canvas") => void;
  onSearch?: (query: string) => void;
  onSettings?: () => void;
}

export function PixelHeaderV2({
  view,
  onViewChange,
  onSearch,
  onSettings,
}: PixelHeaderV2Props) {
  return (
    <header className="h-14 border-b border-[#27272a] bg-[#09090b]/80 backdrop-blur flex items-center justify-between px-6 shrink-0 z-50">
      {/* Left Section - Logo and Nav */}
      <div className="flex items-center gap-8">
        {/* Logo */}
        <div className="text-lg font-black tracking-tighter text-[#fafafa] flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#a78bfa]/20 flex items-center justify-center">
            <Hexagon className="w-4 h-4 text-[#a78bfa]" />
          </div>
          Swarm-IDE
        </div>

        {/* Navigation Tabs */}
        <nav className="flex gap-6 font-medium text-sm">
          <button
            onClick={() => onViewChange("chat")}
            className={`pb-1 border-b-2 transition-colors ${
              view === "chat"
                ? "text-[#a78bfa] border-[#a78bfa]"
                : "text-[#a1a1aa] border-transparent hover:text-[#fafafa]"
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => onViewChange("canvas")}
            className={`pb-1 border-b-2 transition-colors ${
              view === "canvas"
                ? "text-[#a78bfa] border-[#a78bfa]"
                : "text-[#a1a1aa] border-transparent hover:text-[#fafafa]"
            }`}
          >
            Canvas
          </button>
        </nav>
      </div>

      {/* Right Section - Search and Actions */}
      <div className="flex items-center gap-4">
        {/* Search Bar - Only visible on Canvas view */}
        {view === "canvas" && (
          <div className="flex items-center bg-[#121215] rounded-lg px-3 py-1.5 border border-[#27272a]">
            <Search className="w-4 h-4 text-[#a1a1aa] mr-2" />
            <input
              type="text"
              placeholder="Search agents..."
              className="bg-transparent border-none focus:ring-0 text-xs w-48 text-[#fafafa] outline-none"
              onChange={(e) => onSearch?.(e.target.value)}
            />
          </div>
        )}

        {/* Chat Search - visible on Chat view */}
        {view === "chat" && (
          <button className="p-2 text-[#a1a1aa] hover:bg-[#18181b] rounded-lg transition-colors">
            <Search className="w-5 h-5" />
          </button>
        )}

        {/* Help Button */}
        <button className="p-2 text-[#a1a1aa] hover:bg-[#18181b] rounded-lg transition-colors">
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* Settings Button */}
        <button
          className="p-2 text-[#a1a1aa] hover:bg-[#18181b] rounded-lg transition-colors"
          onClick={onSettings}
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* User Avatar */}
        <div className="w-8 h-8 rounded-full border border-[#27272a] bg-[#18181b] flex items-center justify-center overflow-hidden">
          <User className="w-4 h-4 text-[#a1a1aa]" />
        </div>
      </div>
    </header>
  );
}

export default PixelHeaderV2;
