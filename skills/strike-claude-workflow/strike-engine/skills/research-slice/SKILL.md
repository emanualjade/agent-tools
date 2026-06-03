---
name: research-slice
description: Check the facts needed for one implementation slice before planning so the plan does not invent APIs, domain rules, or risky behavior.
argument-hint: "[slice/context]"
disable-model-invocation: true
allowed-tools: Read Write Edit Bash Grep Glob WebFetch WebSearch
---

# Research Slice

Check the facts needed before planning one slice.

This is not the plan. It is the quick evidence pass that keeps the plan from
making things up.

## Inputs

- slice or slice context
- relevant spec or phase context

## What Matters

- If we're using a third-party package, API, framework, etc. we should always check the
  current official docs for the canonical, idiomatic, recommended way of doing things.
  We should never just make it up. Let's verify and make sure we know how to do things the
  right way.
- For external or unstable technology, use source-backed evidence: official
  docs, vendor docs, standards, source repos, or pinned-version references.
  Label weak evidence as weak.
- For anything involving money, accounting, taxes, refunds, payouts, subscriptions, credits,
  invoices, ledgers, or reconciliation, assume the problem has established
  patterns. Look for the canonical or industry approach before planning. Ask
  what a mature commerce system would need to protect against. Ask what Stripe does.
  Ask what Amazon does. Ask what accounting and finance standards already say about this
  particular thing. For example refunds and how to handle it is already solved in the world
  of accounting, and we can reference what Stripe does, etc.
- Use light repo reading if it helps identify the stack, existing
  integration, domain terms, or whether the repo already has a clear pattern.
  Deeper local implementation planning belongs in `plan-slice`.
- In rare cases where research is not needed, say why in a sentence or two.
- Record the needed decision when evidence reveals a consequential product,
  security, data, permission, or architecture decision.

## Output

Write the slice research to the current slice's `research.md`:

```text
strike/initiatives/<initiative-id>/phases/<phase-id>/slices/<slice-id>/research.md
```

Use this shape:

```md
# Slice Research

## Decision
Needed: yes / no
Why:

## Findings
- Source:
  Finding:
  Planning implication:
- None. Use this when `Needed: no`.

## Slice Size Check
Too broad: yes / no
Reason:
Suggested split:
- None.

## Domain Notes
- None.

## Questions Or Blockers
- None.

## Ready For Planning
Ready for planning: yes / no
Reason:
```

## Rules

Keep `research.md` as short as possible while still preventing the plan from
guessing. Save only necessary research in a concise format. Less verbose is
better.

- Do not write the slice plan. This is just a research phase.
- Keep it short: source, finding, why it matters.
- Record implications, not a diary: what changed, why it matters, and where the
  evidence came from.
- Do not paste raw notes, long excerpts, search trails, or link dumps. Summarize
  before writing the artifact.
- Prefer official or primary sources for external, current, or high-stakes
  facts.
- If research shows the slice is too broad, too risky, or hiding multiple
  independent behaviors, write `Too broad: yes`, suggest smaller replacement
  slices, and write `Ready for planning: no`. Strike should edit the
  current slice into the first smaller slice and add any extra slices before
  rerunning research.
- In `## Ready For Planning`, write `Ready for planning: yes` only when the
  findings are enough for planning to continue without guessing.
- Write `Ready for planning: no` when there is an unresolved decision, missing
  official-doc answer, unsafe dependency, or anything else the plan would have
  to guess about. Put the issue in `Reason` and `## Questions Or Blockers`.
