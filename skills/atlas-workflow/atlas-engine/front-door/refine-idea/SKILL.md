---
name: refine-idea
description: Turn a vague idea into a clear first useful outcome — separating facts from assumptions, surfacing the decisions to grill. Step 1 of the atlas interactive front door.
allowed-tools: Read Write Edit Grep Glob WebFetch WebSearch
---

# Refine Idea — atlas front door (step 1 of 2)

Turn a vague idea into a clear **first useful outcome**, *interactively, with the user*. This is the
conversational front door to the autonomous **atlas build** — the build cannot ask the user
anything once it starts, so the thinking happens **here**. Your output feeds `grill-idea` (step 2) and
ultimately the build's `args.idea`.

## Stance

- **Brainstorm and clarify — do not decide.** No stack, persistence, auth, scope details, or
  architecture here; those are grill's and the spec's job.
- Expand the fuzz into a crisp framing, then **confirm it with the user**. Propose; don't impose.
- Ask only the few questions that change the outcome, target, or risk. **Lean.**
- **Fresh-context bar:** the refined idea must stand on its own — a fresh reader (and the build's S0)
  must understand it without the chat transcript.
- Prefer the smallest genuinely-useful outcome over a broad feature wish.

## Process

1. Separate **explicit facts** (what the user actually said) from **assumptions** (what you're inferring).
2. Name the **target** — the user / operator / system and the painful moment or opportunity.
3. Propose the **first useful outcome** — the smallest version that is actually useful.
4. Name **constraints** and **first-version non-goals**.
5. Flag **detected surfaces** — money, auth/identity, persistent data, migrations, external services,
   PII, destructive actions. These are what the build treats as high-risk / one-way, so they become
   grill's priority targets. (None is a fine answer.)
6. List **open questions** — the consequential forks for grill to resolve.
7. Surface **research candidates** — the things worth grounding *before* grill: third-party APIs /
   models / SDKs / new dependencies, **and** solved-problem domains the build shouldn't wing (money,
   accounting, commerce, refunds, coupons). Name them as candidates — **do not do the deep research
   here** (that is the research phase's job). Write **None apparent** if nothing material applies.
8. Ask the user the **few clarifying questions that actually change the outcome, target, or risk**
   (use a question UI when available) and **wait** for answers. Never infer from silence, a missing UI,
   or a failed tool.
9. **User checkpoint (before finishing):** briefly summarize the refined outcome and ask whether they're
   ready to move on or want to keep refining. **Wait for a real answer** and record it — existing docs,
   schemas, prior plans, or silence never count as the answer.

## Output

Pick a short kebab-case `<id>` from the idea and confirm it + the framing with the user. Write to
`atlas/initiatives/<id>/refined-idea.md`:

```md
# Refined Idea
## Explicit Facts
## Assumptions
## Target Moment
## First Useful Outcome
## Constraints
## Non-Goals
## Detected Surfaces      (money | auth | data | migrations | external | PII | destructive — or "none")
## Open Questions         (the consequential forks for grill)
## Research Candidates    (Topic / Why it may matter / Suggested source — or "None apparent")
## User Checkpoint        (Prompt / User response / Ready: yes-no)
```

## Handoff

Hand the refined idea to **`grill-idea`**. Do **not** write a spec, choose a stack, or start building.
**Seed `PROJECT_LANGUAGE.md` at the repo root if absent** (header-only: `# Project Language` +
`## Terms` — never placeholder terms); read it before settling durable terms and append any new
stable term. Do **not**
mark the idea ready without the `## User Checkpoint` recorded.
