# Discipline: Risk Tiering

Compute a slice's `{ size, riskTier, surfaces }` **once, at slice birth in S1**, and have every
downstream step consume it to set its lane and its rigor depth. This is the lever the whole pipeline
pivots on: it is how Strike spends heavy guardrails **only** where a trigger surface fires, and pays
nothing on a CSS change (DESIGN §1.8). Get the tier right and the rest of the workflow self-scales.

**Who reads this:** S1 (assigns the tier), S2 (re-detects; may raise), S4 (re-detects; may raise),
S3 + S5 (consume the tier to pick lane and ladder depth). The **engine** consumes the resulting
`riskTier`/`surfaces` to route lanes deterministically — it computes nothing itself.

---

## 1. The three fields

| Field | Values | Meaning |
| --- | --- | --- |
| `size` | `XS \| S \| M \| L \| XL` | Effort/scope of the slice (sizing table below). |
| `surfaces` | `string[]` | The trigger surfaces this slice touches, detected via the surfaces registry. |
| `riskTier` | `TRIVIAL \| STANDARD \| CRITICAL` | Computed from `size` + `surfaces` by the rubric in §4. |

`surfaces` carries **two** kinds of flag: the **domain surfaces** in §2 (which gate the tier) and
the **modality surfaces** owned by the packs in `surfaces/_registry.md` (which attach guardrails +
adjust the verification ladder). Both are detected in the same pass; both are recorded on the slice.

### Sizing rubric

| `size` | Shape (one observable behavior, app left runnable) |
| --- | --- |
| `XS` | Copy / CSS / config / a constant / an internal rename — no logic branch. |
| `S` | One small unit of new logic in one place; obvious tests; no new persistent shape. |
| `M` | New logic across a couple of seams, **or** any new persistent shape/contract/migration. |
| `L` | Multiple seams or a non-trivial new entity; should usually have been split — flag it. |
| `XL` | Cannot be one observable behavior; **must** be split before it gets a tier. |

Size is about *blast radius and number of moving parts*, not line count. When in doubt between two
sizes, pick the **larger** — sizing only ever raises rigor, never lowers it (§5). **Do not record a
smaller size while the slice shows larger-size signals** (the *Split signals* in `s1 §3`): split it,
or write the one-line reason the larger blast radius is the smallest safe move. Under-sizing to dodge
the FULL lane is the failure this guards against.

---

## 2. The domain-surface list (the tier gate)

A slice is **domain-touching** if it touches **any** of these. This is the exact, closed list —
detect each one; if any fires, the slice is CRITICAL regardless of size.

| Domain surface | Fires when the slice… |
| --- | --- |
| **money** | reads/writes/computes amounts, prices, balances, refunds, accounting, billing. |
| **auth** | touches authentication, sessions, tokens, authorization/permissions, access control. |
| **security** | touches crypto, secrets/credentials, signing, input trust boundaries, injection-prone surfaces. |
| **persistence / migration** | adds or changes a durable schema, a stored shape, or a data migration/backfill — read through the **local-persistence down-tier** below. |
| **external-effect / idempotency** | calls a third-party/foreign-state mutation (payment, email/SMS, webhook out, queue publish) where a retry could double-apply. |
| **destructive op** | deletes, truncates, overwrites, or irreversibly transforms existing data or resources. |
| **PII** | reads/writes/transmits personal or regulated data (names, emails, addresses, health, financial identity). |

### Local-persistence down-tier (the persistence-row carve-out)

The **persistence / migration** row above does **not** fire CRITICAL on every touch of a stored
shape — it fires on a *durable-shape change* or *cross-/multi-party risk*. The carve-out, in the
canonical wording other files consume:

> A persistence/migration surface fires CRITICAL only when it changes a DURABLE SHAPE or carries
> cross-/multi-party risk — a new/changed schema, a destructive or backfilling migration, a
> shared/multi-reader or external/managed datastore. A persistence surface that is SINGLE-USER,
> ON-DEVICE/LOCAL, ADDITIVE-ONLY (new store/field, no backfill of existing rows), with NO shared
> readers and NO external migration tooling is STANDARD (FAST lane, R2 floor), NOT CRITICAL — plain
> CRUD reads/writes against an existing local store carry ordinary rigor. Creation of a new
> persistent store/schema stays CRITICAL (it is a durable-shape change); routine record reads/writes
> do not.

