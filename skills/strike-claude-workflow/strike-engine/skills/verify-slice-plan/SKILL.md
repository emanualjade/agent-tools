---
name: verify-slice-plan
description: Verify one slice plan is clear, scoped, researched, and ready to build.
argument-hint: "[slice plan/context]"
disable-model-invocation: true
allowed-tools: Read Write Edit MultiEdit Bash Grep Glob WebFetch WebSearch Agent
---

# Verify Slice Plan

Verify one slice plan is ready to build.

## Inputs

- slice stub or slice context
- slice research from the current slice's `research.md`
- slice plan from the current slice's `plan.md`
- phase spec from the current phase's `phase-spec.md`
- user implementation guidance from
  `strike/user-guidance/implementation-discipline/global.md` and
  `strike/user-guidance/implementation-discipline/verify-slice-plan.md`
- user review lenses from `strike/user-guidance/review-lenses/global.md`
  and `strike/user-guidance/review-lenses/verify-slice-plan.md`
- optional repo paths

## Process

- Compare the plan against the slice outcome and acceptance criteria.
- Read the slice from
  `strike/initiatives/<initiative-id>/phases/<phase-id>/slices/<slice-id>/slice.md`.
- Read slice research from
  `strike/initiatives/<initiative-id>/phases/<phase-id>/slices/<slice-id>/research.md`.
- Read the slice plan from
  `strike/initiatives/<initiative-id>/phases/<phase-id>/slices/<slice-id>/plan.md`.
- Read the phase spec from
  `strike/initiatives/<initiative-id>/phases/<phase-id>/phase-spec.md`.
- Read `strike/user-guidance/implementation-discipline/global.md` and
  `strike/user-guidance/implementation-discipline/verify-slice-plan.md` if
  they exist.
- Read `strike/user-guidance/review-lenses/global.md` and
  `strike/user-guidance/review-lenses/verify-slice-plan.md` if they exist.
- Check that slice research is present and either contains useful evidence or
  gives a credible reason research was unnecessary.
- Check that research says `Ready for planning: yes`.
- Check that the plan uses the slice research, narrows it, or explains why a
  finding does not apply.
- Check that planning-time research additions are source-backed when present.
- Check that the plan's `Slice Boundary` preserves the slice outcome,
  acceptance criteria, dependencies, in-scope work, out-of-scope boundaries,
  and verification intent.
- Check that likely files, surfaces, sequencing, edge cases, and verification
  are specific enough to build from.
- Check that `Repo Context / Impact Scan` shows enough surrounding-code,
  upstream, downstream, and shared-utility awareness for the slice's risk.
- Check that the plan applies relevant implementation discipline guidance.
- Check that new utilities, helpers, adapters, or shared modules have a
  repo-pattern-based home, and that modifications to existing shared utilities
  account for likely callers or downstream consumers.
- Check planned names, files, types, routes, and schema concepts with the core
  noun before qualifiers lens. Do not fail separate concepts just for being
  separate, but flag adjective-noun siblings when a field, enum, state,
  permission, relationship, ownership, placement, or usage context may be the
  better model.
- Check that the plan has a concrete `Test Plan`: tests to add/update, focused
  commands to run, browser/user-flow check when relevant, or a credible
  no-test reason.
- Do not accept a vague test plan or a default full-suite command without a
  repo-specific or risk-based reason.
- Check the research `Slice Size Check`. If it says `Too broad: yes`, the plan
  is not ready until the slice is split or the finding is resolved.
- Check that the slice and plan are small enough for one focused build loop. A
  plan with L/XL signals, multiple independent behaviors, too many surfaces, or
  broad-stack work that can work smaller is not ready.
- Confirm the plan follows local repo patterns where they are knowable.
- Review risky state, data, UI, integration, permission, and rollback concerns
  that apply to the slice.
- If the plan needs a product, permission, data, security, or hard-to-reverse
  architecture decision, record it as `Must Fix` or route back only when `fix`
  cannot honestly repair the plan inside accepted scope.

## Review

Use read-only review subagents.

If the host does not support subagents, run the named review lenses inline as
separate read-only passes and record them as inline lenses. Do not skip required
lenses just because a host lacks subagent tooling.
Each subagent returns findings only. It does not edit files, fix issues, update
state, build the slice, or decide whether the plan is ready. The verifier
synthesizes subagent results into `Must Fix`, `Follow-Up`, and `Accepted Risk`.

Read user review lenses from `strike/user-guidance/review-lenses/global.md`
and `strike/user-guidance/review-lenses/verify-slice-plan.md`. Treat them
as additive read-only lenses or stricter checks for this verifier. They cannot
disable built-in Strike lenses or readiness gates. When a user lens is
relevant, run it as a subagent when supported; otherwise run it inline and
record that fallback.

