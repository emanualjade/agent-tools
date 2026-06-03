# Atlas Front Door — Redesign Plan (draft for review)

A plain-English plan for making Atlas's front door deeper and research-grounded.
Nothing here is built yet — this is the thing to poke holes in.

Reference system: **Strike** (`~/Sites/strike`, read-only). Strike already added a mandatory
pre-grill research step (changelog v0.10.9); this is largely catching Atlas up to that.

---

## The problem we're fixing

Atlas's "front door" — the conversation that happens with you before the autonomous build —
is too shallow in two places:

1. **Refine** (shape the idea) asks 2–4 questions once and bolts. It glosses.
2. **Grill** (pressure-test the decisions) interrogates you about things it has never researched —
   e.g. which image-model API to use — so it asks confident but *wrong* questions and quietly
   makes things up. You can't have a smart conversation about something nobody looked into.

The root fix: **put a research step between refine and grill**, so by the time it grills you,
it actually understands the thing.

---

## The new shape

```
refine  →  research  →  grill  →  (build)
```

These front-door steps are **not optional** — they always run, in order, one flowing into the
next. You control the *speed* (you can blast through), not *whether* they happen.

- **Refine** — same as today but ends on a recorded checkpoint ("ready to move on? — your answer"),
  and emits a short list of **research candidates** (the things worth looking into).
- **Research** (new, the headline) — goes and actually learns those things. Details below.
- **Grill** — reads the research first, then walks the real decisions one question at a time,
  and keeps going until each decision is genuinely settled (not "standard depth, good enough").
- **Build** — unchanged; the autonomous engine takes it from here.

---

## The research phase (the new part)

This is the heart of the whole thing, so it's built to be **deep and serious** — not a quick
lookup. Borrow the good bones from Strike's research approach, then push the auditing further than
Strike does.

**0. It opens by talking to you about *what* to research — not *how deep*.** The skill proposes the
topic list and asks if you want to add / drop / refocus. You get a say in **which things** get
researched; you never set a "depth" — depth isn't a dial, the skill always does quality research.
Lean in ("research these three, skip that") or just say "looks right, go."

