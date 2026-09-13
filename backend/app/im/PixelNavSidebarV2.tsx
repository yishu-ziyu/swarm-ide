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
  { id: "inbox", label: "Inbox", icon: <Inbox className="w-4 h-4" /> },
  { id: "projects", label: "Projects", icon: <FolderOpen className="w-4 h-4" />, active: true },
  { id: "agents", label: "Agents", icon: <Bot className="w-4 h-4" /> },
  { id: "sessions", label: "Sessions", icon: <History className="w-4 h-4" /> },
];

const bottomItems: NavItem[] = [
  { id: "settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
  { id: "docs", label: "Docs", icon: <FileText className="w-4 h-4" /> },
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
          <div className="w-8 h-8 rounded bg-[#a78bfa]/20 flex items-center justify-center">
            <Hexagon className="w-5 h-5 text-[#a78bfa]" />
          </div>
          <div>
            <div className="font-bold text-[#fafafa] text-sm leading-tight">
              Swarm-IDE
            </div>
            <div className="text-[10px] text-[#a1a1aa] uppercase tracking-widest font-semibold">
              v1.0.4-alpha
            </div>
          </div>
        </div>
      )}

      {view === "canvas" && (
        <div className="mb-6">
          <p className="text-xs text-[#a1a1aa] opacity-60 ml-9">v1.0.4-alpha</p>
        </div>
      )}

      {/* New Session Button */}
      <button className="w-full bg-[#a78bfa] hover:bg-[#8b5cf6] text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 mb-6 transition-all">
        <Plus className="w-4 h-4" />
        New Session
      </button>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${
              item.active
                ? "bg-[#27272a] text-[#fafafa] font-semibold"
                : "text-[#a1a1aa] hover:bg-[#18181b] hover:text-[#fafafa]"
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
            className="w-full flex items-center gap-3 px-3 py-2 text-[#a1a1aa] hover:bg-[#18181b] hover:text-[#fafafa] rounded-lg transition-all text-sm"
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
