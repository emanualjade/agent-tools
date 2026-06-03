# Step S0 — Main-Spec + Phase-Map (merged)

**Runs:** once, at initiative birth, before everything. **Always.** (DESIGN §3.)

**Mandate.** Turn the refined idea + decisions (passed in `args`) into **one durable artifact**
that fixes *what we are building, the bounds, what "done" provably means,* and *the ordered set of
vertical phases that get us there* — such that a fresh-context subagent can run the entire rest of
the pipeline against this file without ever re-reading the chat that produced it.

You are **not** designing the system. You define the destination, the fences, the pass/fail line,
and the route's milestones — never the architecture, schema, or libraries that fill them. Inventing
those here is the failure this step guards against (it pre-commits decisions S1/S2 must make with
real context).

**Inputs:** `args` = `{ initiativeId, idea, decisions, constraints?, repoContext? }`, **plus the
front-door artifacts when they exist**: `strike/initiatives/<initiativeId>/refined-idea.md` and
`idea-decisions.md`. The refine/grill conversation already happened upstream (DESIGN §12) — **read
those two files first** (they hold the full decision log: surface rulings, accepted assumptions,
rejected paths) and treat them as authoritative, with the `args` summary as fallback/agreement-check.
Do not re-litigate the decisions.

---

## 0. Detect modality first (everything below is modality-shaped)

Run the **surfaces-registry detection pass** (`surfaces/_registry.md` §1 `detect`) over the refined
idea + decisions to get a *coarse* initiative-level `surfaces[]`. You have no diff yet, so this is a
**hint, not a verdict** — S1/S2/S4 re-detect against real footprint and may raise (DESIGN §4,
`disciplines/risk-tiering.md` §5). Its job here is only to make the spec **modality-correct**:

- It tells you which pack's `modelingNotes` govern the adjective-noun lens for your durable nouns
  (web-backend = table, data-pipeline = record/event schema field, mobile = local struct field,
  infra = resource attribute, cli = config/message field — `surfaces/_registry.md` §1).
- It tells you what "live success check" concretely means for this modality (the §3 table:
  HTTP/UI+screenshot, simulator run, sample-row assertion, `plan`/dry-run diff, command invoke +
  exit code).
- It seeds each phase's `riskHint` (below).

**Never hard-code web/backend.** If no pack matches, default to the web-backend reading and say so.

---

## 0.5 Preflight floor (front-door bypass — a HARD STOP, NOT a Needs-Decision)

Before §1, the engine enforces a **preflight floor** that this step inherits verbatim. It is a HARD
STOP: a front-door bypass returns `verdict:"BLOCKED"` and is **never** down-ruled into a recorded
assumption. This is the silent-substitution guard of DESIGN non-negotiable #12 — a faithful agent
must **not** absorb an unruled one-way-door surface into `assumptions[]` and PASS. The floor fires
(emit `verdict:"BLOCKED"`, **still** emit `phases:[]`) on **any** of these three conditions:

1. A domain surface is present (named in `refined-idea.md` "## Detected Surfaces" or in `args`) **but**
   `idea-decisions.md` is **absent or unparseable** — the front door was bypassed.
2. `idea-decisions.md` "## Surface Rulings" is **empty or placeholder** — no ruling exists to honor.
3. A domain/external capability is **un-provisioned AND un-waived** in `idea-decisions.md`
   "## Required Capabilities & Preflight".

A §0.5 breach is **not** a FAIL and **not** a Needs-Decision assumption: it is BLOCKED. Record the
breaching condition in `blockers[]`, emit `phases:[]`, and stop — do not synthesize a spec, do not
down-rule the surface to an assumption, do not proceed to §1.

---

## 1. The MAIN-SPEC (the durable contract)

Write these sections into `main-spec.md`. Tight, declarative, no narrative.

### 1.1 One-line intent
The single observable outcome the whole initiative delivers, in one sentence. If it needs an "and",
you have two initiatives — pick the one the decisions actually authorized.

### 1.2 The four boundaries
The fence. Every later step reads this to know when it is out of scope.

| Boundary | Contents |
| --- | --- |
| **In** | What this initiative *will* deliver. Behaviors, not implementation. |
| **Out (with why)** | What it deliberately will **not** deliver — **each line carries its one-line reason** ("deferred: no current consumer" / "separate initiative" / "explicitly de-scoped in decisions"). A reasonless Out line is a FAIL. |
| **Needs-Decision** | Open questions whose answer changes the shape. Each gets a recorded **assumption** (hands-off policy, DESIGN §10) so the build proceeds; the assumption goes in `assumptions[]` and is restated here. Never a blocker unless genuinely unanswerable. |
| **Never** | Hard prohibitions for the life of the initiative (no PII to third parties, no destructive migration without backup, no auth bypass, …). These are invariants every slice inherits. |

