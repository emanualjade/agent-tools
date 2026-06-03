# Step S1 — Phase-Spec + Slices

**Runs:** once **per phase** in the phase-map (S0 output). **Input:** one `phase` object from S0's
`phases[]` — `{ id, name, outcome, size, riskHint }` — plus the durable `main-spec.md` for that
phase's acceptance criteria. **Output:** the phase's **vertical slice set**, each slice born with
`{ size, riskTier, surfaces, lane }`, written as `slice.md` artifacts the rest of the pipeline pivots
on.

S1 does two jobs: **(1) define the phase precisely enough to slice**, and **(2) emit the slices**.
For a small phase these merge into one pass; for an L / high-risk phase they split (phase-spec
first, then slices) — see §1. This is where every slice gets its **risk tier**, the single decision
that scales the whole downstream workflow (`disciplines/risk-tiering.md`).

---

## 1. Merge-or-split (do this first)

Decide the shape of this pass before writing anything.

| Phase shape | Pass |
| --- | --- |
| `phase.size` ∈ {XS, S, M} **and** `riskHint` not high | **MERGED** — define + slice in one artifact; the phase-spec is a short header on the slice set. |
| `phase.size` ∈ {L, XL} **or** `riskHint` high (domain-heavy: money/auth/migration/external-effect) | **SPLIT** — write the phase-spec first (boundaries + acceptance + new nouns + likely surfaces), *then* derive slices against it. The extra altitude pass is what keeps a big phase from being sliced wrong. |

A SPLIT phase that, once spec'd, turns out small may collapse back to MERGED — record the
downgrade. Never the reverse: a phase that grows mid-slice is the §6 boundary-wrong signal.

---

## 2. The phase-spec (header for MERGED; standalone section for SPLIT)

Define the phase tightly enough that slicing is mechanical. Keep it to the load-bearing facts — this
is altitude, not a re-spec of S0.

- **Outcome** — restate `phase.outcome` as the one observable thing true when the phase is done.
- **Boundaries** — In / Out (with why) for *this phase* (the spec's four-boundary discipline scoped
  down). What this phase explicitly defers to a later phase.
- **Acceptance criteria** — the **binary, test-decidable** items from `main-spec.md` that this phase
  must satisfy. Each slice's criteria are a subset of these; together the slices must cover them all.
  These are the **external objective** every downstream verifier reads verbatim — do not paraphrase.
- **New nouns** — every durable type the phase introduces, each run through
  `disciplines/adjective-noun.md` (§4). Resolve table-vs-field **here**, before slicing, so a slice
  never silently invents a new persistent type.
- **Likely surfaces** — a first pass of `surfaces/_registry.md` detection over the phase intent, to
  anticipate which slices will be CRITICAL. Per-slice detection in §4 is authoritative; this is just
  foresight.

---

## 3. Slicing — thin AND complete, vertical, tracer-bullet first

A slice is the unit the FAST/FULL lanes build and verify. Carve the phase into the **smallest set of
slices that each deliver one observable behavior with the app left runnable** (DESIGN §1.6).

### The slice rules (each is a gate criterion in §5)

1. **One observable behavior, no "and."** If the slice name needs an "and" (or a comma, or
   "+ also"), it is two slices. The behavior must be observable through the modality's **real entry
   point** (`surfaces/_registry.md` §3) — an HTTP/UI interaction, a CLI invocation, a sample
   pipeline run, a plan diff — not "a function exists."
2. **Vertical, never horizontal.** A slice cuts top-to-bottom through every layer the behavior
   needs (entry → logic → persistence/effect → observable result). **Reject** any slice named for a
   layer or a stage: "the schema," "the API surface," "wire up the model," "set up the service,"
   "scaffolding," "groundwork." Those are horizontal and are an auto-FAIL (§5, §6).
3. **No speculative infrastructure.** A slice ships **only** what it or the *next* slice consumes.
   Building a generalized base/abstraction "for later" is the Speculative-Foundation smell
   (`disciplines/risk-tiering.md`) — cut it; build the concrete thing now, generalize on real second
   use.
4. **App stays runnable after every slice.** Each slice ends green and demoable. Later behavior may
   be **stubbed** (a fixed return, a flagged-off path) — stubbing to stay runnable is correct;
   shipping a broken half-feature is not.
5. **Right-sized — splitting would create fake work.** A slice is correctly sized when splitting it
   further would produce a fragment that **cannot be observed on its own** (e.g. "validate the input"
   with nothing that consumes the validation). Do not split past one observable behavior; do not
   merge two observable behaviors to dodge a tier. *Splitting that creates an un-demoable fragment is
   over-splitting; keep them together.*

