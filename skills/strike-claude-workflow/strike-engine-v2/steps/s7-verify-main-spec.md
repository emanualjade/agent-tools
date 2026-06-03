# S7 — Verify Main-Spec (final gate)

**One subagent. The last gate before ship.** Confirm the completed phases — taken together —
satisfy the **MAIN-SPEC** acceptance criteria from S0, **compose coherently across phase
boundaries**, and pass one final behavior pass; then assert the initiative is **ship-safe**. You
are a verifier, **not** an implementer: you observe and verdict, you do not edit code (a real gap
routes back, it does not get patched here).

**SKIP condition (engine-owned).** When the initiative has exactly **one phase**, S7 is folded into
S6 and never runs as a separate step — S6 carries the R4 + ship-safety load for that single phase.
This file runs only for **multi-phase** initiatives. (DESIGN §3.)

**Inputs you read (on disk, never the transcript — fresh-context bar, DESIGN §1.4):**
- the **main-spec** + phase-map at `strike/initiatives/<id>/` (S0's artifact) — the acceptance
  criteria are here, verbatim, and are the **external objective** you anchor to.
- each phase's `verification.md` (S6's per-phase artifacts) — what each phase already proved.
- the union of `surfaces[]` across all phases — which modality packs fired anywhere in the build.
- recorded `assumptions`, `blockers`, open `ARCH-DEBT` markers + their ADRs (`adr/`).

---

## What S7 proves (and what it does NOT re-prove)

S7 is **cross-phase**, not a re-run of every slice. The slices were verified at S5, the phases at
S6. S7 owns the seams **between** phases and the spec read as a **whole**:

1. **Every main-spec acceptance criterion is PASS** — verdicted against observable behavior, at the
   honest rung, per criterion. A criterion may span multiple phases; that is exactly what no earlier
   step checked.
2. **Cross-phase integration is observed working (R4_compose)** — the end-to-end flows the
   main-spec implies run through their **real entry points with real data**, crossing phase
   boundaries (e.g. phase-1 writes the record, phase-3 reads it; the contract phase-2 published is
   consumed correctly downstream). This is the integration class S6 (single-phase scope) could not
   reach.
3. **The initiative is ship-safe (`shipSafe`)** — the composed system is safe to ship, not just
   individually green per phase.

Do **not** re-audit passing slices for style or re-run green phase suites for their own sake. Spend
the budget on the **seams and the whole-spec read** — that is where confidently-wrong (DESIGN §1.11)
survives every earlier gate.

---

## Procedure

### 1. Anchor to the external objective (compose `altitude-stepback`)

Open the main-spec **on disk** and read every acceptance criterion **verbatim**. Apply
`disciplines/altitude-stepback.md` Step A/B/C against the *initiative-level* objective:

- **Per-criterion PASS/FAIL table** (its Step B), one row per **main-spec** acceptance criterion,
  verdicted against *observable behavior* — never green tests, never "looks correct" (DESIGN §1.3).
  Use `CODE-VERIFIED`, never `PASS`, when behavior verification is blocked (see §verified-kind).
- **"Goal requires vs delivered" diff** (its Step C): what the main-spec required vs what the
  finished phases actually deliver — surfacing any criterion with **zero** corresponding delivered
  behavior, and any cross-phase requirement no single phase owned.

Never verdict against the transcript or against the phase summaries — those are downstream of the
goal and can be wrong in the same direction. Read the spec file; verdict the running system.

### 2. Choose the R2/R4 form per modality (consult `surfaces/_registry.md`)

For each fired surface in the union `surfaces[]`, read `surfaces/_registry.md` §3 + that pack's
`verification` section for what "real entry point with real data" concretely means, and run the
**cross-phase** flow through it. **Never** hard-code to web. When multiple packs fired across the
build, each flow must be exercised in **every** form its path crosses:

- **web-backend** — HTTP request / UI interaction against live data; **screenshot for any UI**
  surface (drive the *real* rendered UI and inspect it — see `disciplines/honest-verification.md`
  §UI; an uncaptured screenshot is a tamper). **S7 owns the FINAL live-browser pass** (the
  LIVE-BROWSER CONSOLIDATION, `honest-verification.md`): per-slice R2 rode the real-entry-point test
  and S6 owned the per-phase live visual, so S7 captures **one env-stamped live-browser screenshot
  per cross-phase user-flow** (the whole-spec final pass) — not per slice. Any capture asserting a
  **state transition** across a reload/navigation/click obeys the STATE-TRANSITION SCREENSHOT RULE
  (`honest-verification.md`): it must be a genuinely **fresh** frame captured *after* the action and
  must **not** be byte-identical to its pre-action frame unless pixel-identity is explicitly
  expected and stated — a byte-identical pre/post pair cited as transition evidence is a tamper.
