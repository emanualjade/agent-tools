export const meta = {
  name: 'evaluate-dogfood-run',
  description: 'Evaluate the first real Strike v2 dogfood build (houseplant tracker in ~/Sites/workflow-dogfood): code quality, slicing discipline, verification honesty, a 9-failure-mode scorecard, the integration/coverage bugs, and efficiency/timing — then synthesize an improvement report.',
  phases: [
    { title: 'Evaluate', detail: '6 lenses deep-reading the actual build + artifacts' },
    { title: 'Report', detail: 'synthesize grade, what-worked, ranked issues, recommendations, scorecard' },
  ],
}

const DF = '/Users/cracklehat/Sites/workflow-dogfood'
const STK = DF + '/strike/initiatives/initiative'   // the build wrote here (id mismatch)
const FRONT = DF + '/strike/initiatives/houseplant-tracker'  // front door wrote here

const GROUND = 'GROUNDED FACTS (established by direct inspection — verify + expand, do not re-discover):\n' +
  '- The build: a houseplant-watering tracker, TypeScript + Vite, vanilla TS (no framework), persistence via IndexedDB. src/ = db.ts/main.ts/plant.ts/season.ts/status.ts (~988 lines). 4 phases P1-P4, 6 slices total. tests/ = 9 test files (~1330 lines).\n' +
  '- TESTS CURRENTLY 43/43 GREEN (re-run by the evaluator just now via `npx vitest run`).\n' +
  '- Final ' + STK + '/verification.md: all 11 acceptance criteria PASS at honest rungs (R2/R4), `verifiedKind: verified` (NOT code-verified), backed by real-entry-point tests AND live DEV-browser Playwright screenshots (localhost:5199, shots/*-dev.png) AND at least one mutation test (partial `put` → AC-7 FAILs).\n' +
  '- TIMING: front-door artifacts at ' + FRONT + ' written 08:39-08:41; build artifacts at ' + STK + ' written 08:44 → 11:14. ~2.5 HOURS for a small app. The user noticed it was slow.\n' +
  '- ID MISMATCH: the front door used initiativeId "houseplant-tracker"; the BUILD ran as the DEFAULT "initiative" → two separate initiative dirs. The build main-spec nonetheless CITES the houseplant-tracker/ front-door files as authoritative sources (so the decision log reached the build via the agent finding them, NOT via the intended shared-<id> path).\n' +
  '- COVERAGE GAP: the final receipt honestly flags that "Set the hemisphere" was main-spec In-scope but has NO acceptance criterion, so the UI control was NOT built and the initiative still PASSED (the data path exists; only the control is owed).\n' +
  '- The everything-is-CRITICAL hypothesis: IndexedDB persistence is a "persistence/migration" domain surface (risk-tiering §2) → CRITICAL by rule → every slice likely ran the FULL lane (S3 + R3 + lenses + browser), giving the FAST/FULL optimization nothing to save on a storage-backed CRUD app. Verify whether this drove the runtime.'

const FINDING = { type: 'object', required: ['lens', 'summary', 'findings'], properties: {
  lens: { type: 'string' }, summary: { type: 'string' },
  grade: { type: 'string', description: 'A-F for this dimension' },
  findings: { type: 'array', items: { type: 'object', required: ['kind', 'detail'], properties: {
    kind: { type: 'string', description: 'strength | issue | recommendation' },
    severity: { type: 'string', description: 'for issues: P0|P1|P2|P3' },
    detail: { type: 'string' }, evidence: { type: 'string', description: 'file/line/observation that grounds it' } } } } } }

