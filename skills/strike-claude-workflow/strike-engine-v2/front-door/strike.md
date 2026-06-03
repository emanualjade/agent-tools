---
description: Take a vague idea, brainstorm + grill it, then run the autonomous strike-v2 build — one smooth flow.
argument-hint: "[a vague feature idea]"
---

The user wants to build a feature with **strike-v2**, starting from this idea:

$ARGUMENTS

Run the interactive front door and then the autonomous build as ONE flow. The build cannot ask the user
anything once it starts, so do all the thinking WITH the user first.

1. **Refine** — run the `refine-idea` skill: brainstorm the idea into a clear *first useful outcome*,
   separate facts from assumptions, flag detected surfaces, and confirm the framing. Ask only the few
   clarifying questions that matter; wait for answers.

2. **Grill** — run the `grill-idea` skill: pressure-test the consequential decisions one at a time —
   *especially the one-way-door surfaces* (money, auth, data, migrations, external, PII, destructive) the
   autonomous build would otherwise assume. Lock the domain-model shape (core noun before qualifiers),
   scope, and binary success checks. Produce the decision log and the **build launch args**, and confirm
   them with the user.

3. **Build** — call the **Workflow** tool with `scriptPath` = `.claude/workflows/strike-v2.mjs` in this
   project and `args` = the launch args from step 2. Set `args.initiativeId` to the SAME `<id>` the
   refine/grill step used for `strike/initiatives/<id>/` (`refined-idea.md` + `idea-decisions.md`) — do NOT
   let it default to `"initiative"`. The front door and the build MUST run under one `<id>` so the build
   reads the decision log by id; running them under different ids orphans the front door. Then watch with
   `/workflows` and report back when it finishes: what it built, plus every assumption / blocker /
   obstruction / ADR it logged.

Keep steps 1–2 lean and conversational. Do not write the spec yourself — that is the build's first step.
If the user says "just go" / "skip the grill," you may shorten grill to lean depth ONLY when refine
detected NO one-way-door surface (Detected Surfaces = none) AND no required capability/config is
un-provisioned. If ANY one-way-door surface (money | auth | data | migrations | external | PII |
destructive) was detected, you MUST still lock its Surface Ruling AND confirm its required
capabilities/config + the designated environment before launch — that question is non-skippable. Tell the
user the build cannot ask later and a one-way-door surface left vague becomes an irreversible wrong
assumption (and those assumptions will show up in the final report).
