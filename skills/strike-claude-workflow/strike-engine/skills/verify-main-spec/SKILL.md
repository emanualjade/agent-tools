---
name: verify-main-spec
description: Verify the completed Strike main spec as the final workflow gate.
argument-hint: "[main spec completion context]"
disable-model-invocation: true
allowed-tools: Read Write Edit MultiEdit Bash Grep Glob WebFetch WebSearch Agent
---

# Verify Main Spec

Verify the completed initiative against the main spec and record final evidence.

## Inputs

- main spec from the current initiative's `main-spec.md`
- development plan from the current initiative's `development-plan.md`
- each phase's `phase.md`
- each phase's `phase-spec.md`
- each phase's `verification.md`
- user implementation guidance from
  `strike/user-guidance/implementation-discipline/global.md` and
  `strike/user-guidance/implementation-discipline/verify-main-spec.md`
- user review lenses from `strike/user-guidance/review-lenses/global.md`
  and `strike/user-guidance/review-lenses/verify-main-spec.md`
- optional slice artifacts when phase evidence needs inspection
- optional decisions, changed files, checks, or repo context

## Process

- Read the current initiative files from
  `strike/initiatives/<initiative-id>/`.
- Read every phase artifact under
  `strike/initiatives/<initiative-id>/phases/<phase-id>/`.
- Read `strike/user-guidance/implementation-discipline/global.md` and
  `strike/user-guidance/implementation-discipline/verify-main-spec.md` if
  they exist.
- Read `strike/user-guidance/review-lenses/global.md` and
  `strike/user-guidance/review-lenses/verify-main-spec.md` if they exist.
- Confirm every required phase has `verification.md` with `Ready: yes`.
- Compare completed phase evidence against the main spec.
- Confirm accepted scope is complete or explicitly excluded by the main spec.
- Check cross-phase flows, dependencies, integrations, state, data, UI,
  permissions, and operational risks.
- Check whether completed phases collectively follow relevant implementation
  discipline guidance, especially around shared utilities, duplicated patterns,
  and upstream/downstream impact that spans phases.
- Inspect slice artifacts or changed files when phase evidence is too thin.
- Run or inspect final checks when needed.
- Record skipped checks, replacement evidence, residual risks, and blockers.
- Do not edit phase, slice, or implementation artifacts; write issues for
  `fix`, or route back only when `fix` cannot honestly repair the problem.

## Browser / User-Flow Checks

For a UI or user-facing initiative, run one final browser or user-flow check
across the accepted scope before final verification passes.

For UI work, include at least one visual screenshot check after representative
data exists. Inspect the screenshot for:

- page is visibly loaded and styled, not blank or raw unstyled HTML
- primary workflow area is visible without obvious layout collapse
- text, controls, tables, cards, headings, and important values do not overlap
  or clip
- important values and results are readable and visually connected to the right
  labels
- visible empty, error, or success states do not cover or break the main UI
- no obvious horizontal overflow, cut-off controls, hidden primary actions, or
  unusable scrolling

Use the repo-approved browser path when one exists. If the repo does not name a
path, discover available host browser tools or Playwright CLI and use the best
available safe option.

Code review, static checks, curl, and DOM inspection are useful replacement
evidence, but they are not browser verification.

If browser verification is blocked, record what final browser/user-flow check
should have run, what blocked it, replacement evidence, and residual
user-facing risk.

Do not call final UI/user-flow work browser-verified without an actual browser
or user-flow check. Report code-verified rather than browser-verified when
browser verification is blocked.

When browser or user-flow verification is required for accepted initiative scope
and it is blocked, mark final verification as not ready unless replacement
evidence is strong enough and the residual user-facing risk is explicitly listed
under `Accepted Risk`.

## Review

Use read-only review subagents to verify the completed initiative as assembled
work. Do not rerun full phase or slice audits unless earlier evidence is thin,
contradictory, skipped, or risky.

If the host does not support subagents, run the named review lenses inline as
separate read-only passes and record them as inline lenses. Do not skip required
lenses just because a host lacks subagent tooling.
Each subagent returns findings only. It does not edit files, fix issues, update
state, or decide whether the initiative is ready. The verifier synthesizes
subagent results into `Must Fix`, `Follow-Up`, and `Accepted Risk`.

