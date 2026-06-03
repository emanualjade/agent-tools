# Discipline: adjective-noun (field-not-table lens)

A top-priority modeling lens. Run it on **every new persistent type proposed in a plan** (S2),
and again before any edit (S4) introduces one. It is modality-agnostic: read "table" as the
persistent-type concept of the slice's modality — see **Modality mapping** below.

## The default (the lens)

> **An adjective on a noun is a state / enum / flag / permission / scope / relationship on the
> EXISTING entity — never a new type — until a new type is *argued for*.**

Worked vocabulary: `draft post`, `public user`, `cancelled subscription`, `archived order`,
`admin user`, `premium account`, `pending invoice`. Each is the **same real-world thing in a
different state, role, visibility, scope, or ownership** — so each is a column on the existing
noun (`post.status`, `user.role`, `subscription.cancelled_at`, `order.archived`), not
`draft_posts` / `public_users` / `admin_users`.

## The one-line argument that earns a new type

A new type is permitted **only if** you can state in **one line** all three of:

> The distinct **columns** AND **relationships** AND **independent lifecycle** that `<new type>`
> has that `<noun>` lacks.

If any of the three cannot be named, **it is a column** — collapse it back onto the noun. "It
feels cleaner" / "it might grow" is not an argument (that is the Speculative-Foundation smell — see
`risk-tiering.md` surfaces; build the column now, split on real second use).

## Ordered decision ladder

Apply top to bottom; stop at the first verdict. **Cardinality is decided before table-vs-column.**

1. **Same thing, different adjective?** Is `<adjective> <noun>` the same entity in a different
   state/role/visibility/scope/ownership? → **column on `<noun>`** (enum/flag/FK/scope). Stop.
2. **Cardinality first.** How many values can ONE row hold at once?
   - **Single-valued & mutually exclusive** (one status, one role-per-row, one 1:1 setting) →
     **column** with a `CHECK`/enum constraint for allowed values. Stop. *Never* a join/lookup
     table, *never* EAV for this.
   - **Multi-valued** (a row genuinely has many at once) → continue to step 3.
3. **Relationship cardinality.** Many-to-one → **FK column** on the many side. Many-to-many → a
   **join table** (the join is the only new type; the values still are not separate noun-tables).
4. **Lookup table?** Introduce a separate lookup table **only when** the value set is *large* AND
   *shared across entities* AND *itself carries attributes*. Otherwise the enum/`CHECK` from step 2
   is correct.
5. **New entity type?** Only if the one-line argument (columns AND relationships AND independent
   lifecycle, all three) holds. Record that one line in the plan next to the `CREATE`.

PASS condition for this lens (named criterion **`adjective-noun`**): every new persistent type in
the plan either (a) survived the one-line three-part argument, with that line written down, or (b)
was collapsed to a column/enum/flag/FK/scope/join. FAIL names the unjustified new type.

## Two smells (auto-FAIL the lens until resolved)

- **`union-over-split`** — Over-split into per-state/per-role tables. **Detector:** the query
  "**all `<nouns>`**" (all posts, all users, all orders) would require a **UNION across tables**.
  That alone proves over-splitting → **collapse to one table + a discriminator column**
  (`status`/`role`/`visibility`). Trigger: emitting `draft_posts`+`published_posts`,
  `public_users`+`private_users`, `archived_orders` as a sibling table, etc.
- **`scalar-over-normalized`** — A single-valued status / feature flag / fixed per-row config /
  1:1 setting modeled as its **own lookup/join table** or as **EAV** (entity-attribute-value
  key/value rows). **Verdict:** a single-valued, mutually-exclusive per-row property is a
  **column** (`CHECK`/enum), never a joined table and never EAV. (This is step 2 failing — the
  cause is almost always deciding table-vs-column *before* cardinality.)

## Worked examples

1. **`draft post` / `published post`.** Same thing, different state (step 1). → `post.status enum
   ('draft','published','archived')`. The "all posts" query is one `SELECT`; two tables would force
   a UNION → `union-over-split`. **Column.**
2. **`admin user`.** Same person, different role/permission (step 1). Single-valued if one role per
   user (step 2) → `user.role enum`. Multi-valued if a user holds many roles at once (step 2 →
   step 3, M:N) → `user_roles` **join table** — the join is justified by genuine multi-cardinality,
   not by the word "admin." Either way, **no `admin_users` table**.
3. **`cancelled subscription`.** A lifecycle event on the same subscription, not a new species
   (step 1). → `subscription.status` + `cancelled_at timestamp`. The independent-lifecycle test
   *fails* (a cancelled sub is the same row continuing its life), so no new type.
4. **`order` vs `invoice` (a real new type — contrast).** Not an adjective on `order`: an invoice
   has **distinct columns** (tax breakdown, due date, PDF ref), **distinct relationships** (links to
   payments and a tax authority, not to cart items), AND an **independent lifecycle** (issued →
   sent → paid → void, outliving any one order; one invoice can span several orders). All three
   named in one line → **new `invoice` table is earned.** This is the shape that passes.

## Modality mapping

The lens is identical across modalities; only the surface noun for "table" changes. Read the slice's
detected surfaces and apply the matching pack's `modelingNotes` from the **surfaces registry**
(`surfaces/_registry.md` → the relevant pack):

- **web-backend** — SQL table / model. (As above.)
- **data-pipeline** — a field/enum on the **record/event schema** (Avro/Protobuf/JSON Schema/dbt
  model column), not a new topic/table per state. "Over-split" = a topic-or-model per state.
- **mobile** — a field/enum on the local **struct/record** (and its sync payload), not a new
  entity/store per state; a flag in the binary is still a field.
- **infra-as-code** — an attribute/tag on the existing **resource**, not a new resource type per
  state/environment.
- **cli-devtool** — a field/enum on the **config record or message struct**, not a new
  type/subcommand per state.

If a pack ships `modelingNotes`, those refine (never override) this ladder; the one-line three-part
argument and the two smells are constant across all modalities. When no pack matches, default to the
web-backend reading.
