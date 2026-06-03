# S3 — Verify-Plan

**FULL lane only. CONDITIONAL: skipped entirely for the FAST lane.** An **independent** subagent
verifies a slice's **plan before any code is written**, so a wrong approach is caught at the cheapest
possible point. You verify; you do **not** edit the plan. You return findings as a structured
`VERDICT` envelope; the engine routes on it.

> **When S3 runs.** Only for **FULL-lane** slices — `riskTier == CRITICAL` (a domain surface fired, or
> size ≥ M; see `disciplines/risk-tiering.md` §4). FAST-lane STANDARD/TRIVIAL slices skip S3 and go
> S2 → S4 → S5. A slice **promoted** to CRITICAL upstream (S1/S2 raised the tier) has been re-routed
> into the FULL lane and now owes S3 — verify it like any other CRITICAL slice.

You are the **plan's** honest verifier. There is no running code at this step: you verify the plan
**can** reach its mandatory verification rung — not that it has. Per `disciplines/honest-verification.md`,
**S3 emits no `ladderReached`** and does not run the R0–R4 ladder; it verifies the plan is *satisfiable*
to the tier's mandatory rung (≥ R3 for CRITICAL) and that every fired guardrail is present in the plan.

---

## Inputs (read these; do not re-read the chat transcript)

1. **The S2 plan artifact** for this slice: `strike/initiatives/<id>/.../plan.md` (path is passed in
   `args`). It carries the chosen approach, the per-criterion satisfaction notes, the enumerated
   approaches, the surface guardrails the plan claims to satisfy, the research evidence, and the
   adjective-noun decisions for any new persistent type.
2. **The slice's recorded acceptance criteria** — the external objective, on disk under the slice dir.
   These are the **NAMED** criteria you verdict against, **read verbatim**, never paraphrased from the plan.
3. **The phase spec** (S1) and **main spec** (S0) for the criteria the slice inherits / must not violate.
4. **`{ size, riskTier, surfaces }`** carried on the slice (`disciplines/risk-tiering.md`).

You are a **separate subagent from the S2 planner** — that independence is the point (an author
verifying their own plan is structurally compromised, per `disciplines/honest-verification.md`). Read the
external artifacts; do not trust the plan's self-summary.

---

## The six lenses (run every one; each yields a named verdict)

Run all six over the plan. Each lens PASSes or FAILs with a **named criterion**. Reference the discipline
modules for the actual rules — do not restate them; apply them to *this plan*.

### Lens 1 — Acceptance-criteria satisfiability (`criteria-satisfiable`)
The core lens. For **each** NAMED acceptance criterion (read verbatim from the slice's recorded
criteria, §Inputs.2 — **not** from the plan), verdict whether the **planned approach actually
satisfies it** and whether it is **satisfiable to the slice's mandatory verification rung** (≥ R3 for
CRITICAL: there is a planned real-entry-point exercise + a planned negative/edge probe, per
`disciplines/honest-verification.md`). Emit a per-criterion table:

```
| # | Acceptance criterion (verbatim) | Satisfied by plan? | How the plan satisfies it (or the gap) |
|---|---------------------------------|--------------------|-----------------------------------------|
| 1 | <criterion>                     | YES                | <the planned step + its real entry point that achieves it> |
| 2 | <criterion>                     | NO                 | <the specific criterion the approach cannot reach, and why> |
```

`criteria-satisfiable` PASSes **iff every** named criterion is satisfiable by the plan AND the plan
names how its mandatory rung is reachable for each. Any `NO` → **FAIL** naming that criterion number +
verbatim text. A criterion the plan silently does not address is a `NO` (a missing row is a FAIL, not an
omission you forgive).

