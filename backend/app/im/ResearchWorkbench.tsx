"use client";

import { useCallback, useEffect, useState } from "react";

// ── types (mirrors briefing API shape) ──────────────────────────────────────

type Evidence = {
  id: string;
  excerpt: string;
  sourceUrl: string;
  sourceTitle: string;
  authors: string[];
  publishedYear: number | null;
  retrievedAt: string;
  kind?: string;
  venue?: string | null;
  doi?: string | null;
};

type Claim = {
  id: string;
  statement: string;
  status: string;
  planVersion: number;
  evidence: Evidence[];
};

type Briefing = {
  run: {
    id: string;
    question: string;
    planVersion: number;
    status: string;
    phase?: string;
  };
  plan: { version: number; constraints: string } | null;
  currentConclusions: Claim[];
  unverified: Claim[];
  previousPlanClaims: Claim[];
  unattachedEvidence: Evidence[];
  challenged?: Claim[];
  papers?: Evidence[];
};

type Props = {
  groupId: string | null;
  workspaceId?: string | null;
  humanAgentId?: string | null;
  refreshToken?: number;
};

// ── helpers ──────────────────────────────────────────────────────────────────

function yearStr(year: number | null): string {
  return year != null ? String(year) : "年份未知";
}

function metaLine(e: Evidence): string {
  const parts: string[] = [];
  if (e.authors.length > 0) parts.push(e.authors.slice(0, 3).join("、") + (e.authors.length > 3 ? " 等" : ""));
  parts.push(yearStr(e.publishedYear));
  if (e.venue?.trim()) parts.push(e.venue.trim());
  return parts.join(" · ");
}

function phaseLabel(phase: string): string {
  const map: Record<string, string> = { isolate: "收集", review: "审阅", cite: "引用", commit: "定稿" };
  return map[phase] ?? phase;
}

// ── sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 8,
        paddingTop: 16,
        borderTop: "1px solid var(--ui-chip-border)",
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-2)",
        }}
      >
        {label}
      </span>
      {count != null && count > 0 && (
        <span
          style={{
            fontSize: 10,
            color: "var(--ink-2)",
            background: "var(--ui-chip-border)",
            borderRadius: 8,
            padding: "0 5px",
            lineHeight: "16px",
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function PaperItem({
  evidence,
  selected,
  onSelect,
}: {
  evidence: Evidence;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div style={{ marginBottom: 2 }}>
      <button
        type="button"
        onClick={onSelect}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          background: selected ? "var(--ui-chip-border)" : "none",
          border: "none",
          borderRadius: 4,
          padding: "5px 6px",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: selected ? 600 : 400,
            color: "var(--ink)",
            lineHeight: "18px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={evidence.sourceTitle || evidence.sourceUrl}
        >
          {evidence.sourceTitle || evidence.sourceUrl}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 1, lineHeight: "15px" }}>
          {metaLine(evidence)}
        </div>
      </button>

      {selected && (
        <div
          style={{
            margin: "4px 6px 8px",
            padding: "8px 10px",
            background: "var(--ui-bg)",
            border: "1px solid var(--ui-chip-border)",
            borderRadius: 4,
          }}
        >
          {evidence.doi && (
            <div style={{ fontSize: 11, color: "var(--ink-2)", marginBottom: 4 }}>
              DOI:{" "}
              <a
                href={`https://doi.org/${evidence.doi}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--ink-2)", textDecoration: "underline" }}
              >
                {evidence.doi}
              </a>
            </div>
          )}
          <a
            href={evidence.sourceUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              fontSize: 11,
              color: "var(--ink-2)",
              wordBreak: "break-all",
              marginBottom: evidence.excerpt ? 6 : 0,
            }}
          >
            {evidence.sourceUrl}
          </a>
          {evidence.excerpt && (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "var(--ink)",
                lineHeight: 1.55,
                borderLeft: "2px solid var(--ui-chip-border)",
                paddingLeft: 8,
              }}
            >
              {evidence.excerpt}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_DOT: Record<string, { color: string; label: string }> = {
  supported: { color: "#3a9b6e", label: "支持" },
  confirmed: { color: "#3a9b6e", label: "支持" },
  challenged: { color: "#c0433a", label: "质疑" },
  refuted: { color: "#c0433a", label: "质疑" },
  unverified: { color: "#a0a0a0", label: "待核实" },
};

function conclusionStatus(status: string): { color: string; label: string } {
  return STATUS_DOT[status] ?? { color: "#a0a0a0", label: "待核实" };
}

function ClaimItem({
  claim,
  open,
  onToggle,
}: {
  claim: Claim;
  open: boolean;
  onToggle: () => void;
}) {
  const st = conclusionStatus(claim.status);
  return (
    <div style={{ marginBottom: 8 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 6,
          width: "100%",
          textAlign: "left",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        <span
          style={{
            flexShrink: 0,
            marginTop: 5,
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: st.color,
          }}
        />
        <span style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.5 }}>{claim.statement}</span>
      </button>
      {open && claim.evidence.length > 0 && (
        <div style={{ marginTop: 6, marginLeft: 12 }}>
          {claim.evidence.map((ev) => (
            <div
              key={ev.id}
              style={{
                marginBottom: 6,
                paddingLeft: 8,
                borderLeft: "2px solid var(--ui-chip-border)",
              }}
            >
              <a
                href={ev.sourceUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, color: "var(--ink)", fontWeight: 500, textDecoration: "none" }}
              >
                {ev.sourceTitle || ev.sourceUrl}
              </a>
              <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 1 }}>{metaLine(ev)}</div>
              {ev.excerpt && (
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--ink)", lineHeight: 1.45 }}>
                  {ev.excerpt}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {open && claim.evidence.length === 0 && (
        <p style={{ margin: "4px 0 0 12px", fontSize: 12, color: "var(--ink-2)" }}>暂无证据</p>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function ResearchWorkbench({ groupId, workspaceId, humanAgentId, refreshToken = 0 }: Props) {
  void workspaceId;
  void humanAgentId;

  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [openClaimId, setOpenClaimId] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(true);

  const load = useCallback(async () => {
    if (!groupId) { setBriefing(null); return; }
    try {
      const res = await fetch(`/api/research/runs?groupId=${encodeURIComponent(groupId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as Briefing | null;
      setBriefing(data);
    } catch { /* keep last */ }
  }, [groupId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 2500);
    return () => window.clearInterval(timer);
  }, [load, refreshToken]);

  const run = briefing?.run;
  const papers = briefing?.papers ?? [];
  const supporting = briefing?.currentConclusions ?? [];
  const questioned = briefing?.challenged ?? [];
  const pending = [...(briefing?.unverified ?? []), ...(briefing?.previousPlanClaims ?? [])];

  if (!run?.question) {
    return (
      <div style={wrapStyle}>
        <Header />
        <div style={{ padding: "20px", fontSize: 13, color: "var(--ink-2)" }}>尚无研究任务</div>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <Header />
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 24px" }}>

        {/* 问题 */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-2)", marginBottom: 6 }}>
            问题{run.phase ? `  ·  ${phaseLabel(run.phase)}` : ""}
          </div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--ink)", lineHeight: 1.45 }}>
            {run.question}
          </p>
        </div>

        {/* 计划 */}
        <SectionHeader label="计划" />
        <button
          type="button"
          onClick={() => setPlanOpen((v) => !v)}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontSize: 12,
            color: "var(--ink-2)",
            marginBottom: 6,
          }}
        >
          {planOpen ? "▾" : "▸"} 版本 v{run.planVersion}
        </button>
        {planOpen && (
          <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--ink)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
            {briefing?.plan?.constraints?.trim() || "—"}
          </p>
        )}

        {/* 论文 */}
        <SectionHeader label="论文" count={papers.length} />
        {papers.length === 0 ? (
          <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--ink-2)" }}>暂无论文</p>
        ) : (
          papers.map((p) => (
            <PaperItem
              key={p.id}
              evidence={p}
              selected={selectedPaperId === p.id}
              onSelect={() => setSelectedPaperId(selectedPaperId === p.id ? null : p.id)}
            />
          ))
        )}

        {/* 结论 ── 支持 */}
        {supporting.length > 0 && (
          <>
            <SectionHeader label="支持结论" count={supporting.length} />
            {supporting.map((c) => (
              <ClaimItem
                key={c.id}
                claim={c}
                open={openClaimId === c.id}
                onToggle={() => setOpenClaimId(openClaimId === c.id ? null : c.id)}
              />
            ))}
          </>
        )}

        {/* 结论 ── 质疑 */}
        {questioned.length > 0 && (
          <>
            <SectionHeader label="质疑结论" count={questioned.length} />
            {questioned.map((c) => (
              <ClaimItem
                key={c.id}
                claim={c}
                open={openClaimId === c.id}
                onToggle={() => setOpenClaimId(openClaimId === c.id ? null : c.id)}
              />
            ))}
          </>
        )}

        {/* 结论 ── 待核实 */}
        {pending.length > 0 && (
          <>
            <SectionHeader label="待核实" count={pending.length} />
            {pending.map((c) => (
              <ClaimItem
                key={c.id}
                claim={c}
                open={openClaimId === c.id}
                onToggle={() => setOpenClaimId(openClaimId === c.id ? null : c.id)}
              />
            ))}
          </>
        )}

        {/* 散落证据 */}
        {(briefing?.unattachedEvidence ?? []).length > 0 && (
          <>
            <SectionHeader label="散落证据" count={briefing!.unattachedEvidence.length} />
            {briefing!.unattachedEvidence.slice(0, 6).map((ev) => (
              <div
                key={ev.id}
                style={{ marginBottom: 8, paddingLeft: 8, borderLeft: "2px solid var(--ui-chip-border)" }}
              >
                <a
                  href={ev.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12, color: "var(--ink)", fontWeight: 500, textDecoration: "none" }}
                >
                  {ev.sourceTitle || ev.sourceUrl}
                </a>
                <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 1 }}>{metaLine(ev)}</div>
                {ev.excerpt && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--ink)", lineHeight: 1.45 }}>{ev.excerpt}</p>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── layout atoms ─────────────────────────────────────────────────────────────

const wrapStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  background: "var(--ui-bg)",
  minHeight: 0,
  fontFamily: '-apple-system, "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif',
};

function Header() {
  return (
    <div
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--ui-chip-border)",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--ink-2)",
      }}
    >
      研究工作台
    </div>
  );
}
