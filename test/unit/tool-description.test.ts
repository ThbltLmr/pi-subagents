import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { SUBAGENT_TOOL_DESCRIPTION } from "../../src/extension/tool-description.ts";
import { SUBAGENT_CHILD_ENV } from "../../src/runs/shared/child-runtime-config.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("registered subagent tool description", () => {
	it("is a neutral one-line description", () => {
		assert.equal(SUBAGENT_TOOL_DESCRIPTION, "Run configured subagents.");
	});

	for (const mode of [undefined, "full", "compact", "custom", "invalid"]) {
		it(`registers no prompt policy with toolDescriptionMode=${String(mode)}`, () => {
			const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagents-neutral-description-"));
			try {
				const configDir = path.join(agentDir, "extensions", "subagent");
				fs.mkdirSync(configDir, { recursive: true });
				fs.writeFileSync(path.join(configDir, "config.json"), JSON.stringify({ toolDescriptionMode: mode }));
				// Old configuration and templates must not restore the removed policy.
				fs.writeFileSync(path.join(agentDir, "subagent-tool-description.md"), "Custom delegation policy. {{safetyGuidance}}");
				const env = { ...process.env, PI_CODING_AGENT_DIR: agentDir };
				delete env[SUBAGENT_CHILD_ENV];
				const script = String.raw`
					import register from "./src/extension/index.ts";
					let tool;
					const pi = new Proxy({
						events: { on() { return () => {}; }, emit() {} },
						registerTool(value) { if (value.name === "subagent") tool = value; },
					}, { get(target, prop) { return prop in target ? target[prop] : () => undefined; } });
					register(pi);
					if (!tool) throw new Error("subagent tool not registered");
					process.stdout.write(JSON.stringify({
						description: tool.description,
						hasSnippet: Object.hasOwn(tool, "promptSnippet"),
						hasGuidelines: Object.hasOwn(tool, "promptGuidelines"),
						properties: Object.keys(tool.parameters.properties),
					}));
				`;
				const tool = JSON.parse(execFileSync(process.execPath, [
					"--experimental-strip-types", "--import", "./test/support/register-loader.mjs",
					"--input-type=module", "--eval", script,
				], { cwd: projectRoot, env, encoding: "utf8", timeout: 60_000 }));
				assert.equal(tool.description, "Run configured subagents.");
				assert.equal(tool.hasSnippet, false);
				assert.equal(tool.hasGuidelines, false);
				for (const name of ["agent", "task", "action", "workflowScript", "async", "worktree"]) {
					assert.ok(tool.properties.includes(name), `${name} remains available`);
				}
			} finally {
				fs.rmSync(agentDir, { recursive: true, force: true });
			}
		});
	}
});
