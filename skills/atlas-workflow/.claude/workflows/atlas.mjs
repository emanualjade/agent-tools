export const meta = {
  name: 'atlas',
  description: 'Atlas v2 build engine: risk-routed FAST/FULL lanes, self-correcting architectural-obstruction loop with real upstream re-entry, surface-triggered guardrails, honest verification. Refine+grill happen with you first; this runs everything after.',
  whenToUse: 'After you and Claude refine + grill a feature idea. Pass the refined idea + decisions as args; this drives spec -> phases -> slices -> build -> verify to a shipped, verified feature.',
  phases: [
    { title: 'Bootstrap', detail: 'ensure workspace + objective artifact' },
    { title: 'S0 Spec+Phases', detail: 'merged main-spec + vertical phase map' },
    { title: 'Build phases', detail: 'per phase: S1 slices -> per-slice FAST/FULL lane -> S6 verify-phase' },
    { title: 'S7 Verify initiative', detail: 'final gate (folded into S6 when single-phase)' },
  ],
}

/*
 * ATLAS v2 — optimized build engine. Conforms to atlas-engine/DESIGN.md.
 *
 * Replaces v1's uniform 5-step-per-slice toll with risk-routed lanes, adds a real
 * architectural-obstruction loop (Tier 1/2/3 with upstream re-entry the engine actually
 * executes), surface-triggered guardrails via the modality registry, and an honest
 * verification ladder. The engine orchestrates at agent-call granularity; per-tool-call
 * mechanical enforcement is the OPTIONAL hooks layer (read if its stall-signal file exists).
 *
 * Seam unchanged: refine + grill happen in chat; this starts at S0 with args = the refined
 * idea + decisions. Hands-off: a consequential question becomes a recorded assumption; only
 * genuine blockers stop. Every loop is bounded; on exhaustion the run degrades gracefully.
 */

// ---------------------------------------------------------------------------
// Config + inputs
// ---------------------------------------------------------------------------
const a = args || {}
const cfg = {
  rootDir: a.rootDir || '/Users/cracklehat/Sites/workflow-exploration/atlas-engine',
  maxFixAttempts: a.maxFixAttempts ?? 3,
  maxRouteBacks: a.maxRouteBacks ?? 4,        // per slice
  maxSplitsPerPhase: a.maxSplitsPerPhase ?? 6,
  maxUpstreamRouteBacks: a.maxUpstreamRouteBacks ?? 2, // per initiative (S0 re-entry)
  maxPhaseReentries: a.maxPhaseReentries ?? 2,         // per-phase re-run on an S1-S4 route-back
  maxSlices: a.maxSlices ?? 40,               // initiative ceiling
  maxAgentCalls: a.maxAgentCalls ?? 400,      // initiative ceiling
}
const STEP_FILE = {
  S0: 's0-spec-and-phases.md', S1: 's1-phasespec-and-slices.md', S2: 's2-plan.md',
  S3: 's3-verify-plan.md', S4: 's4-build.md', S5: 's5-verify-build.md',
  S6: 's6-verify-phase.md', S7: 's7-verify-main-spec.md', fix: 'fix.md',
  S2S4: 's2s4-fast-plan-build.md', // merged FAST-lane plan+build (one round-trip)
}

const initiative = {
  id: a.initiativeId || 'initiative',
  name: a.initiativeName || a.initiativeId || 'Initiative',
  idea: a.idea || '',
  decisions: a.decisions || '',
  constraints: a.constraints || '',
  repoContext: a.repoContext || '',
}
if (!initiative.idea) log('⚠ No `idea` in args — v2 expects a refined idea + decisions from a prior refine/grill session. Proceeding, spec will be thin.')

// ---------------------------------------------------------------------------
// Canonical artifact paths (written into cwd = the target repo)
// ---------------------------------------------------------------------------
const P = {
  initDir: () => `atlas/initiatives/${initiative.id}`,
  mainSpec: () => `${P.initDir()}/main-spec.md`,
  devPlan: () => `${P.initDir()}/development-plan.md`,
  objective: () => `${P.initDir()}/acceptance-criteria.md`, // the durable external objective
  finalVerification: () => `${P.initDir()}/verification.md`,
  adrDir: () => `${P.initDir()}/adr`,
  phaseDir: (pid) => `${P.initDir()}/phases/${pid}`,
  phaseSpec: (pid) => `${P.phaseDir(pid)}/phase-spec.md`,
  phaseVerification: (pid) => `${P.phaseDir(pid)}/verification.md`,
  sliceDir: (pid, sid) => `${P.phaseDir(pid)}/slices/${sid}`,
  slice: (pid, sid) => `${P.sliceDir(pid, sid)}/slice.md`,
  plan: (pid, sid) => `${P.sliceDir(pid, sid)}/plan.md`,
  planVerification: (pid, sid) => `${P.sliceDir(pid, sid)}/plan-verification.md`,
  build: (pid, sid) => `${P.sliceDir(pid, sid)}/build.md`,
  buildVerification: (pid, sid) => `${P.sliceDir(pid, sid)}/build-verification.md`,
}

// ---------------------------------------------------------------------------
// Run report
// ---------------------------------------------------------------------------
const report = {
  initiative: initiative.id, ready: false,
  phases: [], assumptions: [], blockers: [], routeBacks: [], obstructions: [],
  adrs: [], changedFiles: [], orphanedFiles: [], agentCalls: 0, slicesProcessed: 0,
}
let stopped = false
const note = (arr, o) => arr.push(o)
// report.ready must NEVER be true while the engine has recorded a verification-gap blocker (an orphaned inline
// build, or a kept-build path that skipped its owed S3/S5). Keys off the exact reason phrases the guards emit.
const hasVerificationGapBlocker = () => report.orphanedFiles.length > 0 ||
  report.blockers.some((b) => /orphaned|NOT (S5-)?verified|NOT plan-verified|plan-verify never (ran|run)/.test(b.reason || ''))
const absorb = (where, r) => {
  if (!r) return
  for (const x of r.assumptions || []) note(report.assumptions, { where, note: x })
  for (const x of r.blockers || []) note(report.blockers, { where, reason: x })
  for (const f of r.changedFiles || []) if (!report.changedFiles.includes(f)) report.changedFiles.push(f)
  if (r.obstruction) note(report.obstructions, { where, ...summarizeObstruction(r.obstruction) })
  if (r.obstruction && r.obstruction.adrPath) note(report.adrs, { where, path: r.obstruction.adrPath, reversibility: r.obstruction.reversibility })
}
const summarizeObstruction = (o) => ({ tier: o.tier, blastRadius: o.blastRadius, reversibility: o.reversibility, description: o.description })
const logRouteBack = (from, rb) => {
  note(report.routeBacks, { from, targetStep: rb.targetStep, phase: rb.phaseId, slice: rb.sliceId, check: rb.check, reason: rb.reason })
  log(`↩ route-back from ${from} → re-enter ${rb.targetStep} (${rb.reason || rb.check || ''})`)
}

