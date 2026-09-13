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
};

const DEFAULT_CONFIG: AppConfig = {
  tokenLimit: 100000,
};

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
  const nextConfig = { ...current, ...updates };
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
