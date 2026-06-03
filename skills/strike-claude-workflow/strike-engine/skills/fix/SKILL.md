---
name: fix
description: Fix issues from a failed Strike verification pass, then return to the same verifier.
argument-hint: "[failed verification context]"
disable-model-invocation: true
allowed-tools: Read Write Edit MultiEdit Bash Grep Glob WebFetch WebSearch Agent
---

# Fix

Fix issues from a failed Strike verification pass.

## Inputs

- failed verification artifact
- current initiative, phase, or slice artifacts named by the verifier
- prior fix reports for the same verifier, when present
- user implementation guidance from
  `strike/user-guidance/implementation-discipline/global.md` and
  `strike/user-guidance/implementation-discipline/fix.md`
- repo files, commands, or paths needed to understand and repair the issue

## Process

- Read the failed verification artifact first.
- Read `strike/user-guidance/implementation-discipline/global.md` and
  `strike/user-guidance/implementation-discipline/fix.md` if they exist,
  and apply relevant guidance to the repair.
- Fix the verifier's `Must Fix` items. They may be broken behavior,
  incomplete accepted scope, missing evidence, weak artifacts, or regressions.
- Treat `P0` and `P1` `Must Fix` items as required before the verifier can
  pass. Treat `P2` and `P3` findings as follow-up unless the verifier says they
  are required by accepted scope.
- Read whatever project docs, artifacts, code, or source-backed references are
  needed to fix the real issue.
- If the repair creates or modifies utilities, helpers, adapters, schemas, or
  shared modules, search for existing repo patterns and inspect likely callers
  before editing.
- Keep the repair focused on passing the failed verification, not expanding the
  feature.
- Treat `Follow-Up` and `Accepted Risk` items as context. Do not fix them unless
  they are necessary to resolve a `Must Fix` item.
- Review prior fix reports for the same verifier. If the same issue repeats
  after a reasonable repair attempt, write `Fixed: no` with the repeated issue
  instead of broadening the work.
- Run focused checks that prove the repair, plus any repo-level check that is
  appropriate for the changed surface.
- When the repair requires a real user, product, data, security, accounting,
  scope, or architecture decision, write `Fixed: no`, explain the needed
  decision, and return to the verifier or route-back flow without inventing the
  answer.
- If the issue belongs to an earlier workflow step instead of a contained
  repair, write `Fixed: no` and fill in `## Route Back`.

## Output

Write a compact fix report next to the affected workflow evidence.

Use the next unused numeric path:

```text
strike/initiatives/<initiative-id>/phases/<phase-id>/slices/<slice-id>/fixes/fix-001.md
strike/initiatives/<initiative-id>/phases/<phase-id>/fixes/fix-001.md
strike/initiatives/<initiative-id>/fixes/fix-001.md
```

Use the most local path that matches the failed verification.

Use this shape:

```md
# Fix

## Source Verification
Verifier:
Artifact:

## Fix Status
Fixed: yes / no
Reason:

## Issues Addressed
- I1 —

## Changes Made
-

## Checks
-

## Not Fixed / Blockers
- None.

## Follow-Up / Accepted Risk
- None.

## Return
Verifier:
Artifact:
Ready for re-verification: yes / no

## Route Back
Needed: yes / no
Command: None / reopen-check / reopen-phase-check / reopen-slice-check
Phase: None / <phase-id>
Slice: None / <slice-id>
Check: None / <state-check>
Reason:
```

## Rules

- Fix only from a failed verification artifact.
- Use one of three outcomes: `Fixed: yes` and return to the same verifier;
  `Fixed: no` with `Route Back` when an earlier workflow step owns the repair;
  or `Fixed: no` without route-back only for a genuinely unresolved decision.
- When writing route-back, use the exact helper command Strike should run.
  Use `reopen-check` for the current scope, `reopen-phase-check` for a phase
  check, and `reopen-slice-check` for a specific slice check.
- Do not decide that the work is verified. The same verifier must run again.
- Do not complete workflow state checks.
- Do not chase open-ended improvements.
- Do not hide accepted-scope defects as follow-up work.
- Do not rewrite the failed verification artifact; it remains the source for
  this repair loop.
- Preserve unrelated user work.
