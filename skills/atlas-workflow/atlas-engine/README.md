# Atlas v2 — the optimized feature-building workflow

The build workflow we use for production features. A research-grounded successor to the v1 Atlas
port: **leaner where it can be, more rigorous where it must be.** Same seam — refine + grill happen
with you in chat — but everything from spec onward is one autonomous, self-correcting workflow.

- **Engine:** `.claude/workflows/atlas.mjs`
- **Contract:** [`DESIGN.md`](./DESIGN.md) — the authoritative architecture + interfaces
- **Modules:** `disciplines/` (cross-cutting), `surfaces/` (modality packs), `steps/` (the pipeline)

> Built by researching *how LLM coding agents actually fail* and designing each guardrail to counter
> a specific failure mode — then adversarially reviewing the result.

---

## What's different from v1 (the five upgrades)

1. **Risk-routed lanes.** A slice's risk tier is computed once at birth; a CSS tweak and a payments
   ledger no longer pay the same toll. The uniform 5-step-per-slice ceremony — which was both the
   waste *and* a quality leak (a checklist run on everything gets skimmed on the path that matters) —
   is gone.
2. **A real architectural-obstruction loop.** When the architecture fights a slice, the engine routes
   by blast-radius × reversibility and — critically — **actually re-enters upstream steps** when the
   spec/phase/contract is wrong. (v1 logged this as "not auto-handled.")
3. **Surface-triggered rigor.** Heavy guardrails attach only when a detection pass finds their trigger
   surface — via a first-class **modality registry** (web/backend deepest; mobile, data-pipeline,
   infra-as-code, CLI are real packs, not stubs).
4. **The loop owns the triggers.** Stop/reassess/escalate fire from the engine (bounded retries,
   zero-progress detection, budgets) + optional hooks — never the agent's self-judgment. On a stall:
   **revert-and-reset**, not continue-and-correct.
5. **Honest verification.** "Verified" = the one behavior runs through its **real entry point with real
   data** (+ screenshot for UI), with a tautology/test-tamper audit by a *separate* agent. Green tests
   are never reported as verified.

---

## The pipeline

```
                S0  Main-spec + Phase-map (merged; writes the binary acceptance-criteria objective)
                          │
   per phase ─────────────┼──────────────────────────────────────────────────────────────
                S1  Phase-spec + Slices (merged for small phases) → assigns each slice {size, tier, surfaces, lane}
                          │
     per slice ───────────┤   FAST lane (TRIVIAL/STANDARD):   S2 Plan ─────────────→ S4 Build → S5 Verify-Build
                          │   FULL lane (CRITICAL/domain):    S2 Plan → S3 Verify-Plan → S4 Build → S5 Verify-Build
                          │
                S6  Verify-Phase   (folds in S7 when the initiative has one phase)
                          │
                S7  Verify-Main-Spec   (final gate; skipped when single-phase)
```

Cross-cutting through every step (only when relevant): **read-before-write** grounding,
**adjective-noun** (field-not-table), **canonical research** (surface-gated),
**altitude/step-back**, **two-hats** commits, **obstruction loop**, **honest-verification ladder**.

`verify → fix → re-verify` loops wrap each gate; on zero-progress the engine reverts-and-resets.

---

## How to run it

You don't run JS — the front door drives it. End to end:

1. **`/atlas <vague idea>`** — the `refine-idea` then `grill-idea` skills brainstorm + pressure-test
   *with you*, locking the decisions the autonomous build would otherwise assume (it can't ask you
   mid-run). This is the interactive layer — see [`front-door/`](./front-door). (Prefer it over a bare
   "run the build" prompt: skip the grill and the build assumes its way through everything you left vague.)
2. **It launches the build** — `Workflow` with `scriptPath: .claude/workflows/atlas.mjs` and the
   `args` the grill assembled (below).
3. **Watch with `/workflows`** — `S0 → S1 → Build P1 (slices…) → S6 → S7` fans out, lanes and
   obstruction route-backs visible live.
4. **Claude reports back** — phases verified, slices processed, and every assumption / blocker /
   route-back / **obstruction (with tier + reversibility) / ADR** the run logged.