// ---------------------------------------------------------------------------
// Schemas (the shared envelope + per-step extras; DESIGN section 3)
// ---------------------------------------------------------------------------
const STR = { type: 'array', items: { type: 'string' } }
const OBSTRUCTION = { type: ['object', 'null'], properties: {
  tier: { type: 'number', description: '1|2|3' },
  blastRadius: { type: 'string' }, reversibility: { type: 'string', description: 'two-way|one-way|unknown' },
  description: { type: 'string' }, candidates: STR, reversibleInterim: { type: 'string' },
  enablingSlices: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } } },
  adrPath: { type: ['string', 'null'] },
} }
const ROUTEBACK = { type: ['object', 'null'], properties: {
  targetStep: { type: 'string', description: 'S0|S1|S2|S3|S4' },
  phaseId: { type: ['string', 'null'] }, sliceId: { type: ['string', 'null'] },
  check: { type: 'string' }, reason: { type: 'string' },
} }
const ENVELOPE = {
  verdict: { type: 'string', description: 'PASS|FAIL|BLOCKED' },
  failedCriterion: { type: ['string', 'null'] },
  artifactPath: { type: 'string' },
  assumptions: STR, blockers: STR, changedFiles: STR, surfaces: STR,
  obstruction: OBSTRUCTION, routeBack: ROUTEBACK,
}
const mk = (extra, required) => ({ type: 'object', required: required || ['verdict'], properties: { ...ENVELOPE, ...extra } })

const SCHEMA_S0 = mk({ phases: { type: 'array', items: { type: 'object', required: ['id', 'name'], properties: {
  id: { type: 'string' }, name: { type: 'string' }, outcome: { type: 'string' }, size: { type: 'string' }, riskHint: { type: 'string' } } } } }, ['verdict', 'phases'])
const SCHEMA_S1 = mk({ slices: { type: 'array', items: { type: 'object', required: ['id', 'name', 'lane', 'size'], properties: {
  id: { type: 'string' }, name: { type: 'string' }, size: { type: 'string' },
  riskTier: { type: 'string', description: 'TRIVIAL|STANDARD|CRITICAL' }, surfaces: STR,
  lane: { type: 'string', description: 'FAST|FULL' } } } } }, ['verdict', 'slices'])
const SCHEMA_S2 = mk({ readyToVerify: { type: 'boolean' }, readyToBuild: { type: 'boolean' },
  splitNeeded: { type: 'boolean' }, replacementSlices: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, lane: { type: 'string' } } } },
  lane: { type: 'string' }, riskTier: { type: 'string' } })
const SCHEMA_S4 = mk({ built: { type: 'boolean' },
  riskTier: { type: 'string', description: 'TRIVIAL|STANDARD|CRITICAL — present iff raised at build time' },
  splitNeeded: { type: 'boolean' },
  replacementSlices: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, lane: { type: 'string' } } } } }, ['verdict', 'built'])
// Merged FAST-lane plan+build: S2's planning fields + S4's `built` (false ⇒ stopped at the plan because
// the slice is CRITICAL, so the engine routes it to the FULL lane: S3 plan-verify → S4 → S5).
const SCHEMA_S2S4 = mk({ readyToVerify: { type: 'boolean' }, readyToBuild: { type: 'boolean' },
  splitNeeded: { type: 'boolean' }, replacementSlices: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, lane: { type: 'string' } } } },
  lane: { type: 'string' }, riskTier: { type: 'string' },
  size: { type: 'string', description: 'concrete size after read-before-write (XS|S|M|L|XL); ≥M ⇒ CRITICAL — stop at the plan, do not build inline' },
  built: { type: 'boolean', description: 'true iff this FAST slice was built inline; false ⇒ stopped at the plan (CRITICAL → route to FULL)' } }, ['verdict', 'built'])
const SCHEMA_VERDICT = mk({ fixNeeded: { type: 'boolean' },
  riskTier: { type: 'string', description: 'TRIVIAL|STANDARD|CRITICAL — present iff S5 promoted the slice late (a domain surface that surfaced only at build/verify time)' },
  failedCriteria: { type: 'array', items: { type: 'string' }, description: 'every still-FAILing named criterion this attempt (progress is measured on this set)' } })
const SCHEMA_FIX = { type: 'object', required: ['fixed'], properties: {
  fixed: { type: 'boolean' }, artifactPath: { type: 'string' }, changedFiles: STR,
  assumptions: STR, remaining: STR, routeBack: ROUTEBACK, reason: { type: 'string' },
  obstruction: OBSTRUCTION, blockers: STR } }
