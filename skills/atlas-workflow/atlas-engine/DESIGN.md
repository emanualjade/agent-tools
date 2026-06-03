# Atlas v2 — Design Contract

This is the authoritative contract for the optimized build workflow. Every module, step
instruction, and the engine itself must conform to it. It is intentionally concise: the *prose*
lives in the module files; this file fixes the **architecture, interfaces, and invariants** so
parallel authoring stays coherent.

Derived from `atlas-engine/research/` (8-dimension failure-mode research + 3-design judge panel).
v1 (the faithful port at `.claude/workflows/atlas-build-engine.mjs` + `atlas-engine/`) is
preserved as reference; v2 supersedes it.

---

## 1. Philosophy & non-negotiables

1. **The loop owns the triggers, never the agent.** Stop / reassess / escalate fire from the
   engine (bounded retries, no-progress detection across agent calls, budgets) — an agent in
   sunk-cost mode is the worst judge of whether it is stuck.
2. **Unambiguous terminal states.** Every gate emits a machine-readable verdict — `PASS` / `FAIL`
   / `BLOCKED` with the failing criterion *named* — never prose to be interpreted.
3. **Verify observable behavior, not green tests.** "Verified" means the one behavior ran through
   its **real entry point with real data** (+ screenshot for UI). Green tests and "looks correct"
   are necessary, never sufficient, never reported as "verified."
4. **Fresh-context bar.** Every artifact is done only when a fresh context window can act on it
   without re-reading the chat transcript.
5. **Field-not-table by default.** An adjective on a noun is a state/enum/permission/scope on the
   existing entity until a new table is *argued for* (distinct columns AND relationships AND
   independent lifecycle).
6. **Thin AND complete slices; tracer-bullet first.** One observable behavior (no "and"), app left
   runnable. The first slice pierces every layer for the thinnest happy path, everything else
   stubbed. No slice ships infrastructure no current/next slice consumes.
7. **Two hats, one per commit.** A refactor commit changes zero behavior; a behavior commit
   changes zero structure.
8. **Surface-triggered rigor, never blanket ceremony.** Heavy guardrails attach only when a
   detection pass finds their trigger surface. A CSS change pays nothing. (Ceremony-on-everything
   is itself the failure mode — it trains agents to skim the checklist that guards the money path.)
9. **Conservative obstruction routing.** When the architecture fights a change, route by
   blast-radius × reversibility. If a door can't be *proven* two-way, treat it as one-way and
   escalate. Money / migrations / auth / external-effects are one-way by rule.
10. **Bounded everything + graceful degradation.** Per-loop budgets + an initiative-level ceiling.
    On exhaustion: record a blocker and degrade (revert to last green carrying one distilled
    lesson), never loop forever.
11. **Confidently-wrong is the high-severity class.** The stall detector is blind to non-looping
    silent errors (`days_held=0` skips everything, reports success). The honest behavior-ladder +
    spec-anchored tests + negative probes carry that load, not the counters.
12. **No substitution — fix-it-real or BLOCK-and-name-it.** A verifier credits only behavior it
    observed run through the slice's **real, designated path** — true entry point, real data, real
    datastore/tool, in the environment proper to the activity (browser/user-flow → the DEV env the
    human uses; automated tests → the TEST env with its real fixtures). Every prerequisite that path
    needs (env vars, secrets, tools/auth, the migration CLI, the existing house pattern, the dev DB)
    is **front-loaded in grill** OR **surfaced as a named hard blocker** — never silently substituted,
    skipped, reinvented, applied out-of-band, env-switched-for-convenience, or attested by inherited
    trust. "Green on a stand-in" is a **tamper, not a pass**. Deduped home: `disciplines/honest-verification.md`
    `no_substitution`.

---

## 2. Directory layout

