# Step S6 — Verify-Phase

**Run:** once per phase, after **every** required slice in the phase has reached `verdict:PASS` at
S5. **Subagent, fresh context.** You are NOT the implementer and NOT the per-slice verifier — you
own the **integration** verdict, the layer none of them could see.

**Your job is the seam, not the slice.** S5 already proved each slice's one behavior runs through
its real entry point at its mandatory rung (`disciplines/honest-verification.md`). **Do not
re-audit individual slices.** S6 proves the slices **compose into the phase outcome**: cross-slice
integration (R4), shared-contract consistency, and full coverage of the phase spec — plus rollout
safety. The confidently-wrong class S6 catches is the **integration lie**: every slice green in
isolation, the assembled phase silently wrong (a shared contract two slices read differently, a
behavior that only breaks when slice B's data meets slice A's reader).

**Inputs (read from disk — fresh-context bar, never the transcript):**
- The **phase spec** + the phase's **acceptance criteria** (S1 artifact under
  `strike/initiatives/<id>/phases/<phase-id>/`) — the external objective you verdict against.
- Every slice's `slice.md` + `build-verification.md` (S5) under `.../slices/<slice-id>/` — to read
  each slice's recorded `verdict`, `surfaces`, `riskTier`, shared contracts, and any
  `code-verified` residual risk. You **trust** these S5 verdicts; you do not redo them.
- `ARCH-DEBT` markers and `adr/` written during the phase (grep the phase footprint).

**Single-phase delta:** when the initiative has **exactly one phase**, S7 collapses into S6 — after
the phase checks below, also run the **cross-initiative readiness lenses** in section 4. When the
initiative has more than one phase, skip section 4 entirely (S7 runs separately).

---

## What you verify (the five phase criteria)

Verdict each as a named criterion. All are checked against the **phase spec on disk**, observable
behavior, never green tests or "looks correct" (DESIGN §1.3).

### 1. `slices_verified` — every required slice actually passed

Reconcile the phase's slice set against the **on-disk `slices/` dir as source of truth** (DESIGN §6
— splits may have added/replaced slices since S1). Then confirm **every** required slice in that set
carries `verdict:PASS` from S5.

- A slice marked **`code-verified`** at S5 (behavior verification was blocked — R2+ unreached) is
  **not** a passed slice for a STANDARD/CRITICAL phase outcome. Surface its residual risk: if the
  phase outcome **depends on** that unexercised behavior, S6 cannot claim the phase composes →
  `slices_verified` FAIL (or `BLOCKED` if the behavior is genuinely unexercisable here).
- **PASS:** the on-disk slice set is fully accounted for and every required slice is S5-`verified`
  (not merely `code-verified`) for any behavior the phase outcome depends on.

### 2. `phase_spec_covered` — the outcome is fully delivered

Read the phase acceptance criteria **verbatim** and emit a per-criterion table (the
`altitude-stepback.md` REASSESS table format — reuse it, do not invent a new one):

```
| # | Phase acceptance criterion (verbatim) | Verdict        | Evidence (entry point + observation) |
|---|---------------------------------------|----------------|--------------------------------------|
| 1 | <criterion>                           | PASS           | <real-entry-point run + result>      |
| 2 | <criterion>                           | FAIL           | <what was observed instead>          |
```

- Every criterion must trace to **observed behavior**, not to a slice having been built. A criterion
  no slice delivers, or that falls in the gap *between* slices, is a FAIL here even though every
  slice passed S5.
- Use `CODE-VERIFIED` in the table (never `PASS`) for a criterion whose behavior check is blocked at
  the phase level; list its residual risk.
- **PASS:** every phase acceptance criterion is `PASS` in the table.

### 3. `slices_compose` — R4 integration through the real entry point

This is **R4** from `disciplines/honest-verification.md`, and it is **mandatory at S6**. Exercise
the phase outcome **end-to-end through its real entry point with real data**, across the slice
boundaries — not slice-by-slice.

- "Real entry point with real data" is **per-modality** — resolve it from `surfaces/_registry.md`
  §3 for each pack the phase's slices fired (HTTP/UI flow + screenshot; simulator run + offline→online
  sync; representative-sample pipeline run + output-row/schema assert + idempotent re-run;
  `plan`/dry-run diff inspected, never `apply`; command invoke + exit-code/stdout contract). When
  the phase spans multiple packs, the integration run must satisfy **each**.
- Drive a real **cross-slice path**: the output of one slice flowing into the next (e.g. the slice
  that writes a record → the slice that reads/renders it; the producer slice → the consumer slice).
  A single slice run in isolation is **not** R4.
