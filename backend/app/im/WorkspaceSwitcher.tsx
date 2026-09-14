'use client';

import { useState } from "react";
import { useLanguage } from "../_components/LanguageContext";
import { ChevronsUpDown, Check, Folder, Plus } from "lucide-react";

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
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className="bg-[var(--ui-pixel-surface)] px-3 py-1 flex items-center gap-2 border-2 border-[var(--ui-pixel-outline-30)] cursor-pointer hover:bg-[var(--ui-pixel-surface-hover)] step-transition"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-mono text-xs text-ink font-bold">
          {currentWorkspace}
        </span>
        <ChevronsUpDown size={14} className="text-ink-2" />
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
          <div className="absolute top-full left-0 mt-1 w-48 bg-[var(--ui-pixel-surface)] pixel-border-double z-50">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                className={`
                  w-full px-3 py-2 flex items-center gap-2 text-left
                  ${ws.name === currentWorkspace 
                    ? "bg-[var(--ui-pixel-active)] text-[color:var(--ui-on-accent)]" 
                    : "hover:bg-[var(--ui-pixel-menu)]"
                  }
                `}
                onClick={() => {
                  onWorkspaceChange?.(ws.id);
                  setIsOpen(false);
                }}
              >
                {ws.name === currentWorkspace ? (
                  <Check size={14} />
                ) : (
                  <Folder size={14} />
                )}
                <span className="font-mono text-xs">
                  {ws.name}
                </span>
              </button>
            ))}
            
            {/* Divider */}
            <div className="border-t border-[var(--ui-pixel-outline-20)]" />
            
            {/* Create New */}
            <button
              className="w-full px-3 py-2 flex items-center gap-2 text-ink-2 hover:bg-[var(--ui-pixel-menu)]"
              onClick={() => {
                onCreateWorkspace?.();
                setIsOpen(false);
              }}
            >
              <Plus size={14} />
              <span className="font-mono text-xs">
                {t.createWorkspace}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
