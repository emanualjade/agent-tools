# Discipline: Arch-Debt as Code (Marker + ADR)

**A Tier-3 decision is recorded twice, as code: a grep-able `ARCH-DEBT` marker at the exact site,
AND a committed ≤1-page ADR. Recorded-in-chat or in a PR body does NOT count.**

This is the record-keeping half of obstruction-loop Tier 3 (`obstruction-loop.md`). When the build
escalates a *decision* (irreversible door, competing hard-to-reverse designs, or a wrong upstream
shape), it proceeds on a reversible interim and leaves these two artifacts behind so the choice is
auditable and the next slice can find it.

## Why (load-bearing, not ceremony)

The next slice's **read-before-write** (`read-before-write.md`) greps `ARCH-DEBT` touching its
footprint *before it codes*. A decision that lives only in chat or a merged PR description is
invisible to that grep and to a fresh context window — so the next slice silently builds on the
interim as if it were the final design, and the debt compounds unrecorded. Two code artifacts close
that: the **marker** is the in-code breadcrumb a grep finds at the exact line; the **ADR** is the
one-page reasoning a reader opens to understand *why* and *what the real fix is*. Marker without ADR
= a dangling pointer; ADR without marker = a document nobody greps. Both, committed, or it didn't
happen.

## 1. The `ARCH-DEBT` marker (grammar)

A single-line comment placed at the **exact code site** the interim lives — the line/block that
would change once the debt is paid. Grammar:

```
ARCH-DEBT(<slice-id>): <reason> -> <adr-link>
```

- **`ARCH-DEBT`** — the literal grep token, uppercase, hyphenated. Nothing else may use it.
- **`(<slice-id>)`** — the slice that incurred the debt, in parens, e.g. `(P2-S3)`. Lets the next
  slice attribute and the report aggregate.
- **`<reason>`** — one clause: what is interim and why, in plain words. Not the whole story (that's
  the ADR) — just enough that a grepper knows if it touches them. e.g. `sync writes block on email
  send; needs a queue seam`.
- **`-> <adr-link>`** — `->` then the ADR's repo-relative path:
  `strike/initiatives/<id>/adr/NNN-slug.md`. The pointer is mandatory; a markerless-of-ADR or
  ADR-less-of-marker pair fails the gate below.

Use the host language's comment syntax (`// ARCH-DEBT(...)`, `# ARCH-DEBT(...)`,
`<!-- ARCH-DEBT(...) -->`, `-- ARCH-DEBT(...)`). The token text is identical across all so one grep
finds every site.

```
// ARCH-DEBT(P2-S3): sync write blocks on email send; needs an async outbox seam -> strike/initiatives/checkout/adr/004-email-outbox-seam.md
```

If the same interim spans multiple sites, mark each site (the grep must hit every place the debt
lives); all point to the **same** ADR.

## 2. The ADR (≤1 page)

One file per decision: `strike/initiatives/<id>/adr/NNN-slug.md`. `NNN` is a zero-padded
monotonically-increasing integer per initiative (`001`, `002`, …); `slug` is a short kebab summary.
**Hard cap: one page.** If it runs longer, the decision isn't distilled enough — cut, don't append.

Template (every heading required; keep each to the noted size):

```markdown
# ADR NNN: <title>

- **Slice:** <slice-id>   **Status:** proposed | ratified   **Reversibility:** two-way | one-way | unknown

## Context / Obstruction
<2-4 sentences: the architecture that fights the change, the blast radius, why a plain in-slice
edit can't make this call. State the surface that makes it one-way if any (money / migration / auth /
external-effect) per the surfaces registry.>

## Candidates
1. **<name>** — <one-line tradeoff>.
2. **<name>** — <one-line tradeoff>.
3. **<name>** — <one-line tradeoff>.   ← 2-3 candidates; one line of tradeoff each, no more.

## Decision / Recommendation
<The chosen real fix (or, if escalated upstream, the recommendation for the owning step). 1-3
sentences. Name which candidate and the deciding tradeoff.>

## Reversible Interim
<What ships NOW behind a reversible seam so the slice stays runnable without committing the one-way
choice. 1-2 sentences. This is what the ARCH-DEBT marker sits on.>
```

- **Reversibility classification** is the field that drives routing: `unknown` is treated as
  `one-way`; money / migrations / auth / external-effects are `one-way` by rule (per
  `obstruction-loop.md` and the surfaces registry — never re-derive that classification here).
- **Status** starts `proposed` (written at escalation time, interim shipped). It becomes `ratified`
  only when the decision is accepted and the real fix is scheduled/landed — flipped by whoever
  resolves it, not auto. A `proposed` ADR with a live marker is the normal steady state of open debt.
- **Modality:** "the architecture that fights the change" and "reversible seam" mean whatever the
  slice's surface pack defines — a migration seam, a flag/binary boundary, an idempotent-replay
  boundary, a `plan`/dry-run gate, a CLI contract. Read the meaning from `surfaces/_registry.md`, not
  from a web/backend assumption.

## Gate: `arch-debt-recorded` (S4 asserts on every Tier-3 obstruction)

PASS iff ALL hold — checkable, no interpretation:

- **`adr-committed`** — a file exists at `strike/initiatives/<id>/adr/NNN-slug.md`, is in the commit
  (not just the working tree), has every required heading, and is ≤1 page.
- **`marker-at-site`** — `grep -rn 'ARCH-DEBT('` finds at least one marker, at the interim's actual
  code site(s), carrying the incurring `<slice-id>`.
- **`link-resolves`** — the marker's `-> <path>` resolves to the committed ADR; the ADR's
  **Slice** matches the marker's `<slice-id>`. (Two-way pointer is intact.)
- **`interim-runnable`** — the ADR's Reversible Interim is what actually shipped, and the app is left
  runnable on it (verified by the slice's normal S5 ladder, not by this gate).

FAIL on any miss → the Tier-3 escalation is **not** complete; the build cannot report the obstruction
absorbed. Chat-only or PR-body-only recording is an automatic FAIL of `adr-committed` +
`marker-at-site` — those channels are not checkable by the next slice's grep, which is the whole
point.

## Composition

- **obstruction-loop** (`obstruction-loop.md`) — owns *when* a Tier-3 ADR+marker is required (the
  decision tree, the reversibility rules, the `routeBack` for upstream-wrong decisions). This module
  owns only the *format*. Don't restate the tree here.
- **read-before-write** (`read-before-write.md`) — the downstream consumer: greps `ARCH-DEBT` over
  the incoming slice's footprint and opens any linked ADR before planning/editing. The grammar above
  is what makes that grep reliable.
- **two-hats** (`two-hats.md`) — landing the reversible interim is a normal behavior-hat commit; the
  ADR + marker are part of that commit (or a paired refactor-hat commit if the seam is a pure
  structural prep). Don't smuggle the one-way change in under the marker.
- **surfaces registry** (`surfaces/_registry.md`) — defines "fights the change," "reversible seam,"
  and the by-rule one-way surfaces per modality. This module references those meanings, never
  hard-codes them.

Every recorded obstruction (tier, reversibility, ADR path, marker sites) is surfaced in the slice's
structured result and aggregated into the run report by the engine.
