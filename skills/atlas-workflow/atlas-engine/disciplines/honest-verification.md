# Discipline: Honest Verification

The behavior ladder + the anti-gaming audit. Composed by **S3** (plan), **S5** (build — the
universal gate), **S6** (phase), **S7** (main-spec). It defines what "verified" is allowed to mean
and how to stop a green-but-wrong slice from passing.

> **The target.** Looping/stuck failures are caught by the engine's stall counters
> (DESIGN §1.11, §7-Channel-B). This discipline exists for the other class: **confidently-wrong,
> NON-looping** errors — the slice that compiles, passes its own tests, "looks correct," and is
> silently wrong. The counters are blind to it. Only **spec-anchored oracles** and **negative
> probes** catch it. Optimize this whole discipline for that class.

---

## The ladder (R0 → R4)

Cumulative: each rung assumes the rungs below it passed. A rung is *reached* only when its check
actually ran and produced the named verdict — claiming a rung you did not execute is a tamper
(see audit). Report the highest rung reached as `ladderReached` in the step envelope.

| Rung | Name | What it proves | PASS criterion (named) |
| --- | --- | --- | --- |
| **R0** | Static / build | The code is well-formed | `R0_build`: typecheck/lint/compile/build all exit clean — no errors, no new warnings on touched files |
| **R1** | Focused tests | Stated input → stated output | `R1_spec_io`: ≥1 test per slice behavior asserting a **spec-stated** input→output pair, passing, **non-tautological** (audit below) |
| **R2** | Behavior, real entry point | The ONE behavior actually runs | `R2_real_entry`: the slice's single observable behavior exercised through its **real entry point with real data** — *per-modality, defined by the surfaces registry* (see below) — produces the spec-stated observable result |
| **R3** | Negative + lenses | It fails correctly and is domain-safe | `R3_negative`: ≥1 negative/edge probe (bad input rejected, boundary/empty/duplicate handled) **AND** every fired surface's mandatory lens passed (canonical, security) |
| **R4** | Integration | It composes | `R4_compose`: behavior holds end-to-end with the slices it touches / through shared contracts |

**R2 is the spine.** "Real entry point with real data" is **never** generic and **never**
hard-coded to web/backend. Resolve it from `surfaces/_registry.md` for each fired pack
(e.g. HTTP/UI + screenshot; simulator run + offline→online sync; representative-sample run +
output-row/schema assert + idempotent re-run; `plan`/dry-run diff inspected, never `apply`;
invoke-the-command + exit-code/stdout-contract). When multiple packs fire, R2 must satisfy each.
R1 green without R2 is **not** behavior verification — it is `code-verified` at best (below).

---

## `no_substitution` — the spine principle (DEDUPED HOME; other files reference this section)

A verifier may credit ONLY behavior it observed running through the slice's **REAL, DESIGNATED
path**: the true entry point, real data, the real datastore/tool/integration, **in the environment
the human actually uses for that activity.** Every prerequisite that path needs — env vars, secrets,
tool auth, the migration CLI, the existing house pattern, the dev DB — is EITHER front-loaded at the
front door (`idea-decisions.md`) OR surfaced as a **named hard blocker** that degrades the run and
tells the human exactly what to provision. A prerequisite is **never** silently substituted, skipped,
reinvented, applied out-of-band, or attested by inherited trust. **"Green on a stand-in"** — test/CI
DB for the prod datastore, fake rows for real data, a mock/alternate endpoint, a hand-rolled
reimplementation, hand-applied DDL, a phase verdict taken on faith — is a **TAMPER, not a pass.** The
only autonomous-safe response to a missing/broken/unavailable prerequisite is **fix-it-real** or
**BLOCK-and-name-it** (the engine is autonomous; it cannot ask the user mid-run).

**`no_substitution` (R2 gate).** `R2_real_entry` is satisfied ONLY when the behavior ran through the
slice's ACTUAL production entry point, against REAL data/datastore/tool, **in the PROPER environment
for the activity** named in `idea-decisions.md` "## Environments":

- **Browser / user-flow click-through** (R2 for UI / observable surfaces) runs in the **DEV
  environment the human uses** — never in the test env.
- **Automated tests** (unit/integration/E2E) run in the **TEST environment with its real
  fixtures/setup** — never reconfigured/mutated to do what it normally does not (e.g. enabling ingest
  it normally has off), never written as-if-dev but run in test.
