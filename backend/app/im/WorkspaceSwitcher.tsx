'use client';

import { useState } from "react";

type Workspace = {
  id: string;
  name: string;
};

type WorkspaceSwitcherProps = {
  currentWorkspace?: string;
  workspaces?: Workspace[];
  onWorkspaceChange?: (id: string) => void;
  onCreateWorkspace?: () => void;
};

export function WorkspaceSwitcher({
  currentWorkspace = "PROJECT_A",
  workspaces = [],
  onWorkspaceChange,
  onCreateWorkspace,
}: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className="bg-[#eeeeed] px-3 py-1 flex items-center gap-2 border-2 border-[#867461]/30 cursor-pointer hover:bg-[#e8e8e7] step-transition"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-mono text-xs text-[#855300] font-bold">
          {currentWorkspace}
        </span>
        <span className="material-symbols-outlined text-sm text-[#867461]">
          {isOpen ? "swap_vert" : "swap_vert"}
        </span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          
          {/* Menu */}
          <div className="absolute top-full left-0 mt-1 w-48 bg-[#eeeeed] pixel-border-double z-50">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                className={`
                  w-full px-3 py-2 flex items-center gap-2 text-left
                  ${ws.name === currentWorkspace 
                    ? "bg-[#f59e0b] text-white" 
                    : "hover:bg-[#f9f9f8]"
                  }
                `}
                onClick={() => {
                  onWorkspaceChange?.(ws.id);
                  setIsOpen(false);
                }}
              >
                <span className="material-symbols-outlined text-sm">
                  {ws.name === currentWorkspace ? "check" : "folder"}
                </span>
                <span className="font-mono text-xs">
                  {ws.name}
                </span>
              </button>
            ))}
            
            {/* Divider */}
            <div className="border-t border-[#867461]/20" />
            
            {/* Create New */}
            <button
              className="w-full px-3 py-2 flex items-center gap-2 text-[#867461] hover:bg-[#f9f9f8]"
              onClick={() => {
                onCreateWorkspace?.();
                setIsOpen(false);
              }}
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span className="font-mono text-xs">
                Create New...
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
