# Discipline: altitude-stepback

Anti-fixation altitude protocol. An LLM has no cheap reverse gear: once it commits to an
approach it defends that approach, and once a transcript fills with failed attempts it reads
its own pollution as progress. This module installs two mechanisms that supply the reverse gear
mechanically:

1. **ENUMERATE-BEFORE-COMMITTING** — at plan time, branch *before* you narrow.
2. **REASSESS-AGAINST-EXTERNAL-OBJECTIVE** — when the loop says you are stuck, re-anchor to the
   goal that lives *outside* the conversation, not to your summary of the conversation.

**Who decides WHEN.** You do not. The engine owns stop / reassess / escalate triggers
(`DESIGN.md` §1, §7). An agent in sunk-cost mode is the worst judge of whether it is stuck, so it
never gets to self-assess that. This module defines *what enumeration produces* and *what
reassessment does when the loop fires it* — never when to fire.

---

## Mechanism 1 — ENUMERATE-BEFORE-COMMITTING (plan time, in S2)

**When it applies.** Any non-trivial plan: the **FULL lane** (slice `riskTier` CRITICAL, i.e. a
domain surface fired or size ≥ M — see `disciplines/risk-tiering.md`) **OR** any S2 plan that is
not a single obvious edit. **TRIVIAL** slices (XS, non-domain: copy/CSS/config) skip this entirely
— enumerating one-line changes is exactly the ceremony-on-everything failure mode (`DESIGN.md`
§1.8). FAST-lane STANDARD slices enumerate only if more than one credible shape exists.

**What it produces — verbatim in the S2 plan artifact, before any code:**

- **2–3 DISTINCT approaches.** Distinct = different *shape* (different seam, data model, control
  flow, or library), not the same approach with a knob turned. Two variants of one idea count as
  one approach; if you can only name one, say so and state why the space is genuinely singular.
- **One-line tradeoff each** — the axis that actually decides it (blast radius, reversibility,
  reuse of existing conventions, verification cost), not a feature list.
- **The pick + why** — one sentence naming the chosen approach and the deciding axis.

```
Approaches considered:
  A) <shape> — <tradeoff: the deciding axis>
  B) <shape> — <tradeoff>
  C) <shape> — <tradeoff>      (omit if only two are credible)
Chosen: <A|B|C> — <one-sentence why, on the deciding axis>
```

**Reuse, don't restate.** The enumerated approaches must already respect the same-context
disciplines: reuse what `read-before-write` found (real entry points, existing conventions/utils,
`ARCH-DEBT` touching the footprint); apply the `adjective-noun` field-not-table lens to any data
shape; if a surface fired, the canonical approach from `canonical-research` is one of the
approaches (and usually the pick). Do not re-derive those here — name them.

**One-way doors.** If two enumerated approaches are competing *hard-to-reverse* designs, that is a
Tier-3 obstruction: stop enumerating in prose and escalate the decision via
`disciplines/obstruction-loop.md` (ADR + `ARCH-DEBT`, per `disciplines/arch-debt-adr.md`). The ADR
template *is* an enumeration (candidates + tradeoffs + recommendation) — reuse it, don't duplicate
it.

**Gate (consumed by S3 Verify-Plan).** `ENUMERATION` is **PASS** iff the plan artifact contains
≥ 2 distinct approaches (or an explicit singular-space justification), a one-line deciding-axis
tradeoff per approach, and a named pick with reason. Missing or single-non-justified → **FAIL**,
`failedCriterion: "ENUMERATION"`.

---

## Mechanism 2 — REASSESS-AGAINST-EXTERNAL-OBJECTIVE (loop-fired, mid-build)

**Trigger (engine-owned, do not self-invoke).** The engine fires a reassess on the **zero-progress**
signal: a slice's verifier FAILs `maxFixAttempts` times with **no acceptance criterion moving
FAIL → PASS** between attempts (`DESIGN.md` §7, Channel B). That is the one stall signal an agent
cannot dodge by perturbing the target. When you receive a reassess directive, run this protocol
exactly; do not negotiate with the trigger.

