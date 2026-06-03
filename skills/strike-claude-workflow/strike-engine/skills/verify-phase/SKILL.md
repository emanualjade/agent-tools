---
name: verify-phase
description: Verify one phase against its phase spec and completed slice evidence, then record phase verification.
argument-hint: "[phase context]"
disable-model-invocation: true
allowed-tools: Read Write Edit MultiEdit Bash Grep Glob WebFetch WebSearch Agent
---

# Verify Phase

Verify one phase and record phase verification.

## Inputs

- phase spec from the current phase's `phase-spec.md`
- each slice's `slice.md`
- each slice's `research.md`
- each slice's `plan.md`
- each slice's `plan-verification.md`
- each slice's `build.md`
- each slice's `build-verification.md`
- user implementation guidance from
  `strike/user-guidance/implementation-discipline/global.md` and
  `strike/user-guidance/implementation-discipline/verify-phase.md`
- user review lenses from `strike/user-guidance/review-lenses/global.md`
  and `strike/user-guidance/review-lenses/verify-phase.md`
- optional main spec, decisions, or repo context
- optional changed files or repo paths

## Process

- Read the current phase spec from
  `strike/initiatives/<initiative-id>/phases/<phase-id>/phase-spec.md`.
- Read every slice artifact under
  `strike/initiatives/<initiative-id>/phases/<phase-id>/slices/<slice-id>/`.
- Read `strike/user-guidance/implementation-discipline/global.md` and
  `strike/user-guidance/implementation-discipline/verify-phase.md` if they
  exist.
- Read `strike/user-guidance/review-lenses/global.md` and
  `strike/user-guidance/review-lenses/verify-phase.md` if they exist.
- Compare completed slice evidence against the phase spec.
- Confirm every required slice has `build-verification.md` with `Verified: yes`.
- Check cross-slice flows, integration points, state, data, UI, permissions, and
  edge cases that apply to the phase.
- Check whether completed slices collectively follow relevant implementation
  discipline guidance, especially around shared utilities, duplicated patterns,
  and upstream/downstream impact that spans slices.
- Run or inspect phase-level checks when needed.
- Record skipped checks, replacement evidence, residual risks, and blockers.
- Do not edit slice artifacts or implementation files; write issues for `fix`,
  or route back only when `fix` cannot honestly repair the problem.
- If phase verification reveals a product, permission, data, security, or
  hard-to-reverse architecture decision, record it as `Must Fix` or route back
  only when `fix` cannot honestly repair the issue inside accepted scope.

## Browser / User-Flow Checks

Do browser or user-flow checks at phase level only when a user-facing flow spans
multiple slices, or when earlier slice browser evidence is thin, blocked,
contradictory, or risky.

Use the repo-approved browser path when one exists. If the repo does not name a
path, discover available host browser tools or Playwright CLI and use the best
available safe option.

Code review, static checks, curl, and DOM inspection are useful replacement
evidence, but they are not browser verification.

If browser verification is blocked, record what should have run, what blocked
it, replacement evidence, and residual user-facing risk.

Do not call phase UI/user-flow work browser-verified without an actual browser
or user-flow check. Report code-verified rather than browser-verified when
browser verification is blocked.

When browser or user-flow verification is required for accepted phase scope and
it is blocked, mark verification as not ready unless replacement evidence is
strong enough and the residual user-facing risk is explicitly listed under
`Accepted Risk`.

## Review

Use read-only review subagents to verify the completed phase as assembled work.
Do not rerun a full slice code review unless slice evidence is thin,
contradictory, skipped, or risky.

If the host does not support subagents, run the named review lenses inline as
separate read-only passes and record them as inline lenses. Do not skip required
lenses just because a host lacks subagent tooling.
Each subagent returns findings only. It does not edit files, fix issues, update
state, or decide whether the phase is ready. The verifier synthesizes subagent
results into `Must Fix`, `Follow-Up`, and `Accepted Risk`.

