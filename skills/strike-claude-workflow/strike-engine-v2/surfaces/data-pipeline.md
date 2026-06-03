# Surface pack: data-pipeline

A first-class member of the surfaces registry (`surfaces/_registry.md`): same `detect` /
`guardrails` / `verification` / `modelingNotes` interface as every pack. It owns the **batch &
streaming data** modality — ETL/ELT jobs, warehouse models, and event streams — where the
high-severity failures are **non-idempotent re-runs, breaking schema changes, and unbounded
backfills** that corrupt or lock production data silently.

Detection maps this pack's concrete signals onto the **domain-surface names** in
`disciplines/risk-tiering.md` (persistence/migration, external-effect/idempotency, destructive op,
PII) — those gate the tier; the guardrails below attach the rigor. A pipeline slice is almost always
**CRITICAL** (persistence + replay are domain surfaces and one-way by rule).

---

## detect

A slice matches this pack when any signal fires (cheap pass over the slice plan + changed files):

| Channel | Signals |
| --- | --- |
| **Frameworks / files** | `dbt_project.yml`, `models/**/*.sql`, dbt `*.yml` schema files; Airflow `dags/**`, `@dag`/`@task`/`DAG(`; Spark (`SparkSession`, `pyspark`, `.parquet`/`.orc` writes), Beam (`apache_beam`, `PCollection`); Kafka/Flink/Kinesis/PubSub (`KafkaProducer`, `@KafkaListener`, `consumer.subscribe`, Flink `DataStream`). |
| **Job shape** | ETL/ELT/transform jobs, scheduled batch jobs, stream processors, CDC connectors (Debezium), warehouse loaders (`COPY`, `MERGE`, `INSERT OVERWRITE`), reverse-ETL. |
| **Schemas** | Avro `.avsc`, Protobuf `.proto` for messages/topics, JSON Schema for events, a schema-registry reference, a topic/table contract, a dbt model's column contract. |
| **Backfill / reprocess** | a backfill/replay/reprocess script, a `--start`/`--end` date-range param, `full-refresh`, historical recompute, a one-off migration job over a table. |
| **Warehouse models** | warehouse/lakehouse tables + views (BigQuery, Snowflake, Redshift, Databricks, Iceberg/Delta/Hudi), partition/cluster definitions, incremental models. |

