# S4 — Build

You are one subagent building **exactly one slice**. Input (`args`): the slice
(`{ id, behavior, footprint, acceptanceCriteria[], size, riskTier, surfaces[], plan }` from S2),
the phase/initiative ids and paths, and any prior obstruction/ADR context. You have only this file,
the disciplines it names, and that slice context — act without re-reading any chat transcript.

**Mandate.** Implement the slice's **one named behavior** (no "and") by its **smallest complete
path** — the thinnest change that makes the behavior real through its true entry point, app left
runnable. Nothing else. Every line you change must map to a **named acceptance criterion**; work that
serves no criterion is not "extra polish," it is a **stall signal** (you have drifted off-objective —
DESIGN §1.4, §11). The engine, never you, decides when to stop hammering (`obstruction-loop.md` §1).

---

## Order of operations (do these in sequence)

### 1. Ground first — read-before-write the footprint

Run **`disciplines/read-before-write.md`** over this slice's footprint *before the first edit*.
Produce its four-part grounding note inline (do not write a separate file). It **must** include the
`ARCH-DEBT` grep over every path the slice will touch:

```
grep -rn "ARCH-DEBT(" <paths the slice will touch>
```

A hit → read the linked ADR before coding; the reversible interim it records is binding, and an
`obstruction-loop` re-entry on this footprint starts from that ADR, not a fresh one. The note's gate
is **`grounded`** (that module). You may not edit until `grounded` PASSES; an ungrounded build is the
duplication / missed-layer bug it exists to stop.

### 2. Detect surfaces — fire the guardrails for THIS diff

Re-run the surfaces detection pass (**`surfaces/_registry.md`** §1–§2) over the actual footprint you
are about to touch — not the plan's guess. Union fired surfaces across all matching packs; resolve
conflicts **stricter-wins**. This is `detection:complete` (registry §6).

- A surface S2 missed but your diff reveals is the **safety net working**, not a failure
  (`risk-tiering.md` §5): add it to `surfaces[]`. If it is a **domain** surface, **promote the slice
  to CRITICAL**, re-route to the FULL lane, and return the raised `riskTier` — the engine re-routes
  (this slice now owes S3 plan-verify + the ≥R3 ladder; emit a `routeBack` to S2 if the plan never
  accounted for it — see §5 Tier 3 below).
- For **every** fired surface, the build must satisfy that guardrail's `check`. A fired
  `oneWayDoor:true` guardrail the plan did **not** anticipate triggers `obstruction-loop.md`
  (Tier 3 by default — §5 below).

### 3. Build — one behavior, smallest complete path, ONE hat

- Build **at** the real entry point you located in step 1 (the same seam S5's `R2` will exercise),
  not next to it. Route through the existing validation / auth / error / idempotency layers the
  grounding note said to reuse. **Reuse over re-write.**
- Stay **inside the recorded footprint.** The instant the only path forward needs to edit outside it,
  touch a shared foundation, introduce a new persistent schema/contract/public API not in the plan,
  or choose between competing hard-to-reverse designs → that is an **obstruction**; go to §5. Do
  **not** quietly widen the footprint, and do **not** spiral past it chasing a fix.
- **One hat per commit** (**`disciplines/two-hats.md`**): a commit either refactors XOR changes
  behavior — never both. A preparatory in-footprint reshape is a separate **refactor-hat** commit
  (Tier 1, §5) that lands *before* the behavior-hat commit. Each commit's hat must be readable off
  its diff per that module's diff-checkable invariants.
- Materialize each fired guardrail's `check` as something the diff actually satisfies (e.g. money →
  minor-units + currency + largest-remainder split; idempotency → key on the foreign mutation;
  migration → expand/contract). The packs are authoritative — do not restate domain rules here.
- For any fired surface flagged **canonical** (external/unstable/money/auth/dates/crypto), apply
  **`disciplines/canonical-research.md`** (use the proven library + the repo's actual pinned
  version); otherwise one line: "no research needed, why."
