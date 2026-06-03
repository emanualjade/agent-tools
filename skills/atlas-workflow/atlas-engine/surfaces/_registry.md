# Surfaces — Pack Registry & Interface

The **modality registry**: a uniform interface that every modality pack in this directory conforms
to, plus the rules for detecting, composing, and consuming packs. This is the mechanism that makes
rigor **surface-triggered, not blanket** (DESIGN §1.8) and makes **every modality first-class**
(DESIGN §5): web-backend is not special-cased — it simply ships the deepest pack of the *same* shape.

**Who reads this:** the **detection pass** every slice-touching step runs (S1 at birth; S2 against
the plan; S4 against the diff) to populate `surfaces[]`; `disciplines/risk-tiering.md` (consumes the
fired surfaces to gate the tier); `disciplines/canonical-research.md` (reads which fired surface
flags a canonical concern); `disciplines/honest-verification.md` (reads each pack's ladder
adjustments + per-modality "real entry point"); the **engine** (consumes the resulting
`surfaces[]`/guardrails to route — it computes nothing itself).

**First-classness, made operational:** a modality is added by **dropping one conforming file into
this directory** — no engine change, no step edit. The detection pass globs `surfaces/*.md` (minus
`_registry.md`), so a new pack is live the moment its file lands. There is no allow-list to update;
the shipped list in §5 is descriptive, not a gate.

---

## 1. The pack interface (every file in this dir, including web-backend, conforms)

A pack is a Markdown module exposing **exactly these four sections** (DESIGN §5). A pack that omits
`detect` or `guardrails` is non-conforming and must not ship; `verification` is required;
`modelingNotes` is optional.

### `detect` — signals → surface flags this pack owns

A list of **cheap, mechanical** triggers and the surface flag each raises. Triggers are facts the
detector can read from the slice plan + changed files **without running code**:

- **path / glob** conventions (`migrations/**`, `*.tf`, `**/cmd/*/main.go`, iOS/Android markers),
- **manifest / dependency** entries (a payment SDK, an ORM, `terraform`, a CLI framework),
- **import / API / AST** signals (HTTP route decorators, `crypto`/`hashlib`, queue-publish calls),
- **keywords** in the plan ("refund", "backfill", "destroy", "offline sync", "exit code").

Each trigger maps onto a surface name. Two namespaces share one `surfaces[]` array (per
`disciplines/risk-tiering.md` §1):

- **Domain surfaces** — the closed, tier-gating list owned by `disciplines/risk-tiering.md` §2
  (`money`, `auth`, `security`, `persistence/migration`, `external-effect/idempotency`,
  `destructive-op`, `PII`). A pack maps its *concrete* signals onto these canonical names; it does
  **not** invent synonyms. Do not restate the list here — read it there.
- **Modality surfaces** — pack-local flags that attach guardrails without necessarily forcing
  CRITICAL (e.g. mobile `ship-irreversibility`, cli `exit-code-contract`). These carry their own
  `oneWayDoor` per guardrail.

### `guardrails` — `[{ surface, when, check, oneWayDoor }]`

The rigor, attached **only when its trigger fires** — never blanket. Each entry:

| Field | Meaning |
| --- | --- |
| `surface` | The fired flag this guardrail defends (domain or modality name from `detect`). |
| `when` | The concrete condition that activates it (e.g. "an amount is stored or computed", "a stateful resource is replaced"). If `when` is false for the slice, the guardrail is silent. |
| `check` | The checkable obligation the plan/build/verify must satisfy — phrased as a named, testable verdict, not advice. |
| `oneWayDoor` | `true` ⇒ irreversible / hard-to-reverse; routes via `disciplines/obstruction-loop.md` Tier 3 (ADR + `ARCH-DEBT` + reversible interim). `unknown` reversibility is treated as `true` (DESIGN §1.9). |

`oneWayDoor: true` on a fired guardrail is the signal `disciplines/risk-tiering.md` and
`disciplines/obstruction-loop.md` key off — money / migrations / auth / external-effects are
one-way **by rule**, independent of any pack's own judgement.