**Surfaces this pack flags** (union onto the slice's `surfaces`):
`pipeline:idempotency`, `pipeline:schema-evolution`, `pipeline:backfill`, `pipeline:event-quality`,
`pipeline:pii`. Each maps up to a risk-tiering domain surface (next column in the guardrail table),
so the tier rubric stays modality-agnostic.

---

## guardrails

Each attaches **only when its `when` fires**. `check` is the named PASS condition a verifier asserts;
`oneWayDoor: true` means the obstruction loop treats it as irreversible — `unknown` reversibility is
one-way, and these are one-way **by rule** (`disciplines/obstruction-loop.md` §3).

### G1 — `pipeline:idempotency` (maps to external-effect/idempotency · persistence)
- **when:** the slice writes/updates a sink (table, topic, file, downstream API) on a schedule or via
  a job that can be retried, re-run, or replayed.
- **check `idempotent-replay`:** running the transform twice over the **same input** yields the
  **identical sink state** — no duplicated rows, no double-counted aggregates, no re-fired external
  effects. Achieved by one of: a deterministic **MERGE/upsert keyed on a stable business key**;
  `INSERT OVERWRITE` of the **bounded target partition**; a dedup key on emitted events; or a
  recorded watermark/offset the re-run respects. A blind `INSERT … SELECT` (append) into a
  cumulative table is **not** idempotent → FAIL.
- **oneWayDoor:** **true** for any transform that fires an **external effect** (publishes to a
  downstream topic real consumers read, calls an API, sends notifications) — a re-run that
  double-applies cannot be undone. A purely-internal upsert into a target table the slice fully owns
  is two-way (re-runnable) and may be Tier ≤ 2.

### G2 — `pipeline:schema-evolution` (maps to persistence/migration · external-effect)
- **when:** the slice adds, removes, renames, or retypes a field on a **topic schema, event schema,
  warehouse table, or dbt model contract** that **another job, consumer, or BI tool reads**.
- **check `compat-preserved`:** the change is **backward- AND forward-compatible** for every existing
  consumer — verified against the **schema registry's compatibility mode** where one exists
  (`BACKWARD`/`FORWARD`/`FULL`). Safe (two-way) changes: **add an optional field with a default**,
  add a nullable column, widen a numeric/length type. **Breaking (one-way):** drop/rename a field,
  narrow or change a type, make an optional field required, change semantic meaning of a value, or
  reorder positional Avro/Proto fields. Field-rename is done as **add-new + dual-write + migrate
  consumers + drop-old** (the streaming analog of expand/contract — never an in-place rename).
- **oneWayDoor:** **true** for any breaking change to a consumed schema. Producers and consumers
  cannot be atomically redeployed; once a breaking message is on the topic or a column is gone,
  downstream jobs fail or silently mis-read. Escalate via Tier 3 (ADR + reversible interim =
  versioned/dual schema) — do **not** ship the breaking change inside the slice.

### G3 — `pipeline:backfill` (maps to destructive op · persistence)
- **when:** the slice runs a backfill, full-refresh, reprocess, or any historical recompute over an
  existing table/partition/topic.
- **check `backfill-bounded`:** the backfill is **batched** (chunked by partition / date-range / key
  range, not one monolithic statement), **bounded** (explicit `--start`/`--end` or partition list —
  never unbounded "all history" by default), **non-locking** (no `LOCK TABLE`, no full-table
  rewrite that blocks live readers/writers; write to a staging/shadow location then atomic
  swap/partition-exchange where the warehouse supports it), **resumable** (checkpointed so a failure
  mid-run restarts from the last completed batch, not from zero), and **idempotent per batch** (G1 —
  re-running a batch is safe). A backfill that holds a long lock, rewrites a whole table in one
  transaction, or cannot resume → FAIL.
- **oneWayDoor:** **true** — a backfill mutates historical production data. Run behind a reversible
  interim first (write to a shadow table, diff against current, then swap) and treat the swap as the
  one-way step.

### G4 — `pipeline:event-quality` (maps to external-effect/idempotency · persistence)
- **when:** the slice consumes or produces events/messages from a stream (Kafka/Kinesis/PubSub/CDC)
  or any source where delivery is at-least-once or order is not guaranteed.
- **check `event-robust`:** the slice explicitly handles, with a **named strategy** for each that
  applies:
  - **Duplicates** — dedup by message key / idempotency key / event id (at-least-once delivery is
    the default; assume every message can arrive ≥ 2×).
  - **Out-of-order** — order by **event-time, not arrival-time**; use a watermark/window, or an
    `updated_at`/version guard so a stale event cannot overwrite a newer state.
  - **Late-arriving** — a defined allowed-lateness window and a destination for events past it (late
    update vs. dead-letter), never silently dropped.
  - **Poison / unparseable** — routed to a **dead-letter queue/table** with the raw payload + error,
    never crashing the consumer or being swallowed.
- **oneWayDoor:** false (handling is in-job logic), but missing handling on a slice that mutates
  foreign state escalates via G1's external-effect one-way rule.

### G5 — `pipeline:pii` (maps to PII)
- **when:** the slice reads, writes, transmits, or **propagates** personal/regulated fields (name,
  email, address, phone, government id, health, financial identity) through any stage.
- **check `pii-governed`:** PII is **not silently widened** — a field that was access-controlled or
  masked upstream is not copied into a broadly-readable warehouse table, a public topic, or logs in
  the clear. The slice applies the repo's existing PII pattern (hashing/tokenization/masking/column
  policy/encryption — found via `disciplines/read-before-write.md`), tags the new field's
  sensitivity, and keeps PII out of debug logs and dead-letter payloads unless that sink is itself
  governed. A new PII field has a defined **retention/deletion** path if the repo enforces one.
- **oneWayDoor:** **true** once PII is written to a durable or replicated sink (warehouse, topic,
  backup) — you cannot recall data already fanned out to consumers/replicas.

**CANONICAL lens (mandatory for CRITICAL).** Per `disciplines/canonical-research.md`, do not
hand-roll schema compatibility, exactly-once/idempotency, watermarking, or windowing — use the
proven mechanism of the pinned stack (schema-registry compatibility checks; Kafka transactions /
`enable.idempotence`; the framework's stateful-windowing operators; dbt `unique`/`not_null`/
incremental strategies). Evidence: `SOURCE → FINDING → IMPLICATION` against the **repo's pinned
versions**.

