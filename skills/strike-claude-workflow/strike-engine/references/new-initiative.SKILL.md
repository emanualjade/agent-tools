---
name: new-initiative
description: Use when the user asks Strike to start a new initiative from a new idea or request.
argument-hint: "[idea or request]"
disable-model-invocation: true
allowed-tools: Read Write Edit MultiEdit Bash Grep Glob WebFetch WebSearch Agent
---

# New Initiative

Start a fresh Strike initiative for a new idea. Preserve existing
initiatives.

## New Initiative Behavior

Use this skill only when the user wants new work. If the user wants to resume,
continue, pick up, or inspect existing work, use `go`.

Choose a short kebab-case initiative ID from the request, such as
`checkout-redesign` or `payment-system`. Use the optional name argument for the
human title.

If `strike/state.json` does not exist, initialize the workspace:

```text
node <this skill dir>/scripts/state.mjs init <initiative-id> [name]
```

This initializes `PROJECT_LANGUAGE.md`,
`strike/user-guidance/`, `strike/state.json`, copies the helper to
`strike/scripts/state.mjs`, and creates the first initiative directory. It
does not overwrite existing project language, implementation discipline, or user
review lens files.

If `strike/state.json` already exists, add a new active initiative:

```text
node strike/scripts/state.mjs add-initiative <initiative-id> [name]
```

This preserves all existing initiatives, pauses the previous active initiative,
and starts the new one at `refine-idea`.

If the chosen initiative ID already exists, ask for a different ID or confirm
that the user meant to resume existing work with `go`.

## Continue The Workflow

After initialization, continue with the same workflow mechanics as
`go`:

```text
node strike/scripts/state.mjs current
```

Invoke the returned workflow skill with the original user request, the returned
artifact path, and the returned completion check.

After each workflow skill finishes, complete only the one check returned by
`current`, then run `node strike/scripts/state.mjs current` again before
continuing. Do not batch multiple `complete-check` commands together.

If the work is interrupted after initialization, resume later with
`go`.