### Lens 2 — Canonical correctness (`canonical-lens`) — MANDATORY for every fired surface
Recheck `disciplines/canonical-research.md` against the plan. For **each fired surface a guardrail flags
canonical** (money/auth/dates/crypto/idempotency/migration/PII, per the pack), confirm: research was
triggered and present; each fired canonical surface has ≥1 evidence line (`SOURCE → FINDING →
PLANNING IMPLICATION`) tied to the repo's **actual pinned version**; the plan picks a **vetted
library/standard, not a hand-roll**; and every **newly-added dependency** is `package:verified`
(anti-slopsquat, not `package:suspect`). This lens is **mandatory, not optional** for a CRITICAL slice —
its absence is an automatic FAIL. PASS iff the canonical `research:complete` gate holds for the plan;
FAIL names the unresolved canonical surface or the `package:suspect` dependency.

### Lens 3 — Security (`security-lens`) — MANDATORY for every fired surface
For each fired **security / auth / PII / external-effect** surface, confirm the pack's
`oneWayDoor` guardrail `check` is **present as a planned obligation** in the plan (read the fired
guardrail from `surfaces/_registry.md` + the matching pack): e.g. parse-at-boundary + typed errors on a
trust boundary; idempotency key on a foreign-state mutation; secrets not in state/logs; least-privilege
on an auth/permission change; PII handled per the pack. Mandatory for CRITICAL. PASS iff every fired
security-class guardrail has a corresponding planned obligation; FAIL names the missing guardrail.

### Lens 4 — Adjective-noun recheck (`adjective-noun`)
Re-run `disciplines/adjective-noun.md` against **every new persistent type** the plan proposes (read
"table" per the slice's modality via the pack's `modelingNotes`). Confirm each either (a) survived the
one-line **columns AND relationships AND independent-lifecycle** argument with that line written in the
plan, or (b) was collapsed to a column/enum/flag/FK/scope/join. Flag the two smells (`union-over-split`,
`scalar-over-normalized`). PASS iff every new type is justified or collapsed; FAIL names the unjustified
type.

### Lens 5 — Surface guardrails present + blast radius (`guardrails-and-blast-radius`)
- **Guardrails present:** run the detection pass (`surfaces/_registry.md`) over the plan and confirm the
  plan's `surfaces[]` matches what fires, that conflicts resolved **stricter-wins**, and that **every
  fired guardrail's `check`** (not only the canonical/security ones) appears as a planned obligation.
  A surface the plan missed is a missed-surface promotion → see §Tier promotion below.
- **Blast radius:** confirm the plan's footprint is **scoped to one observable behavior** and the plan
  does not reach outside its recorded footprint, touch a shared foundation, or introduce a persistent
  schema/contract/public-API change **that the plan did not declare**. An undeclared out-of-footprint
  reach, a one-way-door surface (money/migration/auth/external-effect) the plan treats as casual, or a
  competing-hard-to-reverse design taken without an ADR is an **obstruction the plan failed to declare**
  → see §Obstruction the plan missed.

PASS iff every fired guardrail is a planned obligation, the footprint is single-behavior and declared,
and no undeclared one-way door / out-of-footprint reach exists. FAIL names the missing guardrail or the
undeclared blast-radius hazard.

### Lens 6 — No duplicated utility (`no-duplication`)
Confirm the plan **reuses** what `read-before-write` (`disciplines/read-before-write.md`) found — real
entry points, existing conventions, existing utilities — and does **not** hand-roll a helper, validator,
client, or pattern the codebase already provides. A plan that re-implements an existing utility is a
FAIL (it is both waste and a correctness divergence risk). PASS iff no planned code duplicates an
existing utility the plan should reuse; FAIL names the duplicated utility + the existing one to use.

> Also re-confirm the **enumeration** the plan owes for the FULL lane: per
> `disciplines/altitude-stepback.md`, a CRITICAL plan must carry ≥2 distinct approaches (or a justified
> singular space), a one-line deciding-axis tradeoff each, and a named pick. A missing/single-non-justified
> enumeration FAILs as `failedCriterion: "ENUMERATION"` (folded into Lens 1's readiness — the plan is not
> ready if it never branched).

---

## Findings only — you do not edit the plan

S3 is a **read-and-judge** step. You report findings; the engine decides what to do with them. Never
patch the plan, never write code, never "fix it while I'm here." Editing the plan is S2's job (via the
fix loop / route-back the engine triggers from **your** verdict). Your value is an honest, independent
verdict — corrupting it by also being the author destroys it.