**What this protects, explicitly:** REAL migrations stay CRITICAL. A new or changed schema, a
destructive or backfilling migration, a shared/multi-reader datastore, or an external/managed store
(server DB, managed migration tooling) is a one-way door and fires CRITICAL unchanged. The carve-out
narrows the persistence surface to its high-severity core; it does **not** weaken it for any surface
that can corrupt durable or shared state.

**What this down-tiers:** a single-user, on-device/local, additive-only store (e.g. IndexedDB /
local-file / on-device KV) with no shared readers and no external migration tooling. Adding a new
field or a new store there is additive (no backfill of existing rows), and plain CRUD reads/writes
against an existing local store are STANDARD — they take the FAST lane at the R2 floor, not FULL.
Creating that new persistent store/schema for the **first** time is still a durable-shape change and
stays CRITICAL; once it exists, routine record reads/writes against it do not.

> *Dogfood miss this fixes:* an IndexedDB-backed initiative ran **all 6 slices CRITICAL** because
> "IndexedDB = persistence surface" matched the row literally, so the FAST lane was never used. Under
> the carve-out only the store-creation slice is CRITICAL; the additive-field and CRUD slices are
> STANDARD/FAST.

**Detection is delegated, not hard-coded.** Run the surfaces-registry detection pass
(`surfaces/_registry.md`) over the slice's plan + intended footprint. Each modality pack maps its
own concrete signals (SQL/ORM, HTTP handlers, payment SDKs, migration files, Terraform `destroy`,
topic-schema changes, on-device storage, CLI `--force`, …) onto these domain surface names. A slice
may match **multiple** packs; take the **union** of all fired surfaces, and resolve any guardrail
conflict to the **stricter** one (registry precedence rule). This keeps the tier rubric identical
across web, mobile, data-pipeline, infra, and CLI — never web/backend-specific.

---

## 3. Tier definitions

- **CRITICAL** — domain-touching **or** large. Money/auth/security/persistence/external-effects are
  one-way doors by rule (DESIGN §1.9): getting them wrong is hard or impossible to reverse, and
  silent-wrong here is the high-severity class. Maximum rigor.
- **STANDARD** — real logic, no domain surface, small. Ordinary correctness rigor.
- **TRIVIAL** — cosmetic/config, no domain surface, extra-small. Zero domain ceremony — paying
  guardrail cost here is itself a failure mode (it trains agents to skim the checklist that guards
  the money path, DESIGN §1.8).

---

## 4. The rubric (apply top to bottom; first match wins)

```
1. ANY domain surface from §2 fired?              → CRITICAL
2. ELSE size ≥ M  (M, L, or XL)?                  → CRITICAL
3. ELSE size == S  AND no domain surface?         → STANDARD
4. ELSE size == XS AND no domain surface
        AND change is copy/CSS/config/internal?   → TRIVIAL
```

Rules 1–2 are an **OR**: either condition alone makes the slice CRITICAL. Rule 4 is the **only**
path to TRIVIAL — if an XS slice has any domain surface, rule 1 already caught it as CRITICAL.

**Rule 1 reads the persistence surface through the §2 local-persistence down-tier.** A
persistence/migration surface counts as "fired" for rule 1 only when it changes a DURABLE SHAPE or
carries cross-/multi-party risk — a new/changed schema, a destructive or backfilling migration, a
shared/multi-reader or external/managed datastore. A SINGLE-USER, ON-DEVICE/LOCAL, ADDITIVE-ONLY
persistence surface (new store/field, no backfill of existing rows) with NO shared readers and NO
external migration tooling does **not** fire rule 1 — it falls through to rules 2–3 and lands
STANDARD (FAST, R2 floor) unless its size independently makes it CRITICAL. New-store/schema
**creation** still fires rule 1 (durable-shape change → CRITICAL); routine record reads/writes
against an existing local store do not. Every **other** domain surface — money, auth, security,
external-effect, destructive op, PII — and every REAL migration (schema change / destructive or
backfilling migration / shared / external-managed store) fires rule 1 unchanged.

