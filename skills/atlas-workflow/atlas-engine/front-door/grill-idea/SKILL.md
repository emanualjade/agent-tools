---
name: grill-idea
description: Pressure-test a refined idea until the consequential decisions are locked — especially the ones the autonomous build would otherwise guess. Produces the decision log + atlas build launch args. Step 2 of the front door.
allowed-tools: Read Write Edit Grep Glob WebFetch WebSearch
---

# Grill Idea — atlas front door (step 2 of 2)

Pressure-test the refined idea until the consequential decisions are explicit — *interactively, one
question at a time.*

**The whole point:** the atlas build runs **hands-off** and **cannot ask you mid-run** — where it
lacks a decision it will *assume* and proceed, and for a one-way-door surface it will write an ADR and
build a *reversible interim* rather than commit. **Your job is to front-load exactly those decisions** so
the build matches intent instead of guessing. Garbage in, garbage out — this is the highest-leverage
step in the whole system.

## Stance

- Ask **one consequential question at a time**; say **why it matters**; offer a **recommended default**
  when it helps. **Wait** for the answer — never infer from silence, a missing UI, or a failed tool.
- Pressure-test a vague answer with a **concrete scenario**. Show alternatives only to help the user choose.
- Grill **only** decisions that change behavior, scope, model shape, risk, or validation. Don't bikeshed
  reversible trivia — recommend a default and move on.
- Inspect the repo/context for what's already knowable instead of asking.
- Treat a detailed kickoff as decision *evidence*, not automatic completion — record what it answered and
  what's still vague.

## Decision depth (default: standard)

- `lean` — lock the consequential decisions; assume reversible low-risk details.
- `standard` — pressure-test major product / domain / data / validation / risk decisions enough to spec
  without guessing.
- `deep` — examine tradeoffs, edge cases, and follow-on decisions for important nodes.

**Never assume on a one-way-door surface** — auth, security, privacy, payments/money, destructive data,
ownership, permissions, compliance, hard-to-reverse architecture, or a newly-added dependency — unless the
user **explicitly accepts** it. These are precisely what the build treats as CRITICAL / one-way; an
un-locked one becomes an ADR + interim, not what you wanted.

## Priority targets — grill these first (they are what the build would otherwise assume)

1. **The detected surfaces** from refine (money | auth | data | migrations | external | PII | destructive).
   Lock the *rule* for each — e.g. money: which currency? rounding? how is a split made to sum exactly?
2. **Domain model shape — core noun before qualifiers.** If sibling terms appear (`DraftPost`/`PublishedPost`,
   `PublicUser`/`PrivateUser`, `ArchivedOrder`), **ask** whether the qualifier is a field / enum / state /
   permission / scope — *not* a new table. (The build defends this, but your stated intent makes it right
   the first time.)
3. **Required build capabilities & runtime config (run-and-verify prerequisites).** For **every**
   detected surface + integration, enumerate everything the **autonomous** build must *already have* to do
   the real work **and** verify R2 through the slice's real path: CLIs/tools (`neon`/`psql`/`terraform`/the
   migration CLI), credentials & auth, account/project access, network/service reachability, env
   vars/secrets/connection strings, sandbox-or-test credentials, **and the designated verification
   environment**. For each, state: *what it is*, *why it's needed*, *how the human provisions it*, and a
   *disposition* — `provide-now` | `local-fake-OK` | `sandbox-key-here` | `none-needed`. The build cannot
   ask for these mid-run: a tool/credential/env-var the build discovers missing while running is an
   un-fixable hard blocker (front-load it here or you have shipped a guaranteed degraded run). This is the
   *only* layer that can ask the human — provision it now or surface it as a launch blocker (see Open /
   Blocking), never let the build silently substitute, skip, or stub it.
4. **Scope** — in / out (with why) / never.
5. **Success criteria** — what "done" means, statable as **binary** checks.

Then use the rest as a **menu, not a checklist:** flows / lifecycle / state / invariants; ownership /
permissions; integrations / external side-effects / failure cases; UI / API / CLI behavior; validation
evidence (focused tests, browser/screenshot, live checks).

## Output

Write the decision log to `atlas/initiatives/<id>/idea-decisions.md`:

```md
# Idea Decisions
## Decision Depth                 (lean | standard | deep + why)
## Decisions Resolved             (Decision / Why / Rejected / Impact / Revisit-if)
## Accepted Assumptions
## Deferred Decisions
## Surface Rulings                (per detected surface: the locked rule)
## Required Capabilities & Preflight  (per capability: capability | why | provisioned?/waived-with-fallback | how-to-verify-present)
## Environments                   (the DEV/click-through env for browser R2 + the TEST env for automated tests; per-env caveats; which verification runs where — see below)
## Domain Language / Model        (core nouns; each qualifier → field/enum/state/permission call)
## Success Checks                 (binary; repo-verifiable vs live/human)
## Questions Asked & Answered     (each consequential decision: the question put + the user's answer, or "user explicitly accepted default X")
## Open / Blocking                (None, or the blocking question)
```

