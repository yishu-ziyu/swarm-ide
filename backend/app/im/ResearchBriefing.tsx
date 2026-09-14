"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useLanguage } from "../_components/LanguageContext";

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

type ResearchBriefingProps = {
  groupId: string | null;
  workspaceId?: string | null;
  humanAgentId?: string | null;
  refreshToken?: number;
  topology?: ReactNode;
};

export function ResearchBriefing({
  groupId,
  workspaceId,
  humanAgentId,
  refreshToken = 0,
  topology,
}: ResearchBriefingProps) {
  const { t } = useLanguage();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [openClaimId, setOpenClaimId] = useState<string | null>(null);
  const [openPaperId, setOpenPaperId] = useState<string | null>(null);
  const [showTopology, setShowTopology] = useState(false);
  const [paperQuery, setPaperQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) {
      setBriefing(null);
      return;
    }
    try {
      const res = await fetch(`/api/research/runs?groupId=${encodeURIComponent(groupId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as Briefing | null;
      setBriefing(data);
    } catch {
      // keep last briefing
    }
  }, [groupId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 2500);
    return () => window.clearInterval(timer);
  }, [load, refreshToken]);

  const onSearchPapers = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const query = paperQuery.trim();
      if (!query || !groupId) return;
      setSearching(true);
      setSearchError(null);
      try {
        const res = await fetch("/api/research/papers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            query,
            groupId,
            workspaceId,
            agentId: humanAgentId ?? "human",
            maxResults: 8,
          }),
        });
        const data = (await res.json()) as { error?: string; recorded?: number };
        if (!res.ok) {
          setSearchError(data.error || t.researchSearchFailed);
          return;
        }
        await load();
      } catch {
        setSearchError(t.researchSearchFailed);
      } finally {
        setSearching(false);
      }
    },
    [paperQuery, groupId, workspaceId, humanAgentId, load, t.researchSearchFailed]
  );

  const hasRun = Boolean(briefing?.run?.question);
  const empty = !hasRun;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--ui-bg)",
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--ui-chip-border)",
        }}
      >
        <h3
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--ink)",
            margin: 0,
          }}
        >
          {t.researchBriefing}
        </h3>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "16px 20px 24px" }}>
        {empty ? (
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.5,
              color: "var(--ink-2)",
            }}
          >
            {t.researchEmpty}
          </p>
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--ink-2)",
                  marginBottom: 6,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {t.researchQuestion}
                {briefing!.run.phase ? ` · ${phaseLabel(briefing!.run.phase, t)}` : ""}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--ink)",
                  lineHeight: 1.4,
                }}
              >
                {briefing!.run.question}
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {briefing!.run.phase !== "commit" ? (
                  <button
                    className="btn"
                    type="button"
                    disabled={advancing}
                    onClick={async () => {
                      setAdvancing(true);
                      setSearchError(null);
                      try {
                        const res = await fetch(`/api/research/runs/${briefing!.run.id}/advance`, { method: "POST" });
                        const data = (await res.json()) as { error?: string };
                        if (!res.ok) setSearchError(data.error || t.researchAdvanceFailed);
                        await load();
                      } finally {
                        setAdvancing(false);
                      }
                    }}
                    style={{ minHeight: 32, fontSize: 13 }}
                  >
                    {advancing ? t.researchAdvancing : t.researchAdvance}
                  </button>
                ) : null}
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    window.location.href = `/api/research/runs/${briefing!.run.id}/report`;
                  }}
                  style={{ minHeight: 32, fontSize: 13 }}
                >
                  {t.researchExport}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--ink-2)",
                  marginBottom: 6,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {t.researchPlan} · {t.researchPlanVersion} v{briefing!.run.planVersion}
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink)", lineHeight: 1.5 }}>
                {briefing!.plan?.constraints?.trim() || "—"}
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--ink-2)",
                  marginBottom: 8,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {t.researchPapers}
              </div>
              <form onSubmit={onSearchPapers} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input
                  className="input"
                  value={paperQuery}
                  onChange={(e) => setPaperQuery(e.target.value)}
                  placeholder={t.researchSearchPapers}
                  style={{ flex: 1, fontSize: 13, minHeight: 32, padding: "6px 10px" }}
                />
                <button className="btn" type="submit" disabled={searching || !paperQuery.trim()} style={{ minHeight: 32 }}>
                  {searching ? t.researchSearching : t.researchSearch}
                </button>
              </form>
              {searchError ? (
                <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--ink-2)" }}>{searchError}</p>
              ) : null}
              {(briefing!.papers ?? []).length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.45 }}>
                  {t.researchPapersEmpty}
                </p>
              ) : (
                (briefing!.papers ?? []).map((item) => (
                  <PaperRow
                    key={item.id}
                    evidence={item}
                    open={openPaperId === item.id}
                    onToggle={() => setOpenPaperId(openPaperId === item.id ? null : item.id)}
                    unknownAuthors={t.researchUnknownAuthors}
                    unknownYear={t.researchUnknownYear}
                  />
                ))
              )}
            </div>

            <ClaimList
              title={t.researchClaims}
              claims={briefing!.currentConclusions}
              openClaimId={openClaimId}
              onToggle={setOpenClaimId}
              emptyLabel={t.researchNoEvidence}
              excerptLabel={t.researchExcerpt}
            />

            <ClaimList
              title={t.researchUnverified}
              claims={briefing!.unverified}
              openClaimId={openClaimId}
              onToggle={setOpenClaimId}
              emptyLabel={t.researchNoEvidence}
              excerptLabel={t.researchExcerpt}
              muted
            />

            {briefing!.previousPlanClaims.length > 0 ? (
              <ClaimList
                title={t.researchNeedsReverify}
                claims={briefing!.previousPlanClaims}
                openClaimId={openClaimId}
                onToggle={setOpenClaimId}
                emptyLabel={t.researchNoEvidence}
                excerptLabel={t.researchExcerpt}
                muted
              />
            ) : null}

            {briefing!.challenged && briefing!.challenged.length > 0 ? (
              <ClaimList
                title={t.researchChallenged}
                claims={briefing!.challenged}
                openClaimId={openClaimId}
                onToggle={setOpenClaimId}
                emptyLabel={t.researchNoEvidence}
                excerptLabel={t.researchExcerpt}
                muted
              />
            ) : null}

            {briefing!.unattachedEvidence.length > 0 ? (
              <div style={{ marginTop: 20 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--ink-2)",
                    marginBottom: 8,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {t.researchDisagreements}
                </div>
                {briefing!.unattachedEvidence.slice(0, 8).map((item) => (
                  <EvidenceBlock key={item.id} evidence={item} excerptLabel={t.researchExcerpt} />
                ))}
              </div>
            ) : null}
          </>
        )}

        {topology ? (
          <button
            type="button"
            onClick={() => setShowTopology((v) => !v)}
            style={{
              marginTop: 24,
              background: "none",
              border: "none",
              padding: 0,
              fontSize: 12,
              color: "var(--ink-2)",
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            {showTopology ? t.researchHideTopology : t.researchViewTopology}
          </button>
        ) : null}
      </div>

      {showTopology && topology ? (
        <div
          style={{
            height: 220,
            borderTop: "1px solid var(--ui-chip-border)",
            overflow: "hidden",
            opacity: 0.85,
          }}
        >
          {topology}
        </div>
      ) : null}
    </div>
  );
}

function ClaimList({
  title,
  claims,
  openClaimId,
  onToggle,
  emptyLabel,
  excerptLabel,
  muted,
}: {
  title: string;
  claims: Claim[];
  openClaimId: string | null;
  onToggle: (id: string | null) => void;
  emptyLabel: string;
  excerptLabel: string;
  muted?: boolean;
}) {
  if (claims.length === 0) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "var(--ink-2)",
          marginBottom: 8,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      {claims.map((claim) => {
        const open = openClaimId === claim.id;
        return (
          <div key={claim.id} style={{ marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => onToggle(open ? null : claim.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontSize: muted ? 13 : 14,
                fontWeight: muted ? 400 : 500,
                color: muted ? "var(--ink-2)" : "var(--ink)",
                lineHeight: 1.45,
              }}
            >
              {claim.statement}
            </button>
            {open ? (
              claim.evidence.length === 0 ? (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink-2)" }}>{emptyLabel}</p>
              ) : (
                claim.evidence.map((item) => (
                  <EvidenceBlock key={item.id} evidence={item} excerptLabel={excerptLabel} />
                ))
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function phaseLabel(phase: string, t: { researchPhaseIsolate: string; researchPhaseReview: string; researchPhaseCite: string; researchPhaseCommit: string }) {
  if (phase === "review") return t.researchPhaseReview;
  if (phase === "cite") return t.researchPhaseCite;
  if (phase === "commit") return t.researchPhaseCommit;
  return t.researchPhaseIsolate;
}

function paperMeta(evidence: Evidence, unknownAuthors: string, unknownYear: string): string {
  const authors = evidence.authors.length > 0 ? evidence.authors.join(", ") : unknownAuthors;
  const year = evidence.publishedYear != null ? String(evidence.publishedYear) : unknownYear;
  const venue = evidence.venue?.trim();
  return [authors, year, venue].filter(Boolean).join(" · ");
}

function PaperRow({
  evidence,
  open,
  onToggle,
  unknownAuthors,
  unknownYear,
}: {
  evidence: Evidence;
  open: boolean;
  onToggle: () => void;
  unknownAuthors: string;
  unknownYear: string;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", lineHeight: "20px" }}>
          {evidence.sourceTitle || evidence.sourceUrl}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 2, lineHeight: "16px" }}>
          {paperMeta(evidence, unknownAuthors, unknownYear)}
        </div>
      </button>
      {open ? (
        <div style={{ marginTop: 6, paddingLeft: 10, borderLeft: "2px solid var(--ui-chip-border)" }}>
          {evidence.excerpt ? (
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink)", lineHeight: 1.45 }}>{evidence.excerpt}</p>
          ) : null}
          <a
            href={evidence.sourceUrl}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-block", marginTop: 6, fontSize: 12, color: "var(--ink-2)" }}
          >
            {evidence.sourceUrl}
          </a>
        </div>
      ) : null}
    </div>
  );
}

function EvidenceBlock({
  evidence,
  excerptLabel,
  unknownAuthors,
  unknownYear,
}: {
  evidence: Evidence;
  excerptLabel: string;
  unknownAuthors?: string;
  unknownYear?: string;
}) {
  const meta = paperMeta(evidence, unknownAuthors ?? "Unknown", unknownYear ?? "n.d.");

  return (
    <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: "2px solid var(--ui-chip-border)" }}>
      <a
        href={evidence.sourceUrl}
        target="_blank"
        rel="noreferrer"
        style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500, textDecoration: "none" }}
      >
        {evidence.sourceTitle || evidence.sourceUrl}
      </a>
      <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 2 }}>{meta}</div>
      {evidence.excerpt ? (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink)", lineHeight: 1.45 }}>
          {evidence.excerpt}
        </p>
      ) : (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink-2)" }}>{excerptLabel}</p>
      )}
    </div>
  );
}