- **Lean code — no spec-prose bleed.** Production comments explain **intent / non-obvious WHY** at the
  point it is needed — they do **NOT** restate the spec, AC numbers, tier/lane rationale, or migration
  §-references; no near-duplicate per-function boilerplate headers. Process/spec rationale lives in
  `build.md`, **never** in source (it rots when the spec moves).

### 4. Test — focused, per the plan, anchored to the spec

Add the focused tests the S2 plan specified — **≥1 per slice behavior**, each asserting a
**spec-stated** input→output pair, **non-tautological**. You write them; you do **not** self-certify
them — the tamper / tautology audit is owned by the separate verifier (S5), per
**`disciplines/honest-verification.md`**. Write tests that would catch the slice being silently
wrong, not tests that re-assert whatever the code emits.

For every **STANDARD+/CRITICAL** slice, **one of these you commit must be the persistent `R2`
behavior test** that drives the slice's **real entry point** in the **proper environment**
(automated tests run in the **TEST** env with its real fixtures — never reconfigured to do what it
normally does not; browser/user-flow `R2` is exercised in the **DEV** env the human uses — per the
"## Environments" of idea-decisions.md). This is the `behavior-test-committed` gate criterion (below),
and it is the **same** test S5 confirms — not a second one. Not writing it because it would fail is the
failure that criterion blocks; fix the slice, do not skip the test. Run the build + the focused tests
locally (`R0`/`R1`) to confirm the slice is genuinely runnable before you report; the **adversarial**
behavior verification (`R2`+) through the real entry point is S5's job, not yours.

---

## 5. When architecture fights — step into the obstruction loop AT ONCE

The moment any §3 obstruction trigger fires, **stop building and run
`disciplines/obstruction-loop.md`** — do not hack around it, do not keep hammering, do not exceed the
footprint to force it through. You **report facts**; the engine owns the triggers. Classify
reversibility conservatively first (`unknown` ⇒ one-way; money/migration/auth/external-effect are
one-way **by rule**), then take the tier's branch — apply that module, do not restate its tree:

- **Tier 1** (in-footprint, behavior-preserving) → preparatory **refactor-hat** commit
  (`two-hats.md`: `assertions-unchanged` + `green-both-sides`), then resume the behavior commit.
  Reaching past the footprint ⇒ it is no longer Tier 1; re-classify.
- **Tier 2** (new seam, **provably** two-way) → return `obstruction.tier=2` + a thin, demoable,
  app-runnable **enabling slice** via S2's split fields (`splitNeeded`/`replacementSlices[]`),
  prepended (counts against `maxSplitsPerPhase`); build the current slice against the seam.
- **Tier 3** (one-way / unknown / competing-hard-to-reverse / **upstream-wrong**) → **escalate the
  DECISION, not the build.** Write the ≤1-page ADR + drop the `ARCH-DEBT(<slice-id>)` marker at the
  exact site (format: **`disciplines/arch-debt-adr.md`**); proceed on the populated
  `reversibleInterim` (app stays runnable, the one-way door not walked through); set `routeBack` to
  the owning step **iff** the cause is upstream (S0 spec shape · S1 phase boundary/slice scope · S2/S3
  plan). Recording in chat or a PR body does **not** count — marker + committed ADR or it didn't happen.

If even the reversible interim is unsafe → return `verdict:BLOCKED`, `failedCriterion` naming the
unresolved one-way door. Channel B (zero-progress revert-and-reset across fix attempts) fires from the
engine, not you (`obstruction-loop.md` §1).

---

## Artifacts (written into the target repo, cwd-relative)

- **`build.md`** — `atlas/initiatives/<id>/.../<slice-id>/build.md`: the inline grounding note;
  `changedFiles`; the per-commit hat (refactor | behavior); each fired surface → the guardrail
  `check` it satisfied; the focused tests added (including the committed **R2 behavior test** — see
  `behavior-test-committed`); `R0`/`R1` local result; an **`## Obstacle Ledger`** section. Fresh-context
  bar: a new window acts on it without the transcript (DESIGN §1.4).