- **`## Required Capabilities & Preflight`** — one row per capability from Priority Target 3. `provisioned?`
  is yes / no / `waived-with-fallback` (the named local-fake or sandbox stand-in the build is permitted to
  use, e.g. `local-fake-OK`). `how-to-verify-present` is the concrete probe the build can run to confirm the
  capability is really there before relying on it (e.g. `psql -c 'select 1'`, `terraform version`, env-var
  set & non-empty). A capability on a domain/external surface left `no` and **not** `waived-with-fallback`
  is a launch blocker.
- **`## Environments`** — name **both**: the **DEV** environment where the human-facing browser / user-flow
  click-through (R2) runs, **and** the **TEST** environment where automated unit/integration/E2E tests run
  with that env's real fixtures/setup. Note any per-env caveats (e.g. *"ingest does not run in the test
  env"*) and which kind of verification runs where. Each activity is scoped to its proper environment — the
  build must **not** reconfigure the test env to do what it normally doesn't, run a test as-if-dev, or switch
  to a convenient env. **MANDATORY** whenever a persistence/migration/external/UI surface is present;
  otherwise state the repo default.
- **`## Questions Asked & Answered`** — for every consequential decision, record the question you put and the
  user's literal answer (or *"user explicitly accepted default X"*). **`inferred-from-context` is NOT
  acceptable** for any one-way-door surface — that decision must trace to an explicit user answer here.

Then assemble the **build launch args** and present them to the user to confirm verbatim:

```md
## Build Launch Args (for atlas)
initiativeId:   <kebab-id>   ← LOAD-BEARING. This is the field that binds the front door to the build. It
                               MUST be the SAME <id> you used for refined-idea.md / idea-decisions.md, so
                               the build lands in atlas/initiatives/<id>/ and reads those files by id.
                               If omitted, the build runs as "initiative" (the default), writes to a
                               DIFFERENT atlas/initiatives/ dir, and orphans this decision log — the build
                               then cannot find your rulings by id. NEVER let this fall back to the default.
initiativeName: <human title>
idea:           <first useful outcome + key framing from refined-idea.md>
decisions:      <Decisions Resolved + Surface Rulings + Accepted Assumptions + rejected paths>
constraints:    <tech / deadlines / non-negotiables, or "none">
repoContext:    <stack + key paths + conventions, or "greenfield empty directory">
```

## Surface-lock + preflight gate (launch-blocking)

Before launch, resolve `## Open / Blocking` against this gate. **BLOCKER — do NOT call the Workflow tool
if** (i) any refine-detected surface lacks an explicit **Surface Ruling** or user-accepted assumption, **OR**
(ii) any required capability/config on a **domain/external** surface is un-provisioned **AND**
un-waived (no `waived-with-fallback`). An empty or placeholder `## Surface Rulings` while
`Detected Surfaces` is non-`none` = **BLOCKED, not launchable**. On BLOCKED, write the unresolved item into
`## Open / Blocking`, **present it to the user as the blocking question, and wait** — do not launch, do not
infer, do not let the build "discover" it mid-run. A needed tool/credential/env-var the build discovers
missing mid-run is an un-fixable hard blocker: front-load it here or you have shipped a guaranteed degraded
run.

## Handoff

When the user **confirms** and the surface-lock + preflight gate above is clear (`## Open / Blocking` =
None), launch the build: call the **Workflow** tool with `scriptPath` = the absolute path to
`.claude/workflows/atlas.mjs` in this project, and `args` = the object above.

**HARD RULE — thread the id (do NOT skip this).** When you call the Workflow tool you **MUST** set
`args.initiativeId` to the **SAME `<id>`** you used for `refined-idea.md` / `idea-decisions.md` — **never**
the default. If `initiativeId` is omitted the build runs as `"initiative"`, writes to a **DIFFERENT**
`atlas/initiatives/` dir, and **orphans this decision log — the build then cannot find your rulings by
id** (and you have spawned two orphan-able dirs). `args.initiativeId` is the load-bearing field that binds
the front door to the build; confirm it matches the front-door `<id>` before you launch.

Then watch with `/workflows` and report back when it finishes (built / assumptions / blockers /
obstructions / ADRs).

Do **not** write the spec yourself — that is the build's S0. Do not turn the decision log into a spec.
Seed `PROJECT_LANGUAGE.md` at the repo root if absent (header-only); reconcile new durable nouns into it.