- **UI phases:** capture and **inspect** a screenshot of the integrated flow per
  `disciplines/honest-verification.md` (UI checklist) — the assembled view, real data, no broken
  layout / console error / stuck spinner. A screenshot not actually captured is a tamper. The
  screenshot must **record and verify the environment it ran in** — base URL / build SHA / data tier
  / simulator target — and that environment must be the **designated** one from `idea-decisions.md
  "## Environments"` (browser / user-flow runs in the DEV env the human uses). "Real data, not a
  placeholder" is necessary but **not** sufficient: an unstamped screenshot, or one stamped with a
  convenient/wrong environment (a stale dev server, the test env reconfigured to look real, the wrong
  tier), is a tamper, not evidence — not just a missing data check.
- **S6 owns the LIVE-browser visual for the phase's user-flow.** Per the LIVE-BROWSER
  CONSOLIDATION rule (`disciplines/honest-verification.md`): the per-slice S5 R2 is satisfied
  through the slice's real-entry-point TEST (jsdom/component/DOM through the same seam) and a slice
  is **not** blocked for lacking a live screenshot — **the phase gate owns the live confirmation**.
  So at S6, capture **one** env-stamped DEV-browser screenshot exercising the phase behavior in a
  **real browser** (the designated DEV env above); this single live pass discharges the phase's
  user-flow visual that S5 deliberately did not carry per-slice. Do not re-litigate a per-slice
  browser block here — browser reachability is probed once (early); if genuinely unreachable, this
  criterion is `BLOCKED` with residual risk, not a re-derived per-slice failure.
- Any screenshot here that asserts a **state transition** across an action (a reload, navigation,
  or click that changes state) must satisfy the **STATE-TRANSITION SCREENSHOT RULE**
  (`disciplines/honest-verification.md`): a genuinely FRESH frame captured AFTER the action, **not**
  byte-identical to the pre-action frame unless pixel-identity is explicitly expected and stated. A
  byte-identical pre/post pair cited as transition evidence is a tamper.
- **PASS (`R4_compose`):** the end-to-end behavior holds across the slice boundaries through the
  real entry point, observed, with the modality's evidence artifact captured and **env-stamped with
  the designated environment**.

### 4. `shared_contract_consistent` — one truth across slices

For every **shared contract** the phase's slices both produce and consume (a DB shape, an exported
signature, a wire/event/topic schema, a public API, a flag) — facts recorded by the S4
obstruction-loop declarations and visible in `slices/`:

- Producer and every consumer **agree** on the contract: same field names/types, same
  units/encoding, same null/optional semantics, same error shape. A mismatch that each slice's own
  tests missed (because each tested its own side) is exactly the integration lie.
- Run the fired surface's contract guardrail as a named check via `surfaces/_registry.md` — e.g.
  web-backend additive-vs-breaking taxonomy + expand/contract migration ordering; data-pipeline
  consumer schema compat; cli flag/arg backward-compat. Do **not** restate the rules; read each
  pack's `check`.
- **PASS:** every shared contract has exactly one agreed shape across producer and all consumers,
  and every fired contract guardrail's `check` passes.

### 5. `rollout_safe` — no broken half-feature live without a flag

The phase must leave the app **runnable and shippable as a unit** (DESIGN §1.6). Verify there is no
half-wired feature reachable in the default code path.

- Any partial or risky behavior assembled across the phase must be **flag-gated default-off** (or
  otherwise unreachable) until the whole outcome is complete — resolve the gating obligation from
  the fired surface guardrails (e.g. mobile `ship-irreversibility` default-off flag; web-backend
  expand/contract so a half-applied migration never breaks live reads; infra no unintended
  destroy/replace in the plan diff).
- Honor every `one-way` guardrail and `ARCH-DEBT` interim from the phase: a Tier-3 `reversibleInterim`
  must still be holding (the one-way door was **not** walked through), or `rollout_safe` FAIL.
- **PASS:** the integrated phase is live-safe — nothing broken is reachable by default, every
  one-way door is still gated/deferred, and the app runs as a unit.

---

## Tamper / honesty audit (you, not the implementer)

You are a non-implementer party, so you own the integration-level slice of the anti-gaming audit
from `disciplines/honest-verification.md`. Do not re-run each slice's R1 audit; check the **seam**:

