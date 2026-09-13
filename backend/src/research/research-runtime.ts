/**
 * Research Runtime Module
 *
 * Specialized agent runtime for academic research tasks.
 * Provides research workflow orchestration with Tavily/Exa search,
 * content extraction, citation management, and report synthesis.
 */

import { AgentRuntime, UUID } from "../runtime/agent-runtime";

type ResearchMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type SearchResult = {
  url: string;
  title: string;
  content: string;
  publishedDate?: string;
  source?: string;
};

type Citation = {
  id: string;
  type: "journal" | "conference" | "web" | "book";
  authors: string[];
  year: number;
  title: string;
  url?: string;
  journal?: string;
  doi?: string;
};

type ResearchReport = {
  topic: string;
  abstract: string;
  sections: Array<{
    title: string;
    content: string;
  }>;
  citations: Citation[];
  sources: string[];
};

/**
 * Research State Manager
 *
 * Manages the state of ongoing research tasks, including:
 * - Search results collection
 * - Citation tracking
 * - Report section progress
 */
export class ResearchState {
  private state: Map<string, unknown> = new Map();

  set(key: string, value: unknown): void {
    this.state.set(key, value);
  }

  get<T>(key: string): T | undefined {
    return this.state.get(key) as T | undefined;
  }

  getSearchResults(): SearchResult[] {
    return this.get<SearchResult[]>("searchResults") || [];
  }

  addSearchResult(result: SearchResult): void {
    const results = this.getSearchResults();
    results.push(result);
    this.set("searchResults", results);
  }

  getCitations(): Citation[] {
    return this.get<Citation[]>("citations") || [];
  }

  addCitation(citation: Citation): void {
    const citations = this.getCitations();
    citations.push(citation);
    this.set("citations", citations);
  }

  getReportSections(): Array<{ title: string; content: string }> {
    return this.get<Array<{ title: string; content: string }>>("reportSections") || [];
  }

  addReportSection(title: string, content: string): void {
    const sections = this.getReportSections();
    sections.push({ title, content });
    this.set("reportSections", sections);
  }

  clear(): void {
    this.state.clear();
  }
}

/**
 * Research Workflow Orchestrator
 *
 * Coordinates the multi-step research workflow:
 * 1. Topic Definition
 * 2. Search (Tavily + Exa)
 * 3. Content Extraction
 * 4. Citation Management
 * 5. Report Synthesis
 */
export class ResearchWorkflow {
  private state: ResearchState;

  constructor() {
    this.state = new ResearchState();
  }

  /**
   * Initialize a new research task
   */
  initialize(topic: string): void {
    this.state.clear();
    this.state.set("topic", topic);
    this.state.set("status", "initialized");
    this.state.set("createdAt", new Date().toISOString());
  }

  /**
   * Get current research status
   */
  getStatus(): string {
    return this.state.get<string>("status") || "unknown";
  }

  /**
   * Update research status
   */
  setStatus(status: string): void {
    this.state.set("status", status);
  }

  /**
   * Get topic being researched
   */
  getTopic(): string {
    return this.state.get<string>("topic") || "";
  }

  /**
   * Get all collected search results
   */
  getSearchResults(): SearchResult[] {
    return this.state.getSearchResults();
  }

  /**
   * Add a search result
   */
  addSearchResult(result: SearchResult): void {
    this.state.addSearchResult(result);
  }

  /**
   * Get all citations
   */
  getCitations(): Citation[] {
    return this.state.getCitations();
  }

  /**
   * Add a citation
   */
  addCitation(citation: Citation): void {
    this.state.addCitation(citation);
  }

  /**
   * Generate unique citation ID
   */
  generateCitationId(type: Citation["type"], year: number): string {
    const prefix = {
      journal: "JP",
      conference: "CP",
      web: "WB",
      book: "BK",
    }[type];
    const existing = this.getCitations().filter(
      (c) => c.id.startsWith(`${prefix}-${year}`)
    ).length;
    return `${prefix}-${year}-${String(existing + 1).padStart(3, "0")}`;
  }

  /**
   * Get report sections
   */
  getReportSections(): Array<{ title: string; content: string }> {
    return this.state.getReportSections();
  }

  /**
   * Add a report section
   */
  addReportSection(title: string, content: string): void {
    this.state.addReportSection(title, content);
  }

  /**
   * Generate final research report
   */
  generateReport(abstract: string): ResearchReport {
    return {
      topic: this.getTopic(),
      abstract,
      sections: this.getReportSections(),
      citations: this.getCitations(),
      sources: this.getSearchResults().map((r) => r.url),
    };
  }

  /**
   * Format citations in APA style
   */
  formatCitationAPA(citation: Citation): string {
    const authors = citation.authors.join(", ");
    switch (citation.type) {
      case "journal":
        return `${authors} (${citation.year}). ${citation.title}. ${citation.journal}. ${citation.url || ""}`;
      case "conference":
        return `${authors} (${citation.year}). ${citation.title}. ${citation.url || ""}`;
      case "web":
        return `${authors} (${citation.year}). ${citation.title}. Retrieved from ${citation.url}`;
      case "book":
        return `${authors} (${citation.year}). ${citation.title}. ${citation.url || ""}`;
      default:
        return `${authors} (${citation.year}). ${citation.title}.`;
    }
  }
}

/**
 * Citation Manager
 *
 * Handles citation tracking and formatting
 */
export class CitationManager {
  private citations: Map<string, Citation> = new Map();

  add(citation: Citation): void {
    this.citations.set(citation.id, citation);
  }

  get(id: string): Citation | undefined {
    return this.citations.get(id);
  }

  getAll(): Citation[] {
    return Array.from(this.citations.values());
  }

  formatAPA(citation: Citation): string {
    const authors = citation.authors.join(", ");
    switch (citation.type) {
      case "journal":
        return `${authors} (${citation.year}). ${citation.title}. ${citation.journal || ""}. ${citation.doi || citation.url || ""}`;
      case "web":
        return `${authors} (${citation.year}). ${citation.title}. Retrieved from ${citation.url || ""}`;
      case "book":
        return `${authors} (${citation.year}). ${citation.title}. ${citation.url || ""}`;
      default:
        return `${authors} (${citation.year}). ${citation.title}.`;
    }
  }

  formatInText(citation: Citation): string {
    const firstAuthor = citation.authors[0]?.split(" ")[0] || "Unknown";
    if (citation.authors.length === 1) {
      return `(${firstAuthor}, ${citation.year})`;
    } else if (citation.authors.length === 2) {
      return `(${firstAuthor} & ${citation.authors[1]?.split(" ")[0]}, ${citation.year})`;
    } else {
      return `(${firstAuthor} et al., ${citation.year})`;
    }
  }
}

/**
 * Research Session
 *
 * Manages a complete research session with multiple agents
 */
export class ResearchSession {
  id: string;
  workflow: ResearchWorkflow;
  citationManager: CitationManager;
  createdAt: Date;

  constructor(topic: string) {
    this.id = `research-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.workflow = new ResearchWorkflow();
    this.citationManager = new CitationManager();
    this.createdAt = new Date();
    this.workflow.initialize(topic);
  }

  getTopic(): string {
    return this.workflow.getTopic();
  }

  getStatus(): string {
    return this.workflow.getStatus();
  }
}

/**
 * Create a new research session
 */
export function createResearchSession(topic: string): ResearchSession {
  return new ResearchSession(topic);
}
