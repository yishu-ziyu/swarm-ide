import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

let cachedConfig: AppConfig | null = null;

export type AppConfig = {
  tokenLimit: number;
  llmProvider?: "openrouter" | "ark" | "minimax";
  openRouterApiKey?: string;
  openRouterBaseUrl?: string;
  openRouterModel?: string;
  arkApiKey?: string;
  arkBaseUrl?: string;
  arkModel?: string;
  minimaxApiKey?: string;
  minimaxBaseUrl?: string;
  minimaxModel?: string;
  /** When false (default), agents cannot run host shell commands. */
  allowHostBash?: boolean;
  /** Cap on non-human agents per workspace in research mode. */
  researchMaxAgents?: number;
};

const DEFAULT_CONFIG: AppConfig = {
  tokenLimit: 100000,
  allowHostBash: false,
  researchMaxAgents: 6,
};

const API_KEY_FIELDS = ["openRouterApiKey", "arkApiKey", "minimaxApiKey"] as const;
const CONFIG_KEYS = [
  "tokenLimit",
  "llmProvider",
  "openRouterApiKey",
  "openRouterBaseUrl",
  "openRouterModel",
  "arkApiKey",
  "arkBaseUrl",
  "arkModel",
  "minimaxApiKey",
  "minimaxBaseUrl",
  "minimaxModel",
  "allowHostBash",
  "researchMaxAgents",
] as const satisfies ReadonlyArray<keyof AppConfig>;

export function isHostBashAllowed(config: Pick<AppConfig, "allowHostBash"> = getConfig()): boolean {
  return config.allowHostBash === true;
}

export function isConfiguredApiKey(key?: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  return Boolean(trimmed && !trimmed.includes("YOUR_") && !trimmed.includes("your-api-key"));
}

export type PublicAppConfig = Omit<AppConfig, "openRouterApiKey" | "arkApiKey" | "minimaxApiKey"> & {
  openRouterApiKeyConfigured: boolean;
  arkApiKeyConfigured: boolean;
  minimaxApiKeyConfigured: boolean;
};

/** Safe to return over HTTP. Never includes raw API keys. */
export function toPublicConfig(config: AppConfig): PublicAppConfig {
  const { openRouterApiKey, arkApiKey, minimaxApiKey, ...rest } = config;
  return {
    ...rest,
    allowHostBash: config.allowHostBash ?? false,
    researchMaxAgents: config.researchMaxAgents ?? DEFAULT_CONFIG.researchMaxAgents,
    openRouterApiKeyConfigured:
      isConfiguredApiKey(openRouterApiKey) || isConfiguredApiKey(process.env.OPENROUTER_API_KEY),
    arkApiKeyConfigured: isConfiguredApiKey(arkApiKey) || isConfiguredApiKey(process.env.ARK_API_KEY),
    minimaxApiKeyConfigured:
      isConfiguredApiKey(minimaxApiKey) || isConfiguredApiKey(process.env.MINIMAX_API_KEY),
  };
}

/** Empty key strings do not wipe a stored key. */
export function mergeConfigUpdates(current: AppConfig, updates: Partial<AppConfig>): AppConfig {
  const next: AppConfig = { ...current };
  for (const rawKey of CONFIG_KEYS) {
    if (!(rawKey in updates)) continue;
    const value = updates[rawKey];
    if (API_KEY_FIELDS.includes(rawKey as (typeof API_KEY_FIELDS)[number])) {
      if (typeof value !== "string" || value.trim() === "") continue;
    }
    if (value === undefined) continue;
    (next as Record<string, unknown>)[rawKey] = value;
  }
  return next;
}

export function getConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

  try {
    const configPath = join(process.cwd(), "config", "app.json");
    const content = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content) as Partial<AppConfig>;

    cachedConfig = { ...DEFAULT_CONFIG, ...parsed };
    return cachedConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function setConfig(updates: Partial<AppConfig>): AppConfig {
  const current = getConfig();
  const nextConfig = mergeConfigUpdates(current, updates);
  cachedConfig = nextConfig;

  try {
    const configPath = join(process.cwd(), "config", "app.json");
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, JSON.stringify(nextConfig, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save config:", err);
  }

  return nextConfig;
}

export function resetConfigCache() {
  cachedConfig = null;
}
