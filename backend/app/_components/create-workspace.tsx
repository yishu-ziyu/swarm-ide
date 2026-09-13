"use client";

import { useState } from "react";
import { useLanguage } from "./LanguageContext";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";

type WorkspaceDefaults = {
  workspaceId: string;
  humanAgentId: string;
  assistantAgentId: string;
  defaultGroupId: string;
};

export default function CreateWorkspace() {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    if (!name.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} ${text}`);
      const data = JSON.parse(text) as WorkspaceDefaults;
      window.location.href = `/im?workspaceId=${encodeURIComponent(data.workspaceId)}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
      <input
        style={{
          flex: 1,
          minWidth: 200,
          padding: "12px 16px",
          borderRadius: 16,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "var(--ink)",
          fontSize: 14,
          outline: "none",
          transition: "all 0.2s",
          fontFamily: "'JetBrains Mono', monospace",
        }}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.workspaceNamePlaceholder}
        disabled={busy}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !busy) {
            void onCreate();
          }
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "rgba(167, 139, 250, 0.4)";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(167, 139, 250, 0.1)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />
      <motion.button
        onClick={() => void onCreate()}
        disabled={busy || !name.trim()}
        style={{
          whiteSpace: "nowrap",
          padding: "12px 20px",
          borderRadius: 16,
          background: "#7c3aed",
          color: "white",
          border: "none",
          fontSize: 14,
          fontWeight: 600,
          cursor: busy || !name.trim() ? "not-allowed" : "pointer",
          opacity: busy || !name.trim() ? 0.5 : 1,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "'JetBrains Mono', monospace",
        }}
        whileHover={{ scale: busy || !name.trim() ? 1 : 1.02, boxShadow: "0 4px 12px rgba(124, 58, 237, 0.4)" }}
        whileTap={{ scale: busy || !name.trim() ? 1 : 0.98 }}
      >
        <Plus size={14} />
        {busy ? "..." : t.create}
      </motion.button>
      {error ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            width: "100%",
            marginTop: 8,
            padding: 12,
            borderRadius: 8,
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            color: "#ef4444",
            fontSize: 13,
          }}
        >
          {error}
        </motion.div>
      ) : null}
    </div>
  );
}
