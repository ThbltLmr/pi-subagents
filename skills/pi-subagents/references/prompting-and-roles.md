# Tasks and optional profiles

The personal fork has no bundled roles. Assign work directly:

```js
subagent({ label: "Review auth", task: "Review src/auth for concrete correctness bugs. Do not edit files." });
```

A fresh child receives the task, normal Pi instructions, applicable global/project context, and ordinary skill discovery—not the parent conversation. Supply any decisions, paths, or other context needed for the task. Explicit `context: "fork"` remains available with a usable parent session.

Use `model` for a per-run choice, following user/project policy. No package-defined tier or persona is required. Use `agent` only when you want an explicitly configured custom profile's defaults. `action: "list"` lists those profiles.

## Capability ceilings

Parent extensions can register session-scoped ceilings through `pi-subagents/capability-ceiling`. Tool permissions intersect with every active registration and inherited snapshot. An `allowedAgents` ceiling allows only named custom profiles; plain task-only launches fail under it. `denyExtensions` blocks ambient/provider extension loading while retaining protocol runtime.

## Commands

- `/run <profile> [task]` runs an explicitly configured profile.
- `/prompt-workflow` runs a prompt template; without an explicit profile it launches a plain child.
- `/subagents-fleet`, `/subagents-steer`, `/subagents-stop`, and `/subagent-cost` inspect and control runs.
- `/subagents-models` shows available models and configured profile mappings.

Prompt shortcuts such as `/parallel-review`, `/review-loop`, and `/parallel-research` describe tasks, not installed personas. Use [council mode](../../council-mode/SKILL.md) when requested.

For custom frontmatter and settings, see [agents](../../../docs/agents.md) and [models](../../../docs/models.md). Any upstream named-profile examples require profiles you have installed yourself.
