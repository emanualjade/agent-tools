# Discipline: Two Hats

**One hat per commit: a commit either refactors XOR changes behavior — never both.**

Wear exactly one hat at a time. Mixing the two is the failure this discipline kills.

- **Refactor hat** — changes *structure*, **zero behavior**. Move, rename, extract, inline, dedupe,
  re-layer. Observable input→output is identical.
- **Behavior hat** — changes *observable behavior*, **zero structure**. Add/change what the code
  *does*. No moves, no renames, no reshuffling.

## Why (load-bearing, not ceremony)

A mixed commit hides regressions inside the noise: a renamed-file diff buries the one changed
condition, so a real behavior change rides in unreviewed. It also makes review impossible — the
reviewer can't tell "this is just moved" from "this is moved *and* now does something different," so
they either rubber-stamp or re-derive the whole diff. Splitting the hats makes each commit's intent
provable from the diff alone, which is what every gate below checks.

## Diff-checkable invariants (what S4 and S5 assert)

A commit's hat is read off its diff + test result — no interpretation, no taking the agent's word.

**Refactor-hat commit — PASS iff ALL hold:**
- **`assertions-unchanged`** — no test assertion is added, removed, or edited (test files may move or
  rename; their assertion *content* is byte-identical).
- **`green-both-sides`** — the slice's existing tests are green on the commit's parent AND on the
  commit. Same suite, same results.
- **structure-only** — every hunk is a move / rename / extract / inline / reformat. No new branch,
  literal, or call that alters output.

**Behavior-hat commit — PASS iff ALL hold:**
- **`no-moves-renames`** — no file (or top-level symbol) is moved or renamed; the diff touches
  behavior in place. (`git diff --find-renames` reports no renames; no add+delete pair that is a
  move.)
- **assertions-track-behavior** — assertion changes, if any, correspond 1:1 to the behavior delta
  named in the plan (new behavior → new/changed assertion; nothing else moves).

If a single diff would need both a structure change and a behavior change to make sense, it is two
commits, not one — stop and split before committing.

## Composition

- **Obstruction-loop Tier 1** (`obstruction-loop.md`): a Tier-1 in-footprint, behavior-preserving
  preparatory refactor IS a **refactor-hat commit** — it must pass `assertions-unchanged` +
  `green-both-sides` before the behavior-hat commit that resumes the slice. The two-hats split is
  exactly what makes a Tier-1 refactor safe to land before the behavior change. (Reaching past the
  footprint is no longer Tier 1; see that module.)
- **S4 Build** (`steps/s4-build.md`): emits one hat per commit; FAILs if a commit's diff violates the
  invariant for its declared hat.
- **fix** (`steps/fix.md`): a structural cleanup and a behavior fix are separate commits; never
  bundle them.

These invariants are modality-agnostic — "behavior" means observable output through the slice's real
entry point per the surfaces registry (`surfaces/_registry.md`), not test color alone.