### Lane + rigor mapping (the output every downstream step reads)

| `riskTier` | Lane | Plan-verify (S3) | Verification ladder floor | Mandatory lenses |
| --- | --- | --- | --- | --- |
| **CRITICAL** | **FULL** | **yes** (S3 runs) | **≥ R3** (negative/edge probe) | **canonical + security**, for each fired surface |
| **STANDARD** | **FAST** | skipped | **≥ R2** (behavior via real entry point, real data) | none mandated beyond R2 |
| **TRIVIAL** | **FAST** | skipped | **R1** (focused, non-tautological test) | none — zero domain ceremony |

Ladder rungs (R0–R4) and what each means are defined in `disciplines/honest-verification.md`;
"real entry point with real data" is defined **per modality** by the surfaces registry. "Floor"
means *at least* — a verifier may climb higher (e.g. R4 cross-slice) but never below the floor.
"Canonical lens" = `disciplines/canonical-research.md` (MANDATORY, not optional, for a fired
surface). The lane names FAST/FULL and their step sequences are fixed by DESIGN §3.

---

## 5. Monotonic tier: raise only, never lower

The tier is **monotonic across the pipeline** — any step may **raise** it; **no step may lower** it.

- **S1** assigns the birth tier from §4 and records `{ size, riskTier, surfaces }` on the slice.
- **S2** (plan) re-runs surface detection against the now-concrete plan. **S4** (build) re-runs it
  against the actual diff/footprint. Both are obligated to catch a surface the slicer missed.
- **Promotion rule:** if any later step detects a domain surface (or a size growth to ≥ M) that
  would yield a higher tier than the slice currently carries → **promote to CRITICAL**, add the
  newly-detected surface(s) to `surfaces`, and **re-route the slice into the FULL lane** (it now
  owes S3 plan-verification + the ≥ R3 ladder + canonical/security lenses). The step emits the
  updated `riskTier`/`surfaces` in its result envelope; the engine re-routes deterministically.
- **Never demote.** A slice that *looked* CRITICAL and turns out tame stays CRITICAL — paying
  slightly too much rigor once is cheap; missing a money/auth/migration surface is the expensive
  failure. Lowering a tier is forbidden, full stop.

A missed-surface promotion in S2 or S4 is **not** a failure of the slice — it is the safety net
working. Record it (the new surface is now on the slice) and proceed in the FULL lane.

---

## 6. Gate (PASS condition for any step that owns or touches the tier)

**`risk-tiering` is satisfied for a slice iff ALL hold:**

1. **`fields-present`** — the slice carries non-empty `size`, `riskTier`, and a `surfaces` array
   (possibly empty), all three written to the slice artifact.
2. **`detection-run`** — surface detection was run via `surfaces/_registry.md` against this step's
   available footprint (plan in S2, diff in S4), not guessed; every domain surface in §2 was checked.
3. **`rubric-consistent`** — `riskTier` equals the value the §4 rubric yields for the recorded
   `size` + `surfaces` (no domain surface silently dropped; no TRIVIAL with a domain surface).
4. **`lane-correct`** — the slice's lane matches the §4 mapping for its `riskTier`
   (CRITICAL→FULL, STANDARD/TRIVIAL→FAST), and a promoted slice has been re-routed to FULL.
5. **`monotonic`** — the tier is ≥ the tier the slice carried on entry to this step (raise-only).

**Verdict:** all five → this discipline is `PASS` for the slice. Any failing → name the failed
criterion (e.g. `rubric-consistent: money surface fired but tier=STANDARD`) in the step's
`failedCriterion`; the step then promotes (§5) or routes per its own gate. A TRIVIAL or STANDARD
slice carrying a domain surface is always a `rubric-consistent` failure.