- **mobile** — simulator/emulator run + screenshot; exercise offline→online sync across the flow.
- **data-pipeline** — run the cross-phase flow on a **representative sample**; assert output
  schema + row-level expectations; **re-run for idempotence**.
- **infra-as-code** — inspect the `plan` / dry-run diff for the composed change; assert no
  unintended destroy/replace; check drift. **Never `apply`.**
- **cli-devtool** — **invoke** the end-to-end command(s) with real args; assert exit code +
  stdout/stderr contract.

**Read-only in verification, always.** Never run a destructive / applying action to verify
(registry §3). The artifact each form produces (response assertion, screenshot, sample diff, plan
diff, captured exit code) is your **evidence** — cite it in the table and the receipt.

### 3. Run the honest ladder to R4 (compose `honest-verification`)

`disciplines/honest-verification.md` is the authority on what "verified" may mean; do not restate
it. At S7:

- **R4_compose is MANDATORY** (the discipline's "R4 mandatory at S6/S7"). The named PASS criterion:
  the behavior holds **end-to-end across the phases it touches / through the shared contracts** they
  publish and consume. R0–R3 are assumed from S5/S6; you re-run only the **cross-phase** path at R2,
  plus at least one **cross-phase negative probe** (R3-style) through a real entry point — the
  silent-wrong seam is the one that renders/returns cleanly with wrong data flowing *between* phases.
- **Tamper audit** (the discipline's anti-gaming section): you are **not** the implementer, so you
  own it. Spot-check that the cross-phase oracles are spec-anchored (trace each expected value to a
  **main-spec** line, not to whatever a phase happened to output) and non-tautological. A tamper
  finding blocks PASS regardless of how green every phase suite is.
- **CRITICAL surfaces:** any cross-phase flow whose path touches a domain surface (money / auth /
  persistence-migration / external-effect / destructive / PII) must clear `R3_negative` with the
  fired surface's **canonical + security** lenses applied to the *composed* path.

Report the highest rung reached as `ladderReached` (R4 on success).

### 4. `verified` vs `code-verified` — never conflate (from `honest-verification`)

If any cross-phase behavior cannot be exercised (no runnable harness, external dependency down,
environment cannot reach the entry point), that criterion is **`code-verified`**, not `verified` —
and per the discipline that is **`verdict:BLOCKED`** for the initiative, not a green tick. List the
**exact blocker**, the **residual risk** (the specific composed behavior not exercised + how it
could be wrong), and `ladderReached`. Do **not** silently downgrade "verified" to a checkmark.

### 5. Reconcile open obstructions + assumptions

- **Open `ARCH-DEBT`:** `grep -rn 'ARCH-DEBT('` the initiative footprint. Each marker must resolve
  to a committed ADR (`disciplines/arch-debt-adr.md` grammar). An open Tier-3 debt is **not**
  automatically ship-blocking — it is a *recorded, reversible interim* — but a debt sitting on the
  **money / migration / auth / external-effect** path of a flow the main-spec requires to work
  **is** a ship-safety concern: surface it in the receipt's **Next**, and if it means a required
  criterion is only met on an interim that cannot actually carry production load, that criterion
  is **FAIL** (→ route back) or **`code-verified`** (→ BLOCKED), not PASS.
- **Assumptions:** any consequential `assumption` recorded upstream that, if wrong, would fail a
  main-spec criterion is listed in the receipt's **Run-Use** as a thing the operator must confirm.

---

## Gate — `MAIN_SPEC_VERIFIED` (the PASS condition, named & checkable)

`verdict:PASS` iff **ALL** hold:

- **`mainspec_criteria_pass`** — **every** main-spec acceptance criterion is `PASS` in the
  per-criterion table, verdicted against observable behavior at its honest rung (none left
  `CODE-VERIFIED`/`FAIL`).
- **`R4_compose`** — cross-phase integration observed working: the main-spec's end-to-end flows ran
  through their real entry points with real data across phase boundaries, plus ≥1 cross-phase
  negative probe; `ladderReached == "R4"`.
- **`tamper_audit`** — cross-phase oracles are spec-anchored to main-spec lines and
  non-tautological; no tamper pattern present (`disciplines/honest-verification.md`).
- **`shipSafe`** — no open obstruction/assumption leaves a *required* criterion met only on an
  interim that cannot carry production load; all fired CRITICAL-path surfaces cleared their
  canonical + security lenses on the composed path.
- **`disciplines_attested`** — the final, **LEAN spot-check** that the per-slice build disciplines
  were actually honored on disk (not inherited on faith). The per-slice disciplines are already
  gated at S2/S5 — do **not** re-walk all of them; pick **≥1 slice/phase** and attest it by citing
  the **concrete on-disk artifacts the verifier inspected itself** (never an inherited phase
  verdict): (a) its `build.md` **grounding note** is populated — WHAT EXISTS / REUSE / SIBLING are
  filled, not blanked; (b) its `build-verification.md` reached its **mandatory rung (R2/R3)** with a
  committed **real-entry-point behavior test that passes** (same one deliverable S4 committed and S5
  confirmed — not a re-derivation). Exception: a slice S5 recorded `external-genuinely-unavailable`
  satisfies this with the SAME real-entry-point test committed `skip-with-reason` naming the exact
  blocker (that slice BLOCKED/code-verified with residual risk listed) — not a FAIL. A
  skip-with-reason on a slice NOT so classified is still a disciplines_attested FAIL. (c) **IF** any UI/observable surface fired anywhere in that
  slice/phase, then **≥1 env-stamped screenshot exists** recording the environment it ran in **and**
  that environment is the **designated** one from `idea-decisions.md "## Environments"` (browser/
  user-flow in DEV; a screenshot stamped with a convenient/wrong env is a tamper, not evidence).
  Any of (a)/(b)/(c) **absent** → `verdict:FAIL`, recorded as a build-discipline blocker — the run
  DEGRADES (ready stays false); fix the slice on disk and re-launch, S7 is not re-entered for it. An
  artifact that exists but is **unreadable** → `BLOCKED`.
- **`inscope_delivered`** — the IN-SCOPE ⊆ AC RECONCILIATION, **re-checked at the finish line**
  against the In-scope coverage map S0 minted (and S6 re-checked per phase). Every main-spec
  In-scope clause must map to ≥1 binary acceptance criterion, an explicit recorded reuse-acceptance,
  OR a logged scope-waiver — **and** the thing it names must be **actually delivered** (observed in
  the per-criterion table / cross-phase flow, not merely listed). An In-scope clause that is neither
  AC-covered, reuse-accepted, nor waived **AND** not built is a **coverage FAIL** — never a clean
  PASS. (The dogfood miss: "Set the hemisphere" was In-scope with no AC, so the UI was silently
  dropped yet the initiative PASSED.) Cite the In-scope coverage map from S0 and the row that
  carries each clause; a clause that fails this is `failedCriterion:inscope_delivered`.

Otherwise:

- **`FAIL`** — a criterion is observably wrong, a seam does not compose, or the spot-checked slice's
  build disciplines are not honored on disk (`disciplines_attested`), and the fix is a build change.
  Set `failedCriterion` to the named gate criterion above. **`S0` is the ONE honest S7 route-back:**
  only when the **spec/main-spec objective itself** is the gap does the engine re-enter — emit
  `routeBack:S0`. A slice/phase/boundary gap (what would name `S4`/`S3`/`S2`/`S1`) is **recorded as
  a blocker and the run DEGRADES** (ready stays false): the engine does **not** re-enter those final
  gates from S7 and does **not** cascade a re-build — you fix the slice/phase/contract on disk and
  **re-launch**. (S7 itself never edits code.)
- **`BLOCKED`** — a required cross-phase behavior is unreachable (R2/R4 blocked). Set
  `failedCriterion` to the unreachable rung (e.g. `R4_compose blocked`), list `residualRisk`, and
  the engine **degrades gracefully** (DESIGN §1.10): records the blocker, reverts to last green
  carrying one distilled lesson — never loops.

`failedCriterion` is **always one of the named criteria above** — never prose to be interpreted
(DESIGN §1.2).

---

## Artifacts (written before returning — fresh-context bar)

### 1. `verification.md` at `strike/initiatives/<id>/verification.md`

The auditable record of this final gate. Required sections:

```markdown
# Main-Spec Verification — <initiative-id>

- **Verdict:** PASS | FAIL | BLOCKED   **ladderReached:** R4   **verifiedKind:** verified | code-verified

## Per-criterion (main-spec, verbatim)
| # | Acceptance criterion (verbatim) | Verdict | Rung | Evidence (real entry point + observation + artifact) |
|---|---------------------------------|---------|------|------------------------------------------------------|
| 1 | <criterion>                     | PASS    | R4   | <flow run + result + screenshot/diff/exit-code path> |

## Cross-phase integration (R4_compose)
<the end-to-end flows exercised across phase boundaries; the shared contracts consumed; the
cross-phase negative probe + its observed correct failure. Cite the verification artifacts.>

## Goal requires vs delivered
| MAIN-SPEC REQUIRES | DELIVERED (across phases) |
|--------------------|---------------------------|
| <requirement>      | <delivered behavior / gap> |

## In-scope coverage re-check (inscope_delivered)
| In-scope clause (from S0 coverage map) | Home (AC # / reuse-accept / waiver) | Delivered? (observed) |
|----------------------------------------|-------------------------------------|-----------------------|
| <clause>                               | AC-3 / reuse-accepted / waiver-id   | yes (table row #) / FAIL |

## Ship-safety
<shipSafe verdict + reasoning. Open ARCH-DEBT touching required money/migration/auth/external-effect
paths; consequential assumptions; CRITICAL-path canonical+security lens results on the composed path.>

## Disciplines attested
<the ≥1 slice/phase spot-checked + the exact artifact path/grep the verifier inspected itself —
e.g. `phase-2/slice-3 build.md` grounding note populated (WHAT EXISTS/REUSE/SIBLING cited);
`build-verification.md` rung R3 + the committed real-entry-point behavior test that passes; UI fired
→ screenshot `…/shots/checkout.png` env-stamped `dev` == designated. Cite the path/grep, not a verdict.>

## Blockers / residual risk
<required iff any criterion is code-verified or BLOCKED: exact blocker, residual risk, what unblocks.>
```

### 2. The Final Receipt — `Shipped / Run-Use / Next`

The hand-off a fresh operator acts on without re-reading anything. Append to `verification.md` (or
write `receipt.md` beside it) and mirror into the return envelope:

```markdown
## Final Receipt
- **Shipped:** <the observable capability the initiative now delivers, per the main-spec — one or
  two sentences, behavior-stated, no "and"-soup.>
- **Run-Use:** <exact way to exercise it: the real entry point(s) + real inputs a human/operator
  uses to see it work — the command, URL, screen, or sample run. Plus any assumption to confirm.>
- **Next:** <what is deliberately not done: open ARCH-DEBT + ADR links (the real fix owed),
  deferred phases, recorded blockers, residual risk. Empty only if genuinely nothing is owed.>
```

---

## Return envelope (the verifier emits this; the engine routes on the standard-envelope fields — verdict/failedCriterion/routeBack/artifactPath/assumptions/blockers/surfaces/obstruction; DESIGN §3)

Standard envelope + the honest-verification fields:

```
verdict:         "PASS" | "FAIL" | "BLOCKED"
failedCriterion: null | "mainspec_criteria_pass" | "R4_compose" | "tamper_audit" | "shipSafe"
                 | "disciplines_attested" | "inscope_delivered" | "<rung> blocked"   // named, never prose
artifactPath:    "strike/initiatives/<id>/verification.md"
ladderReached:   "R4"                                  // highest rung actually executed
verifiedKind:    "verified" | "code-verified"          // code-verified => residualRisk required
residualRisk:    string[]                              // required iff verifiedKind == "code-verified"
assumptions:     string[]                              // consequential, surfaced in Run-Use
blockers:        string[]                              // genuinely unrepairable; drives degrade
surfaces:        string[]                              // union across phases, as exercised
obstruction:     null                                  // S7 verifies; it does not obstruct/build
routeBack:       null | { targetStep, phaseId, sliceId, check, reason }   // set on FAIL with an upstream/build gap
```

`verdict:PASS` only when `MAIN_SPEC_VERIFIED` holds in full. Anything less is `FAIL` (with
`routeBack`) or `BLOCKED` (degrade) — the initiative does **not** report "shipped" on a green tick
that no observed cross-phase behavior earned.
