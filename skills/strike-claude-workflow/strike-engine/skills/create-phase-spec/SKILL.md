---
name: create-phase-spec
description: Create one detailed phase spec from a phase stub, main spec, development plan, and relevant context.
argument-hint: "[phase context] [--output path]"
disable-model-invocation: true
allowed-tools: Read Write Edit Grep Glob WebFetch WebSearch
---

# Create Phase Spec

Create one detailed phase spec that defines the phase clearly enough to be split
into implementation slices.

## Inputs

- phase stub or phase context
- main spec
- development plan
- optional decisions, constraints, or repo context
- optional output path

## Process

- Preserve the phase purpose, boundary, dependencies, and completion target.
- Compare the provided phase context and development plan against the main spec.
- Pull only the main spec details that matter for this phase.
- Make the phase independently understandable after a context reset.
- Clarify scope, non-goals, flows, product rules, UX expectations, states,
  lifecycle, invariants, security, privacy, permissions, data integrity,
  constraints, and success checks when relevant.
- Name likely surfaces, blast radius, and watchouts only when they clarify later
  slicing. Do not invent architecture.
- Record phase-specific research needs or weak evidence without turning the
  spec into a research transcript.
- Surface if the phase boundary is wrong: too broad, too small, stale,
  horizontal, or inconsistent with the main spec or development plan.
- Ask one consequential question if the phase cannot be specified without
  changing scope, behavior, or risk.
- Do focused research only when it can change the phase spec.

## Quality Bar

The phase spec is ready when `create-phase-slices` can split this one phase into
small vertical slices without rediscovering the main spec or guessing about
phase intent, boundaries, rules, risks, or verification.

Complete does not mean long. Include only phase-specific information.

Use plain boundaries:

- In scope
- Out of scope, with why
- Needs user decision
- Never do

Split success checks into repo-verifiable checks and live/human checks. If a
check belongs to the whole initiative rather than this phase, say so or leave it
out.

## Language

Read `PROJECT_LANGUAGE.md` before settling durable terms for this phase.

Update it when this work clarifies a stable term, accepted alias, conflict, or
meaningful ambiguity.

Alert the user when a language change affects model shape, lifecycle,
ownership, permissions, privacy, destructive behavior, or user-facing promises.

Prefer the core noun before qualifiers. If sibling terms appear, ask whether the
qualifier belongs as a field, enum, state, permission, relationship,
configuration, placement, ownership, or usage context.

## Output

If an output path is provided, write the phase spec there.

If no output path is provided, ask the user where they would like to save it.

Use this shape:

```md
# Phase Spec

Phase ID:

## Source Inputs

## Summary

## Outcome

## Dependencies

## Completion Target

## Users / Systems Served

## Scope
### In
### Out
### Needs User Decision
### Never

## Flows

## UX Expectations

## Product Rules

## Domain Language

## State, Lifecycle, And Invariants

## Security, Privacy, Permissions, And Data Integrity

## Technical Constraints

## Likely Surfaces / Blast Radius

## Success Checks
### Repo-Verifiable
### Live / Human

## Risks And Assumptions

## Research / Watchouts

## Open Questions
### Blocking
### Later Detail Choices

## Phase Boundary Check
Too broad / small / stale / horizontal:
Reason:

## Slice Handoff
```

## Rules

- Create one phase spec.
- Keep the phase boundary clear.
- Preserve relevant main spec decisions and constraints.
- Surface if the phase is too broad or too small to specify coherently.
- Do not create slices, slice acceptance criteria, slice plans, implementation
  tasks, or implementation files.
- Before finishing, reread the phase spec as if the chat transcript is gone. If
  slice creation would have to rediscover this phase, update the spec first.
