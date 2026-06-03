# Step S2 — Plan (per slice)

**Turn one slice into a build-ready PLAN.** You are a fresh-context subagent. Your only inputs are:
this file, the disciplines it names, the surfaces registry, and the slice/phase context handed to you
(`{ slice: { id, behavior, acceptanceCriteria, footprint, size, riskTier, surfaces }, phaseId,
initiativeId, phaseSpecPath }`). You write **one artifact** — `plan.md` for this slice — and return a
structured envelope. The engine routes on what you return; it interprets nothing.

A plan is "build-ready" when a *different* fresh-context agent can build the slice from `plan.md`
alone — without re-reading this chat — and a verifier can check the result against named criteria. If
that bar isn't met, you are not done.

This step runs on **both lanes**. FAST-lane slices skip S3 (Verify-Plan), so on the FAST lane your
plan is the *only* gate before build — hold it to the full bar. The engine decides whether the FAST
lane proceeds straight to S4; you simply produce a ready plan.

---

## The sequence (run in this order — each step feeds the next)

### 1. Ground the codebase — `read-before-write` (FIRST action, before any plan prose)

Run `disciplines/read-before-write.md` against the slice's behavior + footprint **before you write a
single line of plan.** It is targeted reconnaissance (grep/glob/read-specific-files aimed at the four
questions), never a full-repo read. It emits the four-part grounding note —
`WHAT EXISTS / REUSE THESE / DO NOT DUPLICATE / INVARIANTS / ARCH-DEBT` — which you inline into
`plan.md`. Its `grounded` gate must pass before you proceed; everything below builds on it.

This note is load-bearing for three later steps: it supplies the **real entry point** the verifier
will exercise, the **reuse list** that kills duplication, and any **`ARCH-DEBT` + ADR** the prior
slice left on this footprint (read the linked ADR — it sets the reversible interim and the one-way
door you must not re-open).

### 2. Re-detect surfaces — run the registry pass against the now-concrete footprint

The slice arrived with a birth tier from S1. Now that you have the grounding note and a concrete
footprint, **re-run the surfaces-registry detection pass** (`surfaces/_registry.md`): run every pack,
union the fired surface flags, resolve guardrail conflicts **stricter-wins**, and write the result to
`surfaces`. This is `detection:complete` (registry §6).

**You may RAISE the tier, never lower it** (`disciplines/risk-tiering.md` §5). If you detect a domain
surface S1 missed, or the size grew to ≥ M: **promote to CRITICAL**, add the new surface(s) to
`surfaces`, and emit the updated `riskTier`/`surfaces` so the engine re-routes the slice into the
FULL lane (it now owes S3 + the ≥ R3 ladder + canonical/security lenses). A late-detected surface is
the safety net working, not a failure — record it and proceed.

Every fired guardrail's `check` becomes a **planned obligation** in `plan.md` (registry §4).

### 3. Canonical research — fold `canonical-research` INLINE, only if a surface fired

Apply `disciplines/canonical-research.md`. Its trigger gate decides whether research runs:

- **No §1 trigger fired** → emit the single `noResearchReason` line and move on. The one-line skip is
  a first-class outcome, not a confession. Do not pad it.
- **A trigger fired** (a surface whose guardrail flags a canonical concern — money/auth/crypto/dates/
  payments/idempotency/migration/PII —, a third-party API/SDK, a newly-added dependency, or anything
  the repo has no existing precedent for) → research is **MANDATORY for any CRITICAL/domain slice**.
  Fold the evidence **inline into `plan.md`** as `SOURCE → FINDING → PLANNING IMPLICATION` lines, one
  per fired surface + one per added dependency, each pinned to the repo's **actual** version (§3) and
  each added dep carrying its `package:verified | package:suspect` verdict (§4).

A `package:suspect` dep, or a fired CRITICAL/domain surface left unresolved, must surface in your
output as a **blocker or recorded assumption** — never buried. Its `research:complete` gate must pass.

### 4. Enumerate approaches — `altitude-stepback` Mechanism 1 (FULL lane / any non-trivial plan)

Apply `disciplines/altitude-stepback.md` Mechanism 1 **before committing to a shape**:

