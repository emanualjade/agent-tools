# Step S2S4 — Merged FAST-lane Plan + Build (one round-trip)

**Runs:** once per **FAST-lane** slice (TRIVIAL / STANDARD, no domain surface), *instead of* separate S2
and S4 calls. One agent plans the slice and then builds it in a single pass — saving a round-trip and
the plan→build re-grounding. **The FULL lane never uses this step** (CRITICAL slices keep S2 → S3
plan-verify → S4, so plan verification still precedes any build). **`S5` verifies the result either
way** — this step does *not* self-certify; the separate verifier is unchanged.

> **Why this is safe (it does not skip a check):** the only thing the FAST lane ever skipped is the
> *pre-build* plan review (`S3`), which is already skipped on the FAST lane by design and which `S5`
> re-catches post-build. Merging plan+build removes a *round-trip*, not a *verification*. Every built
> slice is still independently checked by the strong-model `S5` verifier.

---

## Do these in order

### 1. PLAN — follow `steps/s2-plan.md` in full

Run **`steps/s2-plan.md`** exactly: read-before-write grounding (its `grounded` gate), re-detect
surfaces over the concrete footprint, fold canonical research **only if a surface fired**, apply
`adjective-noun` to any new persistent type, check reuse / `follow-the-house-pattern`, and write the
plan to `plan.md`. Honor its split and obstruction outcomes (`splitNeeded`/`replacementSlices`,
`obstruction`, `routeBack`) — return them on the envelope; the engine acts on them. **Decide a split or
enabling slice from the PLAN, before you write any code** (same ordering as the CRITICAL stop below): if
the slice must split, return `splitNeeded:true` / `replacementSlices` with `built:false` and write no code
— the engine has no filesystem and cannot revert inline changes you orphan by splitting after building.
**A split or obstruction MUST report `changedFiles: []`.** If you have already written ANY code, you may
NOT split or raise an obstruction on this pass — revert your changes first, then return the split with
`changedFiles` empty. The engine does **not** trust your `built` flag: it treats ANY split/obstruction
result that reports non-empty `changedFiles` as an orphaned, unverified inline build and will **discard it
and re-plan** (so routing is decided before code) — burning a route-back budget unit. Plan first; only
write code once you are sure the slice is whole and will not split.

### 2. THE CRITICAL CHECK — stop at the plan, or proceed to build

When the surface-detection pass (`disciplines/risk-tiering.md`) finishes, decide:

- **A domain surface fired** (money / auth / security / persistence-migration-as-a-durable-shape-change /
  external-effect / destructive / PII — read the persistence row through the **local-persistence
  down-tier**), **OR** the concrete size is **≥ M** → this slice is **CRITICAL**. **STOP at the plan.**
  Return `riskTier: "CRITICAL"`, `built: false`, `readyToVerify: true`. Do **not** build it here — a
  CRITICAL slice must get `S3` plan-verification *before* any code, so the engine re-routes it to the
  FULL lane. (This is the missed-surface safety net, `risk-tiering.md` §5.) **The engine independently
  cross-checks this** — it re-routes to FULL on `size ≥ M` (your reported `size` *or* the S1 birth-time
  `size`) and on any one-way surface (your `surfaces` *or* the birth-time `surfaces`), so an honest
  mis-label as STANDARD still can't build a big or one-way slice inline. Report `size` honestly.
  **A CRITICAL stop writes NO code on this pass and MUST report `changedFiles: []`** — identical to the
  split/obstruction rule. If you wrote ANY code before the surface fired, **REVERT it first**, then return
  the CRITICAL stop with `changedFiles` empty: the engine has no filesystem and cannot revert what you
  orphan by stopping after writing. The slice is rebuilt FULL-grade from scratch (S2 → S3 plan-verify →
  S4 → S5), so code from this pass is discarded — and a stray file the rebuild does not re-touch would
  ship UN-verified. Detect the surface BEFORE you write code.
- **No domain surface, size < M** → genuinely FAST. **Continue to step 3 and build it.**

