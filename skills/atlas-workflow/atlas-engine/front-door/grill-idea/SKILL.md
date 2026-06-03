---
name: grill-idea
description: Pressure-test a refined idea until the consequential decisions are locked — especially the ones the autonomous build would otherwise guess. Produces the decision log + atlas build launch args. Step 3 of the front door.
allowed-tools: Read Write Edit Grep Glob WebFetch WebSearch
---

# Grill Idea — atlas front door (step 3 of 3)

Pressure-test the refined idea until the consequential decisions are explicit — *interactively, one
question at a time.*

**The whole point:** the atlas build runs **hands-off** and **cannot ask you mid-run** — where it
lacks a decision it will *assume* and proceed, and for a one-way-door surface it will write an ADR and
build a *reversible interim* rather than commit. **Your job is to front-load exactly those decisions** so
the build matches intent instead of guessing. **The plan's quality is forged *here*, in this conversation
with the user — the build only executes what you lock together. Deciding a consequential question *for*
the user doesn't save time; it skips the one step that makes the plan good.** Garbage in, garbage out —
this is the highest-leverage step in the whole system.

## Stance

- **Read the research first.** If `atlas/initiatives/<id>/resources/index.md` exists, read it (and the
  reports it lists) **before** pressure-testing — grill on the grounded facts, and turn each finding /
  unknown into a decision, accepted assumption, deferral, or blocker. Don't ask the user a factual
  question the research already answers.
- **A material unknown is a research gap, not a user question.** If a consequential decision needs a fact
  that isn't in `resources/` (a missing API / model / domain detail), don't guess and don't quiz the user —
  **route back to `research-idea`** to research it, then continue grilling on the result.
- Ask **one consequential question at a time**; say **why it matters**; offer a **recommended default**
  when it helps. **Wait** for the answer — never infer from silence, a missing UI, or a failed tool.
- Pressure-test a vague answer with a **concrete scenario**. Show alternatives only to help the user choose.
- Grill **every** decision that changes behavior, scope, model shape, risk, or validation — one at a time,
  until you and the user genuinely agree. **Default *only* truly reversible, low-risk trivia.** Never
  silently decide a consequential or user choice — product intent, scope, risk, ownership, **and especially
  the engineering hardening: stack, dependencies, data model, persistence, auth.** If you're unsure whether
  it's trivia, it isn't — ask.
- **Never draft around a fork.** A working draft of the decision log is **not** a substitute for live
  questioning. If writing the log surfaces an unresolved consequential fork — *"let me just record the
  stack / domain model and move on"* — **stop and ask the next question** before recording it. Recording a
  decision the user never made is the exact failure this step exists to prevent.
- **Hardening decisions get explicit handling, never a silent default:** stack, dependencies / package
  installs, runtime, tooling, data model, persistence, auth / identity, session, permissions, ownership.
  Each must be a *user-confirmed decision* or an *explicitly-accepted assumption* — never inferred.
- Inspect the repo/context for what's already knowable instead of asking.
- Treat a detailed kickoff as decision *evidence*, not automatic completion — record what it answered and
  what's still vague.

## How to grill — walk the decision tree until each node is exhausted

Grill is a **loop, not a fixed-size pass.** Keep walking the consequential decision tree until every node
is **exhausted**, and only then proceed to the Output + Decision Review. A node is exhausted only when it is:
- **resolved** — the user, or a fact from research/repo, settled it;
- **explicitly assumed** — recorded under `## Accepted Assumptions` (never silently);
- **deferred** — with a named later stage / owner; or
- **blocked** — recorded under `## Open / Blocking`.

Triage each node by *who can answer it*:
- **Fact** → answerable from the research (`resources/`), repo code, or official sources. **You resolve it**
  and record the evidence — never ask the user a factual question the research already answers.
- **Tradeoff** → genuine engineering judgement on a *reversible* call. **Recommend** an answer with a one-line
  why, then **ask the user to confirm and record their answer — silence is not confirmation.**
- **Choice** → needs user preference, product intent, scope, risk tolerance, or a business rule. **Ask the
  user** one question.
- **Hardening / one-way-door** (stack, dependencies, data model, persistence, auth, identity, permissions,
  ownership, money, migrations, external, destructive) → **always a `user-choice`** (or `factual` only when
  research/repo genuinely settles it). A recommendation does **not** downgrade the requirement to ask — these
  may **never** be typed `tradeoff` to slip past the recorded question.
If an answer opens new consequential nodes, keep walking. **Do not proceed to assemble the launch args while
any consequential node is unresolved.**