- **No declared DEV/TEST split:** when idea-decisions.md "## Environments" names only a repo default
  (legitimate for a non-UI / non-domain STANDARD slice), that single default IS the proper
  environment — record it once per activity and pass; a missing DEV/TEST split is NOT itself a
  wrong-env tamper. `environment-scoped` FAILs only on an OBSERVED switch/mutation AWAY from the
  declared-or-default env.

It is **NOT** satisfied by a substitute introduced to get green: no prod-DB→test/CI-DB swap, no fake
rows standing in for real data, no mock/alternate endpoint, no dropping a required tool/integration,
no switching to a working branch because the designated one is broken, no arbitrarily switching to a
convenient environment, no running the click-through in the test env, no making the automated tests
pass by reconfiguring/mutating an environment. Behavior against any substitute, or in the wrong
environment for the activity, is **`code-verified` AT BEST** — and for STANDARD/CRITICAL that means
**BLOCKED, never `verified`.**

### Blocker classification — required before any `code-verified` is allowed

A slice may not drop to `code-verified` until the verifier has **classified** the R2 blocker.
Classify into exactly one:

- **`external-genuinely-unavailable`** — a third party with no sandbox, hardware, or paid prod-only
  access; the real path genuinely cannot run anywhere the build can reach.
- **`config-resolvable`** — a missing env var / secret / connection-string / local-fake the build
  could itself set up or run against a sandbox/test value.
- **`designated-env-broken`** — the designated path/env is broken, **including broken by THIS slice.**

| Classification | Allowed outcome |
| --- | --- |
| `external-genuinely-unavailable` | `code-verified` permitted — **only after** documenting failed resolution attempts (tried `.env.example`, sandbox, test key, local fake). The owed deliverable is a committed test marked **skip-with-reason naming the exact blocker**; verdict is **BLOCKED/`code-verified`**, never FAIL (no infinite re-build). |
| `config-resolvable` | **`verdict:BLOCKED`**, `failedCriterion:R2_blocked_missing_config`, naming the **EXACT** var(s) + how-to-provide. Not `code-verified`. |
| `designated-env-broken` | **FAIL** (in-footprint → engine `fix` loop) **OR** `verdict:BLOCKED`, `failedCriterion:R2_designated_env_broken`, naming what broke it. Not `code-verified`. |

**Behavior-test precedence:** a mandatory real-entry-point behavior test **FAILs (re-build) ONLY**
when R2 was REACHABLE (classification ≠ `external-genuinely-unavailable`). The S4-committed behavior
test and this S5 check are the **same** test — S5 CONFIRMS what S4 committed; it is not an
independent re-derivation.

### Obstacle-ledger reconciliation

Reconcile **every** obstacle the builder recorded in `build.md`'s obstacle ledger (the engine reads
only on-disk prose + the existing envelope — no new launch-args or return fields). Each ledger entry
must be either **fixed-with-evidence** OR carried as a **named BLOCKER**. A PASS with an
**unreconciled or routed-around** obstacle is a **`no_substitution` FAIL.**

---

## Mandatory rung per risk tier

From `disciplines/risk-tiering.md`. The *minimum* rung a slice must reach to be eligible for PASS:

| Risk tier | Mandatory rung | Notes |
| --- | --- | --- |
| **TRIVIAL** | **R1** | XS non-domain (copy/CSS/config). No domain ceremony. R0 always runs. |
| **STANDARD** | **R2** | Behavior through the real entry point is required. |
| **CRITICAL** | **R3** | Negative probe + canonical + security lenses are **mandatory, not optional**. |

- **R4** is mandatory at **S6/S7** (cross-slice / cross-phase integration), and at **S5** whenever
  the slice shares a contract with an already-built slice in the phase.
- A tier is set in S1 and may only be **raised** downstream — if verification reveals a domain
  surface the slicer missed, promote the slice to CRITICAL and require R3 before PASS.
- **S3** (plan verification) has no running code: it verifies the plan *can* reach the mandatory
  rung — every named acceptance criterion is satisfiable by the planned approach and every fired
  surface's guardrail is present. It does not emit `ladderReached`.

---

## `verified` vs `code-verified` (never conflate)

The engine reads the step `verdict`. Within a PASS, the prose/structured result MUST distinguish:

- **`verified`** — the mandatory rung (incl. **R2** for STANDARD/CRITICAL) was actually reached:
  the behavior ran through its real entry point with real data **in the proper environment for the
  activity**, with `no_substitution` PASS (no stand-in, no wrong env — see the spine above), and
  produced the spec-stated result.
- **`code-verified`** — behavior verification (R2+) was **blocked** (no runnable harness, external
  dependency unavailable, environment cannot exercise the entry point). Reached R0/R1 only. This is
  **honest, not a pass-grade for STANDARD/CRITICAL.**

