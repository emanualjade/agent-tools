# agent-skills

A collection of [Claude Code](https://claude.com/claude-code) agent skills. Each skill lives
under `.claude/skills/<name>/` with a `SKILL.md` (plus reference files where useful) — drop the
`.claude/skills/` folder into a project, or copy individual skills into your own `~/.claude/skills/`.

## Skills

| Skill | What it's for |
|---|---|
| **nano-banana** | Building with Google's "Nano Banana" image models on the Gemini API or Vertex AI — Nano Banana 2 (`gemini-3.1-flash-image`) and Nano Banana Pro (`gemini-3-pro-image`): models, resolutions, aspect ratios, grounding, pricing, the `@google/genai` SDK. Includes `references/` for Vertex and the Gemini Developer API. |
| **gpt-image-2** | Building with OpenAI's image-generation API — the `gpt-image` models: generating/editing images, sizes, quality, pricing, and wiring it into an app. |
| **stripe-connect** | Working with Stripe Connect platforms & marketplaces — onboarding connected accounts, routing/splitting payments, application fees, payouts, webhooks (v2 thin events), sandbox/CLI testing, and debugging Connect integrations. Includes `references/` (accounts & onboarding, money movement, webhooks, setup & testing, decision guide, doc map). |
| **shape-idea** | Take a fuzzy, early-stage software idea and shape it, through a light back-and-forth, into a crisp one-page spec. |
| **idea-refiner** | A lighter conversational helper for teasing out what a fuzzy product/feature idea really means and its key tradeoffs. |
| **understand-this** | A tutor that makes you genuinely understand the work just done in a session — a feature, fix, PR, or refactor — with incremental teaching and quizzing. |
| **atlas-workflow** | A Claude dev workflow that turns a vague idea into shipped code: refine + grill the idea with you, then run the autonomous **atlas** build (spec → phases → plan → implement → verify). Includes an `atlas-engine/` with disciplines, steps, and the build workflow. |

The reference-style skills (`nano-banana`, `gpt-image-2`) are built docs-as-source-of-truth:
every concrete claim (model IDs, fields, limits, pricing) is verified against the official
provider docs and the actually-shipped SDK rather than guessed.
