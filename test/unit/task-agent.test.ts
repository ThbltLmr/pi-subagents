import assert from "node:assert/strict";
import { it } from "node:test";
import { createTaskAgent, normalizeTaskSpawn, TASK_AGENT_NAME, withTaskAgent } from "../../src/agents/task-agent.ts";
import { normalizePublicSubagentExecution } from "../../src/extension/public-execution.ts";

it("builds a plain Pi child without a persona, tool allowlist, or inferred acceptance contract", () => {
	const agent = createTaskAgent();
	assert.equal(agent.systemPrompt, "");
	assert.equal(agent.systemPromptMode, "append");
	assert.equal(agent.inheritProjectContext, true);
	assert.equal(agent.inheritGlobalContext, true);
	assert.equal(agent.inheritSkills, true);
	assert.equal(agent.defaultContext, "fresh");
	assert.equal(agent.defaultAcceptance, false);
	assert.equal(agent.tools, undefined);
	assert.equal(agent.defaultReads, undefined);
	assert.equal(agent.defaultProgress, undefined);
});

it("accepts labeled task-only public calls without manufacturing a public profile", () => {
	assert.deepEqual(normalizePublicSubagentExecution({ task: "Inspect the parser", label: " Parser review " }), {
		ok: true, params: { task: "Inspect the parser", label: "Parser review", output: true },
	});
	for (const task of ["", "  ", false, 2, null]) assert.equal(normalizePublicSubagentExecution({ task, label: "Parser review" }).ok, false);
	for (const agent of ["", "  ", false, 2, null]) assert.equal(normalizePublicSubagentExecution({ task: "Inspect", agent, label: "Parser review" }).ok, false);
});

it("requires a non-blank direct-spawn label capped at 50 characters", () => {
	for (const label of [undefined, "", "   ", false, 2, null]) {
		const result = normalizePublicSubagentExecution({ task: "Inspect", label });
		assert.equal(result.ok, false, String(label));
		if (!result.ok) assert.match(result.error, /label/);
	}
	assert.equal(normalizePublicSubagentExecution({ agent: "worker" }).ok, false, "named direct spawn also requires label");
	const fifty = "x".repeat(50);
	assert.equal(normalizePublicSubagentExecution({ task: "Inspect", label: fifty }).ok, true);
	assert.equal(normalizePublicSubagentExecution({ agent: "worker", label: fifty }).ok, true);
	assert.equal(normalizePublicSubagentExecution({ task: "Inspect", label: ` ${fifty}` }).ok, false);
	const tooLong = normalizePublicSubagentExecution({ task: "Inspect", label: "x".repeat(51) });
	assert.equal(tooLong.ok, false);
	if (!tooLong.ok) assert.match(tooLong.error, /at most 50/);
	// Workflow containers and management/control calls do not need a top-level label.
	assert.equal(normalizePublicSubagentExecution({ workflowScript: "return 1" }).ok, true);
	assert.equal(normalizePublicSubagentExecution({ action: "status" }).ok, true);
});

it("normalizes new task launches but preserves explicit profiles, context, management, and resume", () => {
	assert.deepEqual(normalizeTaskSpawn({ task: "Inspect", context: "fork" }), { task: "Inspect", context: "fork", agent: TASK_AGENT_NAME });
	assert.deepEqual(normalizeTaskSpawn({ task: "Inspect" }), { task: "Inspect", context: "fresh", agent: TASK_AGENT_NAME });
	assert.throws(() => normalizeTaskSpawn({ task: "Inspect", context: "profile" }), /explicit custom/);
	assert.equal(normalizePublicSubagentExecution({ agent: TASK_AGENT_NAME, task: "Inspect", label: "Inspect" }).ok, false);
	for (const params of [
		{ agent: "custom", task: "Inspect" }, { action: "list" }, { action: "resume", message: "Continue" },
		{ workflowScript: "return 1" }, { workflowScriptPath: "workflow.js" }, { workflow: "review" },
		{ resume: "run-id", task: "Continue" }, { tasks: [] }, { chain: [] },
	]) assert.equal(normalizeTaskSpawn(params), params);
	assert.throws(() => normalizeTaskSpawn({}), /non-empty task/);
});

it("adds an internal identity without mutating discovery and does not allow profile shadowing", () => {
	const custom = { ...createTaskAgent(), name: "custom", systemPrompt: "Custom" };
	const spoofed = { ...createTaskAgent(), systemPrompt: "Spoofed" };
	assert.throws(() => withTaskAgent({ agents: [spoofed] }), /reserved/);
	assert.throws(() => withTaskAgent({ agents: [{ ...custom, aliases: [TASK_AGENT_NAME] }] }), /reserved/);
	assert.throws(() => withTaskAgent({ agents: [{ ...custom, name: "package.__task__", localName: TASK_AGENT_NAME }] }), /reserved/);
	const discovery = { agents: [custom] };
	const execution = withTaskAgent(discovery);
	assert.equal(discovery.agents.length, 1);
	assert.equal(execution.agents[0], custom);
	assert.equal(execution.agents[1].systemPrompt, "");
	assert.equal(withTaskAgent(execution).agents.length, 2);
	assert.equal(withTaskAgent({ agents: [], maxThinking: "low" as const }).agents[0].maxThinking, "low");
});
