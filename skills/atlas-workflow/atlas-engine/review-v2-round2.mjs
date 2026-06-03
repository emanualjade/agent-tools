export const meta = {
  name: 'review-atlas-round2',
  description: 'Round-2 adversarial re-review: verify each of the 9 round-1 fixes landed correctly and regression-free in the patched engine, fresh-sweep the edited regions for new defects, adversarially verify, and give a production-readiness verdict.',
  phases: [
    { title: 'Verify fixes', detail: 'one verifier per round-1 fix: present? correct? complete? regression-free?' },
    { title: 'Fresh sweep', detail: 'new lenses over the patched engine (recursion, corroboration, re-entry loop, schemas)' },
    { title: 'Synthesize', detail: 'verify new findings + final readiness verdict' },
  ],
}

const ENGINE = '/Users/cracklehat/Sites/workflow-exploration/.claude/workflows/atlas.mjs'
const ROOT = '/Users/cracklehat/Sites/workflow-exploration/atlas-engine'
const DESIGN = ROOT + '/DESIGN.md'
const ROUND1 = ROOT + '/research/2026-06-01-review-round1.json'
const N_FIXES = 9

const SCHEMA_RULE = 'RUNTIME FACT: each engine step runs a subagent with BOTH its steps/*.md instructions AND a StructuredOutput JSON schema in the engine; the schema is AUTHORITATIVE at runtime (the agent conforms to it), so prose field-name drift is not a bug. Only real defects count: engine schema missing/wrong for a field the engine routes on; engine routing/termination/budget logic errors; a semantic contradiction between a module behavior and the engine; or a genuine soundness/coverage gap. NOTE: the engine runs in a sandbox with NO filesystem/Node API access and no Date.now/Math.random — do NOT propose fixes that import fs or use those (all file work happens inside subagents).'

const FIXVERDICT = { type: 'object', required: ['index', 'status', 'reasoning'], properties: {
  index: { type: 'number' },
  fixSummary: { type: 'string' },
  status: { type: 'string', description: 'clean | incomplete | regressed' },
  reasoning: { type: 'string' },
  residualFix: { type: 'string', description: 'if incomplete/regressed: the precise remaining fix' },
} }
const FINDINGS = { type: 'object', required: ['lens', 'findings'], properties: {
  lens: { type: 'string' },
  findings: { type: 'array', items: { type: 'object', required: ['id', 'severity', 'where', 'issue'], properties: {
    id: { type: 'string' }, severity: { type: 'string' }, where: { type: 'string' }, issue: { type: 'string' }, proposedFix: { type: 'string' } } } },
} }
const VERDICT = { type: 'object', required: ['id', 'confirmed', 'reasoning'], properties: {
  id: { type: 'string' }, confirmed: { type: 'boolean' }, severity: { type: 'string' }, reasoning: { type: 'string' }, refinedFix: { type: 'string' }, file: { type: 'string' } } }
const SYNTH = { type: 'object', required: ['productionReady', 'overall'], properties: {
  productionReady: { type: 'boolean' },
  overall: { type: 'string' },
  fixesClean: { type: 'number' }, fixesNeedingWork: { type: 'number' },
  remainingFixes: { type: 'array', items: { type: 'object', required: ['severity', 'file', 'issue', 'fix'], properties: {
    severity: { type: 'string' }, file: { type: 'string' }, issue: { type: 'string' }, fix: { type: 'string' } } } } } }

// ---- Phase 1: verify each round-1 fix in the patched engine ----
phase('Verify fixes')
log('Verifying ' + N_FIXES + ' round-1 fixes in the patched engine...')
const idx = []
for (let i = 0; i < N_FIXES; i++) idx.push(i)
const fixVerdicts = (await parallel(idx.map((i) => () =>
  agent('You are confirming that a specific fix from round 1 of an adversarial review actually landed in the patched Atlas v2 engine.\n\n' + SCHEMA_RULE +
    '\n\n1. Read the round-1 review at ' + ROUND1 + ' and take `confirmed[' + i + ']` — that is YOUR fix to verify (its issue + intended fix).\n' +
    '2. Read the current engine ' + ENGINE + ' (and ' + DESIGN + ' if needed).\n' +
    '3. Determine: is the fix PRESENT, CORRECT, and COMPLETE — and did applying it introduce any REGRESSION (broken control flow, lost result, off-by-one, unreachable branch, double-handling)?\n\n' +
    'Return index=' + i + ', a one-line fixSummary, status (clean | incomplete | regressed), tight reasoning grounded in the actual code, and a precise residualFix if not clean. Be skeptical and exact — trace the relevant lines.',
    { label: 'verify-fix#' + i, phase: 'Verify fixes', schema: FIXVERDICT })
))).filter(Boolean)
const notClean = fixVerdicts.filter((v) => v && v.status !== 'clean')
log(fixVerdicts.filter((v) => v && v.status === 'clean').length + '/' + fixVerdicts.length + ' fixes clean; ' + notClean.length + ' need work.')