When you report `code-verified`, you MUST list:
1. The **exact blocker** (what prevented R2 and what is needed to unblock).
2. The **residual risk** — the specific behavior NOT exercised and how it could be wrong.
3. The highest rung reached (`ladderReached`).

Gate effect: `code-verified` on a STANDARD/CRITICAL slice is **not** `verdict:PASS`. Emit
`verdict:BLOCKED` with `failedCriterion` naming the unreachable rung (e.g. `R2_real_entry blocked`)
so the engine records a blocker and degrades — never silently downgrade "verified" to a green tick.
TRIVIAL slices whose mandatory rung is R1 are `verified` at R1 by definition.

---

## Anti-gaming: the tautology / test-tamper audit

**Who:** the auditor MUST be a party that is **NOT the implementer.** S4 builds; the verifier
steps (S3/S5/S6/S7) are separate subagents and own this audit. An implementer auditing their own
tests is structurally compromised — never accept self-certification of R1.

**Anchor every oracle to the spec.** The expected value in an assertion must trace to a
**spec-stated example or acceptance criterion** (S0 main-spec / S1 phase-spec / the slice's
criteria), not to whatever the code happened to output. If you cannot point an assertion at a spec
line, the oracle is unanchored — treat it as not-yet-verified.

**Tamper checklist — flag any of these as `R1_spec_io` FAIL (a Must-Fix, not a nitpick):**

- [ ] **Always-true assert** — `expect(true)`, `assert x == x`, `toBeDefined()` on a guaranteed
      value, empty test body, `assert(result)` on a truthy non-spec value, a test with no assertion.
- [ ] **Mock returns the asserted value** — the stub/mock/fixture is hard-wired to return exactly
      what the test then asserts; the real code path never runs. (Mocking the unit under test, or a
      mock whose return is the oracle, proves nothing.)
- [ ] **Hardcoded / circular input** — input chosen so the output is trivially the input; oracle
      computed by re-running the implementation rather than from the spec; snapshot blessed from
      current (possibly wrong) output with no spec check.
- [ ] **Assertion weakened to pass** — `==` loosened to `contains`/`truthy`, tolerance widened,
      a failing case `.skip`/`.only`/commented out, error-path assert deleted, expected value
      edited to match buggy output (diff the test against its prior version — behavior commits must
      not silently relax assertions; see `disciplines/two-hats.md`).
- [ ] **Tests the framework, not the behavior** — asserts a library/ORM/router does its own job,
      never the slice's spec-stated transformation.
- [ ] **Workaround-to-green** — a blocker was routed around (substitute DB/data/tool/endpoint, a
      stub returning a canned pass, a dropped requirement, an alternate env) and the slice was then
      reported **verified on the stand-in.** (See `no_substitution` above — this is a `no_substitution`
      FAIL, not a `verified` PASS.)
- [ ] **Required-capability / substrate substitution** — behavior was exercised against a substitute
      for a tool/credential/service/data-substrate/environment the slice **actually needs**; the real
      path never ran. `code-verified` AT BEST, BLOCKED for STANDARD/CRITICAL.
- [ ] **Wrong-environment-for-the-activity** — the browser click-through was run in the **test** env
      (or the automated tests were made to pass by reconfiguring/mutating an env, or the env was
      switched for convenience) instead of its proper environment (**browser → DEV, tests → TEST**).
- [ ] **Byte-identical-frame-as-transition-evidence** — a screenshot cited as proof of a state
      transition (reload/navigation/click that changes state) is byte-identical to the pre-action
      frame (the prior frame was reused, not re-captured AFTER the action) where pixel-identity was
      not explicitly expected and stated. (See STATE-TRANSITION SCREENSHOT RULE in the UI section.)

**Audit verdict:** `tamper_audit` PASSES iff every behavior has ≥1 spec-anchored, non-tautological,
real-code-path assertion AND none of the above patterns are present. A tamper finding blocks PASS
regardless of how green the suite is.

---

## Negative / edge probe (R3) — the confidently-wrong catcher

Green happy-path + green types is exactly the signature of the silent-wrong class. R3 forces the
slice to **fail correctly**:

- **Reject the invalid** — malformed/oversized/missing/wrong-type input is rejected with a
  structured typed error, not a naked 500 / swallowed exception / wrong-but-200.