### Split signals — any one means SPLIT (or record `whyNotSplit:` in one line)

Mechanical trip-wires that catch an over-large slice the rules above let you rationalize as "one
behavior." If any fires, split the slice — **unless** splitting would create an un-demoable fragment
(rule 5), in which case write the one-line `whyNotSplit:` justifying that the larger blast radius is
the smallest safe move:

- the name needs **`and` / `also` / `+` / `full` / `complete` / `MVP` / `setup`** — it bundles outcomes;
- **> ~5 likely files**, or **> 3 acceptance criteria** owned by the one slice;
- it spans **multiple independent subsystems**, or combines **repo/package setup + behavior**, or
  **UI + API + data + tests** where one behavior could land smaller;
- you are about to record size **`M` while the slice shows `L`/`XL` signals** (`risk-tiering.md` §1) —
  under-sizing to dodge the FULL lane is the failure this catches.

### Tracer-bullet first (DESIGN §1.6)

The **first slice of `P1`** (the first phase in execution order) is the **tracer bullet**: it pierces **every layer end-to-end for
the single thinnest happy path** — real entry point, real (minimal) logic, real persistence/effect,
real observable result — with everything else **stubbed**. It proves the architecture connects
before any breadth is built. Every later slice (and every other phase's first slice) thickens one
behavior at a time against that proven spine.

- The tracer bullet is **not** "set up the project" and **not** "the schema" — it is the narrowest
  *complete* path that returns a real observable result.
- Mark it explicitly: `tracerBullet: true` on that slice. If `P1`'s first slice is not a
  full-stack tracer, that is a §5 FAIL (`tracer-first`).

---

## 4. Birth the tier — `{ size, riskTier, surfaces, lane }` per slice

For **each** slice, apply `disciplines/risk-tiering.md` in full — this is S1's load-bearing output:

1. **Detect surfaces.** Run the `surfaces/_registry.md` detection pass over the slice's intended
   footprint (its named behavior + the files/effects it will touch). Union the fired flags across
   **all** matching packs; resolve guardrail conflicts stricter-wins (registry §2). Write the
   resulting `surfaces[]` — domain *and* modality flags — onto the slice. This is **delegated**,
   never hard-coded to web/backend.
2. **Size it.** Use the XS..XL sizing rubric in `risk-tiering.md` §1. When between two sizes, pick
   the **larger** (sizing only raises rigor). An XL slice is un-sliceable as one behavior — go back
   to §3 and split it before it can get a tier.
3. **Compute `riskTier`.** Apply the `risk-tiering.md` §4 rubric (any domain surface **or** size ≥ M
   → CRITICAL; S + no domain → STANDARD; XS non-domain copy/CSS/config/internal → TRIVIAL). Do not
   hand-assign — the tier is the rubric's output.
4. **Assign `lane`.** CRITICAL → **FULL**; STANDARD / TRIVIAL → **FAST** (`risk-tiering.md` §4
   mapping). The engine routes off this; S1 just records it.

S1 assigns the **birth tier** only. S2/S4 re-detect and may **raise** it (monotonic, raise-only —
`risk-tiering.md` §5); S1 must not under-call to save lane cost — a missed money/auth/migration
surface is the expensive failure.

---

## 5. Gate — `verdict: PASS | FAIL`

**S1 is `PASS` for the phase iff ALL of these hold** (each FAIL names the offending slice):

1. **`one-behavior`** — every slice is one observable behavior with no "and" (§3 rule 1).
2. **`vertical`** — no slice is horizontal/groundwork/layer-named/scaffolding (§3 rule 2). A
   horizontal slice is the most common FAIL — name it explicitly.
3. **`runnable`** — the app is left runnable after every slice; deferred behavior is stubbed, not
   broken (§3 rule 4).
4. **`right-sized`** — no slice can be split without creating an un-demoable fragment, none merges
   two behaviors to dodge a tier (§3 rule 5), and no slice trips a §3 **Split signal** without a
   recorded one-line `whyNotSplit:`.
5. **`tier-assigned`** — every slice carries non-empty `size`, `riskTier`, `surfaces[]`, and `lane`,
   consistent with the `risk-tiering.md` §4 rubric (its §6 `fields-present` + `rubric-consistent` +
   `lane-correct`). A TRIVIAL/STANDARD slice carrying a domain surface is a FAIL here.
6. **`surfaces-detected`** — surface detection was **run** via `surfaces/_registry.md` (registry §6
   `detection:complete`), not guessed; the union was taken and conflicts resolved stricter-wins.
7. **`nouns-modeled`** — every new durable noun passed `disciplines/adjective-noun.md` (its
   `adjective-noun` criterion): collapsed to a field, or the one-line three-part argument is written.
8. **`coverage`** — the union of all slices' acceptance criteria covers every phase acceptance
   criterion from §2 (no criterion orphaned, no slice inventing scope outside the phase).
9. **`tracer-first`** — for `P1`, the first slice is a full-stack tracer bullet
   (`tracerBullet: true`, pierces every layer, rest stubbed — §3).

**Verdict:** all nine → `PASS`. Any failing → `verdict: "FAIL"`, `failedCriterion` = the named
criterion **plus the offending slice id/name** (e.g. `vertical: slice "define the schema" is
horizontal`). The engine runs **fix** and re-runs S1 (bounded), unless the failure is a boundary
problem → route back per §6.

---

## 6. Route-back to S0 (phase boundary is wrong)

If slicing reveals the **phase boundary itself** is wrong — the phase can't be made vertical (its
outcome isn't independently observable), two phases overlap, an ordering dependency is inverted, or
the phase is really two outcomes — the bug is **upstream**, not in the slicing. Do **not** force bad
slices. Emit a `routeBack` (DESIGN §6) and let the engine re-enter S0:

```
routeBack: {
  targetStep: "S0",
  phaseId: "<this phase id>",
  sliceId: null,
  check:  "phase boundary not sliceable into vertical slices",
  reason: "<what's wrong — e.g. 'phase-03 outcome requires phase-04's persistence; boundary inverted'>"
}
```

Set `verdict: "FAIL"`, `failedCriterion: "vertical"` (or `coverage`), and the `routeBack`. The engine
resets S0 + everything downstream and resumes. This is the safety net working, not a defect — use it
instead of emitting slices you know are wrong.

---

## 7. Artifacts

Write, cwd-relative, into the initiative tree:

- **One `slice.md` per slice** at `strike/initiatives/<id>/phases/<phase-id>/slices/<slice-id>/slice.md`.
  You write these stubs and return `slices[]`; the engine carries that returned list as its in-memory
  source of truth within the run (it has no filesystem access — DESIGN §6). Slice ids must be stable and
  ordered (`<phase-id>-s01`, `-s02`, …). Each `slice.md` contains:

  ```
  # <slice-id>: <name>            # the one observable behavior, no "and"
  behavior:        <the observable result, through which real entry point>
  acceptance:      <binary criteria this slice owns — subset of the phase's>
  size:            XS|S|M|L|XL
  surfaces:        [<fired domain + modality flags, or empty>]
  riskTier:        TRIVIAL|STANDARD|CRITICAL
  lane:            FAST|FULL
  tracerBullet:    true|false      # true only for P1's first slice
  newNouns:        <each: collapsed-to-field OR the one-line earned-table argument, or "none">
  stubs:           <what this slice stubs to stay runnable, or "none">
  dependsOn:       <prior slice ids this builds on, or "none">
  whyNotSplit:     <one line if a §3 Split signal fired but the slice stays whole, else "none">
  ```

- **Phase-spec** (§2): for a **MERGED** phase, it is the header block of the phase dir
  (`strike/initiatives/<id>/phases/<phase-id>/phase-spec.md`, brief). For a **SPLIT** phase, the same
  path holds the standalone phase-spec written **before** the slices.

Every artifact must clear the **fresh-context bar** (DESIGN §1.4): a fresh subagent building a slice
must succeed from `slice.md` + the referenced disciplines alone, without this conversation.

---

## 8. Result envelope (returned to the engine)

Return the shared envelope (DESIGN §3) plus the S1-specific `slices[]`:

```
verdict:         "PASS" | "FAIL" | "BLOCKED"
failedCriterion: <named criterion + offending slice on FAIL, else null>
artifactPath:    "strike/initiatives/<id>/phases/<phase-id>/"   # the phase dir
assumptions:     [<consequential question -> recorded assumption>]
blockers:        [<genuinely unrepairable, else empty>]
surfaces:        [<union of all slices' fired surfaces>]
routeBack:       <§6 object, or null>
obstruction:     null            # S1 plans, it does not build; obstructions surface in S2/S4
slices: [
  { id, name, size, riskTier, surfaces, lane }   # tracerBullet implied by ordering; full detail in slice.md
]
```

The engine carries the returned `slices[]` as its in-memory source of truth (DESIGN §6 — no fs access)
and routes each slice into its lane by `riskTier`. It computes nothing — S1's `{ size, riskTier, surfaces, lane }` per
slice is authoritative until S2/S4 raise it.