```
atlas-engine/
  DESIGN.md                 # this contract
  README.md                 # usage + architecture + migration (authored last)
  disciplines/              # modality-AGNOSTIC cross-cutting modules (composed by steps)
    risk-tiering.md         # how a slice's tier is computed at birth; lane mapping
    read-before-write.md    # codebase-grounding protocol (run before planning)
    adjective-noun.md       # field-not-table lens + decision ladder
    canonical-research.md   # surface-triggered "use the proven way" + package-existence check
    obstruction-loop.md     # Tier 1/2/3 protocol, detection channels, upstream re-entry
    honest-verification.md  # the behavior ladder R0..R4 + tautology/test-tamper audit
    altitude-stepback.md    # enumerate-before-committing + reassess-against-external-objective
    two-hats.md             # refactor xor behavior per commit; diff-checkable invariants
    arch-debt-adr.md        # ARCH-DEBT marker format + <=1-page ADR template
  surfaces/                 # FIRST-CLASS modality registry (see section 5)
    _registry.md            # the pack interface + detection precedence + how packs compose
    web-backend.md          # richest pack (SQL/data, money, auth, migrations, API, UI)
    mobile.md               # offline-sync, app-store, binary/flag, simulator verification
    data-pipeline.md        # idempotent replay, schema evolution, backfill, sample-run verify
    infra-as-code.md        # plan/dry-run, drift, blast-radius, no-apply verification
    cli-devtool.md          # invoke-the-command verification, exit codes, stdout contracts
  front-door/               # INTERACTIVE layer — runs in the conversational agent, NOT the workflow
    refine-idea/SKILL.md    # step 1: vague idea -> clear first useful outcome (+ detected surfaces)
    grill-idea/SKILL.md     # step 2: lock the decisions the hands-off build would otherwise assume
    atlas.md               # the /atlas command: refine -> grill -> launch the build, one flow
  steps/                    # the lean step instructions ("skills v2") — the AUTONOMOUS build, in the workflow
    s0-spec-and-phases.md
    s1-phasespec-and-slices.md
    s2-plan.md
    s3-verify-plan.md
    s4-build.md
    s5-verify-build.md
    s6-verify-phase.md
    s7-verify-main-spec.md
    fix.md
  hooks/                    # OPTIONAL opt-in mechanical enforcement (engine works without it)
    README.md               # what it does, how to enable, the stall-signal contract

.claude/workflows/atlas.mjs   # THE engine (authored against this contract)
```

Runtime artifacts (written into the target repo, cwd-relative) keep v1's durable layout under
`atlas/initiatives/<id>/...`, **plus** `adr/` and an `ARCH-DEBT` convention (section 7).

---

## 3. The pipeline (7 steps; risk-routed lanes)

Steps above the slice level:

| Step | Name | Always? | Merge note |
| --- | --- | --- | --- |
| S0 | Main-spec + Phase-map | always | spec + phases in one artifact |
| S1 | Phase-spec + Slices | per phase | merged for small phases; split for L/high-risk |

Per-slice lanes, keyed off the slice's **risk tier** (section 4):

```
FAST  (TRIVIAL/STANDARD, non-domain):   S2 Plan(+inline evidence) → S4 Build → S5 Verify-Build
FULL  (CRITICAL, or any domain surface): S2 Plan → S3 Verify-Plan → S4 Build → S5 Verify-Build
```

Below the slice level:

| Step | Name | Note |
| --- | --- | --- |
| S6 | Verify-Phase | per phase |
| S7 | Verify-Main-Spec | **collapses into S6** when the initiative has exactly one phase |

**Read-before-write** (`disciplines/read-before-write.md`) runs *inside* S2 as its first action
(and inside S4 before edits) — it is a protocol, not a separate agent step, to stay lean.

### Step I/O contract (uniform)

Every step is one subagent that follows its `steps/*.md` file, writes its canonical artifact(s),
and returns a structured object. **Shared envelope fields on every step result:**

```
verdict:      "PASS" | "FAIL" | "BLOCKED"     // machine-readable; the gate
failedCriterion: string | null               // named on FAIL/BLOCKED
artifactPath: string                          // what it wrote
assumptions:  string[]                        // hands-off: consequential question -> assumption
blockers:     string[]                        // genuinely unrepairable
changedFiles: string[]                        // for build/fix
surfaces:     string[]                        // detected trigger surfaces (section 5)
obstruction:  Obstruction | null              // section 7
routeBack:    RouteBack | null                // section 6
```

Step-specific fields (e.g. `phases[]`, `slices[]`, `riskTier`, `ladderReached`) are layered on
top per the step file. The engine reads only the envelope + declared step-specific fields.

### Gate semantics