### `args`

```jsonc
{
  "initiativeId":   "csv-export",
  "initiativeName": "CSV export for billing",
  "idea":           "<refined idea / outcome from refine-idea>",
  "decisions":      "<resolved decisions, accepted/rejected paths from grill-idea>",
  "constraints":    "<optional>",
  "repoContext":    "<optional: stack, key paths, conventions>",

  // engine knobs (defaults shown)
  "rootDir":               "/Users/cracklehat/Sites/agent-tools/skills/atlas-workflow/atlas-engine",
  "maxFixAttempts":        3,
  "maxRouteBacks":         4,
  "maxSplitsPerPhase":     6,
  "maxUpstreamRouteBacks": 2,
  "maxSlices":             40,
  "maxAgentCalls":         400
}
```

### Where files land

- **Engine + modules** live here (`rootDir`); the engine reads its steps/disciplines/surfaces from
  the absolute `rootDir`, so it works when launched from *any* target repo.
- **Build output** — `main-spec.md`, `acceptance-criteria.md`, phase/slice artifacts, **ADRs under
  `atlas/initiatives/<id>/adr/`**, and the **actual code changes** — land in the **cwd the workflow
  is launched from** (your target repo). Launch from the project you're building in; running from this
  sandbox just scaffolds a `atlas/` tree here.

---

## Enforcement layers (reliable, not rigid, not fragile)

1. **Orchestrator (always):** bounded loops + initiative ceilings (`maxSlices`, `maxAgentCalls`),
   verify-driven retries, revert-and-reset across agent calls, graceful degradation on exhaustion.
2. **Agent prompts (always):** every step self-applies its disciplines and reports structurally
   (obstruction, surfaces, ladder rung, per-criterion verdicts) so the orchestrator can route.
3. **Hooks (optional, opt-in):** `hooks/README.md` provides a ready-to-paste `PostToolUse` hook
   (script + settings snippet) that writes a stall-signal file the engine reads *if present* — true
   per-tool-call mechanical enforcement. The engine runs fully without it; it's global to the
   session, so enable deliberately.

---

## Modality registry (first-class, not bolt-on)

`surfaces/_registry.md` defines a uniform pack interface (`detect / guardrails / verification /
modelingNotes`). Web/backend ships the deepest pack; mobile, data-pipeline, infra-as-code, and CLI are
genuinely useful members of the **same** mechanism. Adding a modality = dropping a conforming file in
`surfaces/`. Each pack defines what "real entry point with real data" means for that modality
(HTTP/UI · simulator+screenshot · sample-run+assert · plan/dry-run · invoke-the-command).

---

## Directory map

```
atlas-engine/
├── DESIGN.md                 # the authoritative contract
├── README.md                 # this file
├── disciplines/              # risk-tiering, read-before-write, adjective-noun, canonical-research,
│                             #   obstruction-loop, honest-verification, altitude-stepback, two-hats, arch-debt-adr
├── surfaces/                 # _registry + web-backend, mobile, data-pipeline, infra-as-code, cli-devtool
├── steps/                    # s0..s7 + fix
└── hooks/                    # optional opt-in mechanical enforcement
.claude/workflows/atlas.mjs   # the engine
```

---

## Known limitations (honest, deliberate v2.0 scope)

- **Upstream re-entry re-runs from S0.** A Tier-3 upstream route-back re-enters the whole initiative
  (bounded by `maxUpstreamRouteBacks`); already-written artifacts make re-runs cheaper, but it is not
  a surgical resume. Targeted re-entry is future work.
- **On-disk slice reconciliation is light.** Within a run the in-memory slice list is source of truth;
  full reconciliation against `slices/` for resume-after-split is a documented enhancement.
- **Confident-silent-errors** (non-looping, reports success) are the high-severity class the stall
  counters can't see — they're caught by the honest-verification ladder + spec-anchored oracles +
  negative probes, which is a strong but not infinite defense.
- **Modality depth varies.** Web/backend is mandatory-deep; the other packs are real but shallower —
  extend them as you use those stacks.
