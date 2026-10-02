# pi-subagents — personal fork

A fork of [nicobailon/pi-subagents](https://github.com/nicobailon/pi-subagents), based on v0.67.0. It retains the execution engine but ships no agent personas or external CLI profiles. See [FORK.md](FORK.md) for the patch history and update procedure.

## Install

```sh
pi install git:github.com/ThbltLmr/pi-subagents@personal
```

For the local config repository, load `./plugins/pi-subagents` instead. Do not load both copies. Run `/reload` after updating the checkout.

That is the only required step. Background children use the host's SDK: npm Pi keeps its detached Node runner; the official Pi 0.86.1 Linux x64 standalone release loads the same runner through Pi's embedded SDK, without a separate SDK install. See [Standalone background execution](docs/standalone-background.md) for the supported boundary and validation gate.

## Spawn a child

```js
subagent({
  label: "Review auth",
  task: "Inspect src/auth and report concrete bugs. Do not edit files.",
  model: "provider/model"
});
```

Direct single-child calls require a non-blank `label` of at most 50 characters plus the child `task`; `model` is optional. The label is the child’s UI title and does not change its execution identity. A plain child keeps Pi's normal system prompt, applicable `AGENTS.md` context, tools, and skill discovery. The plugin adds no role prompt, default reads, or automatic acceptance contract.

Context defaults to **fresh**, including when a global preference says `fork`. Pass `context: "fork"` explicitly to inherit a usable parent session. Include the context a fresh child needs in its task.

## Workflows

Sequential and parallel launches use the same task-only shape:

Write one workflow block in the reply:

```js workflow
const results = await runs.all([
  { key: "correctness", task: "Review the current diff for correctness. Do not edit files." },
  { key: "tests", task: "Review test coverage of the current diff. Do not edit files." }
]);
return results.map(result => result.output);
```

Then call `subagent({ workflow: true, async: true })` in the same reply. Use `workflow: "./path/to/script.js"` for a script file or `workflow: "<name>"` for a named resource.

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

Installing the extension does not start an automatic reviewer in the background. When the session's model can take a new tool mid-conversation, fresh parent sessions initially expose the small `subagents_enable` loader instead of the full `subagent` schema. When your request or applicable instructions authorize delegation, Pi can call the loader itself; the unchanged `subagent` tool is available on the next model request. With other models, fresh sessions start with `subagent` active, because adding a tool later would make the provider miss its prompt cache. The [`toolActivation`](docs/configuration.md#toolactivation) setting changes this. Complexity alone does not authorize delegation. `bg_wait` and supervisor replies remain available without activation.

If you want every implementation reviewed, say so in your prompt or project instructions:

```text
When you finish implementing, run a fresh-context, read-only subagent to review the diff before summarizing.
```

## Common workflows

Packaged prompt shortcuts include `/parallel-review`, `/review-loop`, `/parallel-research`, and `/council`. They describe tasks, not installed personas. The `council-mode` skill supports bounded advisor councils; optional `council-*` profiles belong in your own agent directory. See [Workflows](docs/workflows.md).

## Where running work shows up

Foreground runs stream progress in the conversation. Background runs keep working after control returns to you.

In the TUI, a persistent FleetView below the editor keeps active work visible. `/subagents-fleet` opens a live inspector where you can browse children, read transcripts, steer a running child, or stop a run. You can also just ask: "Show me the current async runs."

Details, keybindings, and the machine-readable run artifacts are in [Observability](https://github.com/nicobailon/pi-subagents/blob/main/docs/observability.md).

For bounded orchestration, `maxSubagentSpawnsPerRun` limits cumulative logical children in one run tree. It defaults to 64 and stays separate from active concurrency and the session-wide cumulative spawn budget. See [Configuration](https://github.com/nicobailon/pi-subagents/blob/main/docs/configuration.md#maxsubagentspawnsperrun).

## If something feels off

```text
/subagents-doctor
```

or ask: "Check whether subagents and intercom are set up correctly."

For installed-version help, use `/subagents-guide [topic]` or `subagent({ action: "guide", topic: "workflows" })`. The default topic is `overview`; available topics are `overview`, `workflows`, `agents`, `missions`, `observability`, `tool-reference`, `configuration`, `models`, `watchdog`, `extension-api`, and `council`.

## Documentation

The full reference lives in `docs/`:

| Doc | What's in it |
|-----|--------------|
| [Agents](https://github.com/nicobailon/pi-subagents/blob/main/docs/agents.md) | Custom agents, frontmatter reference, tools, extensions, skills, per-agent memory. |
| [Models](https://github.com/nicobailon/pi-subagents/blob/main/docs/models.md) | Single-model selection and launch, defaults, per-role overrides, recommended tiering, thinking levels, model scope enforcement, profiles. |
| [Workflows](https://github.com/nicobailon/pi-subagents/blob/main/docs/workflows.md) | Orchestration patterns, prompt shortcuts, scripted workflows, worktree isolation, child-to-parent coordination, the recursion guard. |
| [Watchdog](https://github.com/nicobailon/pi-subagents/blob/main/docs/watchdog.md) | The opt-in adversarial change reviewer, scope monitoring, LSP checks, and child tool permissions. |
| [Tool reference](https://github.com/nicobailon/pi-subagents/blob/main/docs/tool-reference.md) | Every `subagent` parameter, management actions, status/control actions, acceptance gates, external CLI runners. |
| [Observability](https://github.com/nicobailon/pi-subagents/blob/main/docs/observability.md) | FleetView, the fleet inspector, lifecycle artifacts, events, logs, session sharing. |
| [Missions and schedules](https://github.com/nicobailon/pi-subagents/blob/main/docs/missions.md) | Durable mission records, delivery receipts, timed and recurring runs. |
| [Configuration](https://github.com/nicobailon/pi-subagents/blob/main/docs/configuration.md) | Every `config.json` key and environment variable. |
| [Extension API](https://github.com/nicobailon/pi-subagents/blob/main/docs/extension-api.md) | The RPC, delegation API, preflight, capability ceilings, [trusted workflow resources](docs/extension-api.md#trusted-workflow-resources), background-work providers, Herdr integration. |
