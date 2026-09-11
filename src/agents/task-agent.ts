import type { AgentConfig } from "./agents.ts";

/** Internal execution identity, not a discoverable or file-backed profile. */
export const TASK_AGENT_NAME = "__task__";
const internalTaskAgents = new WeakSet<AgentConfig>();

export function createTaskAgent(): AgentConfig {
	const agent: AgentConfig = {
		name: TASK_AGENT_NAME,
		description: "Task",
		source: "runtime",
		filePath: "",
		systemPrompt: "",
		systemPromptMode: "append",
		inheritProjectContext: true,
		inheritGlobalContext: true,
		inheritSkills: true,
		defaultContext: "fresh",
		defaultAcceptance: false,
	};
	internalTaskAgents.add(agent);
	return agent;
}

/** Keep the internal identity out of agent discovery and management. */
export function withTaskAgent<T extends { agents: AgentConfig[]; maxThinking?: AgentConfig["maxThinking"] }>(discovered: T): T {
	if (discovered.agents.some((agent) => (agent.name === TASK_AGENT_NAME || agent.aliases?.includes(TASK_AGENT_NAME)) && !internalTaskAgents.has(agent))) {
		throw new Error(`${TASK_AGENT_NAME} is reserved for task-only execution and cannot be a custom profile name or alias.`);
	}
	const taskAgent = createTaskAgent();
	if (discovered.maxThinking !== undefined) taskAgent.maxThinking = discovered.maxThinking;
	return { ...discovered, agents: [...discovered.agents.filter((agent) => agent.name !== TASK_AGENT_NAME), taskAgent] };
}

interface TaskSpawnParams {
	agent?: unknown;
	task?: unknown;
	action?: unknown;
	workflowScript?: unknown;
	workflowScriptPath?: unknown;
	workflow?: unknown;
	tasks?: unknown;
	chain?: unknown;
	resume?: unknown;
	context?: unknown;
}

/** Normalize only new single-child launches, never management, workflows, or resume. */
export function normalizeTaskSpawn<T extends TaskSpawnParams>(params: T): T {
	if ((params.agent !== undefined && params.agent !== TASK_AGENT_NAME) || params.action !== undefined || params.workflowScript !== undefined
		|| params.workflowScriptPath !== undefined || params.workflow !== undefined
		|| params.tasks !== undefined || params.chain !== undefined || params.resume !== undefined) return params;
	if (typeof params.task !== "string" || !params.task.trim()) throw new Error("Task-only spawning requires a non-empty task.");
	if (params.context === "profile") throw new Error('context: "profile" requires an explicit custom agent profile.');
	return { ...params, agent: TASK_AGENT_NAME, context: params.context ?? "fresh" };
}
