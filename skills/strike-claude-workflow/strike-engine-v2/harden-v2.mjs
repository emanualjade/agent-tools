export const meta = {
  name: 'harden-strike-v2',
  description: 'Gap-analyze Strike v2 against 9 real V1 failure modes (env-var excuse, reinvented patterns, skipped E2E tests, tool-auth give-up, wrong verify environment, out-of-band manual fix that breaks the process, skipped front door, missing final attestation, and the cross-cutting no-silent-workarounds principle), synthesize a concrete hardening plan, then adversarially critique it.',
  phases: [
    { title: 'Analyze', detail: 'one analyst per failure mode, grounded in the real v2 module text' },
    { title: 'Synthesize', detail: 'merge into one concrete, ordered hardening plan (file + exact change)' },
    { title: 'Critique', detail: 'adversarially pressure-test the plan: does it close each failure? over-engineered? autonomous-safe?' },
  ],
}

const ROOT = '/Users/cracklehat/Sites/workflow-exploration/strike-engine-v2'
const D = (n) => ROOT + '/disciplines/' + n
const ST = (n) => ROOT + '/steps/' + n
const S = (n) => ROOT + '/surfaces/' + n
const FD = (n) => ROOT + '/front-door/' + n
const DESIGN = ROOT + '/DESIGN.md'

const CONSTRAINTS = 'KEY CONSTRAINTS: (1) the v2 BUILD is an AUTONOMOUS background workflow — it CANNOT ask the user anything mid-run; the only interactive layer is the front door (refine-idea/grill-idea skills) that runs BEFORE launch. So "just ask the user" mid-build is impossible — the correct patterns are: front-load the need in grill, OR surface a hard BLOCKER that fails the gate so the run degrades and the human sees exactly what is needed (then fixes + re-launches). (2) At runtime the engine\'s StructuredOutput schema is authoritative. (3) Honor the lean principle — add teeth, not ceremony; cover the objective, cut filler. (4) Verifier steps (S3/S5/S6/S7) are SEPARATE agents from the builder (S4); use that.'

const FINDING = { type: 'object', required: ['key', 'covered', 'gap', 'hardening'], properties: {
  key: { type: 'string' },
  covered: { type: 'string', description: 'yes | partial | no — does current v2 actually prevent this failure?' },
  evidence: { type: 'string', description: 'the specific current module text that does or does not cover it (quote/cite)' },
  gap: { type: 'string', description: 'exactly what is missing or rationalize-past-able' },
  hardening: { type: 'array', items: { type: 'object', required: ['file', 'mechanism'], properties: {
    file: { type: 'string', description: 'absolute path of the module/engine file to change' },
    mechanism: { type: 'string', description: 'the concrete teeth to add — a named gate criterion, a mandatory step, a blocker rule — with the gist of the wording' } } } },
  notes: { type: 'string' },
} }