- **FULL lane (CRITICAL), or any plan that is not a single obvious edit** → enumerate **2–3 distinct
  approaches** (distinct = different *shape*: seam, data model, control flow, or library — not a knob
  turned), a **one-line deciding-axis tradeoff** each, and a **named pick + why**, verbatim in
  `plan.md`. The canonical approach from step 3 (if a surface fired) is one of the approaches and
  usually the pick. Reuse what grounding found; don't re-derive it.
- **FAST-lane STANDARD** → enumerate only if more than one credible shape exists.
- **TRIVIAL** (XS, non-domain: copy/CSS/config) → **skip entirely.** Enumerating one-line changes is
  the ceremony-on-everything failure mode (DESIGN §1.8).

If two enumerated approaches are competing *hard-to-reverse* designs, that is a Tier-3 obstruction →
go to step 7 (escalate the decision via `obstruction-loop`), don't keep enumerating in prose.

### 5. Model new types — `adjective-noun` on every new persistent type

For **each** new persistent type the plan proposes, run `disciplines/adjective-noun.md` (read "table"
as your modality's persistent-type concept — see its Modality mapping + the matching pack's
`modelingNotes`). Apply the ordered ladder: an adjective on a noun is a state/enum/flag/scope/FK on
the **existing** entity until the one-line *columns AND relationships AND independent lifecycle*
argument is made and **written next to the `CREATE`**. Watch the two auto-FAIL smells
(`union-over-split`, `scalar-over-normalized`). Its `adjective-noun` gate must pass: every new type
either survived the written argument or was collapsed to a column.

### 6. Check reuse — no duplication (close the loop on grounding)

Cross-check the plan against the grounding note's `REUSE THESE` / `DO NOT DUPLICATE` lines: every
helper, validator, client, and existing **validation/auth/error/idempotency layer** the behavior must
route through is **named in the plan as "reuse `path`"**, not slated to be re-written. If the plan
re-implements something grounding found, replace it with the existing thing. State explicitly that
reuse was checked (and, if you are genuinely writing something new, that grounding confirmed no
existing equivalent after a real search).

**`follow-the-house-pattern` — reinventing a sibling is a NAMED FAIL, not a soft "prefer reuse"**
(`no_substitution`: a hand-rolled reimplementation of something that already exists one verb away is
a substitution, not a build). When grounding's `SIBLING:` line (read-before-write §5) names an
existing equivalent capability, the plan MUST do exactly one of:
- **(a) reuse or extend the sibling** — route the new behavior through that capability's existing
  path / house pattern; or
