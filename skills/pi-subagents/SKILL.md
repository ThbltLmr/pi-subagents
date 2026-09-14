---
name: pi-subagents
description: Launch task-only Pi children, compose sequential or parallel workflows, and manage supervision, isolation, results, and cancellation. Custom profiles are optional.
---

# Pi Subagents

This fork ships no profiles. A direct launch needs a concise UI label (non-blank, at most 50 characters) and a non-empty task:

```js
subagent({ label: "Implement pagination", task: "Implement the agreed change and run the relevant tests" });
```

The label is display-only. Workflow steps keep their optional labels, and workflow container, management/control, and resume calls do not need a top-level label. Optional direct-launch fields include `model`, `cwd`, `context`, `async`, `worktree`, and `output`. Plain children use fresh context and normal Pi instructions, applicable global/project context, tools, and skill discovery. Pass `context: "fork"` explicitly when parent-session context is needed and available.

`agent` selects an explicitly configured custom profile. Do not invent profile names or assume `worker`, `reviewer`, `oracle`, or any external CLI profile exists. Model selection and whether to delegate belong to the user and project instructions, not a package role policy.

## Workflows

```js
subagent({
  async: true,
  workflowScript: `
    const results = await runs.all([
      { key: "code", task: "Review the changed code. Do not edit files." },
      { key: "tests", task: "Review the changed tests. Do not edit files." }
    ]);
    return results.map(result => result.output);
  `
});
```

Use `runs.run(key, { task })` for one step, `runs.all` for parallel steps, and `runs.lanes` for staged lanes. Use stable keys. Later steps can receive earlier results through their task text. Declare durable output with the `output` parameter rather than only naming a file in the task.

Workflow scripts support top-level `await`, plain helper functions, and Promise chains, but not nested async helpers. Resumes use the retained run ID and a new task, without `agent`.

## Runtime boundaries

- Async children notify the parent natively. Do not poll or call `bg_wait` merely to await that notification.
- Tool permissions, capability ceilings, spawn budgets, and isolation limits remain enforced. An `allowedAgents` ceiling requires selection of an allowed custom profile; task-only calls cannot bypass it.
- Keep one writer per shared worktree. Use managed worktrees for independent concurrent edits.
- A child launch or runtime setup failure is an infrastructure blocker, not permission to switch execution protocols silently.
- Management and control use `action`; do not combine management with launch inputs.

For exact fields, use `subagent({ action: "guide", topic: "tool-reference" })` or read [the tool reference](../../docs/tool-reference.md). See [workflows](../../docs/workflows.md), [extension APIs](../../docs/extension-api.md), and [council mode](../council-mode/SKILL.md) when needed. Older named-profile examples in the detailed references require explicitly configured profiles.
