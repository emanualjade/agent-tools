# Discipline: Obstruction Loop

**The spine.** When the architecture fights a planned change — during S2 (plan) or S4 (build) — this
protocol decides *what to do about it* by **blast-radius × reversibility**, with no architectural
taste required and no agent self-judgment of "am I stuck."

The loop owns the triggers; the agent only **reports facts**. The agent never decides whether to keep
hammering — detection and the bounded retries fire from the engine. An agent in sunk-cost mode is the
worst judge of whether it is stuck.

---

## 1. Detection — two channels, engine-corroborated

An obstruction is recognized through one of two channels. Both are corroborated by the engine against
ground truth; neither is "the agent feels blocked."

### Channel A — Declared (structured `Obstruction`, corroborated against the diff)

You (S2 or S4) **MUST** return an `Obstruction` object the moment the only path forward requires any of:

1. **Editing outside the slice's recorded footprint** — files the slice's plan did not list.
2. **Touching a shared foundation** — a module/util/contract consumed by code outside this slice.
3. **A new persistent schema / contract / public API not in the plan** — a migration, a new table or
   column, a wire/event/topic schema, a new or changed public endpoint or exported signature.
4. **A choice between competing hard-to-reverse designs** — two paths, each costly to undo.
5. **A required PREREQUISITE is missing/broken/unavailable, OR a process-managed system must be changed
   outside its tool** — an env var/secret, an external dependency/service, a tool/integration, required
   seed/fixture data, a migration that will not apply cleanly; OR the only path forward hand-applies
   DDL/SQL, edits applied/generated migrations, hand-edits a lockfile, or edits codegen output instead
   of the canonical command. **Surface the fact** — the named prereq/mechanism + the actual error —
   engine-corroborable. An unavailable prereq **substituted to get green** (test DB for dev DB, fake key,
   mock endpoint, hand-rolled reimplementation) is the **no-silent-workaround** failure
   (`disciplines/honest-verification.md` `no_substitution`); the only autonomous-safe responses are
   **fix-it-real** or **BLOCK-and-name-it**.

These are **surface facts** — concrete paths, schema verbs (`ADD COLUMN`, `DROP`, `RENAME`), exported
symbols, a named missing prereq + its error — not opinions. The engine **corroborates** them against
`changedFiles` / the diff: a declared
"in-footprint refactor" whose diff reaches outside the footprint is re-classified upward by the engine,
not taken on trust. Declaring honestly is mandatory; hiding an out-of-footprint edit inside a
"small fix" is the failure this channel exists to catch.

### Channel B — Mechanical (zero-progress across agent calls)

The engine — not you — fires **revert-and-reset** when a slice's verifier returns `FAIL`
`maxFixAttempts` times **with no acceptance criterion moving `FAIL`→`PASS` between attempts**. That is
the *zero-progress* signal: an agent cannot dodge it by perturbing the target, because it is measured on
the **named acceptance criteria** (the external objective), not on test churn or self-report. On this
signal the engine reverts to last green and re-enters with `disciplines/altitude-stepback.md`
(reassess against the external objective; switch to a *different* approach).

The **optional** hook layer (`hooks/`, DESIGN §9.3) adds true per-tool-call fingerprinting (repeat-edit
/ footprint-escape) for sharper mid-build detection. **The engine works fully without it** and only
gains earlier signal with it — never assume it is present.

---

## 2. The `Obstruction` object

Return this on the step envelope's `obstruction` field (DESIGN §3 envelope, §7 shape):

```
Obstruction = {
  tier:             1 | 2 | 3,
  blastRadius:      string,        // who/what is affected: files, consumers, data — concrete
  reversibility:    "two-way" | "one-way" | "unknown",
  description:      string,        // the surface fact: what the architecture demands vs. the plan
  candidates:       string[],      // 2-3 distinct ways through, one-line each (Tier 2/3)
  reversibleInterim:string,        // the safe holding move while the decision is pending (Tier 3)
}
```

`tier` is the *recommendation*; the engine routes on it but corroborates `blastRadius` and
`reversibility` against the diff and the conservative rules below. You compute `tier` by running §4.

---

## 3. Reversibility — conservative by default

Reversibility is the axis that picks Tier 2 vs Tier 3. Classify it **before** proposing a tier.

- **two-way** — provable. A seam (facade/adapter) you can later replace **without data loss and without
  breaking any consumer**. State *why* it is reversible in one line, or it is not two-way.
- **one-way** — costly/impossible to undo once shipped: data is migrated, a consumer is broken, an
  external effect has fired.
