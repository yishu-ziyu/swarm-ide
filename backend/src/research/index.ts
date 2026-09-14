/**
 * Research Module
 *
 * Academic research support module for Swarm-IDE.
 * Provides tools for neural search, citation management,
 * and research report synthesis.
 */

// Core research components
export {
  ResearchState,
  ResearchWorkflow,
  CitationManager,
  ResearchSession,
  createResearchSession,
} from "./research-runtime";

// Types
export type { SearchResult, Citation, ResearchReport } from "./research-runtime";
export { researchStore } from "./research-store";
export { citationDraftFromSearchHit } from "./citation-metadata";
export { searchPapers } from "./paper-search";
export { isCurrentConclusion, partitionClaims } from "./claim-policy";
export {
  peerMessageAllowed,
  isFinalConclusion,
  nextResearchPhase,
} from "./protocol";
