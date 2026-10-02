import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const readProjectFile = (file: string): string => readFileSync(join(process.cwd(), file), "utf-8");

describe("pi-subagents delegation policy guidance", () => {
	it("preserves the fork's task-only and operator policy", () => {
		const skill = readProjectFile("skills/pi-subagents/SKILL.md");
		const prompting = readProjectFile("skills/pi-subagents/references/prompting-and-roles.md");
		const recipes = readProjectFile("skills/pi-subagents/references/constraints-and-recipes.md");
		const lanes = readProjectFile("skills/pi-subagents/references/multi-lane-orchestration.md");
		const guidance = [skill, prompting, recipes, lanes].join("\n");

		assert.match(skill, /This fork ships no profiles/i);
		assert.match(skill, /Model selection and whether to delegate belong to the user and project instructions, not a package role policy/i);
		assert.match(prompting, /Proactive skill-based suggestions are off by default/i);
		assert.match(recipes, /Recipes select a shape; they do not authorize delegation/i);
		assert.match(lanes, /only after delegation is operator-authorized/i);

		assert.doesNotMatch(guidance, /parent works directly by default/i);
		assert.doesNotMatch(guidance, /not the routine primary doer/i);
		assert.doesNotMatch(guidance, /delegate[^\n]*(?:most|all) non-trivial requests/i);
		assert.doesNotMatch(guidance, /use this at the start of non-trivial work/i);
	});
});
