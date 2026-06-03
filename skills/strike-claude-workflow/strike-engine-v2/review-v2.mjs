export const meta = {
  name: 'review-strike-v2',
  description: 'Adversarial review of the Strike v2 engine + modules: fan out correctness/contract/obstruction/verification/leanness/resume lenses, adversarially verify each finding (schema-authoritative runtime kills false positives), synthesize a confirmed fix list.',
  phases: [
    { title: 'Lenses', detail: '6 review lenses over engine + DESIGN + modules' },
    { title: 'Verify findings', detail: 'adversarially confirm/reject each finding' },
    { title: 'Synthesize', detail: 'consolidated, ordered confirmed-fix list' },
  ],
}

const ENGINE = '/Users/cracklehat/Sites/workflow-exploration/.claude/workflows/strike-v2.mjs'
const ROOT = '/Users/cracklehat/Sites/workflow-exploration/strike-engine-v2'
const DESIGN = ROOT + '/DESIGN.md'

const SCHEMA_RULE = 'CRITICAL RUNTIME FACT: every engine step runs a subagent with BOTH its steps/*.md instructions AND a StructuredOutput JSON schema defined in the engine. The schema is AUTHORITATIVE at runtime — the agent MUST return schema-conformant fields. Therefore a prose field-name in a module that differs from the engine schema is NOT a bug (the agent conforms to the schema). Only real defects count: (a) the engine schema is missing/wrong for a field a step genuinely needs to return for routing; (b) engine routing logic mishandles a valid step output; (c) a termination/budget/recursion hole; (d) a SEMANTIC contradiction between a module-described behavior and what the engine actually does; (e) a genuine soundness/quality/coverage gap. Stylistic, speculative, or schema-authority-moot items are NOT findings.'

const FINDINGS = { type: 'object', required: ['lens', 'findings'], properties: {
  lens: { type: 'string' },
  findings: { type: 'array', items: { type: 'object', required: ['id', 'severity', 'where', 'issue'], properties: {
    id: { type: 'string', description: 'short stable id, e.g. C1' },
    severity: { type: 'string', description: 'P0|P1|P2|P3' },
    where: { type: 'string', description: 'file + location' },
    issue: { type: 'string' },
    proposedFix: { type: 'string' },
    confidence: { type: 'string' },
  } } },
} }

const VERDICT = { type: 'object', required: ['id', 'confirmed', 'reasoning'], properties: {
  id: { type: 'string' }, confirmed: { type: 'boolean' },
  severity: { type: 'string' }, reasoning: { type: 'string' },
  refinedFix: { type: 'string' }, file: { type: 'string' },
} }

const SYNTH = { type: 'object', required: ['confirmed'], properties: {
  overall: { type: 'string' },
  confirmed: { type: 'array', items: { type: 'object', required: ['severity', 'file', 'issue', 'fix'], properties: {
    severity: { type: 'string' }, file: { type: 'string' }, issue: { type: 'string' }, fix: { type: 'string' } } } },
  rejectedCount: { type: 'number' },
} }

const base = 'You are reviewing the Strike v2 build workflow for production-readiness. Read:\n' +
  '  - ' + ENGINE + '  (the engine)\n' +
  '  - ' + DESIGN + '  (the design contract)\n' +
  '  - the modules under ' + ROOT + '/steps, ' + ROOT + '/disciplines, ' + ROOT + '/surfaces (read the ones your lens needs)\n\n' +
  SCHEMA_RULE + '\n\nYOUR LENS: '