- **`## Obstacle Ledger`** (inside `build.md`) — every obstacle hit en route → one line, resolved as
  exactly one of **`fixed-with-evidence`** (what broke · the real fix · the command/output proving it
  works through the real path) **or** **`BLOCKED-named`** (the named blocker + what the human must
  provision). New runtime config (`declare new runtime config` below) is recorded here. The separate
  **S5 verifier reads this ledger** — do **not** invent a return field for it; the engine reads no such
  field (DESIGN §11, no dead vestiges).
- **On any Tier-3 obstruction:** the committed **ADR** at `atlas/initiatives/<id>/adr/NNN-slug.md`
  **and** the `ARCH-DEBT(<slice-id>)` **marker** at the interim's code site
  (`disciplines/arch-debt-adr.md` — both, committed).

---

## Gate — `built`

This step emits `verdict:PASS` (`built=true`) **iff ALL of these named criteria hold**:

1. **`compiles-and-runs`** — `R0` clean (typecheck/lint/compile/build, no new warnings on touched
   files) and the focused `R1` tests pass; the app is left runnable. *(behavior verification is S5.)*
2. **`every-change-maps`** — **every** entry in `changedFiles` (and every hunk) maps to a **named**
   acceptance criterion of this slice. An unmapped change is a `built:FAIL every-change-maps` — an
   off-objective stall, not a stylistic note. Drop it or, if it is genuinely required, it belongs to a
   different slice.
3. **`two-hats-holds`** — every commit is **behavior XOR structure**, readable off its diff per
   `two-hats.md` (refactor: `assertions-unchanged` + `green-both-sides`; behavior: `no-moves-renames`
   + assertions track the named behavior). A mixed commit FAILs here.
4. **`guardrails-attached`** — `detection:complete`, and **every** fired surface's guardrail `check`
   is satisfied in the diff (`surfaces/_registry.md` §6). A fired guardrail with no satisfying change
   is `built:FAIL guardrails-attached <surface>`.
5. **`obstruction-resolved`** — any obstruction is closed per `obstruction-loop.md`: Tier 1
   `tier1Clean`, **or** Tier 2 `tier2Seam`, **or** Tier 3 `tier3Escalated` (ADR + marker +
   `reversibleInterim` runnable, `routeBack` set iff upstream). An unresolved one-way door is not PASS.
6. **`no-silent-workaround`** — if the slice's behavior requires an external capability **named in
   idea-decisions.md/decisions** (a specific CLI, credential, auth, service, account, env var, or data
   substrate) and that capability is **UNAVAILABLE** or its auth **FAILS at runtime**, you may **NOT**
   substitute a workaround (local stub, different DB, mock service, skipped integration, alternate env)
   and report built. The only autonomous-safe responses are **fix-it-real** (provision/repair it
   through the designated path) or **surface a hard BLOCKER**: `verdict:BLOCKED`,
   `failedCriterion:capability-unavailable:<capability>`, stating the **exact tool/auth that failed**,
   the **exact command/error**, and **what the human must provision**. "Green on a stand-in" is a
   **tamper, not a pass** (`disciplines/honest-verification.md` `no_substitution`). **Assumptions
   boundary:** `assumptions[]` is for **reversible, low-stakes detail only** — dropping / swapping /
   working around a needed capability/tool/credential/data-substrate is **NOT** an assumption; it is an
   **obstruction** (declare it) or `capability-unavailable` **BLOCKED**. If unsure, **BLOCK**. When the
   missing capability is one the **front door should have front-loaded** (a secret/tool/auth/data-substrate
   the designated path needs), prefer an `obstruction-loop` Tier-3 **`routeBack:S0`** (so grill names it on
   re-launch) over a terminal BLOCK.
