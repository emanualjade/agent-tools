# Surface Pack: web-backend

The richest, **mandatory-deep** pack. It conforms to the uniform pack interface defined in
`surfaces/_registry.md` (`detect` / `guardrails` / `verification` / `modelingNotes`) — this file is
that pack for the web/backend modality, where the bulk of one-way doors live. It must be *genuinely
correct*: a wrong guardrail here is the high-severity, confidently-wrong class
(`disciplines/honest-verification.md`).

**How it is consumed:** S1/S2/S4 run the registry detection pass; each fired surface below maps onto
the domain-surface names in `disciplines/risk-tiering.md` (money, auth, security,
persistence/migration, external-effect/idempotency, destructive op, PII) — so a fired surface here
raises the slice to **CRITICAL** and attaches that surface's guardrail. S3/S5 verify each fired
surface's `check`; the `oneWayDoor` flag feeds `disciplines/obstruction-loop.md` reversibility
(one-way ⇒ Tier 3). Guardrail conflicts across co-firing packs resolve to the **stricter** one per
the registry precedence rule — never restated here.

---

## detect

Cheap signals over the slice plan + changed files. Each row names the surface it flags and the
risk-tiering domain it maps to. A slice may fire several rows; take the union.

| Signal (file globs · imports · path/keyword · AST) | Fires surface | Domain (risk-tiering) |
| --- | --- | --- |
| `*.sql`, migration dirs (`migrations/`, `db/migrate/`, `prisma/migrations/`); ORM imports (Prisma, TypeORM, Sequelize, SQLAlchemy, ActiveRecord, GORM, Drizzle, Knex); raw SQL strings (`SELECT`/`INSERT`/`UPDATE`/`DELETE`/`CREATE`/`ALTER`/`DROP`) | **persistence/SQL-ORM** | persistence/migration (DDL ⇒ also migration) |
| Route/handler decls (Express/Fastify/Koa router, Flask/FastAPI/Django view, Rails controller, Spring `@RequestMapping`, Go `http.Handler`, Next.js API/route handlers); OpenAPI/GraphQL schema files | **http-handler** | trust-boundary (security) |
| Amount/price/balance/refund/fee/tax/total/subtotal/discount field or column names; currency/`Decimal`/`BigDecimal`/`Money` types; payment-amount arithmetic | **money** | money |
| Auth/session/token/JWT/cookie/password/OAuth/permission/role/RBAC; crypto imports (`crypto`, `bcrypt`, `argon2`, `jsonwebtoken`, `jose`, libsodium); secrets/signing/HMAC | **auth-crypto** | auth + security |
| Schema-evolution edits (add/alter/drop column, rename, type change, index, constraint, backfill scripts) | **migration** | persistence/migration (+ destructive op on drop/rename) |
| External SDK/HTTP clients (Stripe, Twilio, SendGrid, AWS SDK, payment/email/SMS, `fetch`/`axios`/`httpx` to a third party); queue publish (SQS, Kafka, Rabbit), outbound webhooks | **external-effect** | external-effect/idempotency |
| File/CSV/XLSX upload or import; multipart/body parsers; inbound webhook *receivers*; deserializers (YAML/XML/`pickle`); query/path/header param reads | **trust-boundary** | security (PII if the payload carries personal data) |
| Consumed/published API or wire contract: REST endpoint shape, GraphQL schema, gRPC/protobuf, event/topic schema, exported public signature | **contract** | persistence/migration (breaking ⇒ one-way) |
| Render layer: JSX/TSX/Vue/Svelte components, templates (ERB/Jinja/Blade), CSS-in-JS, route pages | **ui** | (non-domain unless it also reads money/PII; drives R2 screenshot) |

A bare-CSS or copy-only `ui` hit with no other row firing stays TRIVIAL (no domain ceremony,
`disciplines/risk-tiering.md`). Every other row above is a domain surface ⇒ CRITICAL.

---

## guardrails

`[{ surface, when, check, oneWayDoor }]`. The `check` is the PASS condition S3 (plan) and S5
(build) assert per fired surface; failing it names the criterion. `oneWayDoor:true` ⇒ the slice is
irreversible by rule ⇒ obstruction routes Tier 3, never Tier 2.

### money — `oneWayDoor: true`