`PASS` → advance. `FAIL` with `routeBack=null` → run **fix** then re-run the same verifier
(bounded). `FAIL`/`BLOCKED` with `routeBack` → engine re-enters the named step (section 6).
`BLOCKED` with no route → record blocker, degrade gracefully.

---

## 4. Risk tiering (computed once, at slice birth in S1)

Each slice gets `{ size: XS|S|M|L|XL, riskTier: TRIVIAL|STANDARD|CRITICAL, surfaces: string[] }`.
Consumed by every downstream step to set lane + lens depth. Rubric lives in
`disciplines/risk-tiering.md`; the contract:

- **CRITICAL** if any domain surface fires (money, auth, security, persistence/migration,
  external-effect/idempotency, destructive op, PII) **OR** size ≥ M. → FULL lane, mandatory
  canonical + security lenses, verification ladder ≥ R3.
- **STANDARD** = S size, no domain surface. → FAST lane, ladder ≥ R2.
- **TRIVIAL** = XS, non-domain (copy/CSS/config/internal). → FAST lane, ladder R1, zero domain
  ceremony.
- Tier may only be **raised** downstream (never lowered) — if S2/S4 detects a surface the slicer
  missed, the slice is promoted to CRITICAL and re-routed to the FULL lane.

---

## 5. Surface / modality registry (first-class, not bolt-on)

The registry (`surfaces/_registry.md`) defines a **uniform pack interface**. Every modality is a
member of the same mechanism — web/backend simply ships the deepest pack. A pack provides:

```
detect:        triggers (file globs, imports, path conventions, keywords, AST/import signals)
               -> the surface flags this pack owns
guardrails:    [{ surface, when, check, oneWayDoor: bool }]   // attached only when `when` fires
verification:  ladder adjustments for this modality (what "real entry point with real data" means
               here, and which rungs are mandatory for which surfaces)
modelingNotes: modality-specific adjective-noun / boundary guidance (optional)
```

**Detection precedence:** packs run a cheap detection pass over the slice plan + changed files; a
slice may match multiple packs (a mobile app with a payments screen → mobile + web-backend money
guardrails both apply). Conflicts resolve to the **stricter** (more one-way) guardrail.

**Per-modality "real entry point with real data" (verification core, generalized):**
- web-backend: HTTP request / UI interaction with live data; screenshot for UI.
- mobile: simulator/emulator run + screenshot; offline→online sync exercised.
- data-pipeline: run on a representative sample; assert output rows/schema; idempotent re-run.
- infra-as-code: `plan`/dry-run diff inspected; never `apply` in verification; drift checked.
- cli-devtool: invoke the command; assert exit code + stdout/stderr contract.

Web/backend pack is **mandatory-deep** (money = integer minor units + currency + largest-remainder
split; idempotency keys on foreign-state mutations; expand/contract migrations; parse-at-boundary +
typed errors; additive-vs-breaking contract taxonomy; canonical library for auth/crypto/dates).
The other packs must be **genuinely useful** (real triggers + real guardrails), not stubs — but may
be shallower. All packs share the same schema so a new modality is added by dropping in a file.

---

## 6. Route-back & upstream re-entry (closes v1's biggest gap)

v1 logged phase/upstream route-backs as "not auto-handled." v2 **actually re-enters** them.

```
RouteBack = {
  targetStep: "S0" | "S1" | "S2" | "S3" | "S4",   // the owning step to re-enter
  phaseId: string | null,
  sliceId: string | null,
  check:  string,                                  // what was found wrong
  reason: string,
}
```