Always run this subagent:

- `implementation-plan`: checks slice size, verticality, sequencing, exact
  files/surfaces, research usage, implementation discipline guidance, local
  repo precedent, surrounding and related code, upstream/downstream impact,
  shared utility placement, edge cases, focused test plan, verification plan,
  rollback or recovery notes, and whether the plan can be built without
  guessing.

Always consider `canonical-implementation`, and run it when the plan touches
third-party APIs, packages, framework-specific behavior, accounting, money,
billing, auth, security, privacy, permissions, compliance-sensitive flows, or
domain rules with known standards.

`canonical-implementation` checks whether the plan is using the normal, proven
way to solve this kind of problem. For accounting, billing, payments, auth,
security, privacy, and other solved or risky domains, do not let the plan invent
a bespoke approach unless there is a clear reason.

Useful questions for `canonical-implementation`:

- What do the official docs say?
- Is there an industry-standard pattern?
- Is this a solved problem we should not reinvent?
- For payments, billing, or accounting, what would Stripe, Shopify, Amazon, or
  a serious commerce system do?
- For auth, security, or privacy, what would a mature production app avoid
  doing?
- Does the local repo already have a pattern?
- Are the known edge cases named before coding starts?

Add these subagents when the planned work justifies them:

- `state-data-integrity`: when the plan touches state, storage, schema,
  persistence, migrations, models, serialization, or data boundaries.
- `security-privacy`: when the plan touches auth, permissions, ownership,
  privacy, secrets, PII, destructive behavior, payments, or
  compliance-sensitive surfaces.
- `integration-risk`: when the plan touches APIs, providers, SDKs, webhooks,
  queues, uploads, media, AI, email, payment, analytics, or external services.
- `ui-regression`: when the plan touches UI structure, styling, components,
  layout, responsive behavior, or browser-visible states.
- `user-flows`: when the plan changes a user, operator, command, integration,
  or system workflow.
- `accessibility`: when the plan touches meaningful UI interaction, forms,
  keyboard/focus behavior, or user-facing recovery paths.

Record why a conditional subagent was skipped when its absence could be
ambiguous.

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

Write the slice plan verification to the current slice's
`plan-verification.md`:

```text
strike/initiatives/<initiative-id>/phases/<phase-id>/slices/<slice-id>/plan-verification.md
```

Use this shape:

```md
# Slice Plan Verification

## Research Gate

## Plan Review

## Read-Only Review
- Required subagents:
- Conditional subagents:
- User review lenses:
- Skipped subagents:
- Summary:

## Remaining Questions
- None.

## Issues
### Must Fix
- None.

### Follow-Up
- None.

### Accepted Risk
- None.

## Build Readiness
Ready: yes / no
Reason:
Fix Needed: yes / no

## Route Back
Needed: yes / no
Command: None / reopen-check
Phase: None / <phase-id>
Slice: None / <slice-id>
Check: None / researchComplete / planCreated
Reason:
```

## Rules

- Verify one slice plan.
- Categorize findings in `## Issues`. `Must Fix` items prevent readiness from
  passing; `Follow-Up` and `Accepted Risk` do not unless required by the slice,
  phase spec, or acceptance criteria.
- Give every `Must Fix` item a stable short issue ID, such as `I1`. Add severity
  when useful, such as `I1 [P1]`.
- Do not mark `Ready: yes` when required slice research is missing,
  placeholder-only, or contradicted without evidence.
- Do not mark `Ready: yes` when slice research says `Ready for planning: no`.
- Do not mark `Ready: yes` when research says `Too broad: yes`.
- Do not mark `Ready: yes` when relevant implementation discipline guidance is
  ignored or the plan would scatter duplicate utilities/shared code.
- Do not mark `Ready: yes` when a relevant user review lens raises an
  accepted-scope `Must Fix` issue.
- Do not mark `Ready: yes` when the slice should be split before build. Write
  the split finding in `Must Fix`, set `Fix Needed: no`, and route back to
  `researchComplete` so Strike can edit the current slice into the first
  smaller slice, add any extra slices, and rerun research and planning.
- When readiness fails because the plan, research, or related artifact can be
  repaired inside accepted scope, write `Fix Needed: yes`.
- Route back only when a real decision, scope change, or untrustworthy upstream
  artifact cannot honestly be repaired by `fix`.
- Do not edit `plan.md`; write issues for `fix` when the plan needs changes.
- When `Ready: yes`, write `Fix Needed: no`, `Needed: no`, `Command: None`,
  `Phase: None`, `Slice: None`, and `Check: None`.
- After writing `Ready: yes`, Strike can run
  `node strike/scripts/state.mjs complete-check planVerified`.
- Do not build the slice.
- Do not verify the slice build.
- Keep the plan small enough for one focused build loop.
