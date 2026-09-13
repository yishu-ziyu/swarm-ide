import { getDb } from "@/db";
import {
  type BeatEvent,
  type DossierDelta,
  type WorldState,
  computeDossierDelta,
  loadWorldState,
  updateDossiers,
} from "./memory";

export class DirectorAgent {
  private sessionId: string;
  private characterIds: string[];
  private worldStates: Map<string, WorldState> = new Map();

  constructor(sessionId: string, characterIds: string[]) {
    this.sessionId = sessionId;
    this.characterIds = characterIds;
  }

  /**
   * Load world state at session start.
   * Merges session-level and world-level dossiers for each character.
   */
  async init(): Promise<Map<string, WorldState>> {
    const db = getDb();
    for (const charId of this.characterIds) {
      const state = await loadWorldState(db, charId, this.sessionId);
      this.worldStates.set(charId, state);
    }
    return this.worldStates;
  }

  /**
   * Process a batch of beat events.
   * 1. Calls updateDossiers to persist relationship/knowledge changes.
   * 2. Refreshes world state for affected characters.
   * 3. Returns deltas so the caller can emit SSE events.
   */
  async process(beatEvents: BeatEvent[]): Promise<DossierDelta[]> {
    const db = getDb();
    const deltas = await updateDossiers(db, this.sessionId, beatEvents);

    // Refresh world state for characters whose dossiers changed
    for (const delta of deltas) {
      this.worldStates.set(delta.characterId, await loadWorldState(db, delta.characterId, this.sessionId));
    }

    return deltas;
  }

  getWorldState(characterId: string): WorldState | undefined {
    return this.worldStates.get(characterId);
  }

  getAllWorldStates(): Map<string, WorldState> {
    return this.worldStates;
  }
}
