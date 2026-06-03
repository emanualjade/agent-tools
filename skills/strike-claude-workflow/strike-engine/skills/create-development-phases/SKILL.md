---
name: create-development-phases
description: Create a development plan that breaks a main spec into coherent buildable phases.
argument-hint: "[main spec/context] [--output path] [--phase-root path]"
disable-model-invocation: true
allowed-tools: Read Write Edit MultiEdit Grep Glob WebFetch WebSearch
---

# Create Development Phases

Create a development plan that breaks a main spec into coherent buildable
phases.

## Inputs

- main spec
- optional decisions, constraints, or context files
- optional output path for the development plan
- optional phase output root for phase stubs

## Phase Size

A phase is one coherent buildable capability area. It is larger than a single
implementation slice and smaller than a broad subsystem.

A good phase is usually vertical: it leaves something observable, reviewable, or
verifiable, such as a user path, system capability, working integration, or
meaningful risk retired.

A good phase has:

- one clear user or system outcome
- a completion target
- enough scope to split into slices
- boundaries that keep unrelated capabilities out

Split a phase when it contains multiple independent outcomes, roles, workflows,
risk areas, release targets, fuzzy acceptance, or more work than one focused
build/review loop should own.

Merge or demote a phase when it is only a tiny implementation change. One phase
is correct when splitting would create fake work.

Avoid horizontal phases like "schema first," "API first," or "UI later." A
foundation phase is allowed only when it reduces risk, unlocks later behavior,
creates a stable contract, or makes the next phase easier to verify.

## Process

- Read the main spec and relevant context.
- Identify the smallest ordered phase list that can deliver the spec
  coherently.
- Name each phase by outcome, not implementation activity.
- Use canonical phase IDs: `phase-01`, `phase-02`, `phase-03-b`.
- Capture why the phases are separate and why they are ordered that way.
- Order early phases to prove the most important uncertainty or unlock the next
  useful behavior.
- Mention likely surfaces or watchouts only when they clarify phase scope,
  risk, research needs, or verification shape.
- Create concise phase stubs when a phase output root is provided.
- Ask one consequential question if the phase split changes scope, risk, or
  delivery order.

Use judgment for normal phase names, order, split/merge boundaries, likely
surfaces, and verification shape. Ask only when the spec cannot be phased
without a new project decision.

## Output

If an output path is provided, write the development plan there. The
development plan is the human-readable phase breakdown and rationale.

If no output path is provided, ask the user where they would like to save it.

Use this shape:

```md
# Development Plan

## Phase Strategy

## Phase Map
| Phase | Outcome | Depends On | Readiness Target | Why Separate |
| --- | --- | --- | --- | --- |

## Phase Details
### [phase-01] [Phase Name]
  Outcome:
  Depends On:
  Completion Target:
  Likely Surfaces:
  Watchouts:
  Phase-Spec Focus:

## Boundaries

## Risks / Dependencies

## Open Questions
```

When a phase output root is provided, create one phase stub per phase:

```md
# [Phase Name]

Phase ID:

## Outcome

## Depends On

## Readiness Target

## Boundaries

## Phase-Spec Focus
```

## Rules

- Create phases around outcomes.
- Keep phase IDs canonical and put human names in phase titles or display names.
- Keep phase count as small as the spec allows.
- Preserve the main spec's scope, rules, constraints, and open questions.
- Do not create phase specs, slice files, slice acceptance criteria,
  implementation tasks, or implementation files.
- Before finishing, reread the development plan as if the chat transcript is
  gone. The first phase should be ready for phase-spec creation without
  re-slicing the initiative.
