# Strike Build Engine — a Claude Code workflow port of Strike

A faithful, production-oriented port of the [Strike](https://github.com/emanualjade/strike)
workflow to a **Claude Code workflow** (a single JavaScript orchestration script driven by the
`Workflow` tool).

It reuses Strike's actual skill prompts **verbatim** (vendored under `skills/`) and preserves
Strike's exact on-disk artifact layout. What it replaces is Strike's `go` + `state.json`
orchestration layer — that becomes a deterministic JS engine plus the workflow's own journal.

> **Nothing here modifies the Strike repo.** The skills under `skills/` were fetched read-only
> from GitHub and vendored locally.

---

## The seam

Strike's full pipeline is:

```
refine-idea → grill-idea → create-main-spec → create-development-phases
   └─ per phase: create-phase-spec → create-phase-slices
        └─ per slice: research-slice → plan-slice → verify-slice-plan
                      → build-slice → verify-slice-build
   → verify-phase → verify-main-spec      (with fix → re-verify loops throughout)
```

We split it deliberately:

| Stage | Who runs it |
| --- | --- |
| `refine-idea`, `grill-idea` | **You + Claude, interactively in chat.** These pressure-test *you*; a background workflow can't. |
| everything from `create-main-spec` onward | **This workflow**, hands-off. |

The refined idea + resolved decisions from your chat session are handed to the engine as `args`.

---

## How to run it

You don't run JavaScript or a CLI command — you ask Claude, and Claude drives the `Workflow` tool.

1. **Refine + grill with Claude in chat** until the idea and key decisions are locked.
2. **Tell Claude to launch the build engine.** Claude calls the `Workflow` tool with:
   - `scriptPath`: `.claude/workflows/strike-build-engine.mjs`
   - `args`: the object below (Claude assembles it from your chat).
3. **Watch progress** with the `/workflows` command — you'll see `Main spec → Phases →
   Build phase-01 (slices…) → Verify main spec` fan out, with fix-loops retrying failed gates.
4. **Claude reports back** when it finishes: what built, what verified, and every assumption /
   blocker / route-back the engine logged.

### `args` shape

```jsonc
{
  "initiativeId":   "csv-export",            // kebab-case; becomes strike/initiatives/<id>/
  "initiativeName": "CSV export for billing",
  "idea":           "<the refined idea / outcome from refine-idea>",
  "decisions":      "<resolved decisions, accepted assumptions, rejected paths from grill-idea>",
  "constraints":    "<optional: tech, deadlines, non-negotiables>",
  "repoContext":    "<optional: stack, key paths, conventions>",

  // optional engine knobs (defaults shown)
  "skillsDir":         "/Users/cracklehat/Sites/workflow-exploration/strike-engine/skills",
  "maxFixAttempts":    3,
  "maxRouteBacks":     4,
  "maxSplitsPerPhase": 6
}
```

See `input.example.json` for a filled-in example.

---

## Where files land

Two separate locations — this trips people up, so it's worth being explicit:

| What | Where | Why |
| --- | --- | --- |
| **The engine** (`strike-build-engine.mjs`) + **vendored skills** (`skills/`, `references/`) | **Here**, in `workflow-exploration`. The engine reads skills from the absolute `skillsDir`. | This is the reusable "engine," installed once. |
| **The build output** — `main-spec.md`, phase/slice files, **and the actual code changes** | **The current working directory the workflow is launched from** (`strike/initiatives/<id>/…` + your source files). | The engine writes into whatever repo you point it at. |

> **To build a real feature, launch from your target project's directory.** The engine reads its
> skills from the absolute `skillsDir` here, but writes artifacts + code into the repo you run it
> in. Running it from *this* sandbox will scaffold a `strike/` tree here — fine for a dry run,
> not where you want a real feature built.

---

## Directory map

```
workflow-exploration/
├── .claude/workflows/
│   └── strike-build-engine.mjs        # THE workflow (one JS file; name- or path-callable)
└── strike-engine/
    ├── README.md                      # this file
    ├── input.example.json             # example args
    ├── skills/                        # Strike skills, vendored verbatim (read-only clone)
    │   ├── create-main-spec/SKILL.md
    │   ├── create-development-phases/SKILL.md
    │   ├── create-phase-spec/SKILL.md
    │   ├── create-phase-slices/SKILL.md
    │   ├── research-slice/SKILL.md
    │   ├── plan-slice/SKILL.md
    │   ├── verify-slice-plan/SKILL.md
    │   ├── build-slice/SKILL.md
    │   ├── verify-slice-build/SKILL.md
    │   ├── verify-phase/SKILL.md
    │   ├── verify-main-spec/SKILL.md
    │   └── fix/SKILL.md
    └── references/                    # shared Strike references (language, slug policy, state machine)
        ├── language.md
        ├── slug-policy.md
        └── scripts/{slugify.mjs, go-state.mjs, ...}
```

---

## How the engine works

- **State machine, faithfully reproduced.** The three-level check graph
  (`researchComplete → planCreated → planVerified → implemented → buildVerified` per slice;
  `phaseSpecCreated → slicesCreated → allSlicesVerified` per phase;
  `specCreated → phasesCreated → allPhasesVerified` per initiative) and the reopen-cascade
  semantics mirror Strike's `go/scripts/state.mjs`.
- **Each step is a subagent** told to follow the vendored `SKILL.md` to the letter, given the
  exact artifact paths and an autonomous (hands-off) policy. Structured output (validated JSON
  Schema) flows between steps so the engine can make routing decisions deterministically.
- **Verify → fix → re-verify.** Every verifier loops through `fix` until it passes or
  `maxFixAttempts` is hit (then it logs a blocker).
- **Route-backs are honored, bounded.** A verifier can send a slice back to an earlier check
  (e.g. re-research after a split); the engine resets the cursor, capped by `maxRouteBacks`.
- **Slice splitting** (when research/plan says a slice is too broad) updates the live slice list
  and re-processes, capped by `maxSplitsPerPhase`.

### Hands-off escalation

A background workflow can't stop to ask you a question. So where a Strike skill says *"ask one
consequential question,"* the subagent instead makes the most reasonable, clearly-labeled
**assumption**, records it, and continues. Genuinely unrepairable items become **blockers** in the
final report. Nothing is silently swallowed — assumptions, blockers, and route-backs are all
collected and returned.

---

## Resume

Workflows journal every `agent()` call. To resume after an interruption or a script edit, Claude
re-launches with `{ scriptPath, resumeFromRunId }`: the unchanged prefix returns cached results
instantly; only new/edited steps re-run. The on-disk Strike artifacts also make every step
independently re-readable, so a fresh agent can always pick up the trail.

---

## Known v1 limitations (deliberate, documented)

These are honest scope boundaries for the first production cut, not bugs:

1. **Review lenses run inline, not as parallel agents.** Strike verifiers fan out into read-only
   review subagents; nested agent spawning isn't available inside a workflow, so verifiers use
   Strike's documented inline-lens fallback. *Enhancement:* orchestrate the lenses as
   `parallel()` workflow agents per verifier for true fan-out.
2. **Slices build sequentially.** `build-slice` mutates the working tree, so parallel builds would
   conflict. *Enhancement:* pipeline the read-only `research`/`plan` stages across slices, and/or
   run builds in `isolation: 'worktree'` for safe parallelism.
3. **Phase-level and final route-backs are logged, not auto-replayed.** If `verify-phase` or
   `verify-main-spec` routes all the way back to an earlier phase, v1 records it as a blocker
   rather than automatically rewinding and rebuilding. *Enhancement:* lift the cursor model to the
   phase/initiative level.
4. **`refine-idea` / `grill-idea` are intentionally out of scope** — they stay interactive (the seam).

---

## Provenance

Skills vendored read-only from `github.com/emanualjade/strike` (`plugins/strike/skills/…`).
This port reproduces the orchestration; it does not alter Strike.
