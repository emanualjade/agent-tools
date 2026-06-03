export const meta = {
  name: 'review-strike-v2-hardening',
  description: 'Adversarial pass over the hardened Strike v2: regression check on the engine S0 preflight floor + hand-applied edits, dead-vestige/schema-consumption check, cross-file coherence, each-of-9-failures-closed, lean/new-conflicts, autonomous-safety — verify findings, synthesize a ready-for-dogfood verdict.',
  phases: [
    { title: 'Review', detail: '6 lenses over engine + 11 hardened modules + DESIGN' },
    { title: 'Verify', detail: 'adversarially confirm/reject each finding against the real code' },
    { title: 'Synthesize', detail: 'ready-for-dogfood verdict + ordered remaining fixes' },
  ],
}

const ENGINE = '/Users/cracklehat/Sites/workflow-exploration/.claude/workflows/strike-v2.mjs'
const ROOT = '/Users/cracklehat/Sites/workflow-exploration/strike-engine-v2'
const DESIGN = ROOT + '/DESIGN.md'

const RULE = 'RUNTIME FACTS: (1) the engine runs in a sandbox with NO filesystem/Node API and no Date.now/Math.random; top-level return/await are intended (harness wraps the script). (2) The engine reads ONLY: a.initiativeId/initiativeName/idea/decisions/constraints/repoContext from args; the on-disk refined-idea.md + idea-decisions.md at S0; and the EXISTING step-result envelope/SCHEMA_* fields (verdict, failedCriterion, artifactPath, assumptions, blockers, changedFiles, surfaces, obstruction, routeBack; plus per-step phases/slices/built/fixNeeded/readyToVerify/readyToBuild/splitNeeded/replacementSlices/riskTier). It does NOT read any new launch-arg or new return field. The engine routes on verdict (PASS/FAIL/BLOCKED) + routeBack + the per-step structured fields; failedCriterion strings are informational. A module instructing an agent to emit a field the engine never reads is a DEAD VESTIGE (DESIGN §11). (3) Honor lean: teeth, not ceremony.'

const FINDINGS = { type: 'object', required: ['lens', 'findings'], properties: {
  lens: { type: 'string' },
  findings: { type: 'array', items: { type: 'object', required: ['id', 'severity', 'where', 'issue'], properties: {
    id: { type: 'string' }, severity: { type: 'string', description: 'P0|P1|P2|P3' }, where: { type: 'string' }, issue: { type: 'string' }, proposedFix: { type: 'string' } } } } } }
const VERDICT = { type: 'object', required: ['id', 'confirmed', 'reasoning'], properties: {
  id: { type: 'string' }, confirmed: { type: 'boolean' }, severity: { type: 'string' }, reasoning: { type: 'string' }, refinedFix: { type: 'string' }, file: { type: 'string' } } }
const SYNTH = { type: 'object', required: ['readyForDogfood', 'overall'], properties: {
  readyForDogfood: { type: 'boolean' }, overall: { type: 'string' },
  remainingFixes: { type: 'array', items: { type: 'object', required: ['severity', 'file', 'issue', 'fix'], properties: {
    severity: { type: 'string' }, file: { type: 'string' }, issue: { type: 'string' }, fix: { type: 'string' } } } } } }

const base = 'You are adversarially reviewing the just-HARDENED Strike v2 build workflow for regressions and remaining holes. Read what your lens needs:\n  - engine: ' + ENGINE + '\n  - contract: ' + DESIGN + '\n  - modules under ' + ROOT + ' (disciplines/, surfaces/, steps/, front-door/)\n\n' + RULE + '\n\nThe hardening added (across 11 files + engine + DESIGN): `no_substitution` (honest-verification, the spine), `environment-scoped` (S5), `behavior-test-committed`/`-present` (S4/S5), `no-silent-workaround`/`capability-unavailable` (S4), `sibling-surveyed` (read-before-write) + `follow-the-house-pattern` (S2), web-backend `Through-the-tool` migrations + obstruction-loop 5th trigger, grill `## Required Capabilities & Preflight`/`## Environments` + launch-blocker, `strike.md` floored skip, `disciplines_attested` (S6/S7), an engine S0 PREFLIGHT FLOOR (S0 returns verdict:BLOCKED if idea-decisions.md has unruled surfaces / un-provisioned capabilities; runInitiative degrades on s0.verdict===BLOCKED), and DESIGN non-negotiable #12.\n\nYOUR LENS: '

