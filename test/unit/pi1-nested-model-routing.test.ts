import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import {
	createAssistantMessageEventStream,
	fauxAssistantMessage,
	fauxToolCall,
	getCurrentSystemPrompt,
	getCurrentTools,
	type Model,
	type Provider,
	type SimpleStreamOptions,
	type TranscriptContext,
} from "@earendil-works/pi-ai";
import { rewritePromptWithGuidance } from "../../src/runs/foreground/prompt-audit.ts";
import { createPrunedForkSessionWriter } from "../../src/shared/pruned-fork.ts";
import { createWatchdogPermissionArbiter } from "../../src/watchdog/permission-arbiter.ts";
import { createMainWatchdogReview } from "../../src/watchdog/review.ts";
import { DEFAULT_WATCHDOG_CONFIG } from "../../src/watchdog/settings.ts";

// Real ModelRegistry/ModelRuntime, with only the provider's transport scripted.
const sdkRoot = process.env.PI_SUBAGENTS_NATIVE_PI_ROOT;
for (const virtual of [false, true]) {
	test(`Pi 1.0 nested calls dispatch ${virtual ? "virtual" : "physical"} models through the configured provider`, {
		skip: !sdkRoot && "Requires PI_SUBAGENTS_NATIVE_PI_ROOT and native-peer-loader.mjs",
		timeout: 30_000,
	}, async () => {
		const entry = execFileSync(process.execPath, ["--input-type=module", "-e", "console.log(import.meta.resolve('@earendil-works/pi-coding-agent'))"], { cwd: sdkRoot, encoding: "utf8" }).trim();
		const pi = await import(entry);
		assert.equal(pi.__piSubagentsTestShim, undefined);
		const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pi1-nested-routing-"));
		const calls: Array<{ model: Model<any>; context: TranscriptContext; options?: SimpleStreamOptions }> = [];
		const reasons: string[] = [];
		try {
			const model: Model<any> = {
				id: "physical", name: "Physical", provider: "nested-physical", api: "nested-fixture",
				baseUrl: "https://example.invalid", reasoning: true, input: ["text"],
				contextWindow: 128_000, maxTokens: 4096,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			};
			const provider: Provider = {
				id: model.provider, name: "Nested fixture",
				auth: { apiKey: { name: "Fixture", resolve: async () => ({ auth: { apiKey: "physical-key", headers: { "x-physical-auth": "present" } }, env: { PHYSICAL_ONLY: "yes" }, source: "fixture" }) } },
				getModels: () => [model],
				stream: () => { throw new Error("Nested helpers must use provider-neutral streaming"); },
				streamSimple(nextModel, context, options) {
					calls.push({ model: nextModel, context, options });
					const tools = getCurrentTools(context.messages).map((tool) => tool.name);
					const hasResults = context.messages.some((message) => message.role === "toolResult");
					const prompt = getCurrentSystemPrompt(context.messages);
					let content: Parameters<typeof fauxAssistantMessage>[0] = "revised authored task";
					let stopReason: "stop" | "toolUse" = "stop";
					if (!hasResults && tools.includes("watchdog_permission_decision")) {
						content = fauxToolCall("watchdog_permission_decision", { decision: "approve", reason: "Exact call is in scope" });
						stopReason = "toolUse";
					} else if (!hasResults && tools.includes("watchdog_warn")) {
						content = fauxToolCall("watchdog_warn", { severity: "concern", importance: "high", summary: "Concrete concern", evidence: "Supplied evidence", recommendedAction: "Verify the change" });
						stopReason = "toolUse";
					} else if (prompt.includes("summarize overflow")) {
						const user = context.messages.findLast((message) => message.role === "user")!;
						const payload = typeof user.content === "string" ? user.content : user.content.filter((block) => block.type === "text").map((block) => block.text).join("");
						const items = JSON.parse(payload).items as Array<{ itemId: string }>;
						content = JSON.stringify({ summaries: items.map(({ itemId }) => ({ itemId, summary: "Overflow evidence preserved" })) });
					}
					const stream = createAssistantMessageEventStream();
					queueMicrotask(() => {
						stream.push({ type: "done", reason: stopReason, message: fauxAssistantMessage(content, { provider: model.provider, api: model.api, model: model.id, stopReason }) });
						stream.end();
					});
					return stream;
				},
			};
			const runtime = await pi.ModelRuntime.create({ authPath: path.join(cwd, "auth.json"), modelsPath: null, refreshOnCreate: false });
			runtime.registerNativeProvider(provider);
			if (virtual) {
				runtime.registerNativeProvider({
					id: "nested-router", name: "Router vendor",
					auth: { apiKey: { name: "Router", resolve: async () => ({ auth: { apiKey: "router-secret", headers: { "x-router-secret": "private" } }, env: { ROUTER_SECRET: "private" }, source: "fixture" }) } },
					getModels: () => [],
					stream: () => { throw new Error("Virtual selection must not reach the router provider"); },
					streamSimple: () => { throw new Error("Virtual selection must not reach the router provider"); },
				});
				runtime.registerVirtualModel({
					provider: "nested-router", id: "auto", name: "Auto", thinkingLevels: ["off", "high"],
					route(request: { reason: string }) { reasons.push(request.reason); return { model, thinkingLevel: "high" }; },
				});
			}
			await runtime.refresh({ allowNetwork: false });
			const registry = new pi.ModelRegistry(runtime);
			const selected = virtual ? registry.find("nested-router", "auto") : model;
			assert.ok(selected);
			const ctx = { cwd, model: selected, modelRegistry: registry, signal: undefined, sessionManager: { getSessionId: () => "nested-session" } } as never;
			assert.equal(await rewritePromptWithGuidance({ ctx, authoredTask: "Authored task", runtimeAdditions: "Runtime context", finalEffectivePrompt: "Runtime context\nAuthored task", guidance: "Shorten" }), "revised authored task");
			const warnings: unknown[] = [];
			const review = await createMainWatchdogReview(ctx)({
				delta: "Supplied evidence", epoch: 1, reviewId: 1,
				config: { ...DEFAULT_WATCHDOG_CONFIG, guidance: { watchdogMd: false }, main: { ...DEFAULT_WATCHDOG_CONFIG.main, enabled: true } },
				emitWarning(warning) { warnings.push(warning); return true; },
			});
			assert.equal(review.stopReason, "stop");
			assert.equal(warnings.length, 1);
			const permission = await createWatchdogPermissionArbiter()({
				ctx, toolName: "write", args: { path: "output.txt" },
				rawWatchdogConfig: JSON.stringify({ enabled: true, watchdogTailTimeoutMs: 5000, agentEndTimeoutMs: 5000, maxWarnings: null, lsp: { enabled: false, timeoutMs: 100, maxFiles: 1, maxDiagnostics: 1 }, stalemateRepeats: 2, cadence: { everyNTools: null } }),
			});
			assert.equal(permission.approved, true, permission.reason);
			const sessionFile = path.join(cwd, "fork.jsonl");
			fs.writeFileSync(sessionFile, [
				{ type: "session", version: 1, id: "fork", parentSession: path.join(cwd, "parent.jsonl") },
				{ type: "message", id: "overflow", parentId: null, message: { role: "user", content: "overflow evidence ".repeat(5000) } },
			].map((entry) => JSON.stringify(entry)).join("\n") + "\n");
			const writer = await createPrunedForkSessionWriter(ctx, { mode: "pruned", model: `${selected.provider}/${selected.id}` });
			await writer(sessionFile);
			assert.ok(fs.statSync(sessionFile).size < 64 * 1024);
			assert.equal(calls.length, 6);
			for (const call of calls) {
				assert.equal(call.model.provider, model.provider);
				assert.equal(call.model.id, model.id);
				assert.equal(call.options?.apiKey, "physical-key");
				assert.equal(call.options?.headers?.["x-physical-auth"], "present");
				assert.equal(call.options?.env?.PHYSICAL_ONLY, "yes");
				assert.equal(call.options?.headers?.["x-router-secret"], undefined);
				assert.equal(call.options?.env?.ROUTER_SECRET, undefined);
				assert.equal(call.context.messages[0]?.role, "system");
				if (virtual) assert.equal(call.options?.reasoning, "high");
			}
			assert.deepEqual(reasons, virtual ? Array(6).fill("direct") : []);
		} finally {
			fs.rmSync(cwd, { recursive: true, force: true });
		}
	});
}