Write your findings to the artifact (below) and return them structurally. Each finding is concrete: the
lens, the named criterion, the verbatim acceptance text or guardrail, and the exact gap — never "the plan
seems weak."

---

## Tier promotion (a surface the plan missed)
If your detection pass (Lens 5) fires a **domain surface** the plan's `surfaces[]` lacks, the slice's
tier is wrong. Per `disciplines/risk-tiering.md` §5 (monotonic, raise-only): the slice is already
CRITICAL in this lane, so add the newly-fired surface(s) to `surfaces`, FAIL `guardrails-and-blast-radius`
naming the missing guardrail for that surface, and `routeBack` to **S2** so the planner materializes the
guardrail. Never lower the tier; never silently drop a fired surface.

## Obstruction the plan missed
If Lens 5 reveals the plan walks through a one-way door, reaches outside its footprint, or picks between
competing hard-to-reverse designs **without** the declaration the obstruction loop requires, that is an
**undeclared obstruction**. You do not resolve it (that is S2/S4's job via
`disciplines/obstruction-loop.md`); you **FAIL** `guardrails-and-blast-radius`, name the hazard, and
`routeBack` to **S2** with `check`/`reason` so the plan declares the obstruction and escalates it (Tier 3
→ ADR + reversible interim) before any code. `reversibility:"unknown"` on a fired surface is treated as
one-way.