- **when:** the `money` surface fired (any amount/price/balance/refund/fee/tax read, written, or
  computed).
- **check — all must hold:**
  1. **Integer minor units.** Every monetary amount is stored and computed as an **integer in the
     currency's minor unit** (cents/pence/sen), never a float or a binary-`double`. If the stack
     forces a decimal type, it is a fixed-scale `Decimal`/`BigDecimal` with an explicit scale —
     **no IEEE-754 float touches money, ever.**
  2. **Currency beside every amount.** Each amount carries a **currency code** (ISO-4217) in the
     same record/column/field — an amount with no currency is an unbounded-error bug. Two amounts
     are never added/compared without equal currency.
  3. **Zero-decimal-aware conversion.** Major⇄minor conversion uses the currency's **actual
     exponent**, not a hard-coded ×100. **JPY, KRW, VND, CLP are zero-decimal (×1); BHD, KWD, TND
     are three-decimal (×1000).** A literal `* 100` / `/ 100` on money is a FAIL.
  4. **Largest-remainder split.** Splitting/prorating/allocating an amount across N parts (tax,
     fees, installments, line discounts) uses a **deterministic largest-remainder (Hamilton)**
     allocation so the parts **sum exactly to the original** with no lost or invented minor unit.
     Naive `round(total/n)` that drops or duplicates a cent is a FAIL.
- **canonical:** money math comes from a **vetted library / fixed-decimal type**, never hand-rolled
  (see *canonical* guardrail). Research is via `disciplines/canonical-research.md` (what Stripe/the
  accounting standard does), and is **mandatory** for this surface.

### idempotency — `oneWayDoor: true`

- **when:** the `external-effect` surface fired (a foreign-state mutation: charge/refund, email/SMS
  send, outbound webhook, queue publish, any non-idempotent third-party POST).
- **check — all must hold:**
  1. **Accept an idempotency key** on the mutation entry point (from the caller, or deterministically
     derived from the request's stable business identity) so a retry is recognized, not re-applied.
  2. **Commit the local DB write BEFORE the external call** (or use a transactional **outbox**): the
     intent is durably recorded first, the external effect fires second, the result reconciled back.
     Firing the external effect before the local commit means a crash double-charges with no record —
     a FAIL. Ordering is: persist intent → call with key → persist result.
  3. **Pass a derived key downstream.** The key handed to the provider is **deterministic from the
     business event** (not a fresh UUID per attempt) and is propagated to any further hop, so the
     whole chain dedupes on a retry.
- **canonical:** use the provider's documented idempotency mechanism (e.g. Stripe `Idempotency-Key`),
  pinned to the repo's SDK version (`disciplines/canonical-research.md`). Mandatory for this surface.

### migrations — `oneWayDoor: true`

- **when:** the `migration` surface fired (any durable schema change).
- **check — all must hold:**
  0. **Through-the-tool, never out-of-band.** The schema change is authored **AS a migration via the
     repo's actual migration mechanism** (Prisma migrate / Rails `db:migrate` / Alembic / Flyway /
     Liquibase / Knex / TypeORM / Sequelize / Django `makemigrations`) and is a **NEW TRACKED FILE the
     tool generated/recognizes**. Hand-applying DDL (`psql`/`mysql` console `ALTER`/`CREATE`/`DROP`),
     editing an already-applied migration in place, or hand-editing the tool's version state
     (`schema_migrations`/`_prisma_migrations`/`alembic_version`, the migrations lockfile, the
     generated client/schema) is a FAIL named `migration: out-of-band schema change (bypassed <tool>)`.
     Generalizes: **codegen output and lockfile-managed deps go through their tool, never hand-edited.**
  1. **Expand/contract**, never a single breaking step. Phase it: **expand** (additive, both old and
     new code run) → **backfill** → **contract** (remove the old) in a **separate later deploy** —
     never the same deploy that adds the read of the new shape.
  2. **Additive-nullable.** New columns are **nullable or defaulted** so the pre-deploy code keeps
     writing valid rows; no `NOT NULL`-without-default added to a populated table in the expand step.
  3. **Batched, bounded backfill.** Backfilling existing rows runs in **bounded batches** (no
     full-table lock, no single unbounded `UPDATE`), is **resumable**, and is idempotent on re-run.
  4. **Separate contract deploy.** Dropping the old column/table and removing old-shape code is its
     **own** later migration after the new path is verified live — never bundled with expand.
  5. **Renames = add + backfill + drop** (three steps, three deploys), **never an in-place
     `RENAME`** on a live column that has readers: add the new column, dual-write + backfill, cut
     readers over, then drop the old. An in-place rename is a FAIL.
  6. **Left-designated-green.** After the migration, the **DESIGNATED dev DB/branch** (named in
     `idea-decisions.md` "## Environments") must be confirmed **RUNNABLE** and the behavior **verified
     ON IT** — the migration applied through the tool, the app boots, the slice's path runs against
     that DB. Verifying against the **test/CI DB while the designated DB stays broken** (un-migrated,
     drifted, or left mid-failure) is a FAIL named `migration: broke designated DB`.
