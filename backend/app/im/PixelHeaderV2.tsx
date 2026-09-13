"use client";

import React from "react";
import {
  Search,
  Settings,
  HelpCircle,
  Hexagon,
  User,
} from "lucide-react";
import { useLanguage } from "../_components/LanguageContext";

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
  const { t } = useLanguage();

  return (
    <header className="h-14 border-b border-[#27272a] bg-[#09090b]/80 backdrop-blur flex items-center justify-between px-6 shrink-0 z-50">
      {/* Left Section - Logo and Nav */}
      <div className="flex items-center gap-8">
        {/* Logo */}
        <div className="text-title font-semibold tracking-tight text-ink flex items-center gap-2">
          <div className="w-5 h-5 rounded-nav bg-[#a78bfa] flex items-center justify-center">
            <Hexagon className="w-3.5 h-3.5 text-white" />
          </div>
          Swarm-IDE
        </div>

        {/* Navigation Tabs */}
        <nav className="flex gap-6 font-medium text-emphasis">
          <button
            onClick={() => onViewChange("chat")}
            className={`pb-1 border-b-2 transition-colors ${
              view === "chat"
                ? "text-ink border-[#a78bfa]"
                : "text-ink-2 border-transparent hover:text-ink"
            }`}
          >
            {t.chat}
          </button>
          <button
            onClick={() => onViewChange("canvas")}
            className={`pb-1 border-b-2 transition-colors ${
              view === "canvas"
                ? "text-ink border-[#a78bfa]"
                : "text-ink-2 border-transparent hover:text-ink"
            }`}
          >
            {t.canvas}
          </button>
        </nav>
      </div>

      {/* Right Section - Search and Actions */}
      <div className="flex items-center gap-4">
        {/* Search Bar - Only visible on Canvas view */}
        {view === "canvas" && (
          <div className="flex items-center bg-[#121215] rounded-lg px-3 py-1.5 border border-[#27272a]">
            <Search className="w-3.5 h-3.5 text-ink-2 mr-2" />
            <input
              type="text"
              placeholder={t.searchAgents}
              className="bg-transparent border-none focus:ring-0 text-caption w-48 text-ink outline-none"
              onChange={(e) => onSearch?.(e.target.value)}
            />
          </div>
        )}

        {/* Chat Search - visible on Chat view */}
        {view === "chat" && (
          <button className="p-2 text-ink-2 hover:bg-[#18181b] rounded-nav transition-colors">
            <Search className="w-5 h-5" />
          </button>
        )}

        {/* Help Button */}
        <button className="p-2 text-ink-2 hover:bg-[#18181b] rounded-nav transition-colors">
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* Settings Button */}
        <button
          className="p-2 text-ink-2 hover:bg-[#18181b] rounded-nav transition-colors"
          onClick={onSettings}
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* User Avatar */}
        <div className="w-8 h-8 rounded-full border border-[#27272a] bg-[#18181b] flex items-center justify-center overflow-hidden">
          <User className="w-3.5 h-3.5 text-ink-2" />
        </div>
      </div>
    </header>
  );
}

export default PixelHeaderV2;