- The R4 integration evidence runs the **real cross-slice path**, not a mock standing in for the
  other slice (a stub that returns slice B's expected output proves nothing about composition).
- The integration oracle is anchored to a **phase-spec** criterion, not to whatever the assembled
  code happened to emit.
- No phase criterion was quietly satisfied by a slice's `code-verified` (blocked) behavior reported
  as if `verified`.

A tamper finding blocks PASS regardless of how green the slices were → `phase_spec_covered` or
`R4_compose` FAIL naming it.

---

## Section 4 — Single-phase delta: cross-initiative readiness lenses

**Run ONLY when the initiative has exactly one phase** (S7 folded in). The phase outcome *is* the
whole initiative, so additionally verdict against the **main spec**:

- `main_spec_covered` — repeat criterion 2's verbatim per-criterion table against the **main-spec
  acceptance criteria** (S0 artifact, `strike/initiatives/<id>/main-spec.md`), not just the phase
  spec. For a single-phase initiative these largely coincide, but verdict the main-spec list
  explicitly so nothing in the initiative-level objective is assumed.
- `inscope_delivered` — when S7 folds into S6, also run S7's `inscope_delivered` re-check (mirrored
  here because single-phase folds S7 in and would otherwise escape it). Re-verify the IN-SCOPE ⊆ AC
  RECONCILIATION S0 minted: **every** main-spec In-scope clause maps to ≥1 binary acceptance
  criterion, an explicit recorded **reuse-acceptance**, OR a logged **scope-waiver**. An In-scope
  clause with none of those is a coverage **FAIL** (`failedCriterion:inscope_delivered`,
  `routeBack:S0`) — **never** a clean PASS. (The dogfood miss: "Set the hemisphere" was In-scope
  with no AC, so the UI was silently dropped yet the initiative PASSED.)
- `ship_safe` — one final integrated behavior + (UI) screenshot pass holds; criterion 5
  `rollout_safe` is satisfied at the **initiative** level; no unresolved one-way `ARCH-DEBT`
  interim is masquerading as done.
- `disciplines_attested` — the final, **LEAN spot-check** that the per-slice build disciplines were
  actually honored on disk (not inherited on faith), mirrored here because single-phase folds S7 in
  and would otherwise escape it. **Identical to S7's:** the per-slice disciplines are already gated
  at S2/S5 — do **not** re-walk all of them; pick **≥1 slice** and attest it by citing the
  **concrete on-disk artifacts you inspected yourself** (never an inherited phase verdict): (a) its
  `build.md` **grounding note** is populated — WHAT EXISTS / REUSE / SIBLING are filled, not blanked;
  (b) its `build-verification.md` reached its **mandatory rung (R2/R3)** with a committed
  **real-entry-point behavior test that passes** (the same one deliverable S4 committed and S5
  confirmed — not a re-derivation). **Exception:** a slice S5 recorded `external-genuinely-unavailable`
  satisfies this with the SAME real-entry-point test committed `skip-with-reason` naming the exact
  blocker (that slice BLOCKED/code-verified with residual risk listed) — not a FAIL. A skip-with-reason
  on a slice NOT so classified is still a disciplines_attested FAIL. (c) **IF** any UI/observable
  surface fired anywhere in the phase,
  then **≥1 env-stamped screenshot exists** recording the environment it ran in **and** that
  environment is the **designated** one from `idea-decisions.md "## Environments"` (browser /
  user-flow in DEV; a screenshot stamped with a convenient/wrong env is a tamper, not evidence). Any
  of (a)/(b)/(c) **absent** → `disciplines_attested` FAIL `routeBack:S4` (build-discipline gap); an
  artifact that exists but is **unreadable** → `BLOCKED`.
- **Final Receipt** (write into the artifact): **Shipped** (what observable behavior now works),
  **Run-Use** (the exact real entry point + command/URL/flow to exercise it), **Next** (residual
  risk, deferred `ARCH-DEBT`, follow-ups). This is the fresh-context handoff S7 would otherwise produce.

For a multi-phase initiative, **none** of section 4 runs — S7 owns it; S6 stops after the five phase
criteria.

---

## Route-back (the phase boundary or upstream is wrong)

If S6 finds the failure is not a slice bug but a **wrong upstream decision** — the phase spec is
unsatisfiable as written, two slices can't compose because the **phase boundary** is wrong, or a
**shared contract / spec shape** is malformed — do **not** patch downstream. Emit a `routeBack`
(DESIGN §6 shape; `disciplines/obstruction-loop.md` §4 Tier 3):