- **note:** drop/truncate also fires *destructive op*; the migration is irreversible by rule.

### trust-boundary

- **when:** the `trust-boundary` surface fired (any raw external input crosses in: HTTP body/query/
  path/header, uploaded file/CSV, inbound webhook, deserialized payload).
- **check — all must hold:**
  1. **Parse, don't validate-and-pass-raw.** At the boundary, raw input is **parsed into a typed,
     validated domain object** (schema validator — Zod/Pydantic/JSON-Schema/serializer — pinned per
     `disciplines/canonical-research.md`); unparseable input is **rejected at the edge**. No
     `req.body.x` flows into logic untyped; no string is trusted as a number/enum/id without parsing.
  2. **Structured typed errors, not naked 500s.** A rejected/invalid request returns a **typed,
     structured error** with the right status (4xx for client error) and a machine-readable body —
     never an unhandled exception surfacing as a bare 500, never a swallowed error returning 200.
  3. **Authorization is checked at the boundary** when the route is access-controlled (this composes
     with *auth-crypto*; an authenticated-but-unauthorized request is a typed 403, not a 500).
- **negative probe:** R3 (`disciplines/honest-verification.md`) must drive at least one malformed/
  oversized/wrong-type request through the **real entry point** and confirm the typed rejection.

### contracts

- **when:** the `contract` surface fired (a consumed or published API/wire/event/exported signature
  is touched).
- **check — classify every change as additive vs breaking, then route:**
  - **Additive** (new optional field, new endpoint, new enum value a consumer ignores, widened
    accept) ⇒ allowed in place.
  - **Breaking** (removed/renamed field, narrowed type, changed required-ness, changed status/error
    shape, removed endpoint, reordered positional contract) to a surface **other code consumes**
    ⇒ requires a **versioned / deprecation path**: ship the new version beside the old, deprecate
    with a migration window, remove only after consumers move. A breaking change with no
    versioned/deprecation path is a FAIL.
  - `oneWayDoor` is **true for the breaking case** (a broken consumer is irreversible once deployed),
    **false for the additive case** — the flag is set by the classification, resolving stricter on
    co-fire.
- **note:** a breaking change to an *internally-owned, single-consumer* surface changed atomically in
  the same slice is additive-equivalent — state that reasoning in the plan; otherwise treat as
  breaking.

### canonical — `oneWayDoor: true` (for the money/auth/crypto/dates cases)

- **when:** the slice touches **auth, session, crypto/signing, dates/timezones, or money** — any
  solved domain easy to get subtly and silently wrong.
- **check:** the implementation uses a **vetted, maintained library or the platform standard**,
  pinned to the repo's actual version — **never hand-rolled**. Concretely: password hashing via
  `bcrypt`/`argon2` (never custom); tokens/signing via a vetted JWT/JOSE lib with verified algorithm
  (no `alg:none`, no symmetric-key confusion); date/timezone math via a real tz-aware library against
  IANA data (never `Date` arithmetic or naive `+ days`); money via a fixed-decimal/money library
  (the *money* guardrail). Evidence is the `disciplines/canonical-research.md` output (source →
  finding → implication) + the package-existence check on any newly-added dependency. A hand-rolled
  crypto/auth/date/money routine where a canonical option exists is a FAIL.

---

## verification

