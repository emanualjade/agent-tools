---
name: plan-slice
description: Create a concrete implementation plan for one slice from its slice stub, phase spec, and relevant repo context.
argument-hint: "[slice/context]"
disable-model-invocation: true
allowed-tools: Read Write Edit Grep Glob WebFetch WebSearch
---

# Plan Slice

Create a concrete implementation plan for one slice.

## Inputs

- slice stub or slice context
- slice research from the current slice's `research.md`
- phase spec
- user implementation guidance from
  `strike/user-guidance/implementation-discipline/global.md` and
  `strike/user-guidance/implementation-discipline/plan-slice.md`
- optional main spec, decisions, or repo context

## Process

- Read the slice stub, slice research, and relevant spec context.
- Read `strike/user-guidance/implementation-discipline/global.md` and
  `strike/user-guidance/implementation-discipline/plan-slice.md` if they
  exist.
- If slice research says `Ready for planning: no`, do not plan; surface the
  blocker or unresolved decision.
- Inspect local repo patterns before planning edits, including surrounding code,
  related upstream inputs, downstream consumers, and existing shared utilities
  or helpers that may already cover the need.
- Use the slice research as planning input.
- Apply relevant user implementation guidance to the approach and verification
  plan.
- Preserve the slice outcome, acceptance criteria, dependencies, in-scope work,
  out-of-scope boundaries, and verification intent.
- Do tactical research as needed when planning reveals a detail that affects
  implementation, verification, or risk.
- Name likely files, surfaces, and concern boundaries.
- Use the core noun before qualifiers lens when the plan names domain concepts,
  files, types, routes, or schema shape. If adjective-noun siblings appear, ask
  whether the qualifier belongs as a field, enum, state, permission,
  relationship, ownership, placement, or usage context.
- Identify edge cases, focused test work, verification checks, and rollback or
  recovery notes.
- Before writing the plan, check whether the slice is still small enough for one
  focused build loop. If the likely plan has L/XL signals, multiple independent
  behaviors, too many surfaces, or broad-stack work that can work smaller, do
  not write a bloated plan. Write a split recommendation instead.
- Ask one consequential question if a missing decision changes behavior, risk,
  or implementation shape.
- Point build toward the simplest safe approach. The plan should be specific
  enough to build from, but not a step-by-step coding script.

## Research

The required pre-planning research should already exist in the slice research
file. Use it as the evidence check before planning, not as the plan itself.
In Strike, it lives at:

```text
strike/initiatives/<initiative-id>/phases/<phase-id>/slices/<slice-id>/research.md
```

If you have reason to do more research on your own you should feel free to do that.
If you need to discover the canonical way of doing things and not guessing you should do more research.

Record how the plan uses the existing research in `Research Used`. If research
was marked unnecessary, say why instead of inventing findings. Record only new
planning-time findings in `Implementation Research Additions`, using the same
compact style: source, finding, and why it matters. Do not paste raw notes, long
excerpts, search trails, or link dumps.

## Output

Write the slice plan to the current slice's `plan.md`:

```text
strike/initiatives/<initiative-id>/phases/<phase-id>/slices/<slice-id>/plan.md
```

Use this shape:

```md
# Slice Plan

## Research Used

## Implementation Research Additions

## Repo Context / Impact Scan
Implementation discipline guidance:
Surrounding and related code:
Upstream inputs:
Downstream consumers:
Existing utilities or shared patterns:
New shared code placement:

## Slice Boundary
Outcome:
Acceptance criteria covered:
Depends on:
In scope:
Out of scope:

## Surfaces
-

## Approach

## Edge Cases

## Test Plan
Tests to add/update:
-
Focused commands:
-
Browser/user-flow check:
-
No-test reason:
- None.

## Verification

## Risks / Rollback

## Open Questions

## Split Recommendation
Needed: yes / no
Reason:
Replacement slices:
- None.
```

## Rules

- Create one implementation plan.
- Read and use the slice research artifact when provided.
- Do not plan around unresolved research blockers.
- Keep coding out of the plan.
- Prefer the smallest complete implementation path.
- Do not create new utilities, helpers, adapters, or shared modules without
  first checking whether the repo already has the needed home or behavior.
- If the slice must modify existing shared code, name likely callers or
  downstream consumers and how the build should protect them.
- If `Split Recommendation` says `Needed: yes`, do not present the plan as
  build-ready. Name the replacement slices clearly enough that Strike can
  edit the current slice into the first smaller slice, create any extra slice
  stubs, and register them with `add-slice`.
- Use existing repo conventions before inventing new structure.
- Keep the plan specific enough that another agent can build from it without
  guessing.
- Prefer stable repo paths, commands, constraints, and current evidence over
  restating earlier artifacts.
- If the plan cannot name likely surfaces, verification checks, important edge
  cases, and unresolved assumptions, tighten it before calling it build-ready.
- Do not default to a full test suite. Name focused tests and commands for the
  changed surface. Use a full suite only when it is cheap, repo-standard for the
  touched surface, or specifically justified by the risk.