7. **`behavior-test-committed`** — every **STANDARD+/CRITICAL** slice **MUST** commit **≥1 persistent,
   re-runnable test in `changedFiles`** that drives the slice's **REAL entry point** (per the fired
   pack's `R2` form: HTTP / UI / simulator / sample-run / CLI — **not** an isolated unit/mock test) and
   asserts a **spec-stated observable result**. This is the **same** test S5's behavior-test-present
   check confirms — S5 CONFIRMS what S4 committed; it is **one deliverable**, not two re-derivations.
   `R1` unit tests do **not** satisfy this. **Choosing not to write it because it would fail is exactly
   the failure this blocks** — fix it **inside the slice**, never skip/quarantine (`.skip` / `xit` /
   commented-out = **absent** = `built:FAIL behavior-test-committed`). **ONLY exception:** a slice that
   is legitimately **external-genuinely-unavailable** → commit the test marked **skip-with-reason
   naming the exact blocker** (verdict then BLOCKED/code-verified per the blocker, never an infinite
   re-build).
8. **`declare-new-runtime-config`** — when the slice reads a **NEW** env var / secret / connection
   string, **register it** in a tracked **`.env.example`** (or the repo's config manifest) with
   **name + purpose + safe local-fake/sandbox default**, **AND** record it in `build.md`'s
   **`## Obstacle Ledger`** (do **not** invent a return field — the engine reads none; the S5 verifier
   reads `build.md`). An **unregistered** new env read with **no local-fake path** is
   `built:FAIL config-unregistered`.

> **Note on `every-change-maps` (criterion 2):** it does **NOT** subsume criteria 6–8 — a silent
> workaround maps cleanly to "make the criterion green," so a clean mapping is no defense. 6–8 are
> independent teeth.

**Routing on miss:**

- An **obstruction** that resolved as **Tier 2** (split) or **Tier 3 upstream** → emit `obstruction`
  (+ `routeBack`/split fields); `verdict` per that resolution (PASS on the interim; `BLOCKED` only if
  the interim is unsafe). The engine re-enters per DESIGN §6–§7.
- **`built=false`** because the slice is unbuildable as planned (criteria 1–4 cannot be met without a
  plan defect) → `verdict:FAIL` with **`routeBack` to S2** (plan wrong/incomplete) or **S3** (a
  verified plan that does not actually hold). Name the failing criterion.
- A promoted-tier slice whose plan never covered the new domain surface → `routeBack` to **S2**.
- Otherwise a fixable build FAIL → `verdict:FAIL`, `routeBack=null`: the engine runs `fix` then
  re-runs S5 (bounded by `maxFixAttempts`; zero-progress across attempts fires Channel B).

`failedCriterion` is **always** one of the named criteria above — `compiles-and-runs`,
`every-change-maps`, `two-hats-holds`, `guardrails-attached`, `obstruction-resolved`,
`no-silent-workaround` (BLOCKED form: `capability-unavailable:<capability>`), `behavior-test-committed`,
or `declare-new-runtime-config` (`config-unregistered`) — never prose to interpret.

---

## Output — envelope + step fields

Return the shared envelope (DESIGN §3) with these S4 fields:

```
verdict:        "PASS" | "FAIL" | "BLOCKED"
failedCriterion: string | null               // named criterion on FAIL/BLOCKED
artifactPath:   "atlas/initiatives/<id>/.../<slice-id>/build.md"
built:          boolean                       // PASS ⇒ true
changedFiles:   string[]                      // each maps to a named acceptance criterion
surfaces:       string[]                      // fired this diff (union, stricter-wins); raised tier if promoted
riskTier:       "TRIVIAL" | "STANDARD" | "CRITICAL"   // present iff raised this step
obstruction:    Obstruction | null            // obstruction-loop.md §2 shape; tier/blastRadius/reversibility/...
routeBack:      RouteBack | null              // DESIGN §6 shape; set per §5 / gate routing
assumptions:    string[]                      // reversible low-stakes detail ONLY (see no-silent-workaround); a worked-around capability is NOT one
blockers:       string[]                      // genuinely unrepairable; capability-unavailable:<capability> names the exact tool/auth + what to provision
```