Depth tunes how far you explore *within* a node — `lean` (lock the consequential, assume reversible trivia) ·
`standard` (pressure-test major product/domain/data/risk decisions) · `deep` (tradeoffs, edge cases,
follow-ons). Depth changes breadth-per-node; it **never** lets a consequential node exit un-exhausted.

**Never assume on a one-way-door surface** — auth, security, privacy, payments/money, destructive data,
ownership, permissions, compliance, **stack / runtime / hard-to-reverse architecture**, or a newly-added
dependency — unless the user **explicitly accepts** it. These are precisely what the build treats as CRITICAL / one-way; an
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
## Decision Tree                  (EVERY consequential node — the anti-gloss spine; one block each:
                                  ·  Node:           what's being decided
                                  ·  Type:           factual | tradeoff | user-choice
                                  ·  Status:         resolved | assumed | deferred | blocked
                                  ·  Evidence:       (factual) the source/repo/research it was resolved from
                                  ·  User question:  (user-choice) the exact question asked + the user's answer — REQUIRED for a user-choice; a user-choice with an empty answer is an un-exhausted node, not a decision
                                  ·  Recommendation: your recommended answer + one-line why
                                  ·  Follow-on:      new nodes this opened)
## Decisions Resolved             (Decision / Why / Rejected / Impact / Revisit-if)
## Accepted Assumptions
## Deferred Decisions
## Hardening Decisions            (stack | dependencies | runtime/tooling | data model | persistence | auth/identity | permissions/ownership — each: the decision + "user-confirmed" or "accepted-assumption", never blank/inferred)
## Surface Rulings                (per detected surface: the locked rule)
## Required Capabilities & Preflight  (per capability: capability | why | provisioned?/waived-with-fallback | how-to-verify-present)
## Environments                   (the DEV/click-through env for browser R2 + the TEST env for automated tests; per-env caveats; which verification runs where — see below)
## Domain Language / Model        (core nouns; each qualifier → field/enum/state/permission call)
## Success Checks                 (binary; repo-verifiable vs live/human)
## Questions Asked & Answered     (the `user-choice` rows of the Decision Tree, surfaced — one source of truth: the question put + the user's answer, or "user explicitly accepted default X"; don't re-decide here)
## Decision Review               (Reviewer / Verdict: pass | accepted-risk / Must-Fix count — see "Decision Review" below)
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

## Decision Review (before launch)

Before launch, run a **read-only Decision Review** of `idea-decisions.md` — a fresh pass (a separate
reviewer, or a clean read-only re-read) that does **not** edit the log. It checks:
- every detected surface has a Surface Ruling, and **every `## Decision Tree` node is exhausted** (resolved /
  assumed / deferred / blocked) — none left vague;
- **every `user-choice` node carries the question asked + the user's actual answer** — a user-choice that
  was silently defaulted (empty answer) is a Must-Fix, not a decision;
- **every `## Hardening Decision` is user-confirmed or an explicit accepted-assumption** — none blank or
  inferred (especially stack, data model, persistence, auth) — **and each one marked `user-confirmed` traces
  to a recorded question + answer** (in `## Questions Asked & Answered` or its Decision-Tree `user-choice`
  row); a `user-confirmed` label with no recorded answer is a Must-Fix;
- no `inferred-from-context` on a one-way-door surface;
- **every research open question** (from `resources/index.md`) is turned into a decision, accepted
  assumption, deferral, or blocker — none silently dropped;
- success checks are binary, and capabilities are provisioned-or-waived.

Record it under `## Decision Review` (Reviewer / Verdict: `pass` | `accepted-risk` / Must-Fix count). On any
Must-Fix, **fix it or ask the user one more question, then re-review — loop until Verdict is pass / accepted-risk
with Must-Fix 0.** This is a quality loop, **not a dead-end**: it never hard-stops the flow. (The only
launch-blocker is the surface-lock + preflight gate below — the irreversible-surface safety net.)

## Surface-lock + preflight gate (launch-blocking)

Before launch, resolve `## Open / Blocking` against this gate. **BLOCKER — do NOT call the Workflow tool
if** (i) any refine-detected surface lacks an explicit **Surface Ruling** or user-accepted assumption, **OR**
(ii) any required capability/config on a **domain/external** surface is un-provisioned **AND**
un-waived (no `waived-with-fallback`), **OR** (iii) a **hardening one-way-door** decision — **stack, data
model, persistence, or auth** — is **blank or inferred** in `## Hardening Decisions` (silently defaulted,
not user-confirmed and not an explicitly-accepted assumption). *Delegation counts as a decision:* if the
user explicitly said "you pick" (recorded as an accepted-assumption with that answer), it is not
blank/inferred and does not block. An empty or placeholder `## Surface Rulings` while
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