// ---- Phase 2: fresh sweep of the patched engine (regressions + missed defects) ----
phase('Fresh sweep')
const base = 'Fresh adversarial sweep of the PATCHED Atlas v2 engine (' + ENGINE + '), contract ' + DESIGN + ', and modules under ' + ROOT + '. ' + SCHEMA_RULE + '\n\nFocus your lens; report only REAL defects (a clean lens returns empty). YOUR LENS: '
const LENSES = [
  { key: 'recursion-reenter', brief: 'The threaded per-slice recursion + the `reenter` closure in runSlice. Verify: routeBacks is threaded (default param) and the budget actually bounds re-entries; `const re = reenter(...); if (re) return await re` returns the recursive result correctly (no lost/dropped result, no missing await); when reenter returns null (budget exhausted) every caller falls through to a correct escalate/blocked; no path recurses without incrementing; no stack-blowup beyond maxRouteBacks. Trace S2-reroute, S3-routeback, S4-build (routeback + promotion), S5-routeback.' },
  { key: 'corroborate-reroute', brief: 'The corroborate() conservative reclassification + the reroute result path. Verify: forcing o.tier=3 then synthesizing a routeBack to S2 routes to {result:"reroute"} (slice-level) not a stuck state; a corroborated Tier-3 with an UPSTREAM (S0/S1) routeBack still escalates; no infinite reroute (bounded by reenter); corroborate cannot mislabel a genuinely two-way Tier-2 as Tier-3 in a way that breaks enabling-slice handling; ONE_WAY_SURFACES substring matching has no false-trigger that blocks trivial slices.' },
  { key: 'reentry-loop-report', brief: 'The runInitiative phase-escalation while-loop and S7 re-entry. Verify termination: the while-loop exits in all cases (S0 return, S1-S4 bounded by maxPhaseReentries via local `tries`, else blocker+break); runInitiative S0-recursion is bounded by the module-scope upstreamRouteBacks across recursion; report accumulators (report.phases, report.obstructions, report.slicesProcessed) double-count across an S0 re-entry — is that a correctness or just cosmetic issue, and is report.ready set correctly on every exit path (single-phase, multi-phase pass, multi-phase routeback)?' },
  { key: 'schema-consumption', brief: 'Do the new/changed schemas match what the engine consumes? riskTier on SCHEMA_S4 (read as build.riskTier for promotion), failedCriteria on SCHEMA_VERDICT (read in verifyWithFix set logic), obstruction+blockers on SCHEMA_FIX (read by absorb). Any field the engine reads but no schema declares (so the agent can never return it), or declared-but-never-consumed dead fields that mislead the agent? Check absorb() reads vs every schema that flows into it.' },
  { key: 'holistic-correctness', brief: 'A fresh full read of the patched engine for anything both passes missed: dead/unreachable code, mishandled nulls from runStep (every `await runStep` can return null on budget exhaustion — is each guarded?), escalate results whose targetStep goes nowhere, the single-phase report.ready derivation, the bootstrap .catch(()=>null), and whether the FAST lane truly skips S3 + heavy ceremony. Report concrete defects only.' },
]
const lensResults = (await parallel(LENSES.map((l) => () =>
  agent(base + l.key + ' — ' + l.brief + '\n\nReturn findings with stable ids, severity P0-P3, exact location, proposed fix (sandbox-valid). Empty if clean.',
    { label: 'sweep:' + l.key, phase: 'Fresh sweep', schema: FINDINGS })
))).filter(Boolean)
const fresh = []
for (const lr of lensResults) for (const f of (lr.findings || [])) fresh.push({ ...f, lens: lr.lens })
log('Fresh sweep raised ' + fresh.length + ' findings; adversarially verifying...')

const freshVerdicts = (await parallel(fresh.map((f) => () =>
  agent('Adversarially confirm or REJECT this fresh finding about the patched Atlas v2 engine. Read ' + ENGINE + ' and verify against the actual code.\n\n' + SCHEMA_RULE + '\n\nFINDING [' + f.id + '] (' + f.severity + ', lens=' + f.lens + ')\nWhere: ' + f.where + '\nIssue: ' + f.issue + '\nProposed fix: ' + (f.proposedFix || '(none)') + '\n\nDefault confirmed=false unless the defect is REAL and material. Give a refined sandbox-valid fix + exact file if confirmed.',
    { label: 'verify:' + f.id, phase: 'Synthesize', schema: VERDICT })
))).filter(Boolean)
const newConfirmed = freshVerdicts.filter((v) => v && v.confirmed)
log(newConfirmed.length + ' of ' + freshVerdicts.length + ' fresh findings confirmed.')

// ---- Phase 3: synthesize readiness verdict ----
phase('Synthesize')
const payload = JSON.stringify({ fixVerdicts, newConfirmed }).slice(0, 70000)
const synthesis = await agent('Synthesize the round-2 re-review of Atlas v2 into a production-readiness verdict.\n\nDATA (json: per-fix verdicts from round-1 fixes, plus newly-confirmed fresh findings):\n' + payload +
  '\n\nProduce: productionReady (true iff all 9 round-1 fixes are clean AND no unaddressed P0/P1 fresh finding remains), a one-paragraph `overall` assessment, fixesClean / fixesNeedingWork counts, and an ORDERED remainingFixes list (severity, exact file, one-line issue, precise sandbox-valid fix) covering every not-clean fix + every confirmed fresh finding. If nothing remains, remainingFixes is empty.',
  { label: 'synthesize', phase: 'Synthesize', schema: SYNTH })

return { fixVerdicts, freshConfirmed: newConfirmed.length, freshTotal: fresh.length, synthesis }
