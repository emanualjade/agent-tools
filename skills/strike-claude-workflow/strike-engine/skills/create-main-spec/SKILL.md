---
name: create-main-spec
description: Create a durable main spec from a provided idea, decisions, assumptions, constraints, and context.
argument-hint: "[idea/context] [--output path]"
disable-model-invocation: true
allowed-tools: Read Write Edit Grep Glob WebFetch WebSearch
---

# Create Main Spec

Create a durable main spec from the provided idea, decisions, and context.

## Inputs

- idea, brief, or refined idea
- decisions, assumptions, constraints, or open questions
- optional context files or repo paths
- optional output path

## Process

- Pull current truth from the provided idea, decisions, accepted assumptions,
  rejected paths, context, and research.
- Preserve accepted decisions and do not revive rejected options.
- Turn vague scope into explicit scope, non-goals, and ask-first boundaries.
- Capture product behavior, domain language, flows, state, constraints,
  security/privacy/permissions/data integrity, and success checks when relevant.
- Absorb research as spec-useful implications, not a research transcript. Do
  not overstate weak evidence or unknowns.
- Ask one consequential question if a missing answer changes scope, behavior,
  model shape, risk, or validation.
- End this skill at the main spec. Do not create a development plan, phases, slices,
  implementation tasks, or build instructions.

## Quality Bar

The spec is ready when a fresh context window can understand the feature or MVP
and create development phases without re-interviewing the user about intent,
scope, rules, success, or first-build meaning.

Complete does not mean long. Include only sections that carry project-specific
information.

Use plain boundaries:

- In scope
- Out of scope, with why
- Needs user decision
- Never do

Split success checks into repo-verifiable checks and live/human checks. Do not
invent metrics just to look rigorous.

Name engineering pressure points without over-designing architecture. Mention
business rules, state transitions, permissions, integrations, data consistency,
or risky shared surfaces only when they affect later planning.

## Language

Read `PROJECT_LANGUAGE.md` before settling durable terms.

Update it when this work clarifies a stable term, accepted alias, conflict, or
meaningful ambiguity.

Alert the user when a language change affects model shape, lifecycle,
ownership, permissions, privacy, destructive behavior, or user-facing promises.

Prefer the core noun before qualifiers. If sibling terms appear, ask whether the
qualifier belongs as a field, enum, state, permission, relationship,
configuration, placement, ownership, or usage context.

## Output

If an output path is provided, write the main spec there.

If no output path is provided, ask the user where they would like to save it.

Use this shape:

```md
# Main Spec

## Source Inputs

## Summary

## Outcome

## Users / Systems Served

## What We Are Building

## Flows

## UX Expectations

## Scope
### In
### Out
### Needs User Decision
### Never

## Product Rules

## Domain Language

## State, Lifecycle, And Invariants

## Security, Privacy, Permissions, And Data Integrity

## Constraints

## Engineering Pressure Points

## Success Checks
### Repo-Verifiable
### Live / Human

## Risks And Assumptions

## Open Questions
### Blocking
### Later Detail Choices

## Development Handoff
```

## Rules

- Create one main spec.
- Ground the spec in the provided idea, decisions, assumptions, constraints, and
  context.
- Ask one consequential question if a missing answer changes scope, behavior, or
  risk.
- Keep the spec durable enough to be useful outside the current chat.
- Do not create development phases, phase specs, slices, slice plans, or
  implementation files.
- Before finishing, reread the spec as if the chat transcript is gone. If a
  planner would have to rediscover the project, update the spec first.