Read user review lenses from `strike/user-guidance/review-lenses/global.md`
and `strike/user-guidance/review-lenses/verify-main-spec.md`. Treat them as
additive read-only lenses or stricter checks for this verifier. They cannot
disable built-in Strike lenses or final readiness gates. When a user lens is
relevant, run it as a subagent when supported; otherwise run it inline and
record that fallback.

Always run these subagents:

- `main-spec-coverage`: checks whether completed phases satisfy the main spec,
  accepted scope, non-goals, and final success criteria.
- `cross-phase-integration`: checks whether phases compose into one coherent
  feature without missing handoffs, duplicated assumptions, broken sequencing,
  or gaps between phase outputs.
- `readiness-risk`: checks final evidence, skipped checks, residual risks,
  blockers, and whether accepted-scope defects are being hidden as follow-up.

Add these subagents when the completed initiative justifies them:

- `final-user-flows`: when user, operator, command, integration, or system flows
  span phases.
- `final-state-data-integrity`: when state, storage, schema, persistence,
  migrations, models, serialization, or data boundaries span phases.
- `final-security-privacy`: when auth, permissions, ownership, privacy,
  payments, tokens, secrets, PII, destructive behavior, or
  compliance-sensitive surfaces span phases.
- `final-integration-risk`: when APIs, providers, SDKs, webhooks, queues,
  uploads, media, AI, email, payment, analytics, or external services span
  phases.

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

Write final verification to the current initiative's `verification.md`:

```text
strike/initiatives/<initiative-id>/verification.md
```

Use this shape:

```md
# Main Spec Verification

## Scope Review

## Phase Status
-

## Cross-Phase Checks
-

## Implementation Discipline Review
Relevant guidance:
Cross-phase concerns:
Result:

## Final Checks
-

## Visual Screenshot Check
Passed: yes / no / blocked
Screenshot:
Viewport:
Findings:
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

## Final Verification Result
Ready: yes / no
Reason:
Fix Needed: yes / no

## Route Back
Needed: yes / no
Command: None / reopen-check / reopen-phase-check / reopen-slice-check
Phase: None / <phase-id>
Slice: None / <slice-id>
Check: None / ideaRefined / decisionsResolved / specCreated / phasesCreated / phaseSpecCreated / slicesCreated / researchComplete / planCreated / planVerified / implemented / buildVerified / allSlicesVerified
Reason:

## Final Receipt
Shipped:
-

Run / Use:
-

Next:
-
```

## Rules

- Verify the main spec as the final workflow gate.
- Categorize findings in `## Issues`. `Must Fix` items prevent final readiness
  from passing; `Follow-Up` and `Accepted Risk` do not unless required by the
  main spec or accepted scope.
- Give every `Must Fix` item a stable short issue ID, such as `I1`. Add severity
  when useful, such as `I1 [P1]`.
- Do not mark `Ready: yes` unless every required phase has
  `verification.md` with `Ready: yes` and the main spec is satisfied.
- Do not mark `Ready: yes` when relevant implementation discipline guidance is
  ignored across the completed initiative.
- Do not mark `Ready: yes` when a relevant user review lens raises an
  accepted-scope `Must Fix` issue.
- Do not treat deferred work or residual risk as complete unless the main spec
  explicitly excludes it from the accepted scope.
- Do not edit phase, slice, or implementation artifacts.
- When readiness fails because initiative, phase, slice, artifact,
  implementation, or evidence issues can be repaired inside accepted scope,
  write `Fix Needed: yes`.
- Route back only when a real decision, scope change, or untrustworthy earlier
  artifact cannot honestly be repaired by `fix`.
- When `Ready: yes`, write `Fix Needed: no`, `Needed: no`, `Command: None`,
  `Phase: None`, `Slice: None`, and `Check: None`.
- After writing `Ready: yes`, Strike can run
  `node strike/scripts/state.mjs complete-check allPhasesVerified`.
- Do not hide accepted-scope defects in follow-up work.
- Report code-verified rather than browser-verified when browser/user-flow
  verification is blocked.