Never build a slice you just classified CRITICAL — that is the exact "built on the FAST lane with no
plan-verify" hole the engine guards against.

### 3. BUILD — follow `steps/s4-build.md` in full (FAST slices only)

Run **`steps/s4-build.md`** exactly: read-before-write the footprint (incl. `grep ARCH-DEBT`), build
the **one behavior** by its smallest complete path at the **real entry point**, **one hat per commit**
(`two-hats.md`), satisfy every fired guardrail's `check`, and **commit the persistent real-entry-point
behavior test** (the `behavior-test-committed` deliverable — automated tests in the TEST env, the
`R2` real-entry-point test S5 will confirm). Write `build.md`. **Lean code — no spec-prose bleed**
(s4-build §3). If the build hits an obstruction, apply `disciplines/obstruction-loop.md` and return it.

---

## Gate + output

Emit the **shared envelope** (DESIGN §3) plus the merged S2+S4 fields. The `verdict` reflects the
furthest point reached:

- **Built (stayed FAST):** the plan's gates (`steps/s2-plan.md` `plan:ready`) AND the build's gates
  (`steps/s4-build.md` `built`) both hold → `verdict: "PASS"`, `built: true`, `readyToBuild: true`,
  `changedFiles` populated. The engine sends it straight to `S5`.
- **Stopped at the plan (CRITICAL):** `verdict: "PASS"`, `built: false`, `riskTier: "CRITICAL"`,
  `readyToVerify: true`, `changedFiles: []`. The **engine** (not you) then re-does the slice on the FULL
  lane — a fresh FULL-grade standalone plan → `S3` plan-verify → `S4` → `S5` at ≥R3 — discarding this FAST
  pass. The engine forces this for **every CRITICAL signal it can see** — your reported `riskTier`, the S1
  birth-time `riskTier`/`size`/`surfaces`, your `size`/`surfaces`, or a `DOMAIN_SURFACES` match — even if
  you mistakenly built it. (A domain effect invisible to both S1 and that structured cross-check, surfacing
  only at build/verify time, is caught downstream by `S5` at raised rigor and re-routed to FULL for a
  retroactive `S3` — so it still does not ship a kept build without plan-verify.)
- **Plan or build FAILED:** `verdict: "FAIL"`, `failedCriterion` names the unmet gate (plan or build).
- **Split / obstruction:** emit `splitNeeded`/`replacementSlices` or `obstruction` (+ `routeBack`) per
  the composed modules; the engine acts on them exactly as for a standalone S2/S4. **When you split, set
  `built: false`** and decide it from the plan before writing code — a bare `routeBack` you return is also
  honored even on a built result (`S2`/`S3` re-enter this slice; `S0`/`S1` escalate upstream to the
  phase/initiative driver), but a split *after* an inline build orphans changes the engine can't revert.

```
verdict:           "PASS" | "FAIL" | "BLOCKED"
failedCriterion:   string | null
artifactPath:      the slice dir
built:             boolean        // true ⇒ built inline; false ⇒ stopped at the plan (CRITICAL → FULL)
readyToBuild:      boolean        // true on a built FAST slice
readyToVerify:     boolean        // true when stopped at the plan for FULL-lane verification
riskTier:          "TRIVIAL" | "STANDARD" | "CRITICAL"   // CRITICAL ⇒ stopped at the plan
size:              "XS" | "S" | "M" | "L" | "XL"   // concrete size after read-before-write; ≥M ⇒ CRITICAL, stop at the plan (the engine cross-checks this)
lane:              "FAST" | "FULL"   // optional; "FULL" is an explicit CRITICAL signal (riskTier:"CRITICAL" is the primary one)
surfaces:          string[]
changedFiles:      string[]       // populated iff built; MUST be [] on any split/obstruction OR CRITICAL-stop return (non-empty on a kept-route ⇒ orphaned inline build)
splitNeeded:       boolean
replacementSlices: Slice[]
obstruction:       Obstruction | null
routeBack:         RouteBack | null
```
