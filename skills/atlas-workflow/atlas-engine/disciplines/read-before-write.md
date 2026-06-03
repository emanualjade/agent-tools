# Discipline: Read-Before-Write

**Codebase grounding.** Know what already exists before you plan or edit. Run this as the
**first action inside S2** (before any plan prose) and **inside S4 before the first edit**. It is a
protocol, not a step — it produces a short note that feeds the plan / the build, never a separate
artifact.

**Why it earns its keep.** The two most expensive failures it kills at the source:
- **Duplication** — re-implementing a helper / validator / client that already exists.
- **Missed layers** — skipping the existing validation / auth / error-handling / idempotency layer
  the codebase already routes this kind of behavior through.

Both come from coding blind. The cure is *targeted* reconnaissance, not omniscience.

---

## The one hard rule: TARGET, never trawl

> **Search the footprint, not the repo.** Use grep / glob / read-specific-files to answer the
> questions below. Do **not** read the whole repository, do **not** open files "to get oriented,"
> do **not** dump directory trees into context.

A full-repo read is the exact failure this workflow exists to avoid: it scales poorly, rots context
with irrelevant detail, and buries the load-bearing facts. Every read must be *aimed* at one of the
questions below and then stop. If you can answer the question, you are done with it — close the file.

Budget heuristic: a handful of greps/globs and the few files they point at. If you find yourself
opening the 10th unrelated file, you are trawling — stop and re-aim.

---

## The hard questions (answer each, then stop)

Work the slice's named behavior and footprint. Use the **surfaces registry**
(`surfaces/_registry.md`) detection signals to know *which* layers to hunt for — e.g. a money or
auth surface tells you to look for the existing currency / session helper; a data-pipeline surface
tells you to look for the existing idempotent-replay path. Never hard-code the hunt to web/backend.

### 1. Real entry points — where does this behavior actually live?
Find the true seam the behavior enters and exits the system, not a guess at it. Locate the
route/handler/command/job/component the slice attaches to, and the call path it triggers.
- Grep for the feature noun, the existing sibling behavior, the URL/command/topic/resource name.
- Confirm by reading the entry-point file — not by inference.
- This is the same "real entry point" the verifier (`honest-verification.md` R2) will exercise;
  finding it now means you build *at* it, not next to it.

### 2. Reuse — what already exists that I must use instead of writing?
Find the conventions, utilities, helpers, and the **validation / auth / error / idempotency layers**
this behavior must route through.
- Grep for existing helpers by intent (`validate`, `authorize`, `currency`, `parse`, the error
  type, the client wrapper) and by the surfaces this slice fired.
- Read one or two real call sites of a sibling behavior to learn the *house pattern* (how errors
  are returned, where input is validated, which client/wrapper is canonical).
- Output the concrete list: **reuse these** (path + what it does).