**Conflict resolution.** When this pack and another (e.g. web-backend money on a billing-events
pipeline) both fire, the registry's **stricter (more one-way)** rule wins — money/idempotency
guardrails apply *in addition to* G1–G5.

---

## verification

Defines what **R2 "real entry point with real data"** means for this modality, for
`disciplines/honest-verification.md`. CRITICAL pipeline slices owe **≥ R3**; STANDARD owe **≥ R2**.

**R2 `R2_real_entry` (pipeline form) — run the transform on a REPRESENTATIVE SAMPLE:**
1. **Execute the actual job/model/processor** through its real runner (dbt run/`--select`, the
   Airflow task, `spark-submit`, the Beam runner, the stream consumer against a test topic) — not a
   unit-test stub of the SQL/logic.
2. **Input = a representative sample**, small but covering the slice's real shape: a few partitions /
   a bounded date-range / a seeded set of records, including the edge rows the slice claims to
   handle. Never the entire production table.
3. **Assert the OUTPUT SCHEMA** — column/field names, types, nullability, and (for streams) the
   message schema match the contract the slice promised. A schema drift here is an R2 FAIL.
4. **Assert ROW-LEVEL EXPECTATIONS anchored to the spec** — specific expected rows/aggregates/event
   payloads from the slice's acceptance criteria (e.g. "order 42 → revenue 19.99 in `daily_rev`"),
   not "row count > 0" and not a snapshot blessed from the job's own current output (that is a
   tautology per the honest-verification tamper audit).
5. **IDEMPOTENT RE-RUN** — run the transform **a second time on the same sample**; assert the sink is
   **byte-for-byte/row-for-row identical** to after the first run (no new rows, no doubled
   aggregates, no re-fired effects). This is the load-bearing pipeline check and is **mandatory**
   wherever `pipeline:idempotency` fired.

**R3 `R3_negative` (mandatory for CRITICAL) — feed the bad-data probes** the slice must survive,
through the real runner: a **duplicate** event, an **out-of-order / stale** event, a **late** event,
and a **malformed/poison** record → assert dedup / version-guard / lateness-handling / dead-letter
behavior (G4), plus the canonical + security lenses for every fired surface. For
`pipeline:schema-evolution`, the negative probe is a **consumer-compat check**: feed the *new*
schema to an *old*-schema reader (and vice-versa) and assert it still parses.

**HARD PROHIBITION — never run a destructive full operation in verification.** No production
full-refresh, no unbounded backfill, no `INSERT OVERWRITE`/`MERGE`/`DROP` against a real shared
table, no publish to a topic real consumers read. Verification runs against a **sample / sandbox /
test topic / shadow table** only. If the only way to exercise the behavior is a destructive
production run, R2 is **blocked** — report **`code-verified`** (never "verified") with the residual
risk named and emit `verdict:BLOCKED` (`failedCriterion: R2_real_entry blocked`) per
`disciplines/honest-verification.md`; the engine degrades. Do not run the destructive op to claim a
green tick.

---

## modelingNotes

Refines `disciplines/adjective-noun.md` for this modality (it does not override the one-line
three-part argument or the two smells).

- **Read "table" as the event/record schema** — a topic, an Avro/Proto/JSON message schema, or a
  warehouse/dbt model. The field-not-table lens becomes **field-not-new-topic / field-not-new-model**:
  an adjective on a record (`enriched event`, `failed order`, `late click`, `deduped session`) is a
  **field/enum on the existing event or model** — `event.status`, `order.state`, `event.is_late` —
  **not** a new topic, a new Avro schema, or a sibling dbt model per state.
- **`union-over-split` smell, pipeline form:** if answering "**all `<events>`**" would require a
  `UNION ALL` across several topics/models (`clicks_valid` + `clicks_invalid`, an `orders_failed`
  topic beside `orders`), that is over-splitting → **one stream/model + a discriminator field**.
  Branch with a filter/route at consumption time, not by forking the schema.
- A new topic/model is earned only by the standard one-line argument: **distinct fields AND distinct
  consumers/producers (relationships) AND an independent lifecycle/retention** that the existing
  stream lacks. Adding a field to an existing schema then runs the **`pipeline:schema-evolution`
  guardrail (G2)** — a field is cheaper than a topic, but on a *consumed* schema it is still a
  compatibility event, not free.
