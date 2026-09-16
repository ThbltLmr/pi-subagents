import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	CHILD_SESSION_NAME_MAX_CHARS,
	deriveChildSessionName,
	childDisplayName,
	displayAgentName,
} from "../../src/shared/child-session-name.ts";
import { PROMPT_REDACTED } from "../../src/shared/utils.ts";

describe("deriveChildSessionName", () => {
	it("keeps the task-only execution identity out of derived and displayed names", () => {
		assert.equal(deriveChildSessionName({ agent: "__task__", label: "Write README" }), "Write README");
		assert.equal(deriveChildSessionName({ agent: "__task__", task: "Inspect the service" }), "Inspect the service");
		assert.equal(deriveChildSessionName({ agent: "__task__" }), "subagent");
		assert.equal(displayAgentName("__task__"), "subagent");
		assert.equal(displayAgentName("reviewer"), "reviewer");
		assert.equal(childDisplayName({ agent: "__task__", label: "Write README", sessionName: "__task__: stale task" }), "Write README");
		assert.equal(childDisplayName({ agent: "__task__", sessionName: "__task__: Inspect the service" }), "Inspect the service");
		assert.equal(childDisplayName({ agent: "reviewer", sessionName: "reviewer: Inspect the service" }), "reviewer: Inspect the service");
	});

	it("combines agent and task excerpt", () => {
		assert.equal(
			deriveChildSessionName({ agent: "reviewer", task: "Review the diff since main" }),
			"reviewer: Review the diff since main",
		);
	});

	it("prefers a workflow label over the task", () => {
		assert.equal(
			deriveChildSessionName({ agent: "scout", label: "find-callers", task: "ignored task text" }),
			"scout: find-callers",
		);
	});

	it("falls back to the bare agent when no task or label is usable", () => {
		assert.equal(deriveChildSessionName({ agent: "worker" }), "worker");
		assert.equal(deriveChildSessionName({ agent: "worker", task: "   " }), "worker");
	});

	it("never builds a name from a redacted prompt", () => {
		assert.equal(deriveChildSessionName({ agent: "worker", task: PROMPT_REDACTED }), "worker");
		assert.equal(deriveChildSessionName({ task: PROMPT_REDACTED }), undefined);
	});

	it("collapses newlines and control characters into a single line", () => {
		const name = deriveChildSessionName({ agent: "scout", task: "line one\nline two" });
		assert.equal(name, "scout: line one line two");
		assert.doesNotMatch(name!, /[\n]/);
	});

	it("caps the final name at CHILD_SESSION_NAME_MAX_CHARS", () => {
		const name = deriveChildSessionName({ agent: "worker", task: "x".repeat(500) });
		assert.ok(name);
		assert.ok(name.length <= CHILD_SESSION_NAME_MAX_CHARS);
		assert.ok(name.endsWith("..."));
	});

	it("returns undefined when there is nothing to name", () => {
		assert.equal(deriveChildSessionName({}), undefined);
	});
});
