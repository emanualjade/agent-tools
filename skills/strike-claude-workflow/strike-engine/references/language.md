# Strike Language Contract

Strike uses one durable project glossary at the consuming repo root:

```txt
PROJECT_LANGUAGE.md
```

The file names shared domain language for code, UI, docs, planning, and
modeling. It is a glossary, not a spec, ADR, implementation guide, or planning
scratchpad.

If the file exists, read it before naming, modeling, or planning around domain
terms. If it is missing, create it only when durable language, an accepted
alias, or a meaningful ambiguity has crystallized.

## File Shape

Keep the glossary lean. Group terms by context headings and include only fields
that clarify future work.

```md
# Project Language

This file names durable project language. It is a glossary, not a spec,
implementation guide, ADR, or planning scratchpad.

## [Context]

### [Term]
Meaning: [one plain sentence]
Use in: [code, UI, docs, planning]
User-facing: [optional]
Code-facing: [optional]
Avoid: [optional stale aliases]
Notes: [optional nuance]
```

Use `Kind:` only when model classification clarifies the term. Optional bottom
sections are `Relationships`, `Domain Events`, `Example Dialogue`, and
`Flagged Ambiguities`.

## During The Session

- Challenge conflicts with `PROJECT_LANGUAGE.md` immediately and ask which
  meaning is intended.
- Sharpen vague or overloaded terms before planning, modeling, or naming around
  them.
- Stress-test domain relationships with concrete scenarios when boundaries,
  states, ownership, permissions, billing, or destructive behavior matter.
- Cross-reference code when the existing implementation may contradict stated
  language.
- Keep candidate terms in planning artifacts until stable; promote only durable
  language to `PROJECT_LANGUAGE.md`.

## Promotion Rules

Promote language when it is stable enough to guide code, UI, docs, planning, or
domain modeling. Ask before renaming or removing existing glossary terms, and
ask before changing language that affects schema/model shape, lifecycle states,
ownership, permissions, billing, privacy, destructive behavior, or user-facing
promises.

Do not add casual phrases, implementation details, transient project-local
wording, or speculative terms the user has not accepted.
