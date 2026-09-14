"use client";

import { useState } from "react";
import { useLanguage } from "./LanguageContext";

const SESSION_KEY = "agent-wechat.session.v1";

export default function ClearDbButton() {
  const { t } = useLanguage();
  const [busy, setBusy] = useState<"reset" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onReset() {
    if (busy) return;
    setError(null);

    const confirmed = window.confirm(t.resetConfirmMessage);
    if (!confirmed) return;

    setBusy("reset");
    try {
      await fetch("/api/admin/reset", { method: "POST" });
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch {
        // ignore
      }
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <button
        className="btn"
        onClick={() => void onReset()}
        disabled={busy !== null}
        style={{
          background: "var(--ui-danger-bg)",
          borderColor: "var(--ui-danger-deep)",
          color: "var(--ui-danger-text)",
        }}
      >
        {busy === "reset" ? t.resetting : t.resetDbAndRedis}
      </button>
      {error ? (
        <div className="toast" style={{ width: "100%", marginTop: 8 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