How `R2_real_entry` (`disciplines/honest-verification.md`) is satisfied for this modality — the
"real entry point with real data" definition the registry promises. Ladder floors per tier come from
`disciplines/risk-tiering.md`; this pack only specifies *what counts as real* here.

- **R2 (real entry point):** exercise the slice's one behavior through its **actual HTTP request**
  (the running server, real route, real middleware/auth, a real DB — not a mocked handler call) **or
  its real UI interaction**, with **live, spec-stated data**. A unit test that calls the handler
  function directly is R1, not R2. For a money/auth/external-effect slice, the request must traverse
  the same validation, persistence, and (sandboxed/keyed) external path the production request would.
- **UI surfaces — screenshot inspection is mandatory for R2.** When `ui` fired, drive the **real
  rendered UI** in a browser and **capture + inspect a screenshot** against the checklist in
  `disciplines/honest-verification.md` (the spec-stated element present and rendered with real data;
  no error/broken-layout/console error/stuck spinner; one negative interaction shows its error/empty
  state). A claimed-but-uncaptured screenshot is a tamper.
- **R3 (negative + lenses), mandatory for CRITICAL:** at least one negative/edge probe through the
  real entry point per the fired surface — money: a **zero-decimal currency** amount + a
  **largest-remainder split that must sum exactly**; idempotency: a **replayed key** returns the
  prior result with **no double effect**; trust-boundary: a **malformed/oversized** request returns
  the **typed error**, not a 500; migration: the **expand step runs with old code still serving**
  (forward/backward compat); auth: an **unauthorized** principal is rejected. Plus the canonical +
  security lenses for every fired surface.
- **External effects in verification:** drive them against the provider's **sandbox/test mode** with
  a test key, asserting the idempotency replay; **never fire a real production charge/email/webhook**
  in verification. If no sandbox/harness exists, behavior verification is **blocked** ⇒ report
  `code-verified` with residual risk (`disciplines/honest-verification.md`), **never** `verified`.
- **Migrations in verification:** run the migration **through the repo's migration tool** (clause 0)
  against a **representative copy** (real schema + sample rows), assert the expand step is non-locking
  and old code still reads/writes, and that the backfill is idempotent on re-run. Never verify by
  running a destructive contract step against data you cannot restore. The behavior verdict requires
  the **designated dev DB left green** (clause 6) — a green on the test/CI DB while the designated DB
  stays broken is the *broke designated DB* FAIL, not a pass.

---

## modelingNotes

The `disciplines/adjective-noun.md` lens reads "table/type" as a **SQL table or ORM model** here
(its default reading). Pack-specific refinements (these refine, never override, that ladder):

- **`status`/`role`/`visibility` is a column + `CHECK`/enum constraint**, not a sibling table —
  `draft_posts`/`admin_users`/`archived_orders` are the `union-over-split` smell.
- **`order` vs `invoice`** is the shape that *earns* a new table (distinct columns + relationships +
  independent lifecycle, stated in one line) — the canonical contrast in `disciplines/adjective-noun.md`.
- **Money is a value pair on the owning row** (`amount_minor INTEGER` + `currency CHAR(3)`), not a
  separate `amounts` table — an amount has no lifecycle independent of what it prices.
- **Cardinality before table-vs-column:** single-valued/mutually-exclusive ⇒ column; genuine M:N ⇒
  the **join table is the only new type**, the per-value states still are not noun-tables.

---

## Pack gate

**`web-backend-pack` PASS for a slice iff** every surface that fired in `detect` has its `check`
satisfied (named per surface above), every `oneWayDoor:true` surface was treated as one-way by the
obstruction loop, every schema change went **through its migration tool** and **left the designated
dev DB green** (clauses 0 + 6), R2 was reached through the real HTTP/UI entry point with live data
(screenshot inspected for `ui`), and — for CRITICAL — R3 + the canonical/security lenses passed per
fired surface. **FAIL** names the surface and its failing clause (e.g. `money: literal *100
conversion`, `idempotency: external call precedes local commit`, `migration: in-place RENAME on live
column`, `migration: out-of-band schema change (bypassed <tool>)`, `migration: broke designated DB`,
`contract: breaking change with no version path`). **BLOCKED** when R2 is unreachable (no sandbox/
harness) ⇒ `code-verified` + residual risk, per `disciplines/honest-verification.md`.