const SCHEMA_LIST = { type: 'object', required: ['sliceIds'], properties: { sliceIds: STR } }
const SCHEMA_OK = { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' }, notes: STR } }

// ---------------------------------------------------------------------------
// Step runner (one subagent per step, follows the vendored steps/<file>.md)
// ---------------------------------------------------------------------------
const HANDS_OFF = `
AUTONOMOUS RUN — no human is available mid-run.
- A "consequential question" the skill would ask the user becomes a clearly-stated ASSUMPTION you
  record in "assumptions" and proceed on. Only stop for a genuinely unrepairable blocker (in "blockers").
- Subagent fan-out is unavailable here: run any required review lenses INLINE as read-only passes.
- The acceptance criteria live at ${P.objective()} — treat them as the external objective; re-read
  them verbatim, never reassess against this prompt's history.
- If ${P.initDir()}/.stall-signal.json exists (optional hooks layer), read it and treat its signal as
  a hard instruction to step back / revert-and-reset rather than push the same approach.
- Write artifacts to the EXACT paths named; return a structured result whose envelope fields
  (verdict PASS/FAIL/BLOCKED, failedCriterion, obstruction, routeBack, surfaces) faithfully reflect
  reality. The verdict IS the gate; never report PASS without meeting the named gate.`

function budgetOk(where) {
  if (report.agentCalls >= cfg.maxAgentCalls) {
    if (!stopped) { note(report.blockers, { where, reason: `initiative agent-call ceiling (${cfg.maxAgentCalls}) reached — degrading gracefully` }); log('⛔ agent-call ceiling reached; stopping new work'); }
    stopped = true
    return false
  }
  return true
}

async function runStep({ step, label, phaseGroup, schema, task }) {
  if (!budgetOk(label)) return null
  report.agentCalls++
  const prompt = `You are executing Atlas v2 step "${step}" for initiative "${initiative.id}" (${initiative.name}).

YOUR INSTRUCTION SET — read and follow EXACTLY:
  ${cfg.rootDir}/steps/${STEP_FILE[step]}
It composes discipline + surface modules under ${cfg.rootDir}/disciplines and ${cfg.rootDir}/surfaces;
read the ones it references. Those files are authoritative.

INITIATIVE CONTEXT (from a prior refine + grill done with the user):
  Idea / outcome: ${initiative.idea || '(none)'}
  Decisions / accepted assumptions / rejected paths: ${initiative.decisions || '(none)'}
  Constraints: ${initiative.constraints || '(none)'}
  Repo context: ${initiative.repoContext || '(infer from the working directory)'}

TASK:
${task}
${HANDS_OFF}`
  return agent(prompt, { label, phase: phaseGroup, schema })
}

const passed = (r) => r && r.verdict === 'PASS'

// ---------------------------------------------------------------------------
// Verify + fix loop (with revert-and-reset on zero-progress)
// ---------------------------------------------------------------------------
async function verifyWithFix({ step, label, phaseGroup, verifyTask, fixScope, resetTask }) {
  let last = null
  let lastFailedSet = null
  for (let attempt = 1; attempt <= cfg.maxFixAttempts + 1; attempt++) {
    const v = await runStep({ step, label: `${label} · verify#${attempt}`, phaseGroup, schema: SCHEMA_VERDICT, task: verifyTask })
    if (!v) return { status: 'blocked' }
    last = v; absorb(step, v)
    if (v.verdict === 'PASS') return { status: 'passed', verdict: v }
    if (v.routeBack) return { status: 'routeback', routeBack: v.routeBack, verdict: v }
    if (v.verdict === 'BLOCKED' || !v.fixNeeded) {
      note(report.blockers, { where: label, reason: v.failedCriterion || 'verification failed, no repairable fix path' })
      return { status: 'blocked', verdict: v }
    }
    // zero-progress (Channel B): NO previously-failing criterion moved FAIL→PASS. Measured on the failing
    // criteria SET so a target-perturbing agent can't dodge it by surfacing a different single criterion.
    const failedSet = (v.failedCriteria && v.failedCriteria.length) ? v.failedCriteria : (v.failedCriterion ? [v.failedCriterion] : [])
    const noProgress = lastFailedSet && lastFailedSet.length > 0 && lastFailedSet.every((c) => failedSet.includes(c))
    lastFailedSet = failedSet
    if (noProgress && resetTask && attempt >= 2) {
      const headline = v.failedCriterion || failedSet.join('; ')
      // revert-and-reset rather than continue-and-correct: fresh build carrying only the distilled lesson
      log(`↺ ${label}: zero progress on "${headline}" → revert-and-reset (different approach)`)
      const reset = await runStep({ step: 'S4', label: `${label} · reset`, phaseGroup, schema: SCHEMA_S4, task: resetTask(headline) })
      absorb('S4-reset', reset)
      if (!reset || !reset.built) { note(report.blockers, { where: label, reason: `revert-and-reset did not recover from "${headline}"` }); return { status: 'blocked' } }
      // a reset that surfaced new architecture (obstruction / route-back / split / promotion) must be
      // routed, not silently re-verified — hand it back to the slice driver to re-plan/re-route.
      if (reset.obstruction || reset.routeBack || reset.splitNeeded || reset.riskTier === 'CRITICAL') return { status: 'reset-route', reset }
      continue // re-verify the reset build
    }
    const fx = await runStep({ step: 'fix', label: `${label} · fix#${attempt}`, phaseGroup, schema: SCHEMA_FIX,
      task: `Repair the failed verification. Failed artifact: ${v.artifactPath}. Scope: ${fixScope}. Failing criterion: ${v.failedCriterion || '(see artifact)'}.\nFix only the Must-Fix items; the engine re-runs "${step}" after. If an earlier step owns the repair, set routeBack.` })
    if (!fx) return { status: 'blocked', verdict: v }
    absorb('fix', fx)
    if (fx.routeBack) return { status: 'routeback', routeBack: fx.routeBack, verdict: v }
    if (!fx.fixed) { note(report.blockers, { where: `fix:${label}`, reason: fx.reason || 'fix could not complete' }); return { status: 'blocked', verdict: v } }
  }
  note(report.blockers, { where: label, reason: `did not pass after ${cfg.maxFixAttempts} fix attempts` })
  return { status: 'blocked', verdict: last }
}

// ---------------------------------------------------------------------------
// Obstruction handling — Tier 1 (agent-internal), Tier 2 (enabling slice),
// Tier 3 (ADR + reversible interim + upstream re-entry). Returns an action.
// ---------------------------------------------------------------------------
// Engine-side conservative corroboration (DESIGN §1.9/§7, obstruction-loop §3-4): unknown/absent
// reversibility, or any one-way-by-rule surface, forces Tier 3 regardless of the agent's declared tier —
// so an under-declared one-way door can't slip through as a Tier-2 enabling split. The engine has no diff
// access, so this uses the declared structured fields only.
const ONE_WAY_SURFACES = ['money', 'migration', 'auth', 'security', 'external-effect', 'idempotency', 'pii', 'payment', 'crypto', 'destructive']
// DOMAIN_SURFACES — the FULL risk-tiering CRITICAL net (disciplines/risk-tiering.md §2 / DESIGN §4), a SUPERSET
// of the one-way-door list. It ALSO catches the DURABLE-SHAPE persistence family ('schema'/'datastore'/'backfill'
// — 'migration' is already above) so a real schema change / new store / backfilling migration that a merged FAST
// agent under-tiers as STANDARD+size:S still promotes to FULL (S3 plan-verify before any kept build). Bare
// 'persistence'/'storage' are DELIBERATELY EXCLUDED: the local-persistence down-tier (risk-tiering §2/§4) keeps
// single-user/on-device/additive-only CRUD on FAST, and a blanket persistence match would re-introduce the
// "all 6 slices CRITICAL" dogfood regression. Used ONLY by criticalSignal's surface arm; corroborate()'s
// one-way-door tiering stays on the narrower ONE_WAY_SURFACES. This cross-check can only promote, never lower.
const DOMAIN_SURFACES = ONE_WAY_SURFACES.concat(['schema', 'datastore', 'backfill'])
// size ≥ M ⇒ CRITICAL (risk-tiering §size). Engine-owned so a merged FAST agent can't build a big slice
// inline by self-reporting riskTier:STANDARD. Matches single-letter (M/L/XL) and word forms; XS/S/small excluded.
const sizeAtLeastM = (sz) => { const s = String(sz || '').trim().toLowerCase(); return s === 'm' || s === 'l' || s === 'xl' || s.startsWith('med') || s.startsWith('lar') || s.startsWith('xl') }
function corroborate(r, sid) {
  const o = r.obstruction
  if (!o) return
  const surf = [].concat(o.surfaces || [], r.surfaces || []).map((s) => String(s).toLowerCase())
  const oneWay = o.reversibility == null || o.reversibility === 'unknown' || o.reversibility === 'one-way' ||
    surf.some((s) => ONE_WAY_SURFACES.some((k) => s.includes(k)))
  if (oneWay && o.tier !== 3) {
    note(report.obstructions, { where: `${sid}:corroboration`, forcedTier3: true, was: o.tier, reversibility: o.reversibility || 'unknown' })
    log(`⚠ ${sid}: obstruction reclassified up to Tier 3 (reversibility=${o.reversibility || 'unknown'})`)
    o.tier = 3
    // If the agent didn't escalate, re-plan as Tier 3 (ADR + reversible interim) rather than proceed.
    if (!r.routeBack) r.routeBack = { targetStep: 'S2', sliceId: sid, check: 'one-way-obstruction', reason: 'engine reclassified to Tier 3; re-plan with ADR + reversible interim (+ upstream routeBack if owed)' }
  }
}

// Route splits + obstruction tiers uniformly for S2 and S4 (DESIGN §6/§7). Tier 2 enabling = prepend +
// KEEP current; pure split (too broad) = REPLACE current; Tier 3 upstream (S0/S1) = escalate; Tier 3
// slice-level (S2/S3) = reroute (re-run this slice). Tier 1 = agent-resolved in-footprint (no engine action).
function routeSplitOrObstruction(r, sid, slice) {
  corroborate(r, sid)
  const tier = r.obstruction && r.obstruction.tier
  const repl = (r.replacementSlices && r.replacementSlices.length) ? r.replacementSlices
    : (r.obstruction && r.obstruction.enablingSlices && r.obstruction.enablingSlices.length) ? r.obstruction.enablingSlices : []
  if (tier === 3 && r.routeBack) {
    const t = r.routeBack.targetStep
    return (t === 'S2' || t === 'S3') ? { result: 'reroute', routeBack: r.routeBack } : { result: 'escalate', routeBack: r.routeBack }
  }
  if (tier === 2 && repl.length) { log(`⛓ ${sid} Tier-2 enabling slice → prepend ${repl.length} (keep current)`); return { result: 'enabling', slices: repl, current: slice } }
  if (r.splitNeeded && repl.length) { log(`✂ ${sid} too broad → split into ${repl.length}`); return { result: 'split', slices: repl } }
  return null
}

// ---------------------------------------------------------------------------
// Slice driver — FAST: S2 → S4 → S5 ; FULL: S2 → S3 → S4 → S5
// Returns: {result:'passed'|'blocked'} | {result:'split'|'enabling', slices} | {result:'escalate', routeBack}
// ---------------------------------------------------------------------------
async function runSlice(ph, slice, routeBacks = 0) {
  const pid = ph.id, sid = slice.id
  const group = `Build ${pid}`
  const ctx = `Phase ${pid} (${ph.name}). Slice ${sid} (${slice.name}). Risk tier: ${slice.riskTier || 'unset'}. Lane: ${slice.lane || 'FAST'}. Declared surfaces: ${(slice.surfaces || []).join(', ') || 'none'}.`
  if (routeBacks === 0) report.slicesProcessed++ // count DISTINCT slices vs the maxSlices ceiling; same-slice re-entries (reenter passes routeBacks+1) are already bounded by maxRouteBacks
  // Birth-time CRITICAL is engine-trusted and BINDING (DESIGN §4: CRITICAL ⇒ FULL lane; tier is raise-only, never
  // lowered). An S1 slice that declares riskTier:CRITICAL but (inconsistently) lane:FAST must NOT take the FAST
  // merged step — flip it to FULL here so a born-CRITICAL slice always gets S2→S3 plan-verify→S4→S5, even if S1's
  // own lane-correct gate slipped. String().toUpperCase() also folds a non-canonical 'full' the strict === missed.
  if (String(slice.riskTier).toUpperCase() === 'CRITICAL') slice.lane = 'FULL'
  let lane = String(slice.lane).toUpperCase() === 'FULL' ? 'FULL' : 'FAST'
  // Re-enter this slice with the per-slice budget threaded (so maxRouteBacks actually bounds it).
  const reenter = (where, rb) => { if (routeBacks < cfg.maxRouteBacks) { logRouteBack(where, rb); return runSlice(ph, slice, routeBacks + 1) } return null }

  // S2 (FULL) or MERGED S2+S4 (FAST). On the FAST lane one agent plans then builds inline in a single
  // round-trip — UNLESS planning reveals a CRITICAL surface, in which case it STOPS at the plan
  // (built:false) and the slice promotes to the FULL lane so it still gets S3 plan-verify before any
  // build. Either way the separate S5 verifier independently checks the result (strong model throughout).
  const fast = lane === 'FAST'
  const plan = await runStep({ step: fast ? 'S2S4' : 'S2', label: `${sid} · ${fast ? 'plan+build' : 'plan'}`, phaseGroup: group, schema: fast ? SCHEMA_S2S4 : SCHEMA_S2,
    task: fast
      ? `${ctx}\nMERGED FAST-lane plan+build (one pass — saves a round-trip; the separate S5 verifier still independently checks what you build). Read the slice stub ${P.slice(pid, sid)} and phase spec ${P.phaseSpec(pid)}. Run read-before-write, PLAN the slice, write ${P.plan(pid, sid)}. IF planning reveals this slice is CRITICAL (a domain surface fires, or size ≥ M), STOP at the plan: set riskTier:"CRITICAL", built:false, readyToVerify:true, and return — do NOT build a CRITICAL slice here (the engine routes you to the FULL lane: plan-verify before build). OTHERWISE (genuinely FAST: STANDARD/TRIVIAL, no domain surface) continue straight into BUILDING it: make the code changes, write ${P.build(pid, sid)}, set built:true. Decide any SPLIT or ENABLING slice from the PLAN, BEFORE writing code (like the CRITICAL stop): if the slice must split, set splitNeeded:true / replacementSlices, built:false, and return WITHOUT writing code — don't leave orphaned inline changes for the engine (which can't revert them). Write each replacement's slice.md stub.`
      : `${ctx}\nRead the slice stub ${P.slice(pid, sid)} and phase spec ${P.phaseSpec(pid)}. Run read-before-write first. Write the plan to ${P.plan(pid, sid)}. If you SPLIT or emit an ENABLING slice, write a slice.md stub for EACH replacement slice (under its slices/<id>/ dir) before returning.` })
  if (!plan) return { result: 'blocked' }
  // Absorb assumptions/blockers/obstructions now, but on the FAST lane DEFER the merged result's changedFiles
  // until the slice is committed to being KEPT (past both discard guards below) — otherwise a pass that gets
  // discarded (promoted to FULL, or wrote-and-route) would leave its orphaned, un-S5-verified paths in the
  // global report.changedFiles ledger, indistinguishable from verified ones. Re-added on the kept builtInline path.
  absorb(fast ? 'S2S4' : 'S2', fast ? { ...plan, changedFiles: [] } : plan)
  // ENGINE-OWNED CRITICAL guard (never trust the agent to not-build a CRITICAL slice). A FAST slice that
  // reaches CRITICAL — by declared riskTier/lane OR a one-way-by-rule surface the merged step fired — must
  // be re-done on the FULL lane: persist the promotion onto the slice (so any re-entry recomputes FULL),
  // DISCARD whatever the merged FAST step planned/built, and re-enter → standalone S2 (fresh FULL-grade
  // plan) → S3 plan-verify → S4 → S5 at ≥R3. This holds the hard invariant for every CRITICAL signal the
  // engine can SEE — the S1 birth-time slice.riskTier / slice.size / slice.surfaces (all engine-trusted) sit
  // alongside the build-time plan.riskTier / plan.size / plan.surfaces, so a born-CRITICAL, big, or one-way-
  // surface slice can't sail past by self-reporting riskTier:STANDARD with an idiosyncratic label. A surface
  // that is invisible to BOTH S1 and this structured cross-check (a late-surfacing domain effect) is caught
  // downstream by S5 at raised rigor and the S5 late-CRITICAL re-route below — not here.
  const criticalSignal = String(slice.riskTier).toUpperCase() === 'CRITICAL' ||
    plan.riskTier === 'CRITICAL' || String(plan.lane).toUpperCase() === 'FULL' ||
    sizeAtLeastM(plan.size) || sizeAtLeastM(slice.size) ||
    [].concat(plan.surfaces || [], slice.surfaces || []).some((s) => DOMAIN_SURFACES.some((k) => String(s).toLowerCase().includes(k)))
  const wroteCodeRaw = fast && [].concat(plan.changedFiles || []).length > 0 // raw self-report: did the merged FAST step write code before any guard fired?
  const recordOrphans = () => { for (const f of [].concat(plan.changedFiles || [])) if (!report.orphanedFiles.includes(f)) report.orphanedFiles.push(f) }
  if (fast && criticalSignal) {
    slice.riskTier = 'CRITICAL'; slice.lane = 'FULL'
    // A CRITICAL stop must write NO code (step file: report changedFiles:[]). If the agent wrote code then
    // stopped, those files are orphaned — the FULL rebuild only overwrites what it re-touches, so a stray file
    // would ship un-S5-verified. The engine has no fs to revert; surface it as a blocker + audit entry, not silently.
    if (wroteCodeRaw) { recordOrphans(); note(report.blockers, { where: sid, reason: `merged FAST wrote inline code then stopped at CRITICAL — those files are orphaned (engine has no fs to revert); the FULL rebuild only overwrites what it re-touches, any stray file is NOT S5-verified. orphaned: ${[].concat(plan.changedFiles || []).join(', ')}` }) }
    const re = reenter(`${sid}:fast→full (CRITICAL)`, { targetStep: 'S2', sliceId: sid, check: 'fast-critical', reason: wroteCodeRaw ? 'FAST lane reached CRITICAL after writing inline code (orphaned) — re-do on FULL (S3 plan-verify before any kept build, ≥R3)' : 'FAST lane reached CRITICAL — re-do on FULL (S3 plan-verify before any kept build, ≥R3)' })
    if (re) return await re
    note(report.blockers, { where: sid, reason: 'FAST slice reached CRITICAL but re-route budget exhausted — FULL-lane S3 plan-verify never ran; any on-disk changes are NOT plan-verified' }); return { result: 'blocked' }
  }
  if (plan.riskTier === 'CRITICAL' || String(plan.lane).toUpperCase() === 'FULL') lane = 'FULL' // FULL-born: sync local lane (slice already CRITICAL/FULL)
  // Only the FAST lane ever builds inline. On a FULL-born slice (fast=false) `built` is ignored even if a
  // misbehaving S2 agent emits it (SCHEMA_S2 declares no `built`), so S3 plan-verify + S4 always run on FULL.
  const builtInline = fast && plan.built === true
  // ENGINE-OWNED wrote-code + route guard (never trust the agent's `built` flag, and never let inline code
  // escape S5 via a routing short-circuit). A FAST result that wrote ANY inline code — built:true OR a
  // non-empty changedFiles even when it self-reports built:false (ES-3) — must NOT also carry a routing
  // signal: a split (with OR without replacementSlices, CFT-2) or an obstruction of ANY tier (CFT-1:
  // corroborate() can promote a raw tier-1 to tier-3 and `escalate`/`reroute` BEFORE the S5 block, orphaning
  // the inline build the engine has no fs to revert). Mirror the CRITICAL discard: drop the unverified inline
  // build and re-plan so routing is decided BEFORE any code is written. Read the RAW self-reported fields here,
  // BEFORE routeSplitOrObstruction's corroborate() mutates obstruction.tier.
  const wantsRoute = plan.splitNeeded === true || plan.obstruction != null
  if ((builtInline || wroteCodeRaw) && wantsRoute) {
    const re = reenter(`${sid}:fast-wrote-and-route`, { targetStep: 'S2', sliceId: sid, check: 'wrote-and-route', reason: 'merged FAST wrote inline code (built or non-empty changedFiles) AND signaled split/obstruction — discard the unverified inline build and re-plan (decide routing BEFORE writing code)' })
    if (re) return await re
    if (wroteCodeRaw) recordOrphans()
    note(report.blockers, { where: sid, reason: 'FAST slice wrote inline code but also signaled split/obstruction; re-plan budget exhausted — on-disk inline changes are NOT S5-verified' }); return { result: 'blocked' }
  }
  const s2r = routeSplitOrObstruction(plan, sid, slice)
  if (s2r) {
    if (s2r.result === 'reroute') { const re = reenter(`${sid}:S2-obstruction`, s2r.routeBack); if (re) return await re; note(report.blockers, { where: sid, reason: 'obstruction reroute budget exhausted' }); return { result: 'blocked' } }
    return s2r
  }
  if (plan.verdict !== 'PASS') { note(report.blockers, { where: `${sid}:${fast ? 'plan+build' : 'plan'}`, reason: plan.failedCriterion || 'plan not ready' }); return { result: 'blocked' } }

  // S3 — verify plan (FULL lane only; a merged FAST slice that already built has no pre-build plan to verify)
  if (lane === 'FULL' && !builtInline) {
    const v = await verifyWithFix({ step: 'S3', label: `${sid} plan`, phaseGroup: group, fixScope: `slice ${sid} plan/research`,
      verifyTask: `${ctx}\nVerify the plan. Read ${P.slice(pid, sid)}, ${P.plan(pid, sid)}, ${P.phaseSpec(pid)}. Write ${P.planVerification(pid, sid)}.` })
    if (v.status === 'blocked') return { result: 'blocked' }
    if (v.status === 'routeback') {
      if (v.routeBack.targetStep === 'S2') { const re = reenter(`${sid}:verify-plan`, v.routeBack); if (re) return await re }
      return { result: 'escalate', routeBack: v.routeBack }
    }
  }

  // S4 — build. On the FAST lane the merged step above already built (its obstruction/split/promotion
  // were handled at the S2 routing point); otherwise (FULL lane, or a promoted FAST slice) build now.
  let build
  if (builtInline) {
    build = plan // merged FAST plan+build already produced the build artifact; S5 still verifies it
    // KEPT path: now fold the merged FAST changedFiles into the ledger (deferred at the absorb above), using
    // absorb's exact dedup. Reached only when the slice was not discarded by either guard, so these are real.
    for (const f of plan.changedFiles || []) if (!report.changedFiles.includes(f)) report.changedFiles.push(f)
    // A merged built result can still carry a bare route-back (the builder realized mid-build it must
    // re-plan) with no obstruction object — routeSplitOrObstruction won't catch that. Honor it like S4 does.
    // S2/S3 re-enter this slice (build overwritten before S5); S0/S1 hand the spec/phase-level signal upstream
    // to runPhase→runInitiative (re-entry re-grounds/overwrites the build) rather than dropping it silently.
    const rbT = plan.routeBack && plan.routeBack.targetStep
    if (rbT === 'S2' || rbT === 'S3') {
      const re = reenter(`${sid}:fast-build-routeback`, plan.routeBack); if (re) return await re
      note(report.blockers, { where: sid, reason: 'merged FAST build route-back budget exhausted' }); return { result: 'blocked' }
    } else if (rbT === 'S0' || rbT === 'S1') {
      return { result: 'escalate', routeBack: plan.routeBack }
    }
  } else {
    build = await runStep({ step: 'S4', label: `${sid} · build`, phaseGroup: group, schema: SCHEMA_S4,
      task: `${ctx}\nImplement the verified plan ${P.plan(pid, sid)} (read it + ${P.planVerification(pid, sid)} if present). Read-before-write the footprint (incl. grep ARCH-DEBT). Make the code changes. Write ${P.build(pid, sid)}. ADRs go under ${P.adrDir()}/. If you split or emit an enabling slice, write each replacement's slice.md stub before returning.` })
    if (!build) return { result: 'blocked' }
    absorb('S4', build)
    const s4r = routeSplitOrObstruction(build, sid, slice)
    if (s4r) {
      if (s4r.result === 'reroute') { const re = reenter(`${sid}:S4-obstruction`, s4r.routeBack); if (re) return await re; note(report.blockers, { where: sid, reason: 'obstruction reroute budget exhausted' }); return { result: 'blocked' } }
      return s4r
    }
    // An S2/S3 route-back OR a build-time CRITICAL promotion re-routes the slice (regardless of built).
    const rbT = build.routeBack && build.routeBack.targetStep
    const promoted = build.riskTier === 'CRITICAL' && lane !== 'FULL'
    if (rbT === 'S2' || rbT === 'S3' || promoted) {
      if (promoted) { slice.riskTier = 'CRITICAL'; slice.lane = 'FULL'; lane = 'FULL' } // persist so the re-run takes the FULL lane
      const re = reenter(`${sid}:build`, build.routeBack || { targetStep: 'S2', sliceId: sid, check: 'promoted-to-critical', reason: 'promoted to CRITICAL at build → FULL lane' })
      if (re) return await re
      note(report.blockers, { where: sid, reason: promoted ? 'promoted-to-CRITICAL re-route budget exhausted (FULL-lane S3 plan-verify never run)' : 'build route-back budget exhausted' })
      return { result: 'blocked' }
    } else if (rbT === 'S0' || rbT === 'S1') {
      return { result: 'escalate', routeBack: build.routeBack } // spec/phase-level signal → hand upstream, don't drop
    }
    if (!build.built) { note(report.blockers, { where: `${sid}:build`, reason: build.failedCriterion || 'build reported not built' }); return { result: 'blocked' } }
  }

  // S5 — verify build (the universal gate; revert-and-reset on zero progress)
  const vb = await verifyWithFix({ step: 'S5', label: `${sid} build`, phaseGroup: group, fixScope: `slice ${sid} implementation + tests + evidence`,
    verifyTask: `${ctx}\nVerify the build does its ONE behavior through its real entry point with real data (per the modality registry), scaled to risk tier, and composes with prior slices. Run the tautology/test-tamper audit. Read artifacts under ${P.sliceDir(pid, sid)} and ${P.phaseSpec(pid)}. Write ${P.buildVerification(pid, sid)}.`,
    resetTask: (crit) => `${ctx}\nREVERT-AND-RESET: prior attempts made zero progress on "${crit}". Revert the slice's changes to the last green state and re-implement with a DIFFERENT approach. Read ${P.plan(pid, sid)} for the boundary; do NOT repeat the failed approach. Write ${P.build(pid, sid)}.` })
  if (vb.status === 'reset-route') {
    // the revert-and-reset surfaced an obstruction/promotion/split — re-enter the slice so S2/S4 re-detect
    // and route it through the normal (already-correct) paths, bounded by the per-slice budget.
    // If the reset itself raised CRITICAL, persist the promotion now (mirroring the L409 build-time site) so the
    // re-entry takes the FULL lane directly — a slice born FAST has no birth-time size/surface signal for
    // criticalSignal to re-fire on, so without this the re-run would re-enter the merged FAST S2S4 step and
    // could build inline again before the flip-flopping agent re-reports CRITICAL, wasting a pass + a budget unit.
    if (vb.reset && vb.reset.riskTier === 'CRITICAL') { slice.riskTier = 'CRITICAL'; slice.lane = 'FULL' }
    const re = reenter(`${sid}:reset-route`, { targetStep: 'S2', sliceId: sid, check: 'reset-surfaced-routing', reason: 'revert-and-reset surfaced an obstruction/promotion/split; re-plan the slice' })
    if (re) return await re
    note(report.blockers, { where: sid, reason: 'reset surfaced routing but re-entry budget exhausted — on-disk changes are NOT verified (S5 did not pass)' })
    return { result: 'blocked' }
  }
  // VP-1: S5 can detect a CRITICAL domain surface that surfaced only at build/verify time (invisible to S1 and
  // the pre-build criticalSignal cross-check). If S5 PASSED but flagged riskTier:CRITICAL, the slice shipped
  // built without the owed S3 plan-verify — flip it to FULL and re-route (mirrors the build-time promotion at
  // L409) so a retroactive S2→S3 plan-verify→S4→S5 runs before the build is kept. (routeback/blocked verdicts
  // are already handled below/above; this gates the silent passed-after-late-promotion case.)
  if (vb.verdict && vb.verdict.riskTier === 'CRITICAL' && lane !== 'FULL') {
    slice.riskTier = 'CRITICAL'; slice.lane = 'FULL'
    const re = reenter(`${sid}:s5-late-critical`, { targetStep: 'S2', sliceId: sid, check: 's5-late-critical', reason: 'S5 detected a domain surface post-build — re-do on FULL so S3 plan-verify precedes the kept build' })
    if (re) return await re
    note(report.blockers, { where: sid, reason: 'S5 promoted to CRITICAL but re-route budget exhausted — FULL-lane S3 plan-verify never ran; on-disk inline changes are NOT plan-verified' }); return { result: 'blocked' }
  }
  if (vb.status === 'passed') return { result: 'passed' }
  if (vb.status === 'routeback') {
    if (vb.routeBack.targetStep === 'S2') { const re = reenter(`${sid}:verify-build`, vb.routeBack); if (re) return await re }
    return { result: 'escalate', routeBack: vb.routeBack }
  }
  return { result: 'blocked' }
}

// ---------------------------------------------------------------------------
// Phase driver — S1 slices → run each slice (lane) → S6 (folds S7 if single-phase).
// In-memory slice list is the source of truth within a run (no fs access); splitter agents persist stubs.
// ---------------------------------------------------------------------------
async function runPhase(ph, singlePhase) {
  const pid = ph.id, group = `Build ${pid}`
  phase(`Build ${pid}`)
  log(`▶ Phase ${pid}: ${ph.name}`)

  const s1 = await runStep({ step: 'S1', label: `${pid} · slices`, phaseGroup: group, schema: SCHEMA_S1,
    task: `Define phase ${pid} (${ph.name}) precisely enough to slice AND emit the vertical slice set with per-slice risk tier + lane. Read the main spec ${P.mainSpec()} and dev plan ${P.devPlan()}. Write the phase spec to ${P.phaseSpec(pid)} and a slice.md per slice under ${P.sliceDir(pid, '<slice-id>')}.` })
  if (!s1) { report.phases.push({ id: pid, name: ph.name, status: 'blocked' }); return }
  absorb('S1', s1)
  if (s1.routeBack && s1.routeBack.targetStep === 'S0') { logRouteBack(`${pid}:S1`, s1.routeBack); report.phases.push({ id: pid, name: ph.name, status: 'routeback-S0' }); return { escalate: s1.routeBack } }
  let slices = (s1.slices || []).slice()
  if (!slices.length) { note(report.blockers, { where: `${pid}:slices`, reason: 'no slices produced' }); report.phases.push({ id: pid, name: ph.name, status: 'blocked' }); return }

  let splits = 0
  for (let i = 0; i < slices.length; i++) {
    if (stopped) break
    if (report.slicesProcessed >= cfg.maxSlices) { note(report.blockers, { where: pid, reason: `initiative slice ceiling (${cfg.maxSlices}) reached` }); break }
    const slice = slices[i]
    const out = await runSlice(ph, slice)
    if (out.result === 'split' || out.result === 'enabling') {
      if (splits >= cfg.maxSplitsPerPhase) { note(report.blockers, { where: `${pid}:${slice.id}`, reason: 'split/enabling budget exhausted' }); continue }
      splits++
      if (out.result === 'split') { slices.splice(i, 1, ...out.slices); i--; }       // replace current with the smaller slices
      else { slices.splice(i, 0, ...out.slices); i--; }                              // tier-2: insert enabling slice(s) BEFORE current, then redo current
      continue
    }
    if (out.result === 'escalate') {
      // upstream route-back beyond this slice: hand up to the initiative driver (bounded there)
      report.phases.push({ id: pid, name: ph.name, status: 'escalated' })
      return { escalate: out.routeBack }
    }
    // 'passed' | 'blocked' → continue (best-effort completion of the phase)
  }

  // S6 — verify phase (folds the final cross-initiative readiness lenses when single-phase)
  const pv = await verifyWithFix({ step: 'S6', label: `${pid} phase`, phaseGroup: group, fixScope: `phase ${pid} cross-slice integration`,
    verifyTask: `Verify phase ${pid}: slices integrate into the phase outcome, shared contracts consistent, phase spec covered, rollout-safe.${singlePhase ? ' This initiative has ONE phase: ALSO run the final cross-initiative readiness lenses inline as a delta (S7 is folded in here) and assert the whole main spec is satisfied.' : ''} Read ${P.phaseSpec(pid)} and every slice under ${P.phaseDir(pid)}/slices/. Write ${P.phaseVerification(pid)}.` })
  if (pv.status === 'routeback') { logRouteBack(`${pid}:S6`, pv.routeBack); report.phases.push({ id: pid, name: ph.name, status: 'routeback' }); return { escalate: pv.routeBack } }
  report.phases.push({ id: pid, name: ph.name, status: pv.status === 'passed' ? 'verified' : 'incomplete' })
  log(`${pv.status === 'passed' ? '✔' : '✖'} Phase ${pid} ${pv.status}`)
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------
phase('Bootstrap')
await runStep({ step: 'S0', label: 'bootstrap', phaseGroup: 'Bootstrap', schema: SCHEMA_OK,
  task: `BOOTSTRAP ONLY (do not write the spec yet). Ensure ${P.initDir()} and ${P.adrDir()} exist; if PROJECT_LANGUAGE.md is absent at the repo root create it with a "# Project Language" + "## Terms" stub; do not overwrite anything existing. Return ok:true.` }).catch(() => null)
log(`Workspace ready at ${P.initDir()}`)

let upstreamRouteBacks = 0

// A front-door prerequisite that fails only at RUNTIME (missing tool/credential/env/capability) emits
// routeBack:S0 — but re-running S0 cannot provision it (the engine never writes idea-decisions.md), so a
// re-entry would no-op-loop and burn the budget. Distinguish it from a genuine engine-reclassified spec
// re-route (one-way obstruction) and degrade with an actionable blocker instead of re-entering S0.
function isFrontDoorPrereqS0(rb) {
  if (!rb || rb.targetStep !== 'S0') return false
  const t = `${rb.check || ''} ${rb.reason || ''}`.toLowerCase()
  if (/one-way-obstruction|spec[- ]shape|phase boundary/.test(t)) return false
  return /front-door|capability-unavailable|prerequisite|missing (env|secret|tool|credential|capability)|provision|auth (fail|failed)/.test(t)
}

async function runInitiative() {
  // S0 — merged spec + phase map (re-entrant for upstream route-backs)
  phase('S0 Spec+Phases')
  const s0 = await runStep({ step: 'S0', label: 'spec+phases', phaseGroup: 'S0 Spec+Phases', schema: SCHEMA_S0,
    task: `RESOLVE THE FRONT DOOR FIRST. Read ${P.initDir()}/idea-decisions.md (the locked decision log: "## Surface Rulings", "## Required Capabilities & Preflight", "## Environments", accepted assumptions, rejected paths) and ${P.initDir()}/refined-idea.md (the refined idea + its "## Detected Surfaces"). If they are ABSENT there, SEARCH atlas/initiatives/*/ for a directory holding BOTH files — the front door may have written under a different initiativeId than this build's "${initiative.id}". If exactly one such dir is found, USE it as the authoritative decision log AND record a blocker: "front-door id mismatch — front door used <found-id> but this build runs as ${initiative.id}; re-launch with initiativeId=<found-id> so both share one dir" (proceed with the found log so the run is not wasted). If several are found, record a blocker naming them. The resolved decision log TAKES PRECEDENCE over the args summary on conflict.
PREFLIGHT FLOOR — a HARD STOP, never down-ruled to a recorded assumption (it closes a front-door bypass): build the DOMAIN-SURFACE SET from the resolved refined-idea.md "## Detected Surfaces", else from the args idea/decisions (money | auth/security | persistence/migration | external-effect | PII | destructive — a feature that STORES or PERSISTS user state HAS a persistence surface even if the idea text never says "database"). If that set is NON-EMPTY, STOP with verdict:BLOCKED — and STILL emit phases:[] (SCHEMA_S0 requires the field) — when ANY of: (a) NO decision log was resolved anywhere; (b) a surface lacks a resolved entry in "## Surface Rulings" (empty/placeholder/unresolved = none); (c) a domain/external surface has a required capability left un-provisioned AND un-waived in "## Required Capabilities & Preflight". failedCriterion names the unruled surface / missing log / un-provisioned capability. The human resolves it in grill and re-launches.
Otherwise produce the durable main spec AND the ordered vertical phase map in ONE artifact (verdict:PASS). Write the spec to ${P.mainSpec()}, the phase list to ${P.devPlan()}, and the BINARY acceptance-criteria checklist to ${P.objective()} (the durable external objective every later step re-reads). RECONCILE before PASS: every main-spec In-scope clause must map to ≥1 acceptance criterion, an explicit reuse-acceptance, or a logged scope-waiver (the In-scope⊆AC gate in steps/s0-spec-and-phases.md) — an uncovered In-scope clause is a FAIL, not a clean PASS.` })
  if (!s0) { note(report.blockers, { where: 'S0', reason: 'no spec produced' }); return }
  absorb('S0', s0)
  if (s0.verdict === 'BLOCKED') { note(report.blockers, { where: 'S0', reason: s0.failedCriterion || 'S0 preflight blocked — front-door prerequisites unresolved (unruled surface / un-provisioned capability); resolve in grill and re-launch' }); log('⛔ S0 preflight blocked — front-door prerequisites unresolved.'); return }
  const phases = s0.phases || []
  log(`${phases.length} phase(s): ${phases.map((p) => p.id).join(', ') || '(none)'}`)
  const singlePhase = phases.length === 1

  phase('Build phases')
  for (const ph of phases) {
    if (stopped) break
    let r = await runPhase(ph, singlePhase)
    let tries = 0
    // Upstream re-entry the engine actually executes (DESIGN §6), bounded. S0 → full re-entry;
    // S1-S4 → re-run THIS phase (S1 → slices → S6), the most common S6 route-back; else degrade to a blocker.
    while (r && r.escalate && !stopped) {
      const ts = r.escalate.targetStep
      if (isFrontDoorPrereqS0(r.escalate)) {
        note(report.blockers, { where: 'front-door', reason: 'front-door prerequisite missing/failing at RUNTIME (re-running S0 cannot provision it) — re-run grill to provision it, then re-launch', detail: r.escalate.reason || r.escalate.check })
        log('⛔ runtime front-door prerequisite — degrading (re-provision in grill + re-launch).')
        break
      }
      if (ts === 'S0' && upstreamRouteBacks < cfg.maxUpstreamRouteBacks) {
        upstreamRouteBacks++
        log(`⟲ upstream re-entry #${upstreamRouteBacks}: re-running S0 then resuming (${r.escalate.reason || ''})`)
        return await runInitiative() // cascade reset is implicit (artifacts overwritten)
      }
      if ((ts === 'S1' || ts === 'S2' || ts === 'S3' || ts === 'S4') && tries < cfg.maxPhaseReentries) {
        tries++
        log(`⟲ phase re-entry #${tries} for ${ph.id} (re-enter ${ts}: ${r.escalate.reason || ''})`)
        r = await runPhase(ph, singlePhase)
        continue
      }
      note(report.blockers, { where: 'upstream', reason: `unhandled route-back to ${ts} after ${tries} phase re-entr${tries === 1 ? 'y' : 'ies'} (${ph.id}, S0 budget ${upstreamRouteBacks}/${cfg.maxUpstreamRouteBacks})`, detail: r.escalate.reason })
      break
    }
  }

  // S7 — final gate (skipped when single-phase: folded into S6)
  if (!singlePhase && !stopped) {
    phase('S7 Verify initiative')
    const final = await verifyWithFix({ step: 'S7', label: 'initiative', phaseGroup: 'S7 Verify initiative', fixScope: 'cross-phase integration + final evidence',
      verifyTask: `Final gate: completed phases satisfy the main-spec acceptance criteria at ${P.objective()}, compose across phases, one final behavior/screenshot pass holds, ship-safe. Read ${P.mainSpec()}, ${P.devPlan()}, and each phase verification under ${P.initDir()}/phases/. Write ${P.finalVerification()} + a Final Receipt.` })
    if (final.status === 'routeback') {
      logRouteBack('S7', final.routeBack)
      if (isFrontDoorPrereqS0(final.routeBack)) {
        note(report.blockers, { where: 'front-door', reason: 'front-door prerequisite missing/failing at RUNTIME at the final gate — re-run grill to provision it, then re-launch', detail: final.routeBack.reason || final.routeBack.check })
      } else if (final.routeBack.targetStep === 'S0' && upstreamRouteBacks < cfg.maxUpstreamRouteBacks) {
        upstreamRouteBacks++
        log(`⟲ final-gate upstream re-entry #${upstreamRouteBacks}: re-running S0 (${final.routeBack.reason || ''})`)
        return await runInitiative()
      } else {
        note(report.blockers, { where: 'S7', reason: `unhandled final-gate route-back to ${final.routeBack.targetStep} (S0 budget ${upstreamRouteBacks}/${cfg.maxUpstreamRouteBacks})`, detail: final.routeBack.reason })
      }
    } else {
      report.ready = final.status === 'passed' && !hasVerificationGapBlocker()
    }
  } else if (singlePhase) {
    report.ready = report.phases.length > 0 && report.phases[report.phases.length - 1].status === 'verified' && !hasVerificationGapBlocker()
  }
}

await runInitiative()

log(report.ready ? '✅ Initiative verified.' : `⚠ Not fully verified — ${report.blockers.length} blocker(s).`)
return {
  ...report,
  summary: {
    ready: report.ready, phases: report.phases,
    slicesProcessed: report.slicesProcessed, agentCalls: report.agentCalls,
    assumptions: report.assumptions.length, blockers: report.blockers.length,
    routeBacks: report.routeBacks.length, obstructions: report.obstructions.length, adrs: report.adrs.length,
    changedFiles: report.changedFiles.length, orphanedFiles: report.orphanedFiles.length,
  },
}