### Step A — Re-read the EXTERNAL objective verbatim

The acceptance criteria are an **artifact on disk, outside the conversation** (the slice's recorded
acceptance criteria under `atlas/initiatives/<id>/...`, plus the phase spec). Open the file and
read it as written.

> **Never reassess against the transcript.** The conversation is polluted by every failed attempt;
> summarizing it back to yourself relaunches the fixation. The whole point of an *external* anchor
> is that it has not moved while you thrashed. Read the file, not your memory of the goal.

### Step B — Emit a per-criterion PASS/FAIL table

For **each** acceptance criterion, verdict it against *observable behavior*, not green tests or
"looks correct" (`DESIGN.md` §1.3). Verdict at the honest `R*` rung defined by
`disciplines/honest-verification.md`; use the modality's "real entry point with real data"
definition from `surfaces/_registry.md` (HTTP/UI + screenshot, simulator run, sample-row assertion,
`plan`/dry-run diff, or command invoke + exit code — per the detected pack). Use `CODE-VERIFIED`,
never `PASS`, when behavior verification is blocked.

```
| # | Acceptance criterion (verbatim) | Verdict        | Evidence (entry point + observation) |
|---|---------------------------------|----------------|--------------------------------------|
| 1 | <criterion>                     | PASS           | <real-entry-point run + result>      |
| 2 | <criterion>                     | FAIL           | <what was observed instead>          |
| 3 | <criterion>                     | CODE-VERIFIED  | <why behavior check is blocked>      |
```

### Step C — Emit the "goal requires vs changed so far" diff

Two columns, explicit, no prose self-congratulation:

```
GOAL REQUIRES (from the artifact)   |   CHANGED SO FAR (from changedFiles / the diff)
- <requirement 1>                   |   - <what the diff actually does>
- <requirement 2>                   |   - <gap or divergence>
```

This makes the fixation visible: it surfaces effort spent on things the goal never asked for, and
requirements with zero corresponding change. The diff is against the *diff*, not against the chat.

### Step D — Switch approach OR revert-and-reset (never iterate the failed one)

The failed approach is now disqualified. **Do not** try a *variant* of it — a variant is the same
shape with a knob turned, and the zero-progress signal already proved the shape is wrong. Choose:

- **Switch to a DIFFERENT enumerated approach.** Take the next-best distinct approach from
  Mechanism 1's list (B or C). It must differ in *shape*, not parameters. Record the switch in the
  plan artifact: `Reassess <n>: A disqualified (no criterion moved); switching to <B>.`
- **Revert-and-reset** (when no enumerated alternative survives, or the budget is exhausted —
  `DESIGN.md` §1.10, §7). Revert to last green. Carry forward **exactly one paragraph**: a
  distilled lesson — *what the failed shape was, the specific reason it could not satisfy the named
  FAIL criterion, and what that rules out next.* Nothing else from the polluted transcript crosses
  the reset. If the reassess reveals the spec/phase boundary/shared contract itself is wrong, this
  is upstream: emit a `routeBack` (`DESIGN.md` §6) instead of thrashing locally.

**Gate (the reassess output the engine consumes).** `REASSESS` is **PASS** iff the result carries:
(1) the per-criterion table verdicted against the external artifact at the honest rung, (2) the
requires-vs-changed diff, and (3) exactly one of {a named different enumerated approach, a
revert-and-reset with a one-paragraph lesson, a `routeBack`}. A reassess that proposes a variant of
the failed approach, or verdicts against the transcript, → **FAIL**,
`failedCriterion: "REASSESS"`.

---

## The one-line summary for a fresh context

Branch before you narrow (enumerate distinct approaches + pick). When the *loop* says you are
stuck, re-anchor to the goal on disk — never to the chat — verdict every criterion, diff
requires-vs-changed, and jump to a *different* shape or revert with one lesson. Never the same
shape twice; never your own summary as the truth.
