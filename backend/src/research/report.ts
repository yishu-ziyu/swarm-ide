function formatUnknownAuthors(authors: string[]): string {
  const cleaned = authors.map((a) => a.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned.join(", ") : "Unknown";
}

function formatUnknownYear(year: number | null | undefined): string {
  return typeof year === "number" && Number.isFinite(year) ? String(year) : "n.d.";
}

export type ReportEvidence = {
  excerpt: string;
  sourceUrl: string;
  sourceTitle: string;
  authors: string[];
  publishedYear: number | null;
  doi: string | null;
  venue: string | null;
};

export type ReportClaim = {
  statement: string;
  status: string;
  evidence: ReportEvidence[];
};

export function formatEvidenceApa(item: ReportEvidence): string {
  const authors = formatUnknownAuthors(item.authors);
  const year = formatUnknownYear(item.publishedYear);
  const venue = item.venue ? ` ${item.venue}.` : "";
  const doi = item.doi ? ` ${item.doi}` : item.sourceUrl ? ` ${item.sourceUrl}` : "";
  return `${authors} (${year}). ${item.sourceTitle}.${venue}${doi}`.trim();
}

export function buildResearchReportMarkdown(input: {
  question: string;
  phase: string;
  planVersion: number;
  constraints: string;
  conclusions: ReportClaim[];
  unverified: ReportClaim[];
  previous: ReportClaim[];
  papers: ReportEvidence[];
  unused: ReportEvidence[];
}): string {
  const lines: string[] = [];
  lines.push(`# ${input.question || "Untitled research"}`);
  lines.push("");
  lines.push(`Phase: ${input.phase} · Plan v${input.planVersion}`);
  if (input.constraints.trim()) {
    lines.push("");
    lines.push("## Constraints");
    lines.push(input.constraints.trim());
  }

  lines.push("");
  lines.push("## Conclusions");
  if (input.conclusions.length === 0) {
    lines.push("None verified for the current plan.");
  } else {
    for (const claim of input.conclusions) {
      lines.push(`- ${claim.statement}`);
      for (const ev of claim.evidence) {
        lines.push(`  - ${ev.excerpt || ev.sourceTitle}`);
        lines.push(`  - ${formatEvidenceApa(ev)}`);
      }
    }
  }

  if (input.unverified.length > 0) {
    lines.push("");
    lines.push("## Unverified (needs evidence)");
    for (const claim of input.unverified) {
      lines.push(`- ${claim.statement}`);
    }
  }

  if (input.previous.length > 0) {
    lines.push("");
    lines.push("## Previous plan (not in current conclusions)");
    for (const claim of input.previous) {
      lines.push(`- ${claim.statement} [${claim.status}]`);
    }
  }

  if (input.papers.length > 0) {
    lines.push("");
    lines.push("## Papers");
    for (const paper of input.papers) {
      lines.push(`- ${formatEvidenceApa(paper)}`);
    }
  }

  if (input.unused.length > 0) {
    lines.push("");
    lines.push("## Unused evidence / open disagreements");
    for (const item of input.unused) {
      lines.push(`- ${item.sourceTitle}: ${item.excerpt.slice(0, 240)}`);
    }
  }

  lines.push("");
  lines.push("## References");
  const seen = new Set<string>();
  for (const item of [...input.papers, ...input.unused, ...input.conclusions.flatMap((c) => c.evidence)]) {
    const key = item.doi || item.sourceUrl;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`- ${formatEvidenceApa(item)}`);
  }

  return lines.join("\n");
}