Engine behavior: on a route-back, reset the target step's check + everything downstream of it
(cascade, mirroring v1's reopen semantics), re-run the target step, then resume. Bounded by
`maxUpstreamRouteBacks` per initiative (S0); an S1-level route-back re-runs the owning phase, bounded
by `maxPhaseReentries`. A slice-split (S2 finds the slice too broad) returns replacement slices; the
**splitting agent writes each replacement's `slice.md` stub before returning**, and the engine updates
its in-memory slice list (the source of truth within a run — the engine has no filesystem access).
Resume relies on the workflow journal plus the durable on-disk artifacts (re-read by agents), not on
engine-side directory reconciliation.

---

## 7. Obstruction loop (`disciplines/obstruction-loop.md`)

The spine. When a build step (S4) or plan step (S2) hits architecture that fights the change:

**Detection — two channels, engine-corroborated, not self-judged:**
- **Channel A (declared):** the agent returns a structured `Obstruction` whenever the path requires
  one of: editing outside the slice's recorded footprint; touching a shared foundation; a new
  persistent schema/contract/public API not in the plan; or a choice between competing
  hard-to-reverse designs. These are *surface facts* (paths, schema verbs) the engine corroborates
  against `changedFiles`/the diff.
- **Channel B (mechanical, across agent calls):** the engine fires revert-and-reset when a slice's
  verifier FAILs `maxFixAttempts` times **with no acceptance criterion moving FAIL→PASS** between
  attempts (the "zero progress" signal an agent cannot dodge by perturbing the target). The
  *optional* hook layer (section 9) adds true per-tool-call fingerprinting; the engine works
  without it and benefits if present.

```
Obstruction = { tier: 1|2|3, blastRadius: string, reversibility: "two-way"|"one-way"|"unknown",
                description: string, candidates: string[], reversibleInterim: string }
```

**Decision tree (blast-radius × reversibility — no architectural taste required):**
- **Tier 1** — in-footprint AND behavior-preserving → preparatory refactor as a separate
  refactor-hat commit (tests green before+after), then resume the behavior commit. Hard-bounded to
  files the slice already touches; the moment it wants to reach further it becomes Tier 2.
- **Tier 2** — needs a NEW seam but reversible (two-way door: facade/adapter you can later replace
  without data loss or consumer breakage) → insert an **enabling slice** behind the facade (thin,
  demoable, prepended to the phase slice list, counts against `maxSplitsPerPhase`); build the
  current slice against the seam.
- **Tier 3** — irreversible (one-way door) OR competing hard-to-reverse design OR an **upstream**
  decision is wrong (spec shape / phase boundary / shared contract) → **escalate the DECISION, not
  the build:** write a ≤1-page ADR, drop an `ARCH-DEBT(slice-id)` marker at the exact site, proceed
  on the reversible interim, and (if upstream) emit a `routeBack` the engine re-enters.
  `reversibility:"unknown"` is treated as one-way. Money/migrations/auth/external-effects are
  one-way by rule.

**Record-keeping (as code, twice — chat does not count):** (1) grep-able
`ARCH-DEBT(<slice-id>): <reason> + <adr-link>` at the site; (2) committed ADR under
`atlas/initiatives/<id>/adr/NNN-*.md`. The next slice's read-before-write greps `ARCH-DEBT`
touching its footprint before coding. Every obstruction is absorbed into the run report.

---

## 8. Disciplines (modality-agnostic, composed by steps)

Each is a short, sharp module. Steps reference them rather than restating (kills v1's duplication).

- **risk-tiering** — section 4 rubric, as an agent-applicable checklist.
- **read-before-write** — find the real entry points, existing conventions/utilities to reuse,
  implicit invariants, and `ARCH-DEBT` touching the footprint, *before* planning/editing. Lean:
  targeted search, not a full-repo read. Output: a short "what exists" note feeding the plan.
- **adjective-noun** — the field-not-table ladder; the one-line distinct-columns-AND-relationships
  -AND-lifecycle test; the "UNION across tables = over-split" smell; cardinality-before-table.
- **canonical-research** — research IFF a surface fires (external/unstable/money/auth/dates/crypto);
  official docs + repo's actual pinned versions; package-existence/popularity check (anti-slopsquat);
  otherwise one-line "no research needed, why." Lean evidence: source → finding → implication.
- **honest-verification** — the ladder: R0 static/build, R1 focused tests (non-tautological),
  R2 behavior through real entry point with real data, R3 negative/edge probe + mandatory lenses,
  R4 cross-slice/integration. Tautology/test-tamper audit by a party that is **not** the implementer.
  "code-verified" when behavior verification is blocked — never "verified."
- **altitude-stepback** — for non-trivial plans: name 2–3 distinct approaches + one-line tradeoff
  before committing; on reassess, re-read the **external** acceptance criteria verbatim and emit a
  per-criterion PASS/FAIL table + a "goal requires vs changed so far" diff (never a freeform
  self-summary against polluted context).
- **two-hats** — refactor xor behavior per commit; diff-checkable (refactor: assertions unchanged;
  behavior: no file moves/renames).
- **arch-debt-adr** — the marker grammar + the ≤1-page ADR template (obstruction / 2–3 candidates
  with tradeoffs / reversibility / recommendation / reversible interim).

---

## 9. Enforcement layers (reliable, not rigid, not fragile)

Three layers, decreasing necessity:
1. **Orchestrator (always):** bounded loops (`maxFixAttempts`, `maxRouteBacks`, `maxSplitsPerPhase`,
   `maxUpstreamRouteBacks`, initiative `maxSlices`/`maxAgentCalls`); verify-driven retries;
   revert-and-reset across agent calls on zero-progress. Resume = workflow journal + on-disk artifacts
   (the engine has no filesystem access; splitter agents persist replacement `slice.md` stubs).
2. **Agent prompts (always):** every step self-applies its disciplines and **reports structurally**
   (obstruction, surfaces, ladderReached, per-criterion verdicts) so the orchestrator can act.
3. **Hooks (optional, opt-in):** `hooks/` ships a `PostToolUse` hook + settings snippet that
   fingerprints edits and writes a **stall-signal file** the engine reads if present. The engine
   must run fully **without** hooks and simply gain sharper mid-build detection **with** them. Hooks
   are never required and never assumed.

---

## 10. Engine responsibilities (`.claude/workflows/atlas.mjs`)

- Drive S0 → S1 → (per phase: per slice lane) → S6 → S7, with the merges in section 3.
- Compute nothing the agents should compute; consume `riskTier`/`surfaces`/`obstruction`/`routeBack`
  from structured outputs and route deterministically.
- Implement the route-back re-entry + cascade (section 6) and the obstruction Tier-1/2/3 handling
  (section 7) — including actually re-entering S0/S1/S2.
- Enforce all budgets + the initiative ceiling; degrade gracefully on exhaustion.
- Keep the in-memory slice list as the source of truth within a run; splitter agents persist each
  replacement `slice.md` so a fresh agent can read any slice. (No engine-side filesystem access.)
- Read the optional stall-signal file if present (section 9.3).
- Skills/modules read from an absolute `enginirootDir` (default the absolute path of
  `atlas-engine/`); artifacts + code written into cwd (the target repo). Hands-off escalation
  policy carries over from v1 (consequential question → recorded assumption; only genuine blockers
  stop).
- Return a full auditable report: per-phase/slice status, assumptions, blockers, route-backs,
  obstructions (with tier/reversibility), ADRs written, changed files, final verdict.

---

## 11. Authoring rules for every module/step (the leanness bar)

- **Lean because effective, not lean for its own sake.** Cover the step's objectives completely;
  cut words, never coverage. If a sentence doesn't change what the agent does, delete it.
- No duplication across files — reference a discipline module instead of restating it.
- No dead vestiges (no `state.mjs` hints, no "alert the user" in a hands-off engine, no doubled
  "ask one consequential question", no repeated "reread as if transcript is gone").
- Every gate states its PASS condition as a checkable, named-criterion verdict.
- Every instruction is modality-aware via the registry, never hard-coded to web/backend.
- Write for a fresh-context subagent that has only: this file, the disciplines it references, the
  canonical artifact paths, and the slice/phase context.

---

## 12. The two layers (front door + build engine)

v2 is **two layers**, split by who can talk to the human:

- **Front door (interactive — `front-door/`):** `refine-idea` and `grill-idea` are skills the
  *conversational agent* runs, because only that layer can ask the user questions. They turn a vague
  idea into a refined idea + a locked decision log, and assemble the build's `args`. The grill's
  defining job is to **front-load exactly the decisions the hands-off engine would otherwise assume** —
  especially one-way-door surfaces (money/auth/data/migrations/external/PII/destructive), which the
  engine treats conservatively. The `/atlas` command runs refine → grill → launch as one flow.
- **Build engine (autonomous — `steps/` + the workflow):** starts at S0 with those `args` and runs to a
  verified feature with no human in the loop. A workflow cannot pause for input, which is *why* the
  front door is a separate interactive layer rather than a workflow step.

This is the full original-Atlas shape (refine → grill → build → verify) mapped onto the right layers.

## Migration from v1

v1 stays in place (`.claude/workflows/atlas-build-engine.mjs`, `atlas-engine/`) as reference. When v2
is verified on a real feature it becomes the default and v1 can be archived.