const LENSES = [
  { key: 'code-quality', reads: DF + '/src + ' + DF + '/index.html + ' + DF + '/vite.config.ts + ' + DF + '/package.json',
    brief: 'Read all of ' + DF + '/src/*.ts, index.html, vite.config.ts, package.json. Assess the ACTUAL CODE: correctness, structure/separation, naming, idiomatic TS, error/edge handling, the IndexedDB layer, the season/status date logic (timezone/day-boundary correctness — the ACs hinge on it), any bugs/smells/dead code, dependency choices. Is this code a senior engineer would accept? Grade it. Cite files.' },
  { key: 'slicing-discipline', reads: STK + '/development-plan.md + every phases/*/phase-spec.md + every slices/*/slice.md',
    brief: 'Read ' + STK + '/development-plan.md, every phases/P*/phase-spec.md, and every phases/P*/slices/*/slice.md. Evaluate the SLICING against v2 discipline: were the 4 phases VERTICAL (outcome-named capabilities, not horizontal layers like schema-first)? Were the 6 slices thin AND complete, one observable behavior, vertical, app-runnable? Was P1-s01 a real tracer bullet? Any over-splitting (un-demoable fragments) or under-splitting (bundled "and")? Are the sizes/tiers sensible, or is everything mis-CRITICAL? Did slicing read appropriately? Grade it. Cite slice ids.' },
  { key: 'verification-honesty', reads: STK + '/phases/*/slices/*/{plan-verification,build-verification}.md + ' + STK + '/phases/*/verification.md + ' + STK + '/verification.md',
    brief: 'Read the plan-verification.md + build-verification.md for EVERY slice, every phase verification.md, and the final initiative verification.md under ' + STK + '. This is the load-bearing question: was verification GENUINE or rubber-stamped anywhere? Look for: real-entry-point + real-data evidence vs hand-waving; honest verified-vs-code-verified calls; the tamper/tautology audit actually run; the season-render.test.ts transient FAILURE (find it — was it caught honestly and fixed, evidence of the fix loop?); any slice that cut a corner or claimed a rung it did not reach; screenshots actually inspected vs merely captured. Grade the honesty. Cite slices.' },
  { key: 'failure-modes-scorecard', reads: STK + ' (all build/verification artifacts) + ' + DF + '/tests + ' + DF + '/src',
    brief: 'Build an EVIDENCE-BACKED scorecard: for each of the 9 V1 failure modes v2 was hardened against, did THIS run actually avoid it? (1) env-var excuse for skipping browser tests; (2) reinventing existing patterns [greenfield → N/A, note it]; (3) skipping E2E tests; (4) tool-auth give-up [note the Playwright/chromium issue — how was it handled?]; (5) wrong/convenient verify environment + arbitrary env-switching; (6) out-of-band manual migration [N/A IndexedDB? note]; (7) front-door skipped; (8) missing final attestation; (9) silent workarounds. For EACH: HELD / PARTIAL / FAILED / N-A, with the specific evidence (file/observation). Be skeptical — look for any place a V1-style shortcut sneaked through.' },
  { key: 'integration-and-coverage', reads: FRONT + '/*.md + ' + STK + '/main-spec.md + ' + STK + '/acceptance-criteria.md + ' + STK + '/verification.md',
    brief: 'Investigate two confirmed defects + root-cause them. (A) THE ID MISMATCH: front door wrote ' + FRONT + ' (id "houseplant-tracker") but the build ran as "initiative" (two dirs). Read both refined-idea.md/idea-decisions.md and the build main-spec. Determine: did the grilled decision log + "## Environments" + "## Required Capabilities & Preflight" actually reach + shape the build, or only partially? Why did the id not carry (grill was supposed to pass initiativeId = the front-door <id>)? Why did the S0 PREFLIGHT FLOOR not BLOCK (a persistence surface was present but idea-decisions.md was absent at the build dir)? Propose the precise fix. (B) THE COVERAGE GAP: "Set the hemisphere" was main-spec In-scope but had no acceptance criterion → unbuilt → still PASS. Read main-spec In-scope vs acceptance-criteria.md vs what was built. Is this a systemic hole (In-scope items with no AC are silently droppable)? Propose the fix (e.g. S0/S6/S7 must reconcile In-scope ⊆ AC-covered). Cite exact lines.' },
  { key: 'efficiency-timing', reads: STK + ' (all artifacts, fix files, timestamps) + the risk-tiering/lane design',
    brief: 'Analyze WHY the run took ~2.5h for a small app and where the time went, from the artifacts (count slices, fix files/loops, re-runs, browser passes; read the verifications for fix-loop and re-run evidence; check whether EVERY slice ran FULL lane / CRITICAL because IndexedDB = persistence surface). Separate JUSTIFIED thoroughness from WASTE. Then give concrete, specific speedups that do NOT sacrifice the disciplines that held — e.g. should local/ephemeral persistence (IndexedDB/localStorage, no migration, no shared/multi-user data) be down-tiered from CRITICAL? should the per-slice live-browser pass be consolidated to phase/final level? are there redundant re-verifications? Quantify where you can. Grade the efficiency.' },
]