- **unknown** — **you cannot prove it two-way.** Treat **`unknown` as `one-way`** (Tier 3). The burden
  of proof is on reversibility, never on irreversibility.

**One-way by rule** (no judgment call — these are `one-way` even if they "feel" undoable):
**money, persistence migrations, auth/security, external-effects/idempotency, and any out-of-band manual
change to a tracked-state mechanism** (hand-applied DDL/SQL, hand-edited applied/generated migrations or
lockfiles, hand-edited codegen output, or a stand-in substituted for a missing prereq). An out-of-band
manual change to a tracked-state mechanism is a one-way door **even when it feels undoable**, because it
silently breaks the mechanism for later (`disciplines/honest-verification.md` `no_substitution`). Any
surface pack may declare additional `oneWayDoor` guardrails; where packs disagree, the **stricter (more one-way)**
classification wins (`surfaces/_registry.md` precedence). A slice's fired surfaces
(`disciplines/risk-tiering.md`) feed this: if a money/migration/auth/external-effect surface is in play,
reversibility is `one-way`, full stop.

---

## 4. Decision tree

Run top to bottom; the first match is the tier. (`maxSplitsPerPhase`, `maxFixAttempts`,
`maxUpstreamRouteBacks` are engine budgets — DESIGN §9.1.)

```
Is the obstruction a MISSING/BROKEN PREREQUISITE or an out-of-band tracked-state change (trigger 5)?
  └─ yes: Can the build fix it FOR-REAL in-footprint (run the canonical migration command, install the
          tool, write the real fixture via its normal setup)?
            └─ yes ──────────────────────────────────────► fix it real (no stand-in); resume
            └─ no  (env var/secret/service/auth/tool genuinely unavailable, or migration won't apply,
                    or the only path left is a stand-in / hand-mutating tracked state)
                                                          ► TIER 3  (+ routeBack iff it should have
                                                                     been front-loaded in grill)
  └─ no:  Is the change IN the slice's recorded footprint AND behavior-preserving?
            └─ yes ──────────────────────────────────────► TIER 1
            └─ no:  Is a NEW seam needed, and is it PROVABLY two-way (reversibility == "two-way")?
                      └─ yes ────────────────────────────► TIER 2
                      └─ no  (one-way OR unknown OR competing-hard-to-reverse OR upstream-decision-wrong)
                                                          ► TIER 3
```

### Tier 1 — In-footprint, behavior-preserving → **preparatory refactor**

The code inside the slice's own footprint needs reshaping before the behavior fits cleanly, and the
reshape changes **zero behavior**.

- Do the reshape as a **separate refactor-hat commit** that precedes the behavior commit. The
  refactor/behavior split, the diff-checkable invariants, and "tests green before **and** after" are
  defined in `disciplines/two-hats.md` — apply it; do not restate it here.
- Then **resume** the behavior commit against the cleaned-up code.
- **Hard-bounded to the footprint.** The instant the reshape wants to reach a file the slice does not
  already touch, it is no longer Tier 1 — stop and re-classify as Tier 2 (declare a new `Obstruction`).
- **PASS condition (`tier1Clean`):** refactor commit and behavior commit are separate; the same test
  set is green at both commits with assertions unchanged across the refactor commit; every touched file
  is within the slice footprint. If any clause fails → not Tier 1; re-run §4.

### Tier 2 — Reversible new seam (two-way door) → **enabling slice behind a facade**

A new seam is genuinely needed, but it is a **provable two-way door**: a thin facade/adapter you can
later swap out without data loss or consumer breakage.

- Insert an **enabling slice**: a real, thin, **demoable** slice (one observable behavior, app left
  runnable — same slice bar as `disciplines/risk-tiering.md` / S1) that introduces only the seam.
- **Write the enabling slice's `slice.md` stub before returning**, then **prepend** it via S2's split
  fields so it builds first; the engine updates its in-memory slice list (its source of truth within the
  run — it has no filesystem access, DESIGN §6).
- It **counts against `maxSplitsPerPhase`.** On exhaustion, the engine treats further splitting as
  blocked → degrade (you may need to escalate as Tier 3 instead).
