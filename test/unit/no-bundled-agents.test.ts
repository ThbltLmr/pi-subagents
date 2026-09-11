import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { discoverAgents, discoverAgentsAll } from "../../src/agents/agents.ts";
import { BUILTIN_AGENT_NAMES } from "../../src/agents/builtin-names.ts";
import { handleList } from "../../src/agents/agent-management.ts";
import { writeCustomAgentFixtures } from "../support/custom-agent-fixtures.ts";

let root: string;
let previousAgentDir: string | undefined;
describe("no bundled profiles", () => {
	beforeEach(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-no-bundled-profiles-"));
		previousAgentDir = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = path.join(root, "agent-home");
	});
	afterEach(() => {
		if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
		else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
		fs.rmSync(root, { recursive: true, force: true });
	});
	it("ships no native or external CLI profiles and does not advertise the task identity", () => {
		assert.deepEqual(BUILTIN_AGENT_NAMES, []);
		assert.deepEqual(discoverAgentsAll(root).builtin, []);
		assert.deepEqual(discoverAgents(root, "both").agents, []);
		const listed = handleList({}, { cwd: root, modelRegistry: { getAvailable: () => [] } });
		assert.doesNotMatch(JSON.stringify(listed), /__task__|claude-code|codex-exec|cursor-agent/);
	});
	it("discovers former builtin names only when explicitly installed as custom profiles", () => {
		writeCustomAgentFixtures(path.join(root, ".pi", "agents"), ["worker"]);
		const agents = discoverAgents(root, "both").agents;
		assert.equal(agents.length, 1);
		assert.equal(agents[0]?.name, "worker");
		assert.equal(agents[0]?.source, "project");
	});
});
