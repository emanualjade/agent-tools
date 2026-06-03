# Discipline: Canonical Research

**Use the proven way — but only when the problem is a solved one you might get subtly wrong.**

Composed inline by **S2 (plan)**; its evidence is rechecked by **S3 (verify-plan)** and **S5 (verify-build)** as the canonical lens. This module is modality-agnostic: it decides *whether* to research and *what* counts as proof. Triggers come from the **surfaces registry** (`surfaces/_registry.md`) — never from a hard-coded web/backend list.

The failure this defeats: an LLM confidently re-deriving a domain that the world already solved (float money, naive timezone math, hand-rolled crypto, a misused SDK call), or pulling in a hallucinated/typosquatted package. Research is the cheap insurance; running it on a CSS tweak is the ceremony we refuse.

---

## 1. Trigger gate — research IFF a trigger surface fires

Run the detection pass that S2 already runs (surfaces registry). Research is triggered when **any** of these is true for the slice:

- **A fired surface flagged by any pack** in `surfaces/_registry.md` whose guardrail names a *canonical* concern — money/accounting/refunds, auth/session/crypto, dates/timezones, payments, idempotency/external-effects, migrations/schema-evolution, PII. (The pack owns the trigger; you read it, you don't re-list it.)
- **A third-party API / SDK / protocol** is called, configured, or upgraded — anyone else's contract you must obey exactly.
- **A newly-added dependency** appears in the manifest (new entry in `package.json`/`requirements.txt`/`go.mod`/`Cargo.toml`/`Gemfile`/`pubspec.yaml`/lockfile). New dep ⇒ the package-existence check (§4) always runs, regardless of domain.
- **Anything the repo does not already pattern** — read-before-write (`disciplines/read-before-write.md`) found no existing, working precedent in this codebase for the thing you are about to build. (If the repo already does it correctly, copy that pattern; that *is* the canonical answer here — record it as the source and stop.)

**Mandatory, not optional.** When the slice's `riskTier` is **CRITICAL** or any **domain surface** fired (per `disciplines/risk-tiering.md`), research is **MANDATORY** — not "consider." S2 cannot reach `readyToBuild`/`readyToVerify` without it, and S3/S5 will FAIL the canonical lens if it is absent.

### Not triggered
If no surface above fires, emit exactly **one line** and move on:

> **No research needed** — <one clause: why this is a pattern the repo already owns or a non-domain change>, e.g. "internal CSS-only change, no external contract or domain surface."

Do not pad it. The one-line skip is a first-class outcome, not a confession.

---

## 2. What to research when triggered

**First, check the front-door research.** Before researching anything afresh, scan
`atlas/initiatives/<initiativeId>/resources/` — its `index.md` digest and the descriptively-named reports.
The refine→research→grill front door may have already researched this exact topic and **audited it against
primary sources**. If a relevant report exists, **use it and cite it** (`resources/<id>.md`, carrying its underlying primary
source + version) as the SOURCE — only research afresh what is genuinely missing, stale for the pinned
version (§3), or absent from the folder.
This is audited grounding; do not redo it from scratch.

Answer the three questions that map to the three failure modes. Skip a row only if its surface did not fire.

1. **"What does the standard / the incumbent already do?"** — For a money/dates/auth/protocol problem, find the established correct approach (what Stripe does for money + refunds, what RFC/ISO/OAuth/the platform mandates for the boundary). Goal: a *vetted library or standard pattern*, never a hand-roll. This is the canonical guardrail in the relevant pack made concrete.
2. **Official docs at the repo's ACTUAL pinned version (§3).** The contract you must obey is the one your pinned version exposes — not the latest blog post, not the model's prior.
3. **Package existence + genuineness for every newly-added dependency (§4).** Defeat slopsquatting before the dep enters the plan.

---

## 3. Pin discipline — research the version the repo actually runs

Generic recall is stale and version-blind. Before citing any API:

- Read the **actual pinned version** from the repo's manifest/lockfile for that dependency or runtime (not memory, not "current"). Cite it.
- Match the doc you read to that version. If the pinned version and the documented behavior diverge (deprecated arg, changed default, removed method), the **pinned version wins** and that divergence is a finding.
- If the dep is being *added* or *upgraded* in this slice, the target version is what you pin and verify — and §4 applies.

A finding tied to the wrong version is worse than no finding: it reads as confirmed and is silently false (the confidently-wrong class). Always name the version in the evidence line.

---

## 4. Package-existence check — anti-slopsquatting (every newly-added dependency)

LLMs invent plausible package names and attackers register them (slopsquatting). For **each** dependency this slice adds, confirm it is the **genuine, popular** package before it lands in the plan:

1. **Exists on the official registry** (npm / PyPI / crates.io / Go modules / RubyGems / pub.dev — the one for this modality) at a real, published version.
2. **Is the package you intend** — exact name (watch hyphen/underscore/scope swaps and look-alike chars), the expected repo/homepage, and a maintainer/publisher that matches the well-known project.
3. **Popularity / liveness signal** — non-trivial download count and recent maintenance; a zero/near-zero-download, brand-new, or unmaintained package masquerading as a staple is a **STOP**.

**Verdict (named, checkable):**
- `package:verified` — exists + correct name + popular/maintained ⇒ may enter the plan.
- `package:suspect` — name/owner/popularity mismatch, or cannot be confirmed ⇒ **STOP**: do not add it. Prefer an already-vetted alternative, the standard-library way, or an existing repo dependency; if none exists, raise it as a blocker/assumption in S2's output. A suspect package is never silently dropped into the manifest.

Record one evidence line per added dependency (§5). No new deps in the slice ⇒ this section is a single "no new dependencies" line.

---

## 5. Evidence format — compact, decision-bearing

Every research output is a list of lines in this exact shape:

```
SOURCE → FINDING → PLANNING IMPLICATION
```

- **SOURCE** — the specific doc/version/registry, named tightly: `Stripe API 2023-10-16 §refunds`, `PyPI: requests 2.31.0`, `IANA tz / luxon 3.x`, `repo: src/money/Amount.ts (existing pattern)`.
- **FINDING** — the one fact that changes the plan: "refunds are idempotent via `idempotency_key`"; "JPY is zero-decimal — do not ×100"; "package has 40M weekly downloads, official org".
- **PLANNING IMPLICATION** — the concrete consequence for *this* slice: "store amounts as integer minor units + currency; pass an idempotency key on the refund call"; "use `luxon`, never `Date` arithmetic, for the due-date rollover."

**Banned:** raw API dumps, link lists, pasted doc paragraphs, "I searched and found many results." If a line has no planning implication, it is noise — delete it. Three sharp lines beat a page.

This is the input S2 folds into the plan and S3/S5 audit against the fired surfaces. Every fired canonical surface must have at least one evidence line resolving it (or a justified, named skip).

---

## 6. Output contract (what S2 carries forward)

Return, for the slice's plan:

- `researchTriggered: boolean` — did any §1 trigger fire.
- If **false**: the single `noResearchReason` line (§1).
- If **true**: the evidence lines (§5), one per fired surface + one per added dependency, each ending in a planning implication; plus each added dep's `package:verified | package:suspect` verdict (§4).
- Any `package:suspect`, or a fired CRITICAL/domain surface left unresolved, surfaces in S2 as a **blocker or recorded assumption** — it must not be buried.

**Gate (`research:complete`)** — PASS iff: every §1 trigger that fired has ≥1 evidence line with a planning implication tied to the repo's pinned version (§3); every newly-added dependency is `package:verified`; and for a CRITICAL/domain slice the canonical question (§2.1) is answered by a vetted library/standard, not a hand-roll. Otherwise **FAIL**, naming the unresolved surface or the `package:suspect` dependency. (When no trigger fired, the gate PASSes on the single `noResearchReason` line.)