- **Boundaries** — empty / zero / one / max / duplicate / out-of-order, per the slice's data shape.
- **Domain edges** — pull from the fired surface's guardrails via `surfaces/_registry.md`
  (e.g. money: zero-decimal currency + rounding-split; idempotency: replayed key; migration:
  expand/contract reversibility; pipeline: duplicate/late event). Do **not** enumerate domain rules
  here — they live in the packs.

At least one negative probe must be exercised through the **real entry point** (R2-style), not only
as a unit test, for STANDARD+ slices where the entry point can carry bad input.

---

## UI: browser + screenshot inspection (when a UI surface fires)

When the surfaces registry flags a UI surface, R2 for that slice is incomplete without **visual
confirmation**. Drive the **real** rendered UI (browser/simulator per the modality pack) and
capture a screenshot. Inspect, do not assume:

- [ ] The element/state the slice adds is actually **present and rendered** (not just in the DOM
      with `display:none`, not behind an error boundary).
- [ ] The **spec-stated data** is visible and correct in the rendered view (real data, not a
      placeholder/loading/skeleton state).
- [ ] No visible error, broken layout, console error, or stuck spinner.
- [ ] One **negative interaction** behaves (invalid submit shows the error state; empty list shows
      the empty state) — the confidently-wrong UI is the one that renders cleanly with wrong/no data.

A screenshot that was not actually captured and inspected is a tamper (claiming a rung not reached).

**STATE-TRANSITION SCREENSHOT RULE (DEDUPED HOME; s5/s6/s7 reference this section).** A screenshot
asserting a STATE TRANSITION across an action (a reload, navigation, or click that changes state)
must be a genuinely FRESH frame captured AFTER the action — and it must NOT be byte-identical to the
pre-action frame unless pixel-identity is explicitly expected and stated. Distinguish "I re-captured
and it matched" from "I reused the prior frame"; a byte-identical pre/post pair cited as transition
evidence is a tamper.

### LIVE-BROWSER CONSOLIDATION (DEDUPED HOME; s5/s6/s7 reference this section)

Per-slice (S5), a UI slice's R2 is satisfied by exercising the behavior through its real entry point
via the slice's real-entry-point TEST (jsdom/component/DOM through the same seam). The LIVE-browser
visual confirmation (real browser + env-stamped screenshot in the DEV env) is owned at the PHASE gate
(S6, for the phase's user-flow) and the INITIATIVE gate (S7, one final pass). A slice MAY capture a
live screenshot but is NOT BLOCKED for lacking one — the phase/initiative gate owns the live visual.
Probe browser reachability ONCE (early); do not re-litigate a browser block per slice and carry it
through every phase.

This does **NOT** weaken honest verification. The live rendered-UI inspection above (present-and-
rendered, real spec-stated data, no error/broken-layout/console-error, one negative interaction) still
happens against the **real** browser in the DEV env — it just happens **once per phase/initiative at
the gate that owns the user-flow**, instead of being redundantly re-paid per slice. Per slice the same
behavior is still proven through its real entry point by the real-entry-point TEST; nothing is taken
on faith.

---

## What this step emits

Add to the standard step envelope:

```
ladderReached:  "R0" | "R1" | "R2" | "R3" | "R4"   // highest rung actually executed (verifier steps)
verifiedKind:   "verified" | "code-verified"        // code-verified => residual risk listed below
residualRisk:   string[]                             // required iff verifiedKind == "code-verified"
```

(The engine reads NONE of `ladderReached`/`verifiedKind`/`residualRisk` — they are **written to the
on-disk verification artifact** (`build-verification.md` / `verification.md`) that later steps
re-read; the ladder result reaches the gate by **collapsing into `verdict`** (PASS only at the
mandatory rung) **+ `failedCriterion`** (names the unreached rung). `no_substitution` reconciliation
routes through on-disk prose: the `build.md` obstacle ledger.)

**Gate (PASS condition, named):** `verdict:PASS` iff — every acceptance criterion for the unit
under verification is PASS, **AND** `ladderReached` ≥ the tier's mandatory rung,
**AND** `tamper_audit` PASS, **AND** `no_substitution` PASS (R2 ran through the real designated path
in the proper environment for the activity; every `build.md` obstacle-ledger entry reconciled
fixed-with-evidence or carried as a named blocker), **AND** (for CRITICAL) `R3_negative` PASS with
canonical + security lenses applied. Otherwise `FAIL` (with `routeBack=null` → engine runs `fix` then
re-runs this verifier) or `BLOCKED` (behavior verification unreachable → `failedCriterion` names the
rung — e.g. `R2_blocked_missing_config` / `R2_designated_env_broken` — engine degrades). The
`failedCriterion` is always one of the named criteria above — never prose to be interpreted.
