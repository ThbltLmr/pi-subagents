# pi-subagents — personal fork

A fork of [nicobailon/pi-subagents](https://github.com/nicobailon/pi-subagents), based on v0.67.0. It retains the execution engine but ships no agent personas or external CLI profiles. See [FORK.md](FORK.md) for the patch history and update procedure.

## Install

```sh
pi install git:github.com/ThbltLmr/pi-subagents@personal
```

For the local config repository, load `./plugins/pi-subagents` instead. Do not load both copies. Run `/reload` after updating the checkout.

## Spawn a child

```js
subagent({
  task: "Inspect src/auth and report concrete bugs. Do not edit files.",
  model: "provider/model"
});
```

Only `task` is needed. `model` is optional. A plain child keeps Pi's normal system prompt, applicable `AGENTS.md` context, tools, and skill discovery. The plugin adds no role prompt, default reads, or automatic acceptance contract.

Context defaults to **fresh**, including when a global preference says `fork`. Pass `context: "fork"` explicitly to inherit a usable parent session. Include the context a fresh child needs in its task.

## Workflows

Sequential and parallel launches use the same task-only shape:

```js
subagent({
  async: true,
  workflowScript: `
    const results = await runs.all([
      { key: "correctness", task: "Review the current diff for correctness. Do not edit files." },
      { key: "tests", task: "Review test coverage of the current diff. Do not edit files." }
    ]);
    return results.map(result => result.output);
  `
});
```

`runs.run`, staged lanes, managed worktrees, retained-session resumes, supervision, cancellation, and result artifacts remain available. Async runs notify the parent on completion.

## Optional custom profiles

Use `agent: "my-profile"` only for a profile you have configured. User, project, package, and runtime-registered profiles remain supported, as do external runners. Named profiles retain their configured prompt, tools, model, and context behavior. There are no implicit `worker`, `reviewer`, `oracle`, or CLI profiles.

An `allowedAgents` capability ceiling permits named profiles only. A task-only call fails under that restriction rather than bypassing it. Tool-only ceilings still apply to plain children.

## Controls and reference

- `/subagents-fleet`: inspect running children, transcripts, and controls.
- `/subagents-doctor`: diagnose setup.
- `subagent({ action: "list" })`: list configured profiles, not plain children.
- [Configuration](docs/configuration.md), [workflows](docs/workflows.md), [tool reference](docs/tool-reference.md), and [extension API](docs/extension-api.md).
- [Custom profiles](docs/agents.md), [models](docs/models.md), [observability](docs/observability.md), and [missions](docs/missions.md).

The detailed reference retains upstream examples. Any named profile in those examples must be installed explicitly; this fork provides none. For a plain child, omit `agent` and supply a task.
