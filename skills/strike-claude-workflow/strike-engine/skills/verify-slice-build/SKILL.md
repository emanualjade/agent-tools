---
name: verify-slice-build
description: Verify one slice build against its acceptance criteria, checks, risks, and evidence, then record build verification.
argument-hint: "[slice/build context]"
disable-model-invocation: true
allowed-tools: Read Write Edit MultiEdit Bash Grep Glob WebFetch WebSearch Agent
---

# Verify Slice Build

Verify one slice build and record build verification.

## Inputs

- slice from the current slice's `slice.md`
- slice research from the current slice's `research.md`
- slice plan from the current slice's `plan.md`
- plan verification from the current slice's `plan-verification.md`
- build evidence from the current slice's `build.md`
- phase spec from the current phase's `phase-spec.md`
- user implementation guidance from
  `strike/user-guidance/implementation-discipline/global.md` and
  `strike/user-guidance/implementation-discipline/verify-slice-build.md`
- user review lenses from `strike/user-guidance/review-lenses/global.md`
  and `strike/user-guidance/review-lenses/verify-slice-build.md`
- optional changed files or repo paths

## Process

- Read the canonical slice, research, plan, plan verification, build evidence,
  and phase spec before verifying.
- Read `strike/user-guidance/implementation-discipline/global.md` and
  `strike/user-guidance/implementation-discipline/verify-slice-build.md`
  if they exist.
- Read `strike/user-guidance/review-lenses/global.md` and
  `strike/user-guidance/review-lenses/verify-slice-build.md` if they
  exist.
- Do not verify unless `plan-verification.md` says `Ready: yes` and `build.md`
  says `Built: yes`.
- Compare the built work against slice acceptance criteria.
- Confirm planned tests were added, updated, or credibly skipped.
- Run or inspect the focused checks named by the plan, build evidence, and
  changed surfaces.
- Do not default to a full test suite. Use focused commands unless the plan,
  repo convention, or risk justifies a broader run.
- Review important edge cases, state, data, UI, integration, and permission risks
  that apply to this slice.
- Record skipped checks, replacement evidence, and residual risk.
- If `build.md` says `Built: no`, do not verify. Follow its `## Route Back`
  guidance.
- If verification reveals a product, permission, data, security, or
  hard-to-reverse architecture decision, record it as `Must Fix` or route back
  only when `fix` cannot honestly repair the issue inside accepted scope.

## Review

Use read-only review subagents when the build is meaningful.

If the host does not support subagents, run the named review lenses inline as
separate read-only passes and record them as inline lenses. Do not skip baseline
lenses just because a host lacks subagent tooling.

Each subagent returns findings only. It does not edit files, fix issues, update
state, or decide whether the build passes. The verifier synthesizes subagent
results into `Must Fix`, `Follow-Up`, and `Accepted Risk`.

Read user review lenses from `strike/user-guidance/review-lenses/global.md`
and `strike/user-guidance/review-lenses/verify-slice-build.md`. Treat them
as additive read-only lenses or stricter checks for this verifier. They cannot
disable built-in Strike lenses or verification gates. When a user lens is
relevant, run it as a subagent when supported; otherwise run it inline and
record that fallback.

Run these baseline subagents:

- `canonical-implementation`: checks that implementation does not guess on
  accounting, money, auth, security, third-party APIs, framework behavior,
  package behavior, or solved domain problems. Use official docs, current repo
  versions, and local precedent when needed.
- `code-quality`: checks structure, naming, maintainability, blast radius,
  duplication, dependency choices, tests, environment variables, secrets,
  logging, and placement. Use these as lenses: clear homes for UI, API/actions,
  data access, business rules, adapters, parsing/formatting, validation, tests,
  and scripts; purpose names instead of vague buckets like `helpers`, `utils`,
  `misc`, or `common`; core noun before qualifiers for files, types, routes,
  and schema concepts; small modules without hidden side effects or scattered
  duplicate logic; compliance with relevant implementation-discipline guidance;
  evidence that new utilities, helpers, adapters, or shared modules
  use the repo's established home; evidence that changed shared utilities were
  checked against likely callers and downstream consumers; extra scrutiny for
  shared code, schemas, auth, payments, uploads, migrations, jobs, and
  integrations; isolated adapters for replaceable or risky vendor code;
  centralized and documented env access; no hardcoded secrets or
  environment-specific URLs; input validation at
  boundaries; explicit errors; guarded destructive or external side effects;
  useful debug evidence without leaking sensitive data; and relevant loading,
  empty, success, failure, recovery, accessibility, and responsive states.