- **(b) carry a written one-line distinct-requirement argument** for why the sibling's pattern
  *genuinely* does not fit (a real divergence in contract/lifecycle/shape — not "I'd rather write it
  fresh"), recorded verbatim on the `SIBLING PATTERN:` line below.

Inventing a parallel new way when a sibling exists **with no such argument** is
`reuse-checked:FAIL follow-the-house-pattern`. Write the verdict line into `plan.md`:

`SIBLING PATTERN: follow <path> | divergence justified: <one-line argument>`

(When grounding's `SIBLING:` line is a justified `none after capability search of <verbs/nouns>`,
write `SIBLING PATTERN: none — no sibling after capability search of <verbs/nouns greped>`.)

### 7. If the architecture fights → `obstruction-loop`

If the plan can only proceed by editing outside the slice's footprint, touching a shared foundation,
introducing a new persistent schema/contract/public API not in scope, or choosing between competing
hard-to-reverse designs → run `disciplines/obstruction-loop.md` and return a structured `Obstruction`.
Do **not** quietly widen the slice. Route by blast-radius × reversibility (the module owns the tree;
do not restate it):

- **Tier 2** (reversible new seam, provable two-way door) → **split**: insert a thin, demoable
  enabling slice behind the facade, prepend it, and return via this step's split path
  (`splitNeeded: true` + `replacementSlices[]`, `obstruction.tier = 2`). Build the current slice
  against the seam.
- **Tier 3** (one-way door / `unknown` / competing-hard-to-reverse / **upstream decision wrong**) →
  escalate the *decision*: write the ≤1-page ADR + drop the `ARCH-DEBT(<slice-id>)` marker
  (`disciplines/arch-debt-adr.md`), plan on the `reversibleInterim`, and — iff the cause is upstream
  (spec shape S0 / phase boundary or slice scope S1) — emit a `routeBack` to the owning step. Money,
  migrations, auth, and external-effects are one-way **by rule**.

### 8. If the slice is too broad → SPLIT

A slice must be **one observable behavior, no "and," app left runnable** (DESIGN §1.6). If grounding
or enumeration reveals the slice is really several behaviors (an XL that can't be one behavior, or a
hidden second behavior), **split it**: **write a well-formed `slice.md` stub for EACH replacement
slice** (under its `slices/<id>/` dir) — `id, behavior, acceptanceCriteria, footprint, size` — **before
returning** `splitNeeded: true` + `replacementSlices[]`. The engine has no filesystem access: it carries
the updated in-memory slice list as the source of truth within the run and re-enters (DESIGN §6), so the
next S2 can read the stub you wrote. A split counts against `maxSplitsPerPhase`. Tier-2 obstruction
enabling-splits use this same path — write the enabling slice's stub before returning, too.

---

## The artifact — `plan.md`

Write to the slice's plan path under `atlas/initiatives/<initiativeId>/.../<sliceId>/plan.md`. It is
build-ready iff a fresh-context builder needs nothing else. Required sections:

```
# Plan: <slice-id> — <behavior (one line, no "and")>

## Grounding note   (from read-before-write — inline, not a separate file)
WHAT EXISTS:       <real entry point(s) — path:symbol>
REUSE THESE:       <helper/util/validation/auth/error/idempotency layer — path -> what it gives>
DO NOT DUPLICATE:  <thing that already exists — path>   (or "none after targeted search")
INVARIANTS:        <implicit rule the change must preserve — one line each>
ARCH-DEBT:         <marker touching footprint + ADR link, summarized>   (or "none")

## Surfaces & tier
surfaces: [<fired flags>]   riskTier: <TRIVIAL|STANDARD|CRITICAL>   lane: <FAST|FULL>
promoted: <yes (from <oldTier>: <which surface fired late>) | no>
Guardrail obligations (per fired guardrail's `check`): <one planned obligation each>

## Canonical evidence   (inline; one line per fired surface + per added dependency)
<SOURCE → FINDING → PLANNING IMPLICATION>      ← if a surface fired
package: <name@version> verified|suspect       ← per added dependency
— or —
No research needed — <one clause why>           ← if no trigger fired

## Approaches   (FULL lane / non-trivial; omit only for TRIVIAL or a justified singular space)
A) <shape> — <deciding-axis tradeoff>
B) <shape> — <tradeoff>
C) <shape> — <tradeoff>            (omit if only two are credible)
Chosen: <A|B|C> — <one-sentence why, on the deciding axis>

## New persistent types   (adjective-noun verdict per type; omit if none)
<type> → column on <noun> (collapsed)  —  or  —  NEW: <one-line columns AND relationships AND lifecycle argument>

## Build plan
- Files to touch: <path — what changes>   (the recorded footprint; widening it is an obstruction)
- Reuse (no duplication): <path — used for what>   [reuse-checked: yes]
- SIBLING PATTERN: follow <path> | divergence justified: <one-line argument>   (or "none — no sibling after capability search of <verbs/nouns greped>")
- Edge cases to handle: <each named: empty/null, boundary, duplicate/retry, error path, scope/tenant…>
- Boundary: <what is IN this slice vs explicitly OUT/stubbed — the app stays runnable>
- Focused tests to add: <each maps to an acceptance criterion; non-tautological; real entry point>
```

Keep every line a fact a builder can act on. No prose padding. Omit a section only where the rubric
above says it's legitimately empty (and say "none" rather than leaving it blank from skipping a step).

---

## Gate — `plan:ready`

Emit `verdict` with the failing criterion **named**. `plan:ready` is **PASS** iff **ALL** hold:

1. **`grounded`** — `read-before-write` passed (entry point located + confirmed, reuse surveyed,
   invariants captured, `ARCH-DEBT` checked, targeted) and its note is inlined.
2. **`detection:complete`** — all packs run over the concrete footprint, surfaces unioned,
   conflicts stricter-wins, `surfaces` written; `riskTier` is `rubric-consistent` and **monotonic**
   (raised, never lowered); a promoted slice is re-routed to FULL.
3. **`research:complete`** — every fired canonical trigger has ≥1 inline evidence line with a
   planning implication pinned to the repo's actual version; every added dependency is
   `package:verified`; a CRITICAL/domain canonical question is answered by a vetted library/standard,
   **not** a hand-roll. If no trigger fired, the single `noResearchReason` line is present. (A
   justified, named skip on a non-firing surface is allowed; a buried unresolved fired surface is a
   FAIL.)
4. **`ENUMERATION`** — for FULL/non-trivial plans, `plan.md` carries ≥ 2 distinct approaches (or an
   explicit singular-space justification), a deciding-axis tradeoff each, and a named pick + reason.
   (Auto-satisfied for legitimately-TRIVIAL slices, which skip it.)
5. **`adjective-noun`** — every new persistent type survived the written one-line three-part argument
   or was collapsed to a column/enum/flag/FK/scope/join; neither smell is live.
6. **`reuse-checked`** — the plan names the existing helpers/layers to reuse for every reuse
   opportunity grounding found, and re-implements none of them. Sub-criterion
   **`follow-the-house-pattern`**: when grounding's `SIBLING:` line names an existing equivalent
   capability, the `SIBLING PATTERN:` line either (a) follows it (reuse/extend) or (b) carries a
   written one-line distinct-requirement argument for why the sibling's pattern genuinely does not
   fit. Inventing a parallel new way when a sibling exists with **no** such argument is a hard
   `reuse-checked:FAIL follow-the-house-pattern` — it **blocks `readyToBuild`/`readyToVerify`**,
   carries **`routeBack: null`**, and is repaired by **re-planning the slice onto the sibling**
   (not by a new return field).
7. **`plan-complete`** — `plan.md` names files, surfaces, edge cases, focused tests (each tied to an
   acceptance criterion via a real entry point), the boundary (IN vs OUT, app runnable), and the
   chosen approach — the fresh-context-builder bar (DESIGN §1.4).

FAIL names the unmet criterion (e.g. `plan:ready:FAIL research:complete — money surface unresolved`,
or `plan:ready:FAIL reuse-checked follow-the-house-pattern — sibling <path> reinvented, no divergence
argument`). A FAIL with no `routeBack` is repaired by **fix** then re-running S2 (bounded) — for
`follow-the-house-pattern` the fix is re-planning onto the sibling. An **obstruction** (step 7) or
**split** (step 8) is **not** a FAIL of this gate — it is a first-class structured outcome the engine
acts on (see Output).

---

## Output (envelope + step-specific fields)

Return the shared envelope (DESIGN §3) plus this step's fields:

```
verdict:           "PASS" | "FAIL" | "BLOCKED"
failedCriterion:   string | null          // named on FAIL/BLOCKED (the gate criterion above)
artifactPath:      "atlas/initiatives/<id>/.../<sliceId>/plan.md"
assumptions:       string[]               // consequential question → recorded assumption (hands-off)
blockers:          string[]               // genuinely unrepairable (e.g. a package:suspect with no vetted alternative)
surfaces:          string[]               // re-detected; the (possibly raised) union
obstruction:       Obstruction | null     // section 7 — Tier 1/2/3 per obstruction-loop
routeBack:         RouteBack  | null      // set iff a Tier-3 cause is upstream (S0/S1)

// step-specific:
riskTier:          "TRIVIAL" | "STANDARD" | "CRITICAL"   // possibly promoted
readyToVerify:     boolean    // FULL lane: plan is ready for S3 Verify-Plan
readyToBuild:      boolean    // FAST lane: plan is the only gate; ready to proceed to S4
splitNeeded:       boolean    // slice too broad, or a Tier-2 enabling-slice split
replacementSlices: Slice[]    // present iff splitNeeded; write each one's slice.md stub BEFORE returning (engine has no fs access; in-memory list is source of truth within the run)
```

Set exactly the lane's readiness flag on PASS: **FAST lane** → `readyToBuild: true`; **FULL lane**
(CRITICAL, including a slice you just promoted) → `readyToVerify: true`. On `splitNeeded`, leave both
readiness flags false and return `replacementSlices`. On an upstream Tier-3, set `routeBack`. S2 ends
at a ready plan — the engine, not you, decides what runs next.
