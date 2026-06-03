export const meta = {
  name: 'review-fast-merge',
  description: 'Adversarial review of the FAST-lane plan+build merge in strike-v2.mjs runSlice: control-flow/termination correctness, verification-preserved (S5 always runs; promoted slices still get S3), and edge/schema soundness.',
  phases: [
    { title: 'Review', detail: '3 lenses over the patched runSlice + the new merged step' },
    { title: 'Synthesize', detail: 'verify findings → ready-for-rerun verdict' },
  ],
}

const ENGINE = '/Users/cracklehat/Sites/workflow-exploration/.claude/workflows/strike-v2.mjs'
const STEP = '/Users/cracklehat/Sites/workflow-exploration/strike-engine-v2/steps/s2s4-fast-plan-build.md'
const DESIGN = '/Users/cracklehat/Sites/workflow-exploration/strike-engine-v2/DESIGN.md'

const CTX = 'THE CHANGE under review: the engine merged the FAST lane\'s S2 (plan) and S4 (build) into ONE agent call via a new `S2S4` step, to save a round-trip. In runSlice: `fast = lane===FAST`; the first runStep is `S2S4` (FAST) or `S2` (FULL); a merged FAST step either BUILDS inline (built:true) or, if it detects CRITICAL, STOPS at the plan (built:false, riskTier:CRITICAL) so the slice promotes to FULL. Then: `if (plan.riskTier===CRITICAL||plan.lane===FULL) lane=FULL`; S3 runs `if (lane===FULL && !plan.built)`; S4 is skipped when `plan.built` (build=plan) else runs as before; S5 runs unchanged for both. The new step file is ' + STEP + '. RUNTIME FACTS: engine routes on verdict + routeBack + per-step fields; sandbox (no fs/Date/Math; top-level return/await intended). The user\'s HARD requirement: the merge must NOT weaken verification — every built slice must still be independently verified by S5, and a CRITICAL slice must still get S3 plan-verify BEFORE any build.'

const FINDINGS = { type: 'object', required: ['lens', 'findings'], properties: {
  lens: { type: 'string' },
  findings: { type: 'array', items: { type: 'object', required: ['id', 'severity', 'issue'], properties: {
    id: { type: 'string' }, severity: { type: 'string', description: 'P0|P1|P2|P3' }, where: { type: 'string' }, issue: { type: 'string' }, proposedFix: { type: 'string' } } } } } }
const VERDICT = { type: 'object', required: ['id', 'confirmed', 'reasoning'], properties: {
  id: { type: 'string' }, confirmed: { type: 'boolean' }, severity: { type: 'string' }, reasoning: { type: 'string' }, refinedFix: { type: 'string' } } }