const FMS = [
  { key: 'env-var-excuse', reads: [D('honest-verification.md'), ST('s5-verify-build.md'), FD('grill-idea/SKILL.md'), S('web-backend.md')],
    brief: 'V1 FAILURE: the build NEEDED an env var, never mentioned or set it up, and used the missing env var as an EXCUSE to skip browser/E2E testing. Check v2: (a) does anything surface required env vars/config UP FRONT (grill) so the human provides them before launch? (b) is "a missing env var" a VALID reason to downgrade to code-verified / skip R2 behavior verification, or is it a hard blocker the agent must resolve or surface? Where exactly could an agent still hide behind "missing env var"? Give concrete teeth.' },
  { key: 'reinvented-existing-pattern', reads: [D('read-before-write.md'), ST('s2-plan.md'), ST('s4-build.md'), D('adjective-noun.md')],
    brief: 'V1 FAILURE: a capability ALREADY EXISTED in the codebase (file upload, data ingest) with an established house pattern; the agent invented its OWN new way, which was broken. User: "if you do anything like this, go explore how WE do it before making up your own way." Check v2: does read-before-write + the reuse gate actually FORCE the agent to find a sibling capability that already exists and FOLLOW its pattern? Is "invented a new way when an equivalent already exists" an explicit named FAIL (not just "prefer reuse")? Where could an agent still reinvent? Give concrete teeth.' },
  { key: 'skipped-e2e-tests', reads: [D('honest-verification.md'), ST('s4-build.md'), ST('s5-verify-build.md')],
    brief: 'V1 FAILURE: the agent CHOSE NOT to write end-to-end tests — likely because they would fail and it would then have to deal with the breakage. User wants writing E2E tests to be a HARD REQUIREMENT, and a failing E2E test must be FIXED, not skipped/deleted/weakened. Check v2: are E2E/behavior tests a required DELIVERABLE (S4) or merely "focused tests"? Can an agent satisfy the gate WITHOUT a persistent E2E test that actually exercises the real entry point? Is "skip the test because it would fail" or "delete/weaken the failing test" blocked? Give concrete teeth (named gate criterion).' },
  { key: 'tool-auth-gaveup', reads: [FD('grill-idea/SKILL.md'), D('honest-verification.md'), ST('s4-build.md'), DESIGN],
    brief: 'V1 FAILURE: given a tool (neon CLI), it hit an AUTH error and silently decided "I will not use it" and worked around it, instead of asking. In v2 the build is AUTONOMOUS (cannot ask mid-run). Correct v2 behavior: (a) front-load required tools/auth/access in grill so the human sets them up before launch; (b) a mid-run unavailable tool / auth failure on a NEEDED capability is a SURFACED HARD BLOCKER (run degrades, tells the human exactly what is needed), NEVER a silent workaround. Check v2: does grill capture required tools/credentials? Does the hands-off policy currently let an agent silently "decide not to use" a needed tool (it converts a "consequential question" to an assumption — is dropping a needed tool an acceptable assumption)? Give concrete teeth distinguishing "reasonable assumption" from "silently abandoned a needed capability = blocker".' },
  { key: 'wrong-verify-environment', reads: [D('honest-verification.md'), ST('s5-verify-build.md'), S('web-backend.md'), D('obstruction-loop.md')],
    brief: 'V1 FAILURE: a DB migration broke on the DEV DB (where the human clicks through). Instead of FIXING the migration, the agent switched to the TEST DB (where automated tests run) to "verify", leaving the dev branch BROKEN and unverified — it felt "I verified on SOME branch, good enough." Two failures: (1) routed AROUND a broken dependency instead of fixing it; (2) verified in a CONVENIENT SUBSTITUTE environment, not the DESIGNATED one (the dev branch/DB the human actually uses), and left the real one broken. Check v2: does honest-verification pin R2 to the DESIGNATED environment (not a substitute)? Does a broken migration/dependency trigger FIX (or the obstruction loop) rather than route-around? Could an agent still "verify elsewhere" and call it done? Give concrete teeth.' },
  { key: 'out-of-band-manual-fix', reads: [S('web-backend.md'), D('honest-verification.md'), D('obstruction-loop.md'), ST('s4-build.md'), D('read-before-write.md')],
    brief: 'V1 FAILURE: the agent applied a DB migration MANUALLY, OUTSIDE the project\'s migration scripts/tooling, to fix something itself — which CORRUPTED the migration state so subsequent migrations would not run on top (it broke the system for LATER without realizing). The general failure: bypassing a system\'s CANONICAL PROCESS (migration tool, codegen, lockfile/package manager, schema management) with an OUT-OF-BAND manual change that violates the mechanism\'s invariants and breaks things downstream. Check v2: does anything require that changes to a process-managed system go THROUGH that process (e.g. author a migration via the repo\'s migration tool, NEVER hand-apply SQL/edit generated state)? Does anything catch "I fixed it manually but left state inconsistent with the tracked migrations / broke the mechanism"? Give concrete teeth — connect to the web-backend migration (expand/contract) guardrail, read-before-write (find the project\'s migration mechanism FIRST), and the no-silent-workarounds principle.' },
  { key: 'front-door-skipped', reads: [FD('grill-idea/SKILL.md'), FD('refine-idea/SKILL.md'), FD('strike.md')],
    brief: 'V1 FAILURE: the agent kept wanting to SKIP refine/grill — asked the user no questions, barreled ahead. (Less critical in v2 since the user now runs the front door manually one at a time, but it must still actually engage and not rubber-stamp.) Check v2: do refine-idea/grill-idea force real engagement (ask the consequential questions, never infer from silence)? Is there a path where the front door is skipped or thinly rubber-stamped (e.g. "just go")? Keep any hardening LEAN — do not add ceremony.' },
  { key: 'final-attestation', reads: [ST('s7-verify-main-spec.md'), ST('s6-verify-phase.md'), D('honest-verification.md')],
    brief: 'The user wants a FINAL SANITY/ATTESTATION gate that explicitly confirms the disciplines were ACTUALLY exercised — not merely "the spec is satisfied", but evidence-backed: "you explored the codebase and FOLLOWED our existing patterns; you WROTE your end-to-end tests and they PASS; you browser-verified in the RIGHT environment; you built in THIN VERTICAL SLICES." Check v2: does S7 (final gate) attest the DISCIPLINES were followed, or only spec-coverage? Design a concrete, evidence-backed final attestation gate (each claim backed by an artifact/citation, not self-assertion) and name the file it goes in. This is the capstone that catches an agent which skipped the disciplines but produced something that superficially "works".' },
  { key: 'no-silent-workarounds', reads: [D('honest-verification.md'), D('obstruction-loop.md'), ST('s4-build.md'), DESIGN],
    brief: 'META-PATTERN across V1 failures: EVERY failure was an EXCUSE used as an escape hatch — missing env var, "no data", tool auth failure, broken migration — each became a reason to SKIP the real work (browser test, E2E tests, following patterns) or to silently WORK AROUND the problem (switch to test DB, drop the tool) and claim success on a convenient substitute. Propose ONE cross-cutting v2 principle + mechanism: an obstacle (missing prereq, broken dependency, failing test, unavailable tool, missing data) must be EITHER fixed OR surfaced as a hard BLOCKER that fails the gate — NEVER silently skipped, routed around, or "verified elsewhere" to claim done. Where does this live and how is it enforced (a named honest-verification rule? a build-gate criterion? the obstruction loop)? Make it concrete, lean, and autonomous-safe.' },
]

