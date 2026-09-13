"use client";

import React from "react";
import {
  Inbox,
  FolderOpen,
  Bot,
  History,
  Settings,
  FileText,
  Hexagon,
  Plus,
} from "lucide-react";

type NavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
};

const navItems: NavItem[] = [
  { id: "inbox", label: "Inbox", icon: <Inbox className="w-3.5 h-3.5" /> },
  { id: "projects", label: "Projects", icon: <FolderOpen className="w-3.5 h-3.5" />, active: true },
  { id: "agents", label: "Agents", icon: <Bot className="w-3.5 h-3.5" /> },
  { id: "sessions", label: "Sessions", icon: <History className="w-3.5 h-3.5" /> },
];

const bottomItems: NavItem[] = [
  { id: "settings", label: "Settings", icon: <Settings className="w-3.5 h-3.5" /> },
  { id: "docs", label: "Docs", icon: <FileText className="w-3.5 h-3.5" /> },
];

interface PixelNavSidebarV2Props {
  view?: "chat" | "canvas";
  onNavigate?: (id: string) => void;
}

export function PixelNavSidebarV2({
  view = "chat",
  onNavigate,
}: PixelNavSidebarV2Props) {
  const handleNavClick = (id: string) => {
    onNavigate?.(id);
  };

  return (
    <aside className="w-64 border-r border-[#27272a] bg-[#0c0c0f] flex flex-col p-4 shrink-0 z-40">
      {/* Logo Section */}
      {view === "chat" && (
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-8 h-8 rounded-nav bg-[#a78bfa] flex items-center justify-center">
            <Hexagon className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-ink text-sm leading-tight">
              Swarm-IDE
            </div>
            <div className="text-caption text-ink-2 uppercase tracking-widest font-medium">
              v1.0.4-alpha
            </div>
          </div>
        </div>
      )}

      {view === "canvas" && (
        <div className="mb-6">
          <p className="text-caption text-ink-2 opacity-60 ml-9">v1.0.4-alpha</p>
        </div>
      )}

      {/* New Session Button */}
      <button className="w-full bg-[#a78bfa] hover:bg-[#8b5cf6] text-white font-medium py-2 px-4 rounded-full flex items-center justify-center gap-2 mb-6 transition-all">
        <Plus className="w-3.5 h-3.5" />
        New Session
      </button>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-nav transition-all text-emphasis ${
              item.active
                ? "bg-[#27272a] text-ink font-semibold"
                : "text-ink-2 hover:bg-[#18181b] hover:text-ink"
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-[#27272a] pt-4 mt-auto space-y-1">
        {bottomItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className="w-full flex items-center gap-3 px-3 py-2 text-ink-2 hover:bg-[#18181b] hover:text-ink rounded-nav transition-all text-emphasis"
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

export default PixelNavSidebarV2;
