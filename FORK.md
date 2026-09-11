# Personal fork

This fork starts at upstream `v0.67.0`, commit `aa75b335`, and keeps the upstream history and MIT license. Local changes live on `personal`. The package name stays `pi-subagents` for imports and runtime discovery. It is not published to npm.

## Prompt changes

The `subagent` tool description is `Run configured subagents.` It has no `promptSnippet`, `promptGuidelines`, or appended delegation policy. The old `toolDescriptionMode` setting and custom Markdown description files have no effect.

The opt-in advertised-agent catalog still includes escaped, bounded names and descriptions. It no longer adds instructions about delegation or agent selection.

This is a parent-tool prompt patch, not a removal of every instruction in the package. Parameter descriptions, `bg_wait` and supervisor tool descriptions, bundled skills and prompt templates, child role prompts, child-runtime instructions, and runtime notifications remain upstream behavior. Permissions, launch validation, supervision, and execution limits are unchanged.

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