- `functionality`: checks that accepted behavior works end to end and that
  obvious regressions or broken run paths are visible.
- `spec-coverage`: checks the build against the slice, phase spec, main spec,
  acceptance criteria, non-goals, and accepted scope.
- `edge-cases`: checks important invalid, missing, duplicate, empty, stale,
  partial, race, retry, rollback, destructive, and recovery cases.

Add these subagents when the changed files or risk justify them:

- `ui-regression`: when UI, HTML, CSS, component, or frontend behavior changed.
- `user-flows`: when a user, operator, command, or system workflow changed.
- `state-data-integrity`: when state, storage, schema, persistence, migrations,
  models, serialization, or data boundaries changed.
- `security-privacy`: when auth, permissions, ownership, privacy, payments,
  tokens, secrets, PII, destructive behavior, or compliance-sensitive surfaces
  changed.
- `integration-risk`: when APIs, providers, SDKs, webhooks, queues, uploads,
  media, AI, email, payment, analytics, or external services changed.
- `accessibility`: when UI risk is meaningful or browser evidence is available.

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

Record the review result in the verification output.

## Browser / User-Flow Checks

For UI or user-facing work, run an actual browser or user-flow check after the
slice build.

Use the repo-approved browser path when one exists. If the repo does not name a
path, discover available host browser tools or Playwright CLI and use the best
available safe option.

Code review, static checks, curl, and DOM inspection are useful replacement
evidence, but they are not browser verification.

If browser verification is blocked by host policy, missing tools, environment,
auth, server startup, permissions, or user instruction, record:

- what browser/user-flow check should have run
- what blocked it
- replacement evidence checked
- residual user-facing risk

Do not call UI work browser-verified without an actual browser or user-flow
check. Report code-verified rather than browser-verified when browser
verification is blocked.

When browser or user-flow verification is required for accepted UI scope and it
is blocked, mark verification as not passing unless replacement evidence is
strong enough and the residual user-facing risk is explicitly listed under
`Accepted Risk`.

## Output

Write the slice build verification to the current slice's
`build-verification.md`:

```text
strike/initiatives/<initiative-id>/phases/<phase-id>/slices/<slice-id>/build-verification.md
```

Use this shape:

```md
# Slice Build Verification

## Acceptance Review

## Checks
-

## Tests
- Planned:
- Added or updated:
- Focused commands:
- Not run / skipped:
- Result:

## Review

## Read-Only Review
- Required subagents:
- Optional subagents:
- User review lenses:
- Summary:

## Skipped / Residual Risk
-

## Issues
### Must Fix
- None.

### Follow-Up
- None.

### Accepted Risk
- None.

## Build Verification Result
Verified: yes / no
Reason:
Fix Needed: yes / no

Remaining Risk:
- None.

## Route Back
Needed: yes / no
Command: None / reopen-check
Phase: None / <phase-id>
Slice: None / <slice-id>
Check: None / researchComplete / planCreated / planVerified / implemented
Reason:
```

## Rules

- Verify one slice build.
- Categorize findings in `## Issues`. `Must Fix` items prevent verification
  from passing; `Follow-Up` and `Accepted Risk` do not unless required by the
  slice, phase spec, or acceptance criteria.
- Give every `Must Fix` item a stable short issue ID, such as `I1`. Add severity
  when useful, such as `I1 [P1]`.
- Do not edit implementation files; write issues for `fix` when the build needs
  changes.
- Do not mark `Verified: yes` when `build.md` says `Built: no`.
- Do not mark `Verified: yes` when a relevant user review lens raises an
  accepted-scope `Must Fix` issue.
- When verification fails because the implementation, tests, evidence, or local
  artifacts can be repaired inside accepted scope, write `Fix Needed: yes`.
- Route back only when the accepted plan, research, or scope is untrustworthy
  enough that `fix` cannot honestly repair the issue.
- When `Verified: yes`, write `Fix Needed: no`, `Needed: no`,
  `Command: None`, `Phase: None`, `Slice: None`, and `Check: None`.
- After writing `Verified: yes`, Strike can run
  `node strike/scripts/state.mjs complete-check buildVerified`.
- Do not start another slice.
- Do not verify the whole phase.
- Report code-verified rather than browser-verified when browser/user-flow
  verification is blocked.