### `verification` — ladder adjustments for this modality

Defines, for this pack, the two things the generic ladder (`disciplines/honest-verification.md`)
leaves modality-shaped:

1. **What "R2: real entry point with real data" concretely means here** (the §3 table is the
   index; the pack states the operational form + the artifact it produces, e.g. screenshot, sample
   output diff, plan diff, captured exit code).
2. **Which rungs are mandatory for which fired surfaces** — additive to the tier floor in
   `disciplines/risk-tiering.md` §4 (a pack may *raise* a rung for a surface, never lower the floor).

### `modelingNotes` — modality-specific adjective-noun guidance (optional)

How `disciplines/adjective-noun.md` (field-not-table) maps into this modality's boundary: e.g.
field-not-new-topic for events, field-not-new-resource for infra, a column for SQL. Optional; omit
if the SQL-shaped default in the discipline transfers unchanged.

---

## 2. Detection precedence — multi-match, resolve to the STRICTER guardrail

The detection pass is **cheap and runs every pack**; a slice may match **multiple** packs and that
is normal, not an error (DESIGN §5).

1. **Run all packs.** Take the **union** of every fired surface flag across every matching pack into
   the slice's `surfaces[]`. (A React-Native payments screen fires *mobile* `ship-irreversibility`
   **and** *web-backend* `money` — both apply.)
2. **Union the guardrails.** Every fired guardrail from every matching pack attaches. They are
   cumulative, not exclusive — a slice can owe both an offline-sync guardrail and a money guardrail.
3. **Resolve conflicts to the stricter / more one-way guardrail.** When two packs attach guardrails
   that *contradict* (one permits what the other forbids, or they disagree on reversibility), keep
   the **more restrictive** one and set `oneWayDoor = true` if **either** says so. Strictness order:
   `oneWayDoor:true` > `oneWayDoor:false`; a mandatory rung > an optional one; forbid > permit.
   "Stricter wins" is the only tie-break — no architectural taste required.
4. **Feed the tier.** Hand `surfaces[]` to `disciplines/risk-tiering.md`; if **any** domain surface
   fired, the slice is CRITICAL there (this registry does not re-decide the tier).

A pack that matches but whose every `when` is false contributes **no** guardrail and no rigor cost —
that is the "CSS change pays nothing" property (DESIGN §1.8) operating per-pack.

---

## 3. Per-modality "real entry point with real data" (verification core, indexed)

The verification core of `disciplines/honest-verification.md` R2 is generalized **here**, so no step
is hard-coded to web. Each pack's `verification` section owns the detail; this table is the index
the verifiers consult to pick the right form. **Never run a destructive / applying action in
verification** — the read-only column is the obligation.

| Pack | R2 "real entry point, real data" | Verification artifact | Never (in verify) |
| --- | --- | --- | --- |
| **web-backend** | HTTP request / UI interaction against live data | response assertion; **screenshot for UI** | n/a |
| **mobile** | simulator/emulator run; exercise offline → online sync | screenshot; sync-replay log | ship to a store |
| **data-pipeline** | run on a **representative sample**; assert output schema + row-level expectations; re-run for idempotence | sample output diff | destructive full backfill |
| **infra-as-code** | inspect the `plan` / dry-run diff; assert no unintended destroy/replace; check drift | plan diff | `apply` |
| **cli-devtool** | **invoke** the command with real args | captured exit code + stdout/stderr | n/a |

"Real data" excludes a mock that returns the asserted value — that is a tautology the
`honest-verification` audit rejects regardless of modality.

---

## 4. How the engine + steps consume packs

- **S1 / S2 / S4** run the detection pass (§1 `detect`) over the footprint they have (S1: phase
  intent; S2: the plan; S4: the diff), union the results (§2), and write `surfaces[]` onto the slice.
  S2/S4 may thereby **raise** the tier (`disciplines/risk-tiering.md` §5) — a pack matched late is
  the safety net, not a failure.