### 3. Invariants — what implicit rules will my change break if I ignore them?
Discover the unwritten contracts the surrounding code depends on: ordering ("write local row before
the external call"), required-together fields (amount + currency), null/empty handling, idempotency
keys, tenant/scoping filters, soft-delete vs hard-delete, event/replay assumptions.
- These live in the call sites and tests around the entry point — read those, not the whole module.
- Output them as **invariants to respect** so the plan and the diff can be checked against them.

### 4. ARCH-DEBT — has a prior slice already flagged debt on this footprint?
Grep the footprint for the debt marker (grammar + ADR linkage defined in `arch-debt-adr.md`):

```
grep -rn "ARCH-DEBT(" <paths the slice will touch>
```

A hit means a prior slice hit an obstruction here and left a recorded decision. **Read the linked
ADR before planning** — it tells you the reversible interim in force and the one-way door to avoid
re-opening. Carry any relevant marker into the note so the plan respects it (and so the
`obstruction-loop` re-entry, if it fires, starts from the existing ADR rather than a fresh one).

### 5. SIBLING-CAPABILITY & CANONICAL MECHANISM — does an equivalent capability or a canonical process-tool already exist?
**MANDATORY whenever the slice introduces a capability the repo has no precedent for BY DOMAIN** — a
new ingest / upload / export / notification / integration shape — **independent of whether a domain
surface fired**. Q2 hunts helpers by *intent*; this question hunts the *whole capability* by domain,
so you do not hand-roll a reimplementation of something that already exists one verb away, and so you
never hand-edit state a canonical tool owns.

- **Search by CAPABILITY, not helper intent.** Grep the whole feature's action verbs *and* resource
  nouns — `upload`/`ingest`/`import`/`parse`/`store` (and the slice's own verbs/nouns) — across the
  repo, not just the narrow helper names from Q2. A sibling capability hides under a different verb.
- Write the verdict line:
  `SIBLING: <path:symbol of the existing equivalent + its house pattern in one line> | none after capability search of <verbs/nouns greped>`.
  `none` is assertable **only** by listing the exact verbs/nouns you greped — a bare "none" is a skip.
- **Canonical process/tool.** When a fired surface is managed by a canonical PROCESS or TOOL
  (migrations → migration CLI + migrations dir + version table; deps → package manager + lockfile;
  generated code → codegen config + output), locate it and write:
  `CANONICAL MECHANISM: <tool> — changes go through it via <command>; never hand-edit <tracked state>`.
  Hand-applied DDL, hand-edited lockfiles, or hand-written generated output are the silent
  substitution this catches — the change must route through the tool, or it is ungrounded.

---

## Output: the grounding note (feeds the plan / the build)

A short, fact-per-line note — the *only* artifact this protocol emits. Inline it into the S2 plan
(or the S4 build reasoning); do not write a separate file.

```
WHAT EXISTS:       real entry point(s) for this behavior  — path:symbol
REUSE THESE:       existing helpers/utilities/validation/auth/error layers to use — path -> what it gives me
DO NOT DUPLICATE:  the thing I was about to write that already exists — path
INVARIANTS:        implicit rules the change must preserve — one line each
SIBLING:           existing equivalent capability — path:symbol + house pattern | none after capability search of <verbs/nouns greped>
CANONICAL MECHANISM: process-tool owning a fired surface — <tool> via <command>; never hand-edit <tracked state>  (or "n/a — no process-managed surface fired")
ARCH-DEBT:         any marker touching the footprint + its ADR link (or "none")
```

Keep each line a fact with a path, not prose. Empty sections are allowed only when truly empty
(state "none found after targeted search" — never leave blank from skipping the search).

---

## Gate — `grounded`

Inside S2/S4 this protocol passes its named-criterion check **`grounded`** iff **all** hold:

- **entry-point-located** — the real entry point(s) for the behavior are named with a path,
  confirmed by reading the file (not inferred).
- **reuse-surveyed** — the existing validation / auth / error / idempotency layers and candidate
  helpers for every surface this slice fired (`surfaces/_registry.md`) were searched, and the note
  lists what to reuse (or states none exists after a real search).
- **invariants-captured** — the implicit invariants around the entry point are listed.
- **sibling-surveyed** — whenever the slice introduces a capability with no by-domain precedent (a
  new ingest/upload/export/notification/integration shape), a capability-level search (the feature's
  action verbs + resource nouns, not just helper intents) was performed and the `SIBLING:` verdict
  line is present; and any process-managed surface that fired (migrations/deps/codegen) has its
  `CANONICAL MECHANISM:` line locating the tool and command. FAILs if that capability-level search
  was not performed, its verdict line is absent, or a process-managed surface fired without its
  mechanism located. `none` is assertable **only** by listing the exact verbs/nouns greped.
- **arch-debt-checked** — the footprint was grepped for `ARCH-DEBT(` and any hit's ADR was read.
- **targeted** — grounding used aimed grep/glob/read, not a full-repo or full-module read.

FAIL names the unmet criterion (e.g. `grounded:FAIL reuse-surveyed` — the existing validation layer
was not located; or `grounded:FAIL sibling-surveyed` — a hand-rolled ingest path with no capability
search, or migrations hand-applied without locating the migration CLI). A FAIL here blocks plan/build
progress: ungrounded planning is the duplication and missed-layer bug this discipline exists to stop.
