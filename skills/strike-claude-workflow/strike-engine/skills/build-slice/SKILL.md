---
name: build-slice
description: Implement one planned slice while keeping changes scoped and recording compact build evidence.
argument-hint: "[slice plan/context]"
disable-model-invocation: true
allowed-tools: Read Write Edit MultiEdit Bash Grep Glob WebFetch WebSearch
---

# Build Slice

Implement one planned slice.

## Inputs

- verified slice plan from the current slice's `plan.md`
- plan verification from the current slice's `plan-verification.md`
- repo files named by the plan
- user implementation guidance from
  `strike/user-guidance/implementation-discipline/global.md` and
  `strike/user-guidance/implementation-discipline/build-slice.md`
- optional slice, research, or phase-spec context only when the verified plan is
  unclear, stale, or appears to conflict with the repo

## Process

- Treat `plan.md` as the primary build handoff.
- Read `strike/user-guidance/implementation-discipline/global.md` and
  `strike/user-guidance/implementation-discipline/build-slice.md` if they
  exist, and apply the relevant guidance while editing.
- If `plan-verification.md` does not say `Ready: yes`, write `Built: no` with
  route back to `verify-slice-plan` and do not edit implementation files.
- Skim the plan's `Slice Boundary`, `Surfaces`, `Approach`, `Test Plan`, and
  `Verification` before editing.
- Inspect the current repo files and surfaces named by the plan, plus nearby
  related code, before changing them.
- Before creating a utility, helper, adapter, or shared module, search for an
  existing one and place any new shared code where repo patterns say it belongs.
- Before modifying an existing shared utility, helper, adapter, schema, or
  shared module, inspect likely callers and downstream consumers.
- Implement only the planned slice scope, using the smallest complete path.
- Follow repo conventions and the repo's package manager, test, security, and
  editing rules.
- Add or update the focused tests named in the plan when they apply. If the
  implementation makes a missing test obvious, add it or record why it was not
  appropriate.
- Run focused test/check commands for the changed surface. Do not default to a
  full suite unless the plan justifies it, the repo makes it cheap, or the risk
  clearly warrants it.
- Record changed files, checks attempted, and important implementation notes in
  `build.md`.
- Use engineering judgment for ordinary implementation details inside the
  verified plan, and record meaningful assumptions in `build.md`.
- If the plan is missing, too vague, no longer matches the repo, or needs
  upstream context to understand, write `Built: no` with route back to
  `plan-slice` or `verify-slice-plan`.
- If the verified plan cannot be followed without expanding or redesigning the
  slice, write `Built: no` with route back to `plan-slice`.

## Output

Make the implementation changes in the repo.

Write build evidence to the current slice's `build.md`:

```text
strike/initiatives/<initiative-id>/phases/<phase-id>/slices/<slice-id>/build.md
```

Use this shape:

```md
# Slice Build

## Build Status
Built: yes / no
Reason:

## Changed Files
-

## Checks Attempted
-

## Tests
Added or updated:
-
Focused commands:
-
Not run / skipped:
- None.

## Implementation Notes
- Implementation discipline guidance used:
- Repo pattern or utility placement notes:
- Upstream/downstream impact notes:

## Route Back
Needed: yes / no
Command: None / reopen-check
Phase: None / <phase-id>
Slice: None / <slice-id>
Check: None / planCreated / planVerified
Reason:

## Blocked
- None.
```

## Rules

- Keep work inside one slice.
- Do not broaden the slice to include unrelated cleanup or future work.
- Do not improvise around a bad plan; write `Built: no` and route back to the
  owning workflow step so Strike can continue.
- Do not re-evaluate whether the slice is well-shaped. That was handled by
  research, planning, and plan verification.
- Do not route back for ordinary implementation choices that fit the verified
  plan.
- Read upstream artifacts only when they are needed to clarify or challenge the
  verified plan.
- When `Built: yes`, write `Needed: no`, `Command: None`, `Phase: None`,
  `Slice: None`, and `Check: None`.
- After writing `Built: yes`, Strike can run
  `node strike/scripts/state.mjs complete-check implemented`.
- Do not claim verification.
- Preserve unrelated user work.
- Follow the repo's package manager, test, security, and editing rules.
- Do not scatter duplicate helpers or create convenience utilities without a
  repo-pattern-based home.