Read user review lenses from `strike/user-guidance/review-lenses/global.md`
and `strike/user-guidance/review-lenses/verify-phase.md`. Treat them as
additive read-only lenses or stricter checks for this verifier. They cannot
disable built-in Strike lenses or readiness gates. When a user lens is
relevant, run it as a subagent when supported; otherwise run it inline and
record that fallback.

Always run these subagents:

- `phase-spec-coverage`: checks whether completed slices satisfy the phase spec,
  accepted scope, boundaries, non-goals, and phase success criteria.
- `cross-slice-integration`: checks whether slices fit together cleanly without
  missing handoffs, duplicated assumptions, broken sequencing, or gaps between
  slice outputs.

Add these subagents when the completed phase justifies them:

- `phase-user-flows`: when user, operator, command, integration, or system flows
  span multiple slices.
- `phase-state-data-integrity`: when state, storage, schema, persistence,
  migrations, models, serialization, or data boundaries span slices.
- `phase-security-privacy`: when auth, permissions, ownership, privacy, payments,
  tokens, secrets, PII, destructive behavior, or compliance-sensitive surfaces
  span slices.
- `phase-integration-risk`: when APIs, providers, SDKs, webhooks, queues,
  uploads, media, AI, email, payment, analytics, or external services span
  slices.

Ask each subagent to return:

```md
Lens:
Verdict: pass / issues found / blocked
Findings:
-
Evidence:
-
Suggested Category: Must Fix / Follow-Up / Accepted Risk
```

## Output

Write the phase verification to the current phase's `verification.md`:

```text
strike/initiatives/<initiative-id>/phases/<phase-id>/verification.md
```

Use this shape:

```md
# Phase Verification

## Scope Review

## Slice Status
-

## Cross-Slice Checks
-

## Implementation Discipline Review
Relevant guidance:
Cross-slice concerns:
Result:

## Phase Success Checks
-

## Read-Only Review
- Required subagents:
- Conditional subagents:
- User review lenses:
- Summary:

## Skipped / Residual Risk
-

## Blockers
- None.

## Issues
### Must Fix
- None.

### Follow-Up
- None.

### Accepted Risk
- None.

## Phase Verification Result
Ready: yes / no
Reason:
Fix Needed: yes / no

## Route Back
Needed: yes / no
Command: None / reopen-check / reopen-slice-check
Phase: <phase-id>
Slice: None / <slice-id>
Check: None / phaseSpecCreated / slicesCreated / researchComplete / planCreated / planVerified / implemented / buildVerified
Reason:
```

## Rules

- Verify one phase.
- Categorize findings in `## Issues`. `Must Fix` items prevent readiness from
  passing; `Follow-Up` and `Accepted Risk` do not unless required by the phase
  spec or acceptance criteria.
- Give every `Must Fix` item a stable short issue ID, such as `I1`. Add severity
  when useful, such as `I1 [P1]`.
- Do not mark `Ready: yes` unless every required slice has
  `build-verification.md` with `Verified: yes` and the phase spec is satisfied.
- Do not mark `Ready: yes` when relevant implementation discipline guidance is
  ignored across the completed phase.
- Do not mark `Ready: yes` when a relevant user review lens raises an
  accepted-scope `Must Fix` issue.
- Do not treat deferred work or residual risk as complete unless the phase spec
  explicitly excludes it from the phase.
- Do not edit slice artifacts or implementation files.
- When readiness fails because phase, slice, artifact, implementation, or
  evidence issues can be repaired inside accepted scope, write
  `Fix Needed: yes`.
- Route back only when a real decision, scope change, or untrustworthy earlier
  artifact cannot honestly be repaired by `fix`.
- When `Ready: yes`, write `Fix Needed: no`, `Needed: no`, `Command: None`,
  `Slice: None`, and `Check: None`.
- After writing `Ready: yes`, Strike can run
  `node strike/scripts/state.mjs complete-check allSlicesVerified`.
- Do not start another phase.
- Do not verify the whole main spec.
- Report code-verified rather than browser-verified when browser/user-flow
  verification is blocked.