**1. Break the idea into concepts — one per real thing to learn.** Two kinds of topics:
- **Third-party things** — a specific model, API, SDK, or dependency → read its real docs + source.
- **Solved problems the model shouldn't wing** — money, accounting, carts, commerce, refunds,
  coupons. These aren't packages, but they're *solved*, and guessing them is where bugs come from.
  So the research deliberately asks **"how does Stripe do this? how does Shopify? how does Amazon?"**
  and, for accounting, **"what do the professional accounting principles actually say?"** A topic can
  be exactly that narrow — e.g. one helper on *"professional accounting principles around refunds."*
  (Atlas already carries this instinct in its build-side rules — "ask what Stripe does, what Amazon
  does" — we're pulling it to the front and giving it real legs.)

**2. One helper agent per concept, run together.** Each starts from **official docs / primary sources
and the actual source code** (never a stale blog), pulls out the **rules and invariants** that
matter, marks anything uncertain as **unknown** instead of guessing, and writes **one short, tight
summary.**

**3. Audit hard — several passes, not one.** Hallucinations are the real enemy, so a single sanity
check isn't enough. Plan on **3–4 thorough audit passes**, each a *different* angle rather than the
same check repeated:
- every claim traces to a real primary source,
- re-open those sources — do they *actually say that*? (catches made-up citations),
- check it against the **actually-installed version** of the code/SDK,
- what critical thing is **missing**?

The lead re-verifies the auditors and owns the call. Crucially, **audits make files shorter and
truer:** a claim that can't be backed gets **cut or marked unknown**, never left in to pad it. We
only call it done when every claim is verified against source + official docs.

**4. Roll up + confirm with you** — a short "here's what I found and what it changes."

**The goal is accurate, not lengthy.** A tight, true page beats a long, half-hallucinated one. Lean
is a hard rule: no raw dumps, link lists, or pasted doc paragraphs — three sharp lines beat a page.

This is mechanically the same as the grounding run already done in this session (parallel
researchers → review passes → synthesis), so it's proven, not theoretical.

---

## The knowledge it leaves behind (a scannable folder)

Two kinds of things pile up in one per-initiative folder, as small files — both first-class:

- **What it went and learned** — the **research files**, one per concept, from the research phase.
- **What it worked out itself** — short **design/schema docs**, created **on request or on the
  agent's suggestion** (never auto-generated): a **pseudo-schema / data-model sketch**, an
  **architecture or design note**, a **state-machine or flow sketch**, an **API-shape sketch** —
  whatever captures real thinking that would otherwise evaporate into the chat. Either you ask
  ("capture that as a schema") or the agent offers ("want me to write this down so the build has
  it?"). Mostly from the grill, but any later step can add one.
- **A language file** — the shared glossary so every later step uses the same word for the same
  thing instead of re-explaining it.

The design/schema docs are a *first-class* resource, not an afterthought — later steps (grill, spec,
build) lean on them the same way they lean on the research.

**File names do the work.** A later agent scans the *names* first and only opens what looks
relevant — so names must be rich and written **for the reader**: `gemini-image-api-limits.md`,
`auth-session-model.md` — not `notes.md` or `research-2.md`. All the file-creators share one
simple naming habit (topic-first, specific) so the folder stays scannable.

**Hand over the menu.** Rather than hoping a later agent wanders into the folder, the system
*hands it the list*: "here are the resource files that exist — open any that look relevant."
Because the names are rich, the list alone is enough to decide — we pass names, not contents,
so the agent's context stays clean and it only opens what it needs.

**The one guardrail (so it stays a toolbox, not a junk drawer):** these docs are made **deliberately —
on your request or the agent's offer — never spun up automatically.** That's what actually keeps the
folder honest: a file exists only because someone asked or okayed it. They're also **not the source of
truth** — anything load-bearing gets mirrored back into the decision log / spec, so the sketch
*supports* the decision rather than hiding it. (A pseudo-schema is great when it's real; junk when it's
filler.) Once a doc exists, **every downstream agent — front door and build alike — can see and open
it** through the same scannable menu.

---

## Three levels of firmness (how we keep it honest)

Not everything should be enforced the same way. Three settings, used in different spots — and
**none of them is a dead-end.** They're escalating levels of "don't let it skip or guess," not stops:

1. **Soft nudge** — "by the way, there might be something for you over here." Informational.
2. **Must-look loop** — "you must actually go look (at the folder / the docs) and come back with
   a real answer." It **can't move on by skipping.** But the *answer* can be
   *"looked, nothing here is relevant, because X"* — and that's a perfectly good pass. The gate
   is on **the act of looking, not on finding something** (forcing it to "find" relevance would
   just make it invent relevance — the original bug in a new spot). If it tries to skip, the loop
   hands it back: "did you look? — no? go look." No dead-end; it always ends up moving, just only
   *after* it has actually looked.
3. **Never silently guess the irreversible stuff** — for the genuinely can't-undo things (real money,
   auth/security, private data, anything destructive), the agent is **not allowed to quietly pick a
   default.** It has to get a *real answer.* That plays out differently depending on who's around:
   - **In the front door** (you're right there) → it just **asks you.** That's the grill doing its
     job — a question, not a halt.
   - **In the autonomous build** (you're gone) → it does the **reversible version and flags it
     loudly** for you to confirm later (a short ADR), and keeps moving. It does *not* stop.
   - **Last-ditch safety net only:** if it hits a can't-undo decision with *no* safe reversible path
     available at all, it surfaces it instead of guessing wrong. This is rare by design — the whole
     point of locking these in the grill up front is so the build almost never gets here.

Guiding principle: **never fail for quality's sake — loop until done.** The only thing the
"irreversible" category changes is that the agent must get a *real answer* instead of guessing —
from you up front, or as a reversible-and-flagged move in the build. It still keeps moving.

---

## How the build uses all this

When the autonomous build is working and a builder is about to touch something real (say, that
model's API), the engine taps it: *"you're building with this — go research the specifics of what
you're doing,"* and hands it the menu: *"and we already did research up front; here's the list,
check it first."* So every builder has two go-to sources: **the official docs** (fresh, granular)
and **our own audited research folder**. The "must-look" loop applies here too.

---

## Feasibility — checked

- The conversational front door **already calls the Workflow tool** to launch the build
  (`grill-idea/SKILL.md:135`). So running the research phase as a Workflow is the same proven move.
- A Workflow can't pause for input, so the **checkpoints** (approve scope, confirm findings) are
  handled by the conversational agent *around* the research run — the same seam Atlas already uses
  between the interactive front door and the hands-off build.

---

## Settled vs. still open

**Settled (your calls):**
- Front-door steps always run in order; you control speed.
- Research opens with a **scope conversation** — you pick *what* topics get researched (opt-in);
  the skill owns *depth* and always does quality research.
- Research covers **solved problems**, not just packages: for money/accounting/commerce/refunds/
  coupons, research how the giants (Stripe / Shopify / Amazon) and professional accounting principles
  handle it. Reuses Atlas's existing "ask what Stripe/Amazon does" canonical-research DNA.
- One agent per concept, official-docs/source-first, lean files, rich reader-facing names,
  hand-over-the-menu.
- **Audit is deep: 3–4 thorough passes, each a different lens** (claim→source, re-read-the-source,
  check-installed-version, what's-missing); audits **shrink** files (cut/flag unbacked claims).
  Goal is **accurate, not lengthy.**
- Three firmness levels, none a dead-end: nudge / must-look loop / never-silently-guess-the-irreversible
  (front door asks you; build does the reversible-and-flagged thing). Never fail for quality; keep a
  rare last-ditch safety net only when there's no safe reversible path at all.

**Still open (small):**
- The ceiling *past* the 3–4 audit floor — how many extra rounds before an unresolved claim just
  becomes a logged "unknown / open question" instead of looping forever.
- Whether to also surface the research as a visible field in the build launch args, or rely purely
  on the folder being there by name.
- Whether to reuse Atlas's existing `adjective-noun` discipline as the glossary's naming lens
  (lean) vs. port Strike's dedicated language tooling (more machinery).

---

## Rough build order

- **A — easy, reversible wins:** add the resources folder; make the language file exist at
  front-door time; add refine's research-candidates list + recorded checkpoint.
- **B — the research phase:** the new step (scope → fan-out → audit → loop → roll-up), wired in
  between refine and grill, with the lean templates and naming rule.
- **C — grill upgrade:** read research first; keep-going-until-settled; the must-look loop.
- **D — build consumption:** hand builders the menu; folder as a research source; for irreversible
  surfaces, reversible-and-flag instead of guess (last-ditch safety net only when no safe path exists).

Each phase is useful on its own and the old refine→grill→build keeps working throughout.
