import assert from "node:assert/strict";
import { test } from "node:test";
import { isHostBashAllowed, mergeConfigUpdates, toPublicConfig, type AppConfig } from "./config.ts";

test("host bash is denied unless explicitly enabled", () => {
  assert.equal(isHostBashAllowed({}), false);
  assert.equal(isHostBashAllowed({ allowHostBash: false }), false);
  assert.equal(isHostBashAllowed({ allowHostBash: true }), true);
});

test("public config never includes raw API keys", () => {
  const config: AppConfig = {
    tokenLimit: 1000,
    llmProvider: "minimax",
    minimaxApiKey: "sk-secret-should-not-leak",
    arkApiKey: "ark-secret",
    openRouterApiKey: "or-secret",
    minimaxModel: "MiniMax-M2.1",
  };
  const published = toPublicConfig(config);
  const json = JSON.stringify(published);
  assert.equal(published.minimaxApiKeyConfigured, true);
  assert.equal(published.arkApiKeyConfigured, true);
  assert.equal(published.openRouterApiKeyConfigured, true);
  assert.equal("minimaxApiKey" in published, false);
  assert.equal("arkApiKey" in published, false);
  assert.equal("openRouterApiKey" in published, false);
  assert.equal(json.includes("sk-secret"), false);
  assert.equal(json.includes("ark-secret"), false);
  assert.equal(json.includes("or-secret"), false);
  assert.equal(published.allowHostBash, false);
});

test("empty API key updates do not wipe the stored key", () => {
  const current: AppConfig = {
    tokenLimit: 1000,
    minimaxApiKey: "keep-me",
    allowHostBash: false,
  };
  const merged = mergeConfigUpdates(current, {
    minimaxApiKey: "",
    minimaxModel: "new-model",
    allowHostBash: true,
  });
  assert.equal(merged.minimaxApiKey, "keep-me");
  assert.equal(merged.minimaxModel, "new-model");
  assert.equal(merged.allowHostBash, true);
  const ignored = mergeConfigUpdates(current, {
    // @ts-expect-error public flags must not be written back
    minimaxApiKeyConfigured: true,
  });
  assert.equal("minimaxApiKeyConfigured" in ignored, false);
});
