---
name: research-idea
description: Ground the refined idea in real, audited research before grilling — one worker per topic, official-docs + source first, a multi-pass audit that loops until accurate. Step 2 of the atlas front door.
allowed-tools: Read Write Edit Grep Glob WebFetch WebSearch
---

# Research Idea — atlas front door (step 2 of 3)

Ground the refined idea in **real, audited research** so the grill can pressure-test decisions on
*facts*, not guesses. Without this, the grill interrogates you about things nobody looked into — and
invents wrong questions (e.g. picking between AI-model APIs it never read the docs for). The deep,
parallel research + audit runs **hands-off in a workflow**; your job here is the **scope-chat before**
and the **results checkpoint after**.

## Stance

- **You own depth; the user owns the topic list.** Always do quality research — never ask the user
  "how deep." The user decides *what* gets researched, and can lean in or wave it through.
- **Accurate, not lengthy.** The research files are a toolbox, not a dumping ground.
- **Do not decide, spec, or build.** Hand grounded facts to grill.

## Process

1. **Read refine's output** — `atlas/initiatives/<id>/refined-idea.md` (`## Research Candidates`,
   `## Detected Surfaces`, `## Open Questions`) and `PROJECT_LANGUAGE.md` (repo root).
2. **Build the research scope** — decompose the candidates into **atomic** topics. Each topic gets a
   **descriptive kebab `id` that becomes its filename** — make it reader-facing (`gemini-image-api-limits`,
   `accounting-principles-refunds`), never `topic-1`. One topic per real thing to learn:
   - **third-party things** — a specific model / API / SDK / new dependency;
   - **solved problems the build shouldn't wing** — money, accounting, commerce, refunds, coupons, auth,
     dates: research *how the established players solve it* (how Stripe / Shopify / Amazon do it) **and**
     the professional principles. These are solved — don't let the build invent them;
   - **codebase / blast-radius** topics when the work touches an existing repo (which areas it affects).
   For each: `id` / `topic` / `why` / `questions` (what to answer) / `sources` (expected primary sources) /
   `repoPaths` (for repo topics).
3. **Scope checkpoint (with the user):** present the topic list; let them **add / remove / refocus** — they
   decide *what*, not *how deep*. **Wait for a real answer.** Record it to
   `atlas/initiatives/<id>/resources/scope.md`. If nothing material needs research, write a single line
   `No research needed — <why>` to `resources/scope.md` and **skip straight to grill** (the lean fast path).
4. **Run the research** — call the **Workflow** tool with `scriptPath` = the absolute path to
   `.claude/workflows/atlas-research.mjs` in this project, and `args` of this exact shape:
   ```jsonc
   {
     "initiativeId": "<id>",   // MUST be the SAME <id> refine used for atlas/initiatives/<id>/. Do NOT let
                               //   it default to "initiative" — research would land where the grill can't
                               //   find it, and the grill would silently proceed ungrounded.
     "repoContext": "<stack + key paths, or 'greenfield'>",
     "topics": [
       { "id": "gemini-image-api-limits",        // descriptive kebab id — becomes the filename resources/<id>.md
         "topic": "Gemini image API: capabilities, limits, pricing",
         "why": "we must know aspect-ratio/size limits before the grill locks the editor UX",
         "questions": ["supported sizes/ratios?", "per-image cost?", "rate limits?"],  // string[]
         "sources": ["https://ai.google.dev/gemini-api/docs/image-generation"],         // string[]
         "repoPaths": ["src/image"] }                                                   // string[] (omit if external)
     ]
   }
   ```
   `questions`, `sources`, and `repoPaths` are **string arrays**; every topic needs a descriptive `id` + `topic`.
   It writes one lean, audited report per topic to `resources/<id>.md` and a `resources/index.md` digest.
   Watch with `/workflows`.
5. **Results checkpoint (with the user):** read `resources/index.md`; summarize **what was found and what
   it changes** — especially anything that shifts a decision, or surfaces a new risk/cost/limit. Confirm
   ready to grill. Carry every `## Open Questions` item forward as something the grill must still resolve.

## Output

- `atlas/initiatives/<id>/resources/scope.md` — the approved topic list (or the `No research needed` line).
- `atlas/initiatives/<id>/resources/<id>.md` — one lean, audited report per topic *(written by the workflow)*.
- `atlas/initiatives/<id>/resources/index.md` — the digest the grill reads first *(written by the workflow)*.

## Handoff

Hand to **`grill-idea`** (step 3) with `resources/index.md` as the grounding — grill reads it first and turns each
finding / unknown into a decision, accepted assumption, deferral, or blocker. Reconcile any durable nouns
into `PROJECT_LANGUAGE.md`. Do **not** write a spec or start building.
