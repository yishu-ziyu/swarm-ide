import assert from "node:assert/strict";
import { test } from "node:test";
import {
  didSendSucceed,
  fallbackIdempotencyKey,
  isSendTool,
  sendIdempotencyKey,
  sendTargetFromArgs,
} from "./delivery.ts";

test("didSend is false when the send tool is only invoked, not when it succeeds", () => {
  assert.equal(didSendSucceed("send_group_message", undefined), false);
  assert.equal(didSendSucceed("send_group_message", { ok: false }), false);
  assert.equal(didSendSucceed("send_group_message", { ok: true }), true);
  assert.equal(didSendSucceed("web_search", { ok: true }), false);
  assert.equal(isSendTool("bash"), false);
});

test("idempotency keys are stable for the same run, tool, and target", () => {
  const a = sendIdempotencyKey({ runId: "run-1", toolName: "send", target: "agent-2" });
  const b = sendIdempotencyKey({ runId: "run-1", toolName: "send", target: "agent-2" });
  const c = sendIdempotencyKey({ runId: "run-2", toolName: "send", target: "agent-2" });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(fallbackIdempotencyKey("run-1", "g1"), "run-1:fallback_send:g1");
});

test("send target is taken from the matching argument, not from content", () => {
  assert.equal(sendTargetFromArgs("send", { to: " a1 ", content: "hi" }), "a1");
  assert.equal(sendTargetFromArgs("send_direct_message", { toAgentId: "a2" }), "a2");
  assert.equal(sendTargetFromArgs("send_group_message", { groupId: "g1" }), "g1");
  assert.equal(sendTargetFromArgs("send", { content: "hi" }), null);
});