phase('Analyze')
log('Analyzing v2 against ' + FMS.length + ' real V1 failure modes...')
const findings = (await parallel(FMS.map((fm) => () => {
  const reads = fm.reads.map((r) => '  - ' + r).join('\n')
  return agent('You are hardening the Strike v2 build workflow against a SPECIFIC real-world failure the previous version (V1) actually committed. Read the relevant v2 modules, then judge honestly whether v2 already prevents this failure and, where it does not, design concrete teeth.\n\nREAD THESE v2 FILES (and ' + DESIGN + ' for the contract):\n' + reads + '\n\n' + CONSTRAINTS + '\n\nTHE V1 FAILURE (key=' + fm.key + '):\n' + fm.brief + '\n\nBe brutally honest about "partial" coverage — V1 often HAD decent words and rationalized past them, so "the module mentions it" is NOT the same as "an agent cannot skip it." Favor enforcement an agent cannot talk its way out of: named gate criteria, mandatory deliverables, hard blockers, evidence requirements, separate-verifier checks. Return the structured finding with concrete hardening (exact file + the teeth to add).',
    { label: 'analyze:' + fm.key, phase: 'Analyze', schema: FINDING })
}))).filter(Boolean)
log('Collected ' + findings.length + ' findings. Synthesizing the hardening plan...')

phase('Synthesize')
const PLAN = { type: 'object', required: ['principle', 'edits'], properties: {
  principle: { type: 'string', description: 'the single cross-cutting principle that ties the failures together, stated crisply' },
  edits: { type: 'array', items: { type: 'object', required: ['file', 'severity', 'change', 'why'], properties: {
    file: { type: 'string' }, severity: { type: 'string', description: 'P0|P1|P2' },
    change: { type: 'string', description: 'the concrete change — a named gate criterion / mandatory step / blocker rule, with the gist of the exact wording to add' },
    why: { type: 'string', description: 'which V1 failure(s) it closes' } } } },
  newModules: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, purpose: { type: 'string' } } } },
  finalAttestation: { type: 'string', description: 'the concrete final-attestation gate design (claims + their required evidence) and where it lives' },
  openQuestions: { type: 'array', items: { type: 'string' } },
} }
const findingsJson = JSON.stringify(findings).slice(0, 90000)
const plan = await agent('Synthesize these failure-mode analyses into ONE concrete, ordered hardening plan for Strike v2. Deduplicate overlapping hardening (several failures share the no-silent-workarounds spine and the verify-in-the-right-environment / write-real-E2E-tests teeth). Each edit must name an exact file and concrete teeth (named gate criterion, mandatory deliverable, hard-blocker rule, or evidence requirement) — wording an agent cannot rationalize past, kept lean. Order by severity. Include the final-attestation gate design and the single cross-cutting principle. Respect the autonomous constraint (front-load in grill OR surface-as-blocker; never "ask mid-run").\n\nFINDINGS (json):\n' + findingsJson,
  { label: 'synthesize-plan', phase: 'Synthesize', schema: PLAN })
log('Plan: ' + (plan.edits || []).length + ' edits across ' + new Set((plan.edits || []).map((e) => e.file)).size + ' files. Critiquing...')

phase('Critique')
const CRITIQUE = { type: 'object', required: ['verdict', 'issues'], properties: {
  verdict: { type: 'string', description: 'solid | needs-revision' },
  closesAllFailures: { type: 'boolean' },
  issues: { type: 'array', items: { type: 'object', properties: { about: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } } } },
  overEngineering: { type: 'array', items: { type: 'string' }, description: 'ceremony that violates the lean principle or that agents will skim' },
  gapsRemaining: { type: 'array', items: { type: 'string' }, description: 'any of the 8 failures the plan does NOT actually close' },
} }
const critique = await agent('You are an adversarial critic of this Strike v2 hardening plan. Pressure-test it on three axes: (1) DOES IT ACTUALLY CLOSE each of the 8 V1 failures, or does it just add words an agent will rationalize past like V1 did? (2) Is any of it OVER-ENGINEERED — ceremony-on-everything that trains agents to skim the very checklists that guard the real work (the failure the whole design fights)? (3) Is it AUTONOMOUS-SAFE — no edit assumes the build can ask the user mid-run; "needs a human decision/credential" is front-loaded in grill or surfaced as a hard blocker, never a mid-run prompt? Also check it does not contradict the existing contract (' + DESIGN + ').\n\n' + CONSTRAINTS + '\n\nPLAN (json):\n' + JSON.stringify(plan).slice(0, 40000) + '\n\nReturn a verdict, concrete issues with fixes, any over-engineering to cut, and any of the 8 failures still not closed.',
  { label: 'critique', phase: 'Critique', schema: CRITIQUE })

return { findings, plan, critique }
