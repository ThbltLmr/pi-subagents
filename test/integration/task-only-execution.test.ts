import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createEventBus, makeMinimalCtx } from "../support/helpers.ts";
import { readAsyncRecoveryDescriptor } from "../../src/runs/background/async-resume.ts";
import { installAsyncExecutionHooks, available, createSubagentExecutor, mockPi, tempDir, readAsyncPayload } from "../support/async-execution-fixture.ts";

function executor() {
	return createSubagentExecutor!({
		pi: { events: createEventBus(), getSessionName: () => undefined, sendMessage() {} },
		state: { baseCwd: tempDir, currentSessionId: null, asyncJobs: new Map(), foregroundControls: new Map(), lastForegroundControlId: null },
		config: {}, asyncByDefault: false, tempArtifactsDir: tempDir,
		getSubagentSessionRoot: () => tempDir, expandTilde: (p: string) => p,
		discoverAgents: () => ({ agents: [] }),
	});
}

function callRecords() {
	return fs.readdirSync(mockPi.dir).filter(name => name.startsWith("call-") && name.endsWith(".json"))
		.map(name => JSON.parse(fs.readFileSync(path.join(mockPi.dir, name), "utf8")));
}

describe("task-only execution without configured profiles", { skip: !available }, () => {
	installAsyncExecutionHooks();
	for (const async of [false, true]) {
		it(`spawns a plain child with fresh context (async=${async})`, async () => {
			mockPi.onCall({ output: "Done" });
			const result = await executor().executePublic(`task-only-${async}`, {
				label: "Return greeting", task: "Return a short greeting", async, output: false, mission: false,
			}, new AbortController().signal, undefined, makeMinimalCtx(tempDir));
			assert.notEqual(result.isError, true, JSON.stringify(result));
			if (async) {
				assert.ok(result.details?.asyncId);
				const payload = await readAsyncPayload(result.details.asyncId);
				assert.equal(payload.success, true, JSON.stringify(payload));
				assert.equal(payload.results?.[0]?.sessionName, "Return greeting");
				assert.equal(payload.results?.[0]?.label, "Return greeting");
				assert.ok(result.details.asyncDir);
				assert.equal(readAsyncRecoveryDescriptor(result.details.asyncDir)?.label, "Return greeting");
			} else {
				assert.equal(result.details.results[0]?.sessionName, "Return greeting");
				assert.equal(result.details.results[0]?.label, "Return greeting");
			}
			const calls = callRecords();
			assert.equal(calls.length, 1);
			assert.ok((calls[0].systemPrompts ?? []).every((prompt: { mode?: string }) => prompt.mode !== "replace"));
			assert.equal(calls[0].runtime?.inheritProjectContext, true);
			assert.equal(calls[0].runtime?.inheritGlobalContext, true);
			assert.equal(calls[0].runtime?.inheritSkills, true);
			assert.equal(calls[0].runtime?.sessionName, "Return greeting");
		});
	}

	for (const async of [false, true]) {
		for (const childAsync of [false, true]) {
			it(`carries workflow labels into child sessions (workflow async=${async}, child async=${childAsync})`, async () => {
				for (let i = 0; i < 2; i++) mockPi.onCall({ output: "Documented" });
				const labels = ["Write grid-timeshift README", "Review documentation and verify all examples against the implementation"];
				const result = await executor().executePublic(`workflow-labels-${async}-${childAsync}`, {
					async, mission: false, output: false,
					workflowScript: `const labels = ${JSON.stringify(labels)}; const first = await runs.run('write', {label: labels[0], task:'Document the service', async:${childAsync}, output:false}); const reviews = await runs.all([{key:'review', label:labels[1], task:'Review the documentation', async:${childAsync}, output:false}]); return [first.runId, reviews[0].runId];`,
				}, new AbortController().signal, undefined, makeMinimalCtx(tempDir));
				assert.notEqual(result.isError, true, JSON.stringify(result));
				let runIds = result.details.workflow?.value as string[];
				if (async) {
					const payload = await readAsyncPayload(result.details.asyncId);
					assert.equal(payload.success, true, JSON.stringify(payload));
					runIds = payload.workflow.value;
					assert.deepEqual(payload.results.map(child => child.sessionName), labels);
				}
				if (childAsync) {
					for (const [index, runId] of runIds.entries()) {
						const payload = await readAsyncPayload(runId);
						assert.equal(payload.success, true, JSON.stringify(payload));
						assert.equal(payload.results[0]?.label, labels[index]);
					}
				}
				assert.deepEqual(callRecords().map(call => call.runtime?.sessionName).sort(), [...labels].sort());
			});
		}
	}

	for (const async of [false, true]) {
		it(`supports task-only parallel and sequential workflow children (async=${async})`, async () => {
			for (let i = 0; i < 3; i++) mockPi.onCall({ output: "Inspected" });
			const result = await executor().executePublic(`task-workflow-${async}`, {
				async, mission: false, output: false,
				workflowScript: `const first = await runs.all([{key:'a', task:'Inspect A', async:false}, {key:'b', task:'Inspect B', async:false}]); const last = await runs.run('c', {task:'Summarize: ' + first.map(r => r.output).join('; '), async:false}); return last.output;`,
			}, new AbortController().signal, undefined, makeMinimalCtx(tempDir));
			assert.notEqual(result.isError, true, JSON.stringify(result));
			if (async) {
				assert.ok(result.details?.asyncId);
				const payload = await readAsyncPayload(result.details.asyncId);
				assert.equal(payload.success, true, JSON.stringify(payload));
			}
			assert.equal(callRecords().length, 3);
		});
	}

	it("does not bypass an allowed-agent ceiling when the profile is omitted", async () => {
		const result = await executor().executePublic("task-ceiling", {
			label: "Inspect", task: "Inspect", async: false, output: false, mission: false,
			capabilityCeiling: { version: 1, allowedAgents: ["custom-only"], sources: ["test"] },
		}, new AbortController().signal, undefined, makeMinimalCtx(tempDir));
		assert.equal(result.isError, true);
		assert.equal(callRecords().length, 0);
	});

	it("keeps explicit fork strict when no parent session is available", async () => {
		const result = await executor().executePublic("task-fork", {
			label: "Inspect", task: "Inspect", context: "fork", async: false, output: false, mission: false,
		}, new AbortController().signal, undefined, makeMinimalCtx(tempDir));
		assert.equal(result.isError, true);
		assert.match(result.content.map(item => item.text).join("\n"), /fork|session/i);
		assert.equal(callRecords().length, 0);
	});
});
