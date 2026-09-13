import { getDb } from "@/db";
import { characterDossiers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { store } from "@/lib/storage";
import { getWorkspaceUIBus } from "@/runtime/ui-bus";
import { getLlmProvider, getOpenRouterConfig, getArkConfig } from "@/runtime/agent-runtime";
import { safeJsonParse } from "@/runtime/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Dossier {
  id: string;
  workspaceId: string;
  sessionId: string | null;
  characterId: string;
  trustLevel: number;
  knowledge: Record<string, unknown>;
  relationshipNotes: string;
  updatedAt: string;
}

export interface DossierDelta {
  characterId: string;
  trustLevelDelta: number;
  knowledgeDelta: Record<string, unknown>;
  relationshipNotesDelta: string;
  isSignificant: boolean;
}

export interface WorldState {
  characterId: string;
  sessionId: string | null;
  trustLevel: number;
  knowledge: Record<string, unknown>;
  relationshipNotes: string;
}

export interface BeatEvent {
  type: string;
  characterIds: string[];
  description: string;
  content: string;
}

// ---------------------------------------------------------------------------
// LLM helper (non-streaming, structured output)
// ---------------------------------------------------------------------------

interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callLlm(messages: LlmMessage[]): Promise<string> {
  const provider = getLlmProvider();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    if (provider === "ark") {
      const { apiKey, baseUrl, model } = getArkConfig();
      const resp = await fetch(baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, messages, stream: false }),
        signal: controller.signal,
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`LLM error: ${resp.status} ${text}`);
      }
      const data = (await resp.json()) as Record<string, unknown>;
      const choices = data.choices as Array<{ message?: { content?: string } }> | undefined;
      return choices?.[0]?.message?.content ?? "";
    }

    const { apiKey, baseUrl, model, httpReferer, appTitle } = getOpenRouterConfig();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (httpReferer) headers["HTTP-Referer"] = httpReferer;
    if (appTitle) headers["X-Title"] = appTitle;

    const resp = await fetch(baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, messages, stream: false }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`LLM error: ${resp.status} ${text}`);
    }
    const data = (await resp.json()) as Record<string, unknown>;
    const choices = data.choices as Array<{ message?: { content?: string } }> | undefined;
    return choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractJsonFromLlmResponse(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
  const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const DOSSIER_DELTA_SYSTEM_PROMPT = `You are a narrative memory analyst for a story simulation system. Analyze how a character's relationships, trust, and knowledge changed after a story beat.

Output a JSON object with:
- trustLevelDelta: integer (-5 to +5), net change in trust toward others
- knowledgeDelta: object, new facts/insights gained (only NEW info)
- relationshipNotesDelta: string, concise summary of relationship shifts

Rules:
- Be conservative: use 0 / {} / "" if nothing meaningful changed
- Output ONLY valid JSON, no markdown, no explanation`;

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

export async function computeDossierDelta(
  oldDossier: Dossier,
  beatEvents: BeatEvent[]
): Promise<DossierDelta> {
  const userPrompt = `${DOSSIER_DELTA_SYSTEM_PROMPT}

CHARACTER ID: ${oldDossier.characterId}
CURRENT TRUST LEVEL: ${oldDossier.trustLevel} (range -10 to +10)
CURRENT KNOWLEDGE: ${JSON.stringify(oldDossier.knowledge)}
CURRENT RELATIONSHIP NOTES: ${oldDossier.relationshipNotes}

BEAT EVENTS:
${JSON.stringify(beatEvents, null, 2)}

Return JSON: { "trustLevelDelta": number, "knowledgeDelta": {}, "relationshipNotesDelta": "" }`;

  try {
    const response = await callLlm([
      { role: "system", content: DOSSIER_DELTA_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ]);

    const parsed = extractJsonFromLlmResponse(response);
    if (!parsed) {
      return noOpDelta(oldDossier.characterId);
    }

    const trustLevelDelta = Math.max(-5, Math.min(5, Number(parsed.trustLevelDelta) || 0));
    const knowledgeDelta =
      parsed.knowledgeDelta && typeof parsed.knowledgeDelta === "object"
        ? (parsed.knowledgeDelta as Record<string, unknown>)
        : {};
    const relationshipNotesDelta =
      typeof parsed.relationshipNotesDelta === "string" ? parsed.relationshipNotesDelta : "";

    return {
      characterId: oldDossier.characterId,
      trustLevelDelta,
      knowledgeDelta,
      relationshipNotesDelta,
      isSignificant: Math.abs(trustLevelDelta) >= 2,
    };
  } catch (error) {
    console.error(`computeDossierDelta failed for ${oldDossier.characterId}:`, error);
    return noOpDelta(oldDossier.characterId);
  }
}

function noOpDelta(characterId: string): DossierDelta {
  return {
    characterId,
    trustLevelDelta: 0,
    knowledgeDelta: {},
    relationshipNotesDelta: "",
    isSignificant: false,
  };
}

export async function updateDossiers(
  db: ReturnType<typeof getDb>,
  sessionId: string,
  beatEvents: BeatEvent[]
): Promise<DossierDelta[]> {
  const characterIdsInBeat = new Set(beatEvents.flatMap((e) => e.characterIds));
  if (characterIdsInBeat.size === 0) return [];

  const sessionDossiers = await store.listDossiersBySession(sessionId);
  const targets = sessionDossiers.filter((d) => characterIdsInBeat.has(d.characterId));
  if (targets.length === 0) return [];

  const deltas: DossierDelta[] = [];

  for (const dossier of targets) {
    const delta = await computeDossierDelta(dossier, beatEvents);
    deltas.push(delta);

    const newTrustLevel = Math.max(-10, Math.min(10, dossier.trustLevel + delta.trustLevelDelta));
    const mergedKnowledge = { ...dossier.knowledge, ...delta.knowledgeDelta };
    const newNotes = delta.relationshipNotesDelta.trim()
      ? `${dossier.relationshipNotes}\n[${new Date().toISOString()}] ${delta.relationshipNotesDelta}`.trim()
      : dossier.relationshipNotes;

    await store.updateDossier(dossier.id, {
      trustLevel: newTrustLevel,
      knowledge: mergedKnowledge,
      relationshipNotes: newNotes,
    });

    if (delta.isSignificant) {
      getWorkspaceUIBus().emit(dossier.workspaceId, {
        event: "world_state_delta",
        data: {
          characterId: dossier.characterId,
          sessionId,
          trustLevelDelta: delta.trustLevelDelta,
          newTrustLevel,
          knowledgeDelta: delta.knowledgeDelta,
          relationshipNotesDelta: delta.relationshipNotesDelta,
        },
      });
    }
  }

  return deltas;
}

export async function loadWorldState(
  db: ReturnType<typeof getDb>,
  characterId: string,
  sessionId?: string
): Promise<WorldState> {
  const [worldDossier, sessionDossier] = await Promise.all([
    store.getDossierByCharacterAndSession(characterId, null),
    sessionId ? store.getDossierByCharacterAndSession(characterId, sessionId) : Promise.resolve(null),
  ]);

  const base = worldDossier
    ? {
        trustLevel: worldDossier.trustLevel,
        knowledge: worldDossier.knowledge,
        relationshipNotes: worldDossier.relationshipNotes,
      }
    : { trustLevel: 0, knowledge: {} as Record<string, unknown>, relationshipNotes: "" };

  const overrides = sessionDossier
    ? {
        trustLevel: sessionDossier.trustLevel,
        knowledge: sessionDossier.knowledge,
        relationshipNotes: sessionDossier.relationshipNotes,
      }
    : null;

  return {
    characterId,
    sessionId: sessionDossier?.sessionId ?? null,
    trustLevel: overrides ? overrides.trustLevel : base.trustLevel,
    knowledge: overrides ? { ...base.knowledge, ...overrides.knowledge } : base.knowledge,
    relationshipNotes: overrides ? overrides.relationshipNotes : base.relationshipNotes,
  };
}
