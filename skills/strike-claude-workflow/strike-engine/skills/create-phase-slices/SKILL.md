---
name: create-phase-slices
description: Split one phase spec into small buildable implementation slices with clear outcomes and acceptance criteria.
argument-hint: "[phase spec/context] [--slice-root path]"
disable-model-invocation: true
allowed-tools: Read Write Edit MultiEdit Grep Glob WebFetch WebSearch
---

# Create Phase Slices

Split one phase spec into small buildable implementation slices.

## Inputs

- phase spec
- optional main spec, development plan, or decisions
- optional context files or repo paths
- optional slice output root

Work on one phase at a time. If the phase spec is missing, stale, too vague, or
inconsistent with the main spec, do not invent scope inside the slice set.
Record the specific phase-spec problem so Strike can route back to the
owning phase step.

## Slice Size

A slice is one small buildable increment that can be planned, built, verified,
and reviewed in one focused loop.

A good slice:

- produces one observable user or system behavior, or reduces a specific
  near-term risk
- has clear acceptance criteria
- leaves the repo in a working state
- is small enough to complete without bundling unrelated outcomes

A vertical slice is one observable behavior path. It is not "frontend work,"
"backend work," or "database setup" by itself.

Good vertical slice examples:

- user can create one listing and see it persisted in the list
- admin can approve one pending request and the requester sees the new status
- customer can enter one discount code and see the corrected total

Usually bad slice shapes:

- set up database tables
- build all backend endpoints
- create the whole UI
- add frontend and backend for payments

A slice may touch UI, API, data, and tests when those pieces must land together
to make one small behavior work. Split it when the pieces are independent or the
behavior can work smaller.

Use this sizing guide:

| Size | Shape |
| --- | --- |
| XS | 1 file; tiny config, function, copy, or style change. |
| S | 1-2 files; one component, endpoint, helper, or adapter. |
| M | 3-5 files; one complete vertical behavior path. |
| L | 5-8 files; challenge and split unless clearly justified. |
| XL | 8+ files; too large for one slice. |

Break or challenge a slice when it has:

- more than 5 likely files
- more than 3 acceptance criteria
- a broad title such as `and`, `full`, `complete`, `MVP`, or
  `setup frontend/backend`
- multiple independent subsystems
- repo setup plus package decisions plus frontend/backend behavior
- UI plus route/API plus state/data plus tests, unless one behavior truly cannot
  work smaller

Do not label a slice `M` while accepting `L/XL` signals. Split it or record why
the larger blast radius is still the smallest safe move.

Non-vertical slices are allowed only when they reduce risk or unlock near-term
vertical behavior. Keep them XS/S unless clearly justified. Explain why a
vertical slice is worse first and name the next vertical slice they unblock.

## Quality Bar

The slice set is ready when each slice can move into research, planning, build,
and verification without re-slicing the phase.

A fresh context should be able to open any `slice.md` and understand:

- outcome and acceptance criteria
- dependency order
- in-scope and out-of-scope boundaries
- likely surfaces and verification intent
- important edge, flow, risk, or working-state notes

One slice is correct when splitting would create fake work.

## Process

- Read the phase spec and relevant context.
- Identify the smallest set of slices that can complete the phase coherently.
- Name each slice by outcome, not task category.
- Use canonical slice IDs: `slice-01`, `slice-02`, `slice-03-b`.
- Order slices so dependencies are satisfied, high-risk assumptions appear
  early, and each slice leaves the app in a working state.
- Put edge/flow notes only where they affect slice boundaries, acceptance,
  risk, or verification. Useful categories include state, permissions, data
  integrity, integrations, UI/device, operations, and recovery.
- Create concise slice stubs when a slice output root is provided.
- Ask one consequential question if the slice split changes scope, risk, or
  delivery order.

Use judgment for normal slice names, order, split/merge boundaries,
dependencies, likely surfaces, and verification shape. Ask only when the phase
cannot be sliced without a new product, technical, workflow, or risk decision.

## Output

If a slice output root is provided, create one directory per slice and write
`slice.md` inside it. Do not create a shared `slices.md`, `index.md`, or
dependency-map file.

If no slice output root is provided, ask the user where they would like to save
the slice stubs.

Use this shape for each slice:

```md
# [slice-01] [Slice Name]

## Size
XS / S / M / L / XL

## Type
Vertical / Non-vertical

## Outcome
One sentence describing the observable behavior that works after this slice.

## Acceptance Criteria
-

## Why This Slice Exists

## Depends On

## In Scope

## Out Of Scope

## Likely Surfaces

## Verification Intent

## Edge / Flow Notes

## Risks / Watchouts
```

## Rules

- Create slices around outcomes.
- Keep slice IDs canonical and put human names in slice titles or display names.
- Keep implementation planning, execution tasks, research notes, build steps,
  and verification evidence out of the slice stub.
- Preserve the phase spec's scope, rules, constraints, and open questions.
- Split or justify any L/XL, batched, or non-vertical slice.
- Add `## Why Not Split` for L slices or broad-stack slices that cannot be made
  smaller.
- Add `## Non-Vertical Justification` only for non-vertical slices.
- Surface if a slice is too broad or too small to build coherently.
- Do not create shared slice indexes, slice maps, implementation plans, build
  files, or implementation files.
