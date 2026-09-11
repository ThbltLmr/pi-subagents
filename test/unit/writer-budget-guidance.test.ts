import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const readProjectFile = (file: string): string => readFileSync(join(process.cwd(), file), "utf-8");

describe("writer budget guidance", () => {
	it("leaves delegation and model policy out of the task-only skill", () => {
		const skill = readProjectFile("skills/pi-subagents/SKILL.md");
		assert.match(skill, /ships no profiles/);
		assert.match(skill, /user and project instructions/);
		assert.doesNotMatch(skill, /Orchestrator mode|writer → challenge|keep the parent on|agent: "(?:worker|reviewer|oracle)"/i);
	});
	it("keeps hard tool and usage caps off mutation-capable workers", () => {
		const toolReference = readProjectFile("docs/tool-reference.md");
		const reviewLoop = readProjectFile("prompts/review-loop.md");

		for (const text of [toolReference, reviewLoop]) {
			assert.match(text, /As a conservative orchestration policy, do not (?:pass|set) a hard `toolBudget`/);
			assert.match(text, /default tool budget blocks read\/search tools rather than mutation tools/i);
			assert.match(text, /checkpoint after the current tool returns/);
			assert.match(text, /changed files/);
			assert.match(text, /build\/test state/);
			assert.match(text, /commit or PR state/);
		}
		assert.match(toolReference, /elapsed timeout is not a mutation-safe boundary/i);
	});

});
