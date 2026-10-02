# Personal fork

This fork starts at upstream `v0.67.0`, commit `aa75b335`, and keeps the upstream history and MIT license. It is synchronized through upstream `69a830c0` (after `v0.74.0`). Local changes live on `personal`. The package name stays `pi-subagents` for imports and runtime discovery. It is not published to npm.

## Task-only spawning

A native child no longer needs a named profile:

```js
subagent({ label: "Implement pagination", task: "Implement pagination and run the tests", model: "provider/model" });
```

Direct single-child tool calls require a non-blank `label` of at most 50 characters. It is the UI title and stays separate from the internal `__task__` execution identity. Workflow children keep their existing optional step labels, which become their session and UI titles in foreground and background runs. The UI never uses `__task__` as a role or header. Workflow containers, management/control, and resume calls do not require a top-level label.

The task-only shape (without the direct-call label requirement) works in `runs.run(key, { task })`, `runs.all([{ key, task }])`, and workflow lanes. Model tool calls use upstream's `workflow: true` with a reply-fenced `js workflow` block, a script path in `workflow`, or a named workflow resource; `workflowScript` is now an internal carrier rather than a public tool field. The extension delegation and preflight APIs also accept an omitted `agent`. Omitted context means `fresh` for task-only calls, even if a global preference says `fork`. Explicit `context: "fork"` still requires a usable parent session. Named custom profiles remain optional and retain their configured defaults.

Task-only children keep Pi's base system prompt, applicable global and project context files, and normal skill discovery. They have no role prompt, default reads, progress-file requirement, or automatic acceptance contract. Explicit acceptance and gates still work. Tool permissions and execution limits still apply.

An `allowedAgents` capability restriction permits named profiles only; task-only launches fail with an explanation rather than bypassing it. Tool-only ceilings still apply to plain children. `__task__` is a reserved internal execution identity, not a selectable profile or alias.

## No bundled profiles

The fork ships no native personas or external CLI profiles. User, project, package, and runtime-registered custom profiles still work. Profile names do not get special prompt defaults.

Prompt workflows without an explicit profile and refinement proposals launch plain children. The named `review` workflow also uses a plain child, with a read-only tool ceiling. Proactive skill-based profile suggestions are off unless explicitly enabled; there is no preferred reviewer or delegate.

## Prompt changes

The `subagent` tool description is `Run subagents.` It has no `promptSnippet`, `promptGuidelines`, or appended delegation policy. The new lazy-activation loader, `subagents_enable`, also has no delegation-policy metadata. The old `toolDescriptionMode` setting and custom Markdown description files have no effect.

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

Fetch upstream tags, select a release or an explicit upstream commit, and merge it deliberately. Work in a separate Git worktree when the live Pi session loads this checkout: merge markers can prevent child runners from starting. Then run:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm test
npm run test:integration
```

The normal suites use an isolated coding-agent shim, with Pi 1.0 declarations and host peers pinned to 1.0.0. Real SDK/resource-loader checks require an installed Pi package and its own peers:

```sh
export PI_SUBAGENTS_NATIVE_PI_ROOT=/path/to/node_modules/@earendil-works/pi-coding-agent
npm run test:smoke:tool-activation
node --experimental-strip-types --import ./test/support/isolated-temp-root.mjs --import ./test/support/native-peer-loader.mjs --test test/unit/pi1-nested-model-routing.test.ts test/integration/in-process-child.test.ts
```

Check the registered tool and catalog tests after each merge. Push `personal` to this fork before updating the parent's submodule pin. Pi package updates do not advance this local checkout.