### 1.3 Durable nouns — adjective-noun applied
Enumerate every **durable noun** the intent implies (the persistent types/entities, in this
modality's terms per §0). For **each**, apply `disciplines/adjective-noun.md` — do **not** restate
its ladder; **run** it and record the verdict:

- An adjective on a noun (`draft post`, `cancelled order`) is a **state/flag/scope on the existing
  noun**, not a new type — unless the one-line three-part argument (distinct **columns** AND
  **relationships** AND **independent lifecycle**) holds. Record that one line next to any noun you
  keep separate; collapse the rest.
- This is a *naming/boundary* pass at spec altitude, not a schema. You list the nouns and their
  state-vs-type verdict; S2 designs their columns. Naming them now stops two later slices from
  inventing `draft_posts` + `published_posts` independently.

The named criterion is `adjective-noun` (that discipline's gate); a kept-separate noun with no
one-line argument is a FAIL here.

### 1.4 Engineering pressure points (NO architecture)
Name the 3–6 places this initiative will be hard or dangerous — **as risks, not solutions.** Each is
one line: *the pressure + which boundary/surface it threatens.* Examples of the **right altitude**:
"concurrent edits to the same order risk lost updates", "the export touches PII (privacy surface)",
"the payment retry path is an external-effect / idempotency surface". **Forbidden here:** naming the
fix ("use optimistic locking", "add an idempotency-key table", "Postgres advisory locks"). Those are
S2's job with real context; pre-deciding them is exactly the architecture-invention failure. Tag
each pressure point with the domain/modality surface it implies (feeds `riskHint` + S1's tiering).

---

## 2. ACCEPTANCE-CRITERIA — the external objective (binary, test-decidable)

This is the load-bearing artifact of the whole step. It is the **external objective** that
`disciplines/altitude-stepback.md` (Mechanism 2) re-reads verbatim when the loop fires a reassess —
so it lives on disk, outside any transcript, and **every item must be machine-verdictable.**

**Every criterion MUST be BINARY and TEST-DECIDABLE:** a single observable fact that a verifier can
mark PASS or FAIL with no judgement. Phrase as a checkable assertion with a concrete trigger and
observable result.

- ✅ `POST /orders with a valid cart returns 201 and the order is retrievable by its id.`
- ✅ `Refund of a $10.00 charge returns exactly 1000 minor units to the original payment method.`
- ✅ `Running the importer on the 50-row sample produces 50 output rows with no null \`email\`.`
- ✅ `Invoking \`tool sync --dry-run\` exits 0 and prints "would change N" to stdout.`
- ❌ `Orders work well.` / `The UI is intuitive.` / `Performance is good.` / `Handle errors
  gracefully.` — none are binary; each is a FAIL of this gate (`acceptanceCriteria:not-binary`).

Rules:
1. **Non-empty.** An initiative with zero acceptance criteria has no definition of done → gate FAIL.
2. **Each item is ONE fact** (no "and"/"or" hiding two criteria in one — split them).
3. **Stated against a real entry point in this modality** (§0): the criterion names *how it is
   triggered* and *what is observed*, using the registry's §3 "real entry point with real data"
   form for the detected pack — never "the function returns the right value" (that invites the
   tautology the `honest-verification` audit rejects).
4. **Every fired guardrail's `check` becomes a criterion.** For each guardrail the §0 detection
   fired (`surfaces/_registry.md` §1, e.g. money largest-remainder split, idempotency key, expand/
   contract migration), materialize its `check` as a binary acceptance criterion here. This is how
   surface rigor enters the external objective rather than being re-derived per slice.

Store the criteria as a numbered list (stable ids `AC-1, AC-2, …`) — phases and slices reference
these ids; the reassess table verdicts each one by id.

### 2.1 In-scope ⊆ AC reconciliation (the `inscope-covered` gate)

The acceptance criteria are the external objective; the §1.2 **In** boundary is what the initiative
*will* deliver. These must reconcile, or a clause ships half-built under a clean PASS. **Mint the
reconciliation here** (S6/S7 re-check it):

> Every main-spec In-scope clause must map to ≥1 binary acceptance criterion, an explicit recorded
> reuse-acceptance, OR a logged scope-waiver. An In-scope clause with none of those is a coverage
> FAIL — never a clean PASS. (The dogfood miss: "Set the hemisphere" was In-scope with no AC, so the
> UI was silently dropped yet the initiative PASSED.)

Walk every §1.2 In-scope clause and record where it lands. Write a small **In-scope coverage map**
into `main-spec.md` (one row per In-scope clause):

| In-scope clause | Covered by |
| --- | --- |
| the §1.2 In line, verbatim | **AC id(s)** (`AC-2, AC-5`) — *or* — **reuse-acceptance:** `<one line: existing behavior accepted as-is, why no new AC>` — *or* — **waiver:** `<one line: logged scope-waiver + reason>` |

A clause whose "Covered by" cell is empty — no AC, no reuse-acceptance, no waiver — is an
`inscope-covered` FAIL (not a clean PASS). The named criterion is `inscope-covered`; an uncovered
In-scope clause names itself in `failedCriterion`.

---

## 3. SUCCESS CHECKS — split repo-verifiable vs live/human

Acceptance criteria say *what* is true at done; success checks say *how each is confirmed* and **who
can confirm it.** Split into two explicit columns so the engine never blocks on something only a
human can do, and never lets a human-only check masquerade as automated.

| AC id | Check | Lane |
| --- | --- | --- |
| AC-1 | the concrete observation that confirms it | **repo-verifiable** *or* **live/human** |

- **repo-verifiable** — a subagent can run it head-less in the target repo: a test, a build, a
  command invoke + exit-code/stdout assertion, a `plan`/dry-run diff, a sample-run output diff. The
  honest-verification ladder (`disciplines/honest-verification.md`) executes these.
- **live/human** — needs a running deploy, a real third-party credential, app-store review, a visual
  judgement, or production data a subagent cannot stand up. The engine records these as
  **deferred-to-human** rather than blocking; the slice reports `CODE-VERIFIED` (not `verified`) for
  any AC whose only check is live/human and whose behavior path is blocked (DESIGN §1.3).

Every AC must appear in exactly one lane. An AC with no check, or a check that is secretly human but
labeled repo-verifiable, is a FAIL (`successChecks:mislabeled`).

---

## 4. The PHASE-MAP — vertical, outcome-named, ordered

The route. An **ordered** list of phases, each a **vertical slice of user-or-operator-observable
value**, end to end through whatever layers it needs.

**VERTICAL means:** each phase delivers one demoable outcome a person could *use or observe*, piercing
every layer it touches (data → logic → boundary/UI/command, in this modality's terms). **HORIZONTAL
is forbidden:** no phase may be a layer or a stage shared across features — `schema-first`,
`all-the-models`, `set-up-the-database`, `build-the-API-then-the-UI`, `infrastructure`, `wire-up`.
A phase whose name or outcome is a *layer* rather than a *capability* is the FAIL this gate exists for.

Test each phase with: **"Could I demo this to a user/operator as a thing that now works?"** If the
honest answer is "no, it's plumbing for a later phase," it is horizontal → merge it into the first
vertical phase that consumes it (tracer-bullet first, DESIGN §1.6: the first phase pierces every
layer for the thinnest happy path; later phases thicken it).

For **each** phase emit:

| Field | Meaning |
| --- | --- |
| `id` | stable `P1, P2, …` (execution order). |
| `name` | a **capability**, outcome-named (`place-an-order`, `refund-a-payment`, `offline-draft-sync`), never a layer. |
| `outcome` | the one observable behavior a person can do/see when this phase is done — and which **AC ids** it satisfies. |
| `size` | `XS\|S\|M\|L\|XL` per `disciplines/risk-tiering.md` sizing rubric — a *coarse* phase estimate; S1 sizes the real slices. `XL` ⇒ note it must split in S1. |
| `riskHint` | the domain/modality surfaces (§0) this phase's outcome implies (`money`, `persistence/migration`, `auth`, mobile `ship-irreversibility`, …) — a **hint** for S1's tiering, never the final tier. Empty if none detected. |

Ordering rule: dependencies flow forward only (P2 may rely on P1's outcome, never the reverse), and
the **first phase is the thinnest end-to-end tracer** that proves the spine works. No phase ships
infrastructure no current/next phase consumes (DESIGN §1.6).

---

## 5. Artifacts (write before returning)

Into the target repo (cwd-relative), under `strike/initiatives/<initiativeId>/`:

1. **`main-spec.md`** — §§1–3 (intent, four boundaries, durable nouns + adjective-noun verdicts,
   pressure points, **acceptance criteria AC-1…N**, success-check table). This is the durable
   external objective the reassess protocol re-reads.
2. **`development-plan.md`** — §4 the ordered phase-map (the `phases[]` table, rendered), plus a
   one-line restatement of the intent and a pointer back to `main-spec.md`. This is the route S1
   consumes phase by phase.

Both must satisfy the **fresh-context bar** (DESIGN §1.4): a subagent with *only* these two files +
the disciplines they name can act with zero reference to the chat. No "as discussed above",
no pronoun without an antecedent in-file, no decision that exists only in the transcript.

---

## 6. GATE — `S0` PASS condition

Emit a single machine-readable verdict. **`S0` is `PASS` iff ALL of these named criteria hold:**

| Criterion | PASS requires |
| --- | --- |
| `preflight-floor` | **no §0.5 front-door bypass** (idea-decisions.md present & parseable when a surface is declared; "## Surface Rulings" non-empty/non-placeholder; every domain/external capability provisioned-or-waived in "## Required Capabilities & Preflight"). A breach is **BLOCKED** (`verdict:"BLOCKED"`, `phases:[]`) — **not** a FAIL and **not** a recorded assumption. |
| `spec-written` | `main-spec.md` **and** `development-plan.md` both written to the initiative dir. |
| `boundaries-complete` | all four boundaries present; **every Out line carries a why**; every Needs-Decision carries a recorded assumption (in `assumptions[]`). |
| `adjective-noun` | every durable noun verdicted by `disciplines/adjective-noun.md`; any kept-separate noun has its one-line three-part argument recorded. |
| `acceptanceCriteria-nonempty` | ≥ 1 acceptance criterion exists. |
| `acceptanceCriteria-binary` | **every** criterion is binary + test-decidable + single-fact, stated against a real entry point in this modality (no vague/compound item). |
| `inscope-covered` | **every** §1.2 In-scope clause maps to ≥1 binary AC, an explicit recorded reuse-acceptance, OR a logged scope-waiver (§2.1 coverage map written, no empty cell). An uncovered In-scope clause is a coverage FAIL — never a clean PASS. |
| `successChecks-split` | every AC maps to exactly one lane (repo-verifiable / live/human); none mislabeled. |
| `phases-vertical` | **every** phase is an outcome-named vertical capability; **zero** horizontal/layer phases; dependencies flow forward; first phase is the thinnest tracer. |
| `fresh-context` | the author asserts, having re-read both artifacts as if the transcript were gone, that they are self-sufficient — **this self-check is recorded `true`** in the result. |

**On FAIL:** set `verdict:"FAIL"` and `failedCriterion` to the **first** failing criterion, naming
the offending item exactly — e.g. `acceptanceCriteria-binary: AC-3 "orders work well" is not
testable`, or `phases-vertical: P2 "schema-first" is a layer, not a capability`, or
`boundaries-complete: Out line "no reporting" has no reason`, or `inscope-covered: In-scope clause
"Set the hemisphere" maps to no AC / reuse-acceptance / waiver`. S0 has no upstream to route to; a true
blocker (a decision genuinely unanswerable, not a deferrable assumption) **OR a §0.5 preflight-floor
breach** → `verdict:"BLOCKED"` with the blocker recorded (emit `phases:[]`). Otherwise iterate and
re-emit. Never PASS with a vague criterion or a horizontal phase.

---

## 7. Result envelope (returned to the engine)

Shared envelope (DESIGN §3) plus S0's step-specific fields:

```
verdict:          "PASS" | "FAIL" | "BLOCKED"
failedCriterion:  string | null            // named per §6 on FAIL/BLOCKED
artifactPath:     "strike/initiatives/<id>/main-spec.md"   // + development-plan.md
assumptions:      string[]                  // every Needs-Decision resolution
blockers:         string[]                  // only genuinely unanswerable decisions OR a §0.5 preflight-floor breach
changedFiles:     ["strike/initiatives/<id>/main-spec.md",
                   "strike/initiatives/<id>/development-plan.md"]
surfaces:         string[]                  // coarse initiative-level detection (§0), a hint
obstruction:      null                      // S0 designs nothing; it cannot hit an obstruction
routeBack:        null                      // S0 is the root; nothing upstream

// step-specific:
acceptanceCriteria: [{ id: "AC-1", text: string, lane: "repo-verifiable"|"live/human" }]
phases:           [{ id, name, outcome, size, riskHint: string[] }]   // ordered; see §4
freshContextSelfCheck: true                 // §6 fresh-context; PASS requires this true
```

The engine reads the envelope + `phases[]` (to drive S1 per phase) + `acceptanceCriteria` (the
external objective downstream steps and the reassess protocol anchor to). It parses no prose — your
structured fields are the contract.