- `targetStep: "S1"` — phase boundary / phase-spec / slice scope is wrong (most common from S6).
- `targetStep: "S0"` — the main-spec shape itself is wrong (the phase can't deliver its share of an
  ill-formed objective).

Set `check` (what was found wrong) and `reason` (why that step owns the fix). The engine resets the
target step + everything downstream (cascade) and **re-enters** it, bounded by `maxUpstreamRouteBacks`.
You do not re-enter it yourself; you emit the route and stop.

---

## Artifact

Write `strike/initiatives/<id>/phases/<phase-id>/verification.md` containing: the five named-criterion
verdicts; the verbatim per-criterion phase-spec table; the R4 integration evidence (entry point +
observation + screenshot/sample-diff/plan-diff/exit-code path, **env-stamped** with the designated
base URL / build SHA / data tier / simulator target it ran against); the shared-contract consistency
result; the rollout-safety result; any tamper findings; and — for a single-phase initiative — the
section 4 lenses + Final Receipt + a **`## Disciplines attested`** row citing the exact artifact
path/grep inspected for `disciplines_attested`:

```markdown
## Disciplines attested   (single-phase only)
| Spot-checked slice | Grounding note (build.md) | Behavior test @ rung (build-verification.md) | Env-stamped screenshot (if UI fired) | Verdict |
|--------------------|---------------------------|----------------------------------------------|--------------------------------------|---------|
| <slice-id>         | <path — populated y/n>    | <path — R2/R3, test passes>                  | <path + env stamp / n/a>             | PASS    |
```

Fresh-context bar: a reader acting on this file alone must not need the transcript.

---

## Gate (named-criterion verdict)

`verdict:PASS` **iff ALL** hold:

1. `slices_verified` — the on-disk slice set is reconciled and every required slice is S5-`verified`
   for any behavior the phase outcome depends on.
2. `phase_spec_covered` — every phase acceptance criterion is `PASS` in the verbatim table.
3. `R4_compose` — the phase outcome holds end-to-end across slice boundaries through the real
   per-modality entry point, observed, with evidence captured (R4 reached).
4. `shared_contract_consistent` — one agreed shape per shared contract across producer + all
   consumers; every fired contract guardrail's `check` passes.
5. `rollout_safe` — the integrated phase is live-safe; no broken half-feature reachable by default;
   every one-way door still gated/deferred.
6. **Tamper audit** PASS (seam-level: real cross-slice path, spec-anchored oracle, no `code-verified`
   sold as `verified`).
7. **(single-phase only)** `main_spec_covered` + `inscope_delivered` + `ship_safe` +
   `disciplines_attested` PASS and the Final Receipt is written.

**Else:**
- **FAIL**, `routeBack=null` → the failing criterion is a slice/integration bug the engine can repair
  in place: name it in `failedCriterion`; the engine runs `fix` then re-runs S6 (bounded by
  `maxFixAttempts`).
- **FAIL / BLOCKED**, `routeBack` set → the failure is upstream (phase boundary / phase-spec / main-spec
  shape): the engine re-enters the named step (above).
- **BLOCKED**, no route → integration behavior is genuinely unexercisable here (no harness): name the
  unreachable criterion (e.g. `R4_compose blocked`), list residual risk; the engine records a blocker
  and degrades gracefully.

`failedCriterion` is always one of the named criteria above — never prose to be interpreted.

---

## Output envelope

Standard step envelope (DESIGN §3) plus the honest-verification fields:

```
verdict:         "PASS" | "FAIL" | "BLOCKED"
failedCriterion: null                                  // on FAIL/BLOCKED, one of the named criteria:
                 | "slices_verified" | "phase_spec_covered" | "R4_compose"
                 | "shared_contract_consistent" | "rollout_safe" | "tamper_audit"
                 | "main_spec_covered" | "inscope_delivered" | "ship_safe"
                 | "disciplines_attested"                              // single-phase only
                 | "<rung> blocked"                    // never prose
artifactPath:    ".../phases/<phase-id>/verification.md"
ladderReached:   "R4"                        // R4 is mandatory at S6 (lower => not composed)
verifiedKind:    "verified" | "code-verified"  // code-verified => residualRisk listed
residualRisk:    string[]                     // required iff verifiedKind == "code-verified"
phaseId:         string
routeBack:       RouteBack | null            // S0/S1 per above
blockers:        string[]
surfaces:        string[]                     // the union fired across the phase's slices
assumptions:     string[]
```

`changedFiles` and `obstruction` stay empty — S6 verifies, it does not build. The engine reads only
the envelope + these declared fields and routes deterministically.