- Build the **current** slice against the new seam, not around it.
- Return via S2's split path: `obstruction.tier = 2` plus the replacement/prepended slice(s)
  (`splitNeeded` / `replacementSlices[]` per S2's output) so the engine re-enters the slice list.
- **PASS condition (`tier2Seam`):** the seam is named and demonstrated `reversibility:"two-way"` with a
  one-line why; the enabling slice is thin + demoable + app-runnable; it is prepended and within the
  split budget; the current slice now builds against the seam. If reversibility is not provably
  two-way → it is Tier 3, not Tier 2.

### Tier 3 — Irreversible, competing-hard-to-reverse, or upstream-wrong → **escalate the DECISION, not the build**

Any of: a **one-way door** (incl. `unknown`, and everything one-way **by rule**); **competing
hard-to-reverse** designs; an **upstream decision is wrong** (the spec shape, a phase boundary, or a
shared contract makes the slice unbuildable as specified); or a **prerequisite is genuinely unavailable
and cannot be fixed for-real in-footprint** (trigger 5 — env var/secret/service/auth/tool unavailable, a
migration that won't apply, or the only path left hand-mutates tracked state). The prereq case is **Tier
3 by default** — one-way by rule, because substituting a stand-in or hand-mutating tracked state is the
silent-workaround / state-corruption this catches: **an unavailable prereq substituted to get green is
the no-silent-workaround failure** (`disciplines/honest-verification.md` `no_substitution`).

Do **not** pick the irreversible design under deadline pressure, do **not** keep hacking, and do **not**
substitute a stand-in for a missing prereq. Escalate the *decision*:

1. **Write a ≤1-page ADR** and **drop an `ARCH-DEBT(<slice-id>)` marker at the exact code site.** The
   marker grammar, the ADR template (context / 2-3 candidates with tradeoffs / reversibility /
   recommendation / reversible interim), and the ADR path are defined in
   `disciplines/arch-debt-adr.md` — apply it; do not restate it here. **Recorded in chat does not
   count** — the marker (grep-able) and the committed ADR are the record the next slice's
   `read-before-write` greps before coding.
2. **Proceed on the `reversibleInterim`** — the safe holding move (a stub, a flag-gated default-off
   path, a conservative two-way placeholder) that keeps the app runnable and the slice's behavior
   demoable without walking through the one-way door. Populate `reversibleInterim` on the `Obstruction`.
3. **If the wrong decision is upstream, emit a `routeBack`** so the engine re-enters and fixes it at the
   owning step instead of patching downstream. **A missing prereq that should have been front-loaded**
   (env var/secret/tool/auth/fixture/migration the slice's real designated path needs) routes back to
   **S0** so the grill names it in `idea-decisions.md` as a front-door prerequisite — naming exactly what
   the human must provision — rather than the build silently working around it:

```
routeBack = {
  targetStep: "S0" | "S1" | "S2" | "S3" | "S4",  // S0 spec shape / front-door prereq · S1 phase boundary/slice scope · S2/S3 plan · S4 build
  phaseId, sliceId,                               // the affected ids (null if N/A)
  check:  "<what was found wrong>",
  reason: "<why this step owns the fix>",
}
```

The engine resets the target step's check plus everything downstream (cascade) and re-runs from there,
bounded by `maxUpstreamRouteBacks` (DESIGN §6). The full `RouteBack` shape lives in DESIGN §6 — do not
duplicate it; populate exactly those fields.

- **PASS condition (`tier3Escalated`):** an ADR is committed at the contract path **and** an
  `ARCH-DEBT(<slice-id>)` marker sits at the site **and** `reversibleInterim` is populated and keeps the
  app runnable **and** (iff the cause is upstream) a `routeBack` targets the owning step **and** (iff the
  cause is a prereq that should have been front-loaded) the `routeBack` targets **S0** naming the prereq.
  The build did **not** walk through the one-way door, **and did not substitute a stand-in or
  hand-mutate tracked state for a missing prereq.** If any clause fails, the obstruction is unresolved →
  `BLOCKED`, not `PASS`.

---

## 5. What you return

On the step envelope (DESIGN §3):

- **Fix-it-real (prereq, in-footprint):** no `Obstruction` tier needed once fixed — run the canonical
  command / real setup (never a stand-in), then resume.
- **Tier 1:** `obstruction.tier = 1`; resume normally after the two-hats refactor commit — no
  `routeBack`, no split.
- **Tier 2:** `obstruction.tier = 2` + the prepended enabling slice via S2's split fields; build current
  slice against the seam.
- **Tier 3:** `obstruction.tier = 3`, `reversibleInterim` populated, ADR + `ARCH-DEBT` written;
  `routeBack` set **iff** the cause is upstream (target **S0** naming the prereq iff it should have been
  front-loaded). No stand-in substituted, no tracked state hand-mutated. Proceed on the interim or, if
  even the interim is unsafe, return `BLOCKED` with `failedCriterion` naming the unresolved one-way door
  or the unavailable prereq.

Every obstruction — tier, blast-radius, reversibility, ADR link — is absorbed into the run report by the
engine. The chat transcript is never the record; the marker and the ADR are.