const LENSES = [
  { key: 'correctness-termination', brief: 'Engine correctness + TERMINATION. Is every loop bounded (verifyWithFix fix attempts, runSlice routeBacks, phase splits, initiative upstream re-entry, agent-call + slice ceilings)? Can runSlice recursion (route-back re-invocations) or runInitiative recursion (upstream re-entry) infinite-loop or blow the stack? Are budget checks (budgetOk, maxSlices, maxAgentCalls) actually enforced before every agent call and on every loop? Does a split/enabling that returns malformed slices loop forever? Trace the worst cases.' },
  { key: 'engine-module-contract', brief: 'Engine <-> module SEMANTIC contract alignment (not prose field names — schema is authoritative). For each step S0..S7+fix: does the engine schema capture every field the step module says the engine ROUTES on? e.g. S2 readyToBuild/readyToVerify/splitNeeded/replacementSlices/riskTier/lane/obstruction/routeBack; S4 built/splitNeeded/replacementSlices/obstruction/routeBack; verifiers verdict/fixNeeded/routeBack; S1 slices[].lane/riskTier/surfaces + routeBack to S0; S0 phases[]. Does the engine ACT correctly on each (e.g. S4 says "fixable build FAIL -> fix then re-run S5" — does the engine do a build fix-loop, or does it block? S1 routeBack to S0 — handled? readyToBuild vs readyToVerify lane gating — does the engine actually gate S3 on lane?). Enumerate genuine mismatches.' },
  { key: 'obstruction-end-to-end', brief: 'Trace Tier 1/2/3 obstruction end-to-end through obstruction-loop.md + s2-plan.md + s4-build.md + the engine. Tier 2 enabling: does the engine PREPEND + KEEP current (insert before, re-run current) vs pure split (replace)? Does it distinguish via obstruction.tier===2? Tier 3 upstream: does the engine ACTUALLY re-enter S0/S1 with cascade reset, bounded? Does upstream re-entry re-do already-built slices wastefully or double-count the report? On-disk slices/ reconciliation (DESIGN §6) — the engine does NOT re-read the dir; does that break resume-after-split or in-run correctness? Is the conservative reversibility default actually enforceable (it relies on the agent classifying — acceptable?).' },
  { key: 'verification-anti-gaming', brief: 'Does the pipeline actually catch the HIGH-SEVERITY class: confidently-wrong NON-looping silent errors (days_held=0 skips everything, reports success)? The tamper/tautology audit must be by a NON-implementer — confirm S5 (verify-build) runs as a SEPARATE agent from S4 (build) in the engine (it does — different agent calls). Does honest-verification.md actually force R2 behavior-through-real-entry-point with real data, and is the engine prompting for it? Can an agent report PASS without meeting the gate (the engine trusts verdict===PASS — is that exploitable, and is it mitigated by the separate-verifier + spec-anchored oracle)? Any place "green tests" could be reported as verified.' },
  { key: 'leanness-risk-tiering', brief: 'Leanness + ceremony-fatigue. Does the FAST lane stay genuinely lean (TRIVIAL: S2->S4->S5 only, no canonical/altitude ceremony)? Is rigor truly surface-gated so a CSS change pays nothing? Does the engine actually route FAST vs FULL off slice.lane/riskTier and skip S3 for FAST? Any place blanket ceremony leaks onto trivial slices (the failure mode the whole design fights)? Are the step modules too long/heavy in a way that will bloat agent context? Flag real leaks only.' },
  { key: 'resume-budgets-report', brief: 'Resume, budgets, and reporting soundness. Resume (DESIGN §10) relies on the workflow journal + on-disk artifacts; does the engine mutate state (slice list splice, report accumulation across upstream re-entry) in a way that breaks deterministic resume or double-counts phases/obstructions on re-entry? Is the acceptance-criteria artifact (objective) genesis sound — S0 writes it, later steps re-read it; if S0 gets it wrong, everything passes wrongly — is there any check on AC correctness/completeness? Is the optional stall-signal hook integration coherent (engine references it in HANDS_OFF prompt; never required)? Does the final report accurately reflect partial/degraded runs?' },
]

phase('Lenses')
log('Running ' + LENSES.length + ' adversarial review lenses over the v2 engine + modules...')
const lensResults = (await parallel(LENSES.map((l) => () =>
  agent(base + l.key + ' — ' + l.brief + '\n\nReturn concrete findings with stable ids, severity P0-P3, exact location, and a proposed fix. Only real defects per the runtime fact above. A clean lens may return an empty findings list.',
    { label: 'lens:' + l.key, phase: 'Lenses', schema: FINDINGS })
))).filter(Boolean)

const allFindings = []
for (const lr of lensResults) for (const f of (lr.findings || [])) allFindings.push({ ...f, lens: lr.lens })
log('Collected ' + allFindings.length + ' raw findings. Adversarially verifying each...')

phase('Verify findings')
const verdicts = (await parallel(allFindings.map((f) => () =>
  agent('You are an adversarial verifier. A review lens raised this finding about the Strike v2 workflow. Confirm or REJECT it by reading the actual files (' + ENGINE + ', ' + DESIGN + ', and the relevant module).\n\n' + SCHEMA_RULE + '\n\nFINDING [' + f.id + '] (' + f.severity + ', lens=' + f.lens + ')\nWhere: ' + f.where + '\nIssue: ' + f.issue + '\nProposed fix: ' + (f.proposedFix || '(none)') + '\n\nDefault to confirmed=false unless the defect is REAL and material (verify against the actual code/contract, accounting for schema-authority at runtime). If real, give a refined, minimal fix and the exact file. Be skeptical: many findings dissolve once you check that the engine schema is authoritative or that a separate verifier agent handles it.',
    { label: 'verify:' + f.id, phase: 'Verify findings', schema: VERDICT })
))).filter(Boolean)

const confirmed = verdicts.filter((v) => v && v.confirmed)
log(confirmed.length + ' of ' + verdicts.length + ' findings confirmed. Synthesizing fix list...')

phase('Synthesize')
const confirmedJson = JSON.stringify(confirmed).slice(0, 60000)
const synthesis = await agent('Synthesize the confirmed adversarial-review findings into a single ORDERED fix list for the Strike v2 workflow (engine + modules). Deduplicate overlapping findings, order by severity (P0 first), and for each give: severity, the exact file to edit, the issue in one line, and the precise fix. Also give an `overall` readiness assessment (is v2 production-ready after these fixes, or are there structural concerns?).\n\nCONFIRMED FINDINGS (json):\n' + confirmedJson,
  { label: 'synthesize-fixes', phase: 'Synthesize', schema: SYNTH })

return { rawFindings: allFindings.length, confirmed: confirmed.length, verdicts, synthesis }