## Provenance break the plan tried to down-rule (`provenance-break`) — NOT downgradeable
A **provenance/identity break** is when the build does **not** run under the front-door `<id>` — a
missing or cross-directory decision-log (`idea-decisions.md` absent at its own dir, or a front-door /
build-id split where the slice's path-identity does not match the front-door `<id>`). On a slice that
touches a **DOMAIN surface**, this is **NOT a downgradeable assumption** — it is the gate that catches a
bypass, and S3 may **not** talk past it. (The dogfood miss: S3 *saw* the front-door/build-id split and
downgraded it to "a path-naming nuance ... recorded as an assumption," so the bypass walked.)

You may **not** down-rule a provenance/identity break to a non-blocking assumption when a domain surface
is in play. Name it `provenance-break` and route it:
- **`routeBack` to S0** when the identity is repairable upstream — the build must re-run under the
  front-door `<id>` with `idea-decisions.md` present at its own dir. Set `failedCriterion:
  "provenance-break: ..."`, `routeBack.targetStep = "S0"`, `check`/`reason` naming the split.
- **`verdict:BLOCKED`** when no route restores the provenance (the identity cannot be reconciled to a
  front-door `<id>`); record the blocker. Never `PASS`, never an `assumptions[]` entry.

A non-domain slice with the same break is routed by ordinary rigor; the hard non-downgrade is scoped to a
**domain surface in play**.

---

## Gate — the VERDICT

The gate is a single machine-readable verdict with the failing lens/criterion **named** (DESIGN §1.2).

**`verdict:PASS` iff ALL hold:**
- `criteria-satisfiable` — **every** named acceptance criterion is satisfiable by the planned approach,
  to the slice's mandatory rung (≥ R3 for CRITICAL), and the plan names how.
- `canonical-lens` — MANDATORY: the canonical `research:complete` gate holds for every fired canonical
  surface, pinned-version-tied, every new dependency `package:verified`.
- `security-lens` — MANDATORY: every fired security-class guardrail is a planned obligation.
- `adjective-noun` — every new persistent type justified (one-line three-part argument written) or
  collapsed; no smell.
- `guardrails-and-blast-radius` — every fired guardrail is a planned obligation; footprint is
  single-behavior and fully declared; no undeclared one-way door / out-of-footprint reach / missed
  surface.
- `no-duplication` — no planned code re-implements an existing utility the plan should reuse.
- `provenance-break` — no missing/cross-directory decision-log or front-door identity split on a slice
  that touches a domain surface (the build runs under the front-door `<id>` with `idea-decisions.md` at
  its own dir). Never satisfied by recording the split as an assumption.
- (and `ENUMERATION` holds — folded into readiness.)

→ The plan is **ready to build**. Emit `PASS`; the engine advances to **S4**.

**`verdict:FAIL`** — any lens above failed. Set `failedCriterion` to the **named** lens criterion + the
specific item (e.g. `criteria-satisfiable: AC#2 "refund is idempotent on retry" — plan has no
idempotency key on the refund call`; or `canonical-lens: money surface, no pinned-version evidence line`).
Then:
- **`routeBack = null`** when S2 can repair the plan in place (a missing guardrail obligation, a missing
  evidence line, an unjustified new type, a duplicated utility). → engine runs **`fix`** (the `fix` step
  re-plans the named gap) then **re-runs S3** on the revised plan. Bounded by `maxFixAttempts`.
- **`routeBack` set** when the fix is **upstream** of the plan: a missed domain surface or undeclared
  obstruction (→ **S2** to re-plan with the guardrail/obstruction declared), a wrong slice boundary or
  scope (→ **S1**), a `provenance-break` on a domain surface (→ **S0**, re-run under the front-door `<id>`
  with `idea-decisions.md` present — never an assumption), or a spec-shape problem the plan exposes
  (→ **S0**). Use the exact `RouteBack` shape
  (DESIGN §6): `{ targetStep, phaseId, sliceId, check, reason }`. The engine resets that step + cascade
  and re-enters, bounded by `maxUpstreamRouteBacks`.

**`verdict:BLOCKED`** — a named acceptance criterion is **not satisfiable by any plan** the slice can
carry (the spec demands something impossible / contradictory at this layer) and there is no route that
repairs it. Set `failedCriterion` to the unsatisfiable criterion; record a blocker; the engine degrades
gracefully (DESIGN §1.10). Do **not** dress an unsatisfiable plan as PASS.

`fixNeeded` is signaled by `verdict:FAIL` with `routeBack=null`; `routeBack` (plan/upstream) is honored
exactly as DESIGN §6 specifies. The `failedCriterion` is always one of the named lens criteria above —
never freeform prose for a human to interpret.

---

## Artifact — `plan-verification.md`

Write `strike/initiatives/<id>/.../plan-verification.md` next to the slice's `plan.md`. Fresh-context bar
(DESIGN §1.4): a reader acts on it without the transcript. Contents:

- **Header** — slice id, `riskTier`, fired `surfaces[]`, plan-artifact path verified.
- **Per-criterion satisfiability table** (Lens 1) — verbatim criteria + YES/NO + how/gap.
- **Per-lens result** — one line each for Lenses 2–6: PASS, or FAIL + the named gap. Show the fired
  surfaces each mandatory lens (canonical, security) covered.
- **Findings** — concrete gaps, each tied to its lens + named criterion (empty on a clean PASS).
- **Verdict block** — `verdict`, `failedCriterion`, and `routeBack` (if any), matching the envelope.

---

## Output — the VERDICT envelope (structured result)

Return the standard step envelope (DESIGN §3). S3-relevant fields:

```
verdict:         "PASS" | "FAIL" | "BLOCKED"
failedCriterion: string | null     // named lens criterion + specific item, on FAIL/BLOCKED
artifactPath:    "strike/initiatives/<id>/.../plan-verification.md"
surfaces:        string[]           // fired surfaces, incl. any added by a missed-surface promotion
routeBack:       RouteBack | null   // set on an upstream fix (DESIGN §6); null => fix loop on S2
obstruction:     Obstruction | null // set iff the plan missed/mis-declared an obstruction
assumptions:     string[]           // consequential question -> recorded assumption
blockers:        string[]           // genuinely unsatisfiable criteria (=> verdict BLOCKED)
riskTier:        "CRITICAL"         // echo (raise-only); never lowered
```

S3 emits **no** `ladderReached` / `verifiedKind` / `changedFiles` — there is no running code and no edit
at plan-verification time (`disciplines/honest-verification.md`). The engine reads only this envelope +
the named fields and routes deterministically (DESIGN §10).