phase('Evaluate')
log('Evaluating the dogfood build across ' + LENSES.length + ' dimensions...')
const results = (await parallel(LENSES.map((l) => () =>
  agent('You are evaluating the FIRST real production run of the Strike v2 build workflow — a dogfood build the user wants an honest assessment of. Read the actual files your lens names (under ' + DF + ') and judge from the real artifacts/code, not assumptions.\n\n' + GROUND + '\n\nYOUR LENS (' + l.key + '): read: ' + l.reads + '\n\n' + l.brief + '\n\nReturn a tight summary, a letter grade for this dimension, and concrete findings (strength | issue[+severity] | recommendation) each grounded in a specific file/observation. Be honest and specific — credit what genuinely worked (this is the payoff of all the hardening) AND name real problems plainly.',
    { label: 'eval:' + l.key, phase: 'Evaluate', schema: FINDING })
))).filter(Boolean)
log('Collected ' + results.length + ' dimension evaluations. Synthesizing the report...')

phase('Report')
const REPORT = { type: 'object', required: ['verdict', 'overallGrade', 'whatWorked', 'issues', 'recommendations', 'failureScorecard'], properties: {
  verdict: { type: 'string', description: '2-3 sentence bottom line: did v2 deliver, and what is the headline' },
  overallGrade: { type: 'string', description: 'A-F overall' },
  whatWorked: { type: 'array', items: { type: 'string' }, description: 'the disciplines that held — the payoff vs V1, with evidence' },
  issues: { type: 'array', items: { type: 'object', required: ['severity', 'title', 'fix'], properties: {
    severity: { type: 'string', description: 'P0|P1|P2|P3' }, title: { type: 'string' }, detail: { type: 'string' }, fix: { type: 'string' } } } },
  recommendations: { type: 'array', items: { type: 'object', properties: { priority: { type: 'string' }, rec: { type: 'string' } } } },
  failureScorecard: { type: 'array', items: { type: 'object', properties: { failure: { type: 'string' }, status: { type: 'string', description: 'HELD|PARTIAL|FAILED|N/A' }, evidence: { type: 'string' } } } },
} }
const report = await agent('Synthesize these 6 dimension evaluations of the Strike v2 dogfood build into ONE honest improvement report for the user. Lead with the bottom line (did the hardening pay off?). Credit what genuinely held vs V1 (real-browser verification, E2E tests, env-scoping, honest attestation) WITH evidence. Rank the real issues by severity (the id mismatch, the In-scope-without-AC coverage gap, the ~2.5h efficiency, plus anything the lenses surfaced). Give concrete prioritized recommendations. Produce the 9-failure scorecard (HELD/PARTIAL/FAILED/N-A + evidence). Be honest and useful, not a victory lap — but do credit real wins.\n\nDIMENSION EVALUATIONS (json):\n' + JSON.stringify(results).slice(0, 110000),
  { label: 'synthesize-report', phase: 'Report', schema: REPORT })

return { dimensions: results, report }
