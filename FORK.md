# Personal fork

This fork starts at upstream `v0.67.0`, commit `aa75b335`, and keeps the upstream history and MIT license. Local changes live on `personal`. The package name stays `pi-subagents` for imports and runtime discovery. It is not published to npm.

## Task-only spawning

A native child no longer needs a named profile:

```js
subagent({ task: "Implement pagination and run the tests", model: "provider/model" });
```

The same shape works in `runs.run(key, { task })`, `runs.all([{ key, task }])`, and workflow lanes. The extension delegation and preflight APIs also accept an omitted `agent`. Omitted context means `fresh` for task-only calls, even if a global preference says `fork`. Explicit `context: "fork"` still requires a usable parent session. Named custom profiles remain optional and retain their configured defaults.

Task-only children keep Pi's base system prompt, applicable global and project context files, and normal skill discovery. They have no role prompt, default reads, progress-file requirement, or automatic acceptance contract. Explicit acceptance and gates still work. Tool permissions and execution limits still apply.

An `allowedAgents` capability restriction permits named profiles only; task-only launches fail with an explanation rather than bypassing it. Tool-only ceilings still apply to plain children. `__task__` is a reserved internal execution identity, not a selectable profile or alias.

## No bundled profiles

The fork ships no native personas or external CLI profiles. User, project, package, and runtime-registered custom profiles still work. Profile names do not get special prompt defaults.

Prompt workflows without an explicit profile and refinement proposals launch plain children. The named `review` workflow also uses a plain child, with a read-only tool ceiling. Proactive skill-based profile suggestions are off unless explicitly enabled; there is no preferred reviewer or delegate.

## Prompt changes

The `subagent` tool description is `Run configured subagents.` It has no `promptSnippet`, `promptGuidelines`, or appended delegation policy. The old `toolDescriptionMode` setting and custom Markdown description files have no effect.

The opt-in advertised-agent catalog still includes escaped, bounded names and descriptions. It no longer adds instructions about delegation or agent selection.

This does not remove every runtime instruction. Parameter descriptions, `bg_wait` and supervisor tools, bundled skills and prompt templates, child-runtime instructions, and notifications remain. Permissions, launch validation, supervision, and execution limits are retained.

## Local installation

The parent config repository tracks this checkout as `plugins/pi-subagents`. Its `settings.json` loads `./plugins/pi-subagents` instead of `npm:pi-subagents`. Do not enable both copies.

After cloning the submodule, install dependencies:

```sh
npm ci --ignore-scripts --no-audit --no-fund
```

No build is required. Pi loads the TypeScript entry point. Run `/reload` after changing the source or configuration.

## Upstream updates

Use a clean worktree on `personal`. Add the upstream remote once in a new checkout:

```sh
git remote add upstream https://github.com/nicobailon/pi-subagents.git
```

Fetch upstream tags, select a release, and merge that tag deliberately. Then run:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm test
npm run test:integration
```

Check the registered tool and catalog tests after each merge. Push `personal` to this fork before updating the parent's submodule pin. Pi package updates do not advance this local checkout.
