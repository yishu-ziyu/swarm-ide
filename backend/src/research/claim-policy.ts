export type ClaimStatus = "supported" | "unverified" | "needs_reverify" | "superseded";

export type ClaimLike = {
  planVersion: number;
  status: ClaimStatus | string;
};

export function claimStatusForEvidenceCount(evidenceCount: number): "supported" | "unverified" {
  return evidenceCount > 0 ? "supported" : "unverified";
}

/** Current-plan conclusions that may enter the final report. */
export function isCurrentConclusion(claim: ClaimLike, currentPlanVersion: number): boolean {
  if (claim.planVersion !== currentPlanVersion) return false;
  if (claim.status === "needs_reverify" || claim.status === "superseded") return false;
  return true;
}

export function partitionClaims<T extends ClaimLike>(
  claims: T[],
  currentPlanVersion: number
): { current: T[]; archived: T[]; unverified: T[] } {
  const current: T[] = [];
  const archived: T[] = [];
  const unverified: T[] = [];
  for (const claim of claims) {
    if (!isCurrentConclusion(claim, currentPlanVersion)) {
      archived.push(claim);
      continue;
    }
    if (claim.status === "unverified") unverified.push(claim);
    else current.push(claim);
  }
  return { current, archived, unverified };
}