const SYNTH = { type: 'object', required: ['readyForRerun', 'overall'], properties: {
  readyForRerun: { type: 'boolean' }, overall: { type: 'string' },
  fixes: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string' }, file: { type: 'string' }, issue: { type: 'string' }, fix: { type: 'string' } } } } } }

const base = 'Adversarially review the FAST-lane plan+build MERGE in the Strike v2 engine. Read ' + ENGINE + ' (focus on runSlice), the new step ' + STEP + ', and ' + DESIGN + ' as needed.\n\n' + CTX + '\n\nYOUR LENS: '
const LENSES = [
  { key: 'control-flow-termination', brief: 'Trace every path through the patched runSlice and confirm correctness + termination. (a) FAST slice that BUILDS (built:true): does it skip S3 (lane stays FAST) and S4 (plan.built) and reach S5? (b) FAST slice that PROMOTES (built:false, riskTier:CRITICAL): does lane flip to FULL, S3 run (lane===FULL && !plan.built), S4 run (!plan.built reads the already-written plan, no re-plan), then S5? (c) FULL-born slice: unchanged S2→S3→S4→S5? (d) split / obstruction / reroute from the merged S2S4 result: handled by routeSplitOrObstruction exactly as a standalone S2/S4? (e) the reset-route path in S5 still works? (f) any infinite-loop / unbounded-recursion / budget hole introduced (the `reenter` budget, the promoted re-route)? (g) the `let build` + `if (plan.built) build=plan else {...}` — is `build` always defined before S5; any path that reaches S5 with build undefined? Name concrete defects.' },
  { key: 'verification-preserved', brief: 'THE user\'s hard requirement: confirm the merge did NOT weaken verification. (a) Does EVERY slice that gets BUILT still reach S5 (the independent verifier) — FAST-built AND FULL? Find any path where built code skips S5. (b) Does a CRITICAL slice still get S3 plan-verify BEFORE any build — i.e., can the merged FAST step ever BUILD a slice it should have promoted (built:true AND a domain surface), bypassing S3? Check the step-file contract + the engine guards (the !plan.built guards on S3/S4). (c) Is the FULL lane (where the heavy rigor lives) byte-for-byte behaviorally unchanged? (d) Does S5\'s scope/rigor change at all for a merged slice vs a separate-S4 slice? Be skeptical — this is the one thing that must not regress.' },
  { key: 'edge-and-schema', brief: 'Edge cases + schema. (a) SCHEMA_S2S4: does it declare every field the engine reads off the merged result (built, riskTier, lane, splitNeeded, replacementSlices, readyToVerify/readyToBuild, verdict, obstruction, routeBack, changedFiles)? Any field the engine reads but the schema omits (so the agent can never return it)? (b) Buggy-agent cases: merged step returns built:true AND riskTier:CRITICAL (should not happen per the prompt) — do the `!plan.built` guards degrade safely (S3/S4 skipped, S5 still catches)? merged step returns built:false but NOT CRITICAL (just failed to build) — handled? built:false + splitNeeded? (c) Does the step file s2s4-fast-plan-build.md\'s output contract match SCHEMA_S2S4 and the engine\'s consumption? (d) absorb(\"S2S4\", plan) — does it correctly capture changedFiles/obstruction/blockers from a merged build? Name real defects only.' },
]

phase('Review')
const lensResults = (await parallel(LENSES.map((l) => () =>
  agent(base + l.key + ' — ' + l.brief + '\n\nReturn concrete findings (id, P0-P3, location, sandbox-valid fix). Empty if clean. Trace the ACTUAL code.',
    { label: 'lens:' + l.key, phase: 'Review', schema: FINDINGS })
))).filter(Boolean)
const all = []
for (const lr of lensResults) for (const f of (lr.findings || [])) all.push({ ...f, lens: lr.lens })
log('Collected ' + all.length + ' findings; verifying...')

phase('Synthesize')
const verdicts = (await parallel(all.map((f) => () =>
  agent('Confirm or REJECT this finding about the FAST-merge in Strike v2. Read ' + ENGINE + ' (runSlice) + ' + STEP + ' and verify against the actual code.\n\n' + CTX + '\n\nFINDING [' + f.id + '] (' + f.severity + ', lens=' + f.lens + ')\n' + (f.where || '') + ': ' + f.issue + '\nProposed: ' + (f.proposedFix || '(none)') + '\n\nDefault confirmed=false unless REAL and material. Refined sandbox-valid fix if confirmed.',
    { label: 'verify:' + f.id, phase: 'Synthesize', schema: VERDICT })
))).filter(Boolean)
const confirmed = verdicts.filter((v) => v && v.confirmed)
log(confirmed.length + ' of ' + verdicts.length + ' confirmed.')
const synthesis = await agent('Synthesize the FAST-merge review. readyForRerun = true iff NO confirmed P0/P1 (the merge is safe to dogfood). One-paragraph overall (especially: is verification provably preserved — every built slice still hits S5, every CRITICAL slice still gets S3 before build?). Ordered fixes list (severity/file/issue/fix).\n\nCONFIRMED (json):\n' + JSON.stringify(confirmed).slice(0, 50000),
  { label: 'synthesize', phase: 'Synthesize', schema: SYNTH })

return { rawFindings: all.length, confirmed: confirmed.length, verdicts, synthesis }