- **S2 (plan)** materializes each fired guardrail's `check` as a planned obligation; folds
  `disciplines/canonical-research.md` for any fired surface a guardrail flags canonical.
- **S4 (build)** must satisfy every fired guardrail; a fired `oneWayDoor:true` guardrail that the
  plan did not anticipate triggers `disciplines/obstruction-loop.md` (Tier 3 by default).
- **S3 / S5 / S6 / S7 (verifiers)** read each fired guardrail's `check` as a named acceptance
  criterion, and this registry's §3 + the pack's `verification` to choose the R2 form + mandatory
  rungs. A guardrail whose `check` is unmet is a named FAIL criterion.
- **The engine** consumes only the resulting `surfaces[]` (to route lanes via `riskTier`) and the
  structured envelope. It does **not** parse pack files — packs are agent-facing prose; the engine
  trusts the structured `surfaces`/`obstruction`/`routeBack` the steps emit (DESIGN §10).

---

## 5. Shipped packs

All five are **first-class members of the same interface**. `web-backend` is **mandatory-deep**
(the reference depth); the other four are **genuinely useful** — real triggers, real guardrails,
real verification — never stubs (DESIGN §5).

| Pack | File | Owns (illustrative — the file is authoritative) |
| --- | --- | --- |
| **web-backend** | `web-backend.md` | money (minor units + currency + largest-remainder split), idempotency keys, expand/contract migrations, parse-at-boundary + typed errors, additive-vs-breaking contracts, canonical auth/crypto/dates. The deepest pack. |
| **mobile** | `mobile.md` | offline-first sync + idempotent replay, ship-irreversibility (flag-gate risky changes default-off), permissions/privacy, on-device schema evolution. Verify: simulator + screenshot. |
| **data-pipeline** | `data-pipeline.md` | idempotent/replayable transforms, schema evolution (consumer compat), batched backfill safety, late/duplicate/out-of-order events, PII. Verify: representative-sample run + idempotent re-run. |
| **infra-as-code** | `infra-as-code.md` | plan/dry-run before apply, blast-radius (destroy/replace of stateful = one-way), drift, secrets in state. Verify: plan diff, never apply. |
| **cli-devtool** | `cli-devtool.md` | exit-code contract, stdout-data / stderr-logs separation, flag/arg backward-compat, destructive ops behind confirm/`--force`. Verify: invoke + assert exit code & streams. |

To add a modality (e.g. `embedded`, `ml-training`), author a file conforming to §1 and drop it
here. No other file changes — that is what "first-class via the same mechanism" means.

---

## 6. Gate — `registry:conformant` and `detection:complete`

**A pack file is `registry:conformant` iff ALL hold:**

1. **`interface-complete`** — it exposes `detect`, `guardrails`, and `verification`; `guardrails`
   entries each carry `{ surface, when, check, oneWayDoor }`.
2. **`surface-names-canonical`** — every domain-surface flag it raises is one of the closed names in
   `disciplines/risk-tiering.md` §2 (no synonyms); modality-local flags are namespaced to the pack.
3. **`checks-checkable`** — every `check` is a named, testable verdict a verifier can PASS/FAIL, not
   advice.
4. **`oneway-honest`** — money / migration / auth / external-effect guardrails carry
   `oneWayDoor:true`; `unknown` reversibility is recorded as one-way.
5. **`verification-grounded`** — its `verification` section defines a concrete read-only R2 form
   consistent with §3 and never prescribes a destructive/applying action in verification.

**A step's detection is `detection:complete` for a slice iff:** all packs were run over the available
footprint (not guessed); fired surfaces were **unioned** across packs; guardrail conflicts were
resolved **stricter-wins** (§2); and `surfaces[]` was written to the slice for the tier rubric.

**Verdict:** all conditions hold → PASS. Any failing → name the failed criterion (e.g.
`oneway-honest: refund guardrail marked two-way`) in the consuming step's `failedCriterion`; the
step then routes per its own gate.