const LENSES = [
  { key: 'engine-regression-s0-floor', brief: 'Engine regression + the S0 preflight floor. Read the engine. Verify the new `if (s0.verdict === "BLOCKED")` degrade path: does it record a blocker and return cleanly without running phases? Does a normal verdict:PASS still proceed (the floor does not false-block a legitimate run)? Does the BLOCKED check interact correctly with upstream re-entry (runInitiative recursion / runInitiative() re-run) — e.g. a re-entry that re-runs S0 and blocks degrades, no infinite loop? Does SCHEMA_S0 still allow a BLOCKED return (phases required:["verdict","phases"] — can S0 return BLOCKED with empty phases without a schema-retry storm)? Any other regression from the hand-applied S0 task edit. Trace it.' },
  { key: 'dead-vestige-schema', brief: 'Dead-vestige / schema-consumption. For EVERY new gate criterion across the 11 edits, check whether it instructs the agent to EMIT or RETURN a structured field the engine does not read (a new launch-arg, a new envelope/return field, newRequiredConfig[], requiredCapabilities, etc.). The plan was supposed to route ALL new info through on-disk prose (idea-decisions.md sections, build.md obstacle ledger) — confirm it did, and flag any place a module says "return X"/"emit X in the result" for an X not in the engine SCHEMA_*/ENVELOPE. Read the engine schemas (lines ~105-145) and grep the edited modules for return/emit instructions.' },
  { key: 'cross-file-coherence', brief: 'Cross-file coherence of the hardening. Confirm: `no_substitution` is DEFINED once in honest-verification.md and merely COMPOSED/referenced by s5/s6/s7 (not redefined); the behavior-test precedence (FAIL only when R2 reachable; legitimately external-unavailable -> committed skip-with-reason test + BLOCKED/code-verified, never FAIL/infinite-rebuild) is stated CONSISTENTLY across s4/s5/honest-verification; `environment-scoped` (browser->DEV, tests->TEST, no switching/mutating) means the same everywhere; the s4 behavior-test-committed and s5 behavior-test-present are ONE deliverable (S5 confirms S4); the two hand-applied nits (s4 routeBack:S0 preference, s5 composing designated-env-broken from the discipline) landed correctly. Flag contradictions / drift.' },
  { key: 'each-failure-closed', brief: 'Re-walk the 9 V1 failures and confirm each now has a HARD, rationalize-proof gate an agent cannot talk past (not just words): (1) env-var-excuse, (2) reinvented-existing-pattern, (3) skipped-e2e-tests, (4) tool-auth-gaveup, (5) wrong-verify-environment + arbitrary env-switching, (6) out-of-band-manual-migration, (7) front-door-skipped (incl. direct-launch bypass via the S0 floor), (8) final-attestation, (9) no-silent-workarounds spine. For EACH, name the exact gate criterion + file that closes it, and flag any that is still soft/rationalize-past-able or whose teeth depend on a field the engine ignores.' },
  { key: 'lean-and-new-conflicts', brief: 'Lean + NEW conflicts the hardening may have introduced. (a) Ceremony: how many named gates does a single STANDARD slice now pass across S4+S5? Is `disciplines_attested` truly ONE spot-check (not four)? Flag skim-inducing bloat. (b) TRIVIAL/non-UI handling: does behavior-test-committed wrongly demand an E2E test on a TRIVIAL XS copy/config slice (mandatory is STANDARD+, confirm), and does `environment-scoped` gracefully handle a CLI/library feature with NO browser/UI (no DEV-browser requirement falsely imposed)? (c) Termination: can the new behavior-test-committed FAIL + the code-verified precedence create an infinite re-build, or does the precedence cut it? (d) Does the S0 preflight floor risk false-blocking a legitimate greenfield run where surfaces are genuinely none? Flag real conflicts only.' },
  { key: 'autonomous-safety-frontdoor', brief: 'Autonomous-safety + front-door. Confirm NO hardening edit assumes the build can ask the user mid-run — every "needs a human decision/credential/env" is front-loaded in grill (idea-decisions.md) or surfaced as a hard blocker. Check the grill launch-blocker + the engine S0 floor are the right shape (front-door is the only interactive layer per DESIGN §12). Check strike.md floored "just go" cannot skip a one-way-door surface. Flag any place the autonomous build is implicitly expected to prompt a human, or any blocker that dead-ends with no path to resolution + re-launch.' },
]

phase('Review')
log('Running ' + LENSES.length + ' adversarial lenses over the hardened v2...')
const lensResults = (await parallel(LENSES.map((l) => () =>
  agent(base + l.key + ' — ' + l.brief + '\n\nReturn concrete findings (stable id, P0-P3, exact location, sandbox-valid proposed fix). A clean lens returns an empty list. Be skeptical and specific; trace the actual code/text.',
    { label: 'lens:' + l.key, phase: 'Review', schema: FINDINGS })
))).filter(Boolean)
const all = []
for (const lr of lensResults) for (const f of (lr.findings || [])) all.push({ ...f, lens: lr.lens })
log('Collected ' + all.length + ' findings. Adversarially verifying...')

phase('Verify')
const verdicts = (await parallel(all.map((f) => () =>
  agent('Adversarially confirm or REJECT this finding about the hardened Strike v2. Read ' + ENGINE + ', ' + DESIGN + ', and the relevant module, and verify against the ACTUAL code/text.\n\n' + RULE + '\n\nFINDING [' + f.id + '] (' + f.severity + ', lens=' + f.lens + ')\nWhere: ' + f.where + '\nIssue: ' + f.issue + '\nProposed fix: ' + (f.proposedFix || '(none)') + '\n\nDefault confirmed=false unless the defect is REAL and material. Give a refined sandbox-valid fix + exact file if confirmed.',
    { label: 'verify:' + f.id, phase: 'Verify', schema: VERDICT })
))).filter(Boolean)
const confirmed = verdicts.filter((v) => v && v.confirmed)
log(confirmed.length + ' of ' + verdicts.length + ' findings confirmed.')

phase('Synthesize')
const synthesis = await agent('Synthesize the adversarial review of the hardened Strike v2 into a ready-for-dogfood verdict. readyForDogfood is true iff NO confirmed P0/P1 remains (P2/P3 polish may be noted but does not block a dogfood run). Give a one-paragraph overall and an ORDERED remainingFixes list (severity, exact file, one-line issue, precise sandbox-valid fix).\n\nCONFIRMED FINDINGS (json):\n' + JSON.stringify(confirmed).slice(0, 60000),
  { label: 'synthesize', phase: 'Synthesize', schema: SYNTH })

return { rawFindings: all.length, confirmed: confirmed.length, verdicts, synthesis }
