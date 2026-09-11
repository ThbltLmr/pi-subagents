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

it("accepts task-only public calls without manufacturing a public profile", () => {
	assert.deepEqual(normalizePublicSubagentExecution({ task: "Inspect the parser" }), {
		ok: true, params: { task: "Inspect the parser", output: true },
	});
	for (const task of ["", "  ", false, 2, null]) assert.equal(normalizePublicSubagentExecution({ task }).ok, false);
	for (const agent of ["", "  ", false, 2, null]) assert.equal(normalizePublicSubagentExecution({ task: "Inspect", agent }).ok, false);
});

it("normalizes new task launches but preserves explicit profiles, context, management, and resume", () => {
	assert.deepEqual(normalizeTaskSpawn({ task: "Inspect", context: "fork" }), { task: "Inspect", context: "fork", agent: TASK_AGENT_NAME });
	assert.deepEqual(normalizeTaskSpawn({ task: "Inspect" }), { task: "Inspect", context: "fresh", agent: TASK_AGENT_NAME });
	assert.throws(() => normalizeTaskSpawn({ task: "Inspect", context: "profile" }), /explicit custom/);
	assert.equal(normalizePublicSubagentExecution({ agent: TASK_AGENT_NAME, task: "Inspect" }).ok, false);
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
	const discovery = { agents: [custom] };
	const execution = withTaskAgent(discovery);
	assert.equal(discovery.agents.length, 1);
	assert.equal(execution.agents[0], custom);
	assert.equal(execution.agents[1].systemPrompt, "");
	assert.equal(withTaskAgent(execution).agents.length, 2);
	assert.equal(withTaskAgent({ agents: [], maxThinking: "low" as const }).agents[0].maxThinking, "low");
});
