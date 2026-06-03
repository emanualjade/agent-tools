export const meta = {
  name: 'strike-build-engine',
  description: 'Autonomous Strike build engine: main spec → phases → slices → build → verify, with fix loops and route-backs. Refine + grill happen with you first; this runs everything after.',
  whenToUse: 'After you and Claude have refined and grilled a feature idea. Pass the refined idea + resolved decisions as args; this drives the rest of Strike to a verified build.',
  phases: [
    { title: 'Bootstrap', detail: 'ensure Strike workspace + initiative dir' },
    { title: 'Main spec', detail: 'create-main-spec' },
    { title: 'Phases', detail: 'create-development-phases' },
    { title: 'Build phases', detail: 'per phase: phase-spec → slices → per slice research/plan/build/verify → verify-phase' },
    { title: 'Verify main spec', detail: 'final initiative gate' },
  ],
}

/*
 * STRIKE BUILD ENGINE — a faithful port of the Strike workflow to a Claude Code workflow.
 *
 * WHAT THIS IS
 *   Strike (github.com/emanualjade/strike) is a Claude Code plugin: ~25 skills sequenced by
 *   an orchestrator skill (`go`) over a state machine (`strike/state.json`). This workflow
 *   REPLACES the `go` + state.json orchestration layer with a deterministic JS engine, while
 *   reusing Strike's actual skill prompts verbatim (vendored under strike-engine/skills) and
 *   preserving Strike's exact on-disk artifact layout (strike/initiatives/<id>/...).
 *
 * THE SEAM (decided with the user)
 *   refine-idea + grill-idea are interactive and stay OUTSIDE this workflow (done in chat).
 *   Their outputs (refined idea + resolved decisions) come in via `args`. This engine starts
 *   at create-main-spec and runs hands-off to a verified main spec.
 *
 * HANDS-OFF ESCALATION
 *   A background workflow cannot pause to ask the user. Where a Strike skill says "ask one
 *   consequential question", the subagent instead picks the most reasonable, clearly-labeled
 *   assumption, records it, and continues. Genuinely unrepairable blockers are recorded and
 *   surfaced in the final report; the engine keeps making safe forward progress where it can.
 *
 * FIDELITY NOTES
 *   - Check graph, reopen-cascade, and verdict contract mirror strike/skills/go/scripts/state.mjs.
 *   - Verifiers run their review lenses INLINE (Strike's documented fallback when a host can't
 *     spawn nested subagents). Orchestrator-level lens fan-out is a documented enhancement.
 *   - Phases run sequentially (Strike orders them by dependency). Slices run sequentially by
 *     default (build-slice mutates the working tree). See cfg.parallelPlanning / worktrees in README.
 *
 * RESUME
 *   Re-launch with { scriptPath, resumeFromRunId } — unchanged agent() calls return cached
 *   results; only new/edited steps re-run. On-disk Strike artifacts also make every step
 *   independently re-readable by a fresh agent.
 */

// ----------------------------------------------------------------------------
// Config + inputs
// ----------------------------------------------------------------------------

const a = args || {}

const cfg = {
  // Absolute home of the vendored Strike skills. The engine reads skills from here, but writes
  // artifacts + code into the CURRENT working directory (the target repo it is launched from).
  skillsDir: a.skillsDir || '/Users/cracklehat/Sites/workflow-exploration/strike-engine/skills',
  maxFixAttempts: a.maxFixAttempts ?? 3,   // fix -> re-verify rounds before a verifier is declared blocked
  maxRouteBacks: a.maxRouteBacks ?? 4,     // route-backs honored per slice/phase before escalating/blocking
  maxSplitsPerPhase: a.maxSplitsPerPhase ?? 6, // slice-split events honored per phase
}

const initiative = {
  id: a.initiativeId || 'initiative',
  name: a.initiativeName || a.initiativeId || 'Initiative',
  idea: a.idea || '',
  decisions: a.decisions || '',
  constraints: a.constraints || '',
  repoContext: a.repoContext || '',
}

if (!initiative.idea) {
  log('⚠ No `idea` provided in args. This engine expects a refined idea + decisions from a prior refine/grill session. Proceeding, but the spec will be thin.')
}

// ----------------------------------------------------------------------------
// Canonical Strike artifact paths (repo-relative, written into cwd)
// ----------------------------------------------------------------------------

const P = {
  initDir: () => `strike/initiatives/${initiative.id}`,
  mainSpec: () => `${P.initDir()}/main-spec.md`,
  devPlan: () => `${P.initDir()}/development-plan.md`,
  finalVerification: () => `${P.initDir()}/verification.md`,
  phaseDir: (pid) => `${P.initDir()}/phases/${pid}`,
  phaseStub: (pid) => `${P.phaseDir(pid)}/phase.md`,
  phaseSpec: (pid) => `${P.phaseDir(pid)}/phase-spec.md`,
  phaseVerification: (pid) => `${P.phaseDir(pid)}/verification.md`,
  sliceDir: (pid, sid) => `${P.phaseDir(pid)}/slices/${sid}`,
  slice: (pid, sid) => `${P.sliceDir(pid, sid)}/slice.md`,
  research: (pid, sid) => `${P.sliceDir(pid, sid)}/research.md`,
  plan: (pid, sid) => `${P.sliceDir(pid, sid)}/plan.md`,
  planVerification: (pid, sid) => `${P.sliceDir(pid, sid)}/plan-verification.md`,
  build: (pid, sid) => `${P.sliceDir(pid, sid)}/build.md`,
  buildVerification: (pid, sid) => `${P.sliceDir(pid, sid)}/build-verification.md`,
}

// Slice-level checks in order (mirrors SLICE_WORKFLOW)
const SLICE_CHECKS = ['researchComplete', 'planCreated', 'planVerified', 'implemented', 'buildVerified']
const sliceCursorOf = (check) => {
  const i = SLICE_CHECKS.indexOf(check)
  return i === -1 ? null : i
}

// ----------------------------------------------------------------------------
// Run accumulators (returned in the final report)
// ----------------------------------------------------------------------------

const report = {
  initiative: initiative.id,
  assumptions: [],   // {where, note}
  blockers: [],      // {where, reason, detail}
  routeBacks: [],    // {from, command, target, reason}
  changedFiles: [],  // strings
  phases: [],        // {id, name, status}
  ready: false,
}
const note = (arr, obj) => { arr.push(obj) }
const absorb = (where, structured) => {
  for (const x of structured?.assumptions || []) note(report.assumptions, { where, note: x })
  for (const x of structured?.blockers || []) note(report.blockers, { where, reason: x })
  for (const f of structured?.changedFiles || []) if (!report.changedFiles.includes(f)) report.changedFiles.push(f)
}

// ----------------------------------------------------------------------------
// Structured-output schemas (validated at the tool layer; the model retries on mismatch)
// ----------------------------------------------------------------------------

const ROUTEBACK = {
  type: 'object',
  required: ['needed'],
  properties: {
    needed: { type: 'boolean' },
    command: { type: 'string', description: 'none | reopen-check | reopen-phase-check | reopen-slice-check' },
    phase: { type: ['string', 'null'], description: 'phase-id or null' },
    slice: { type: ['string', 'null'], description: 'slice-id or null' },
    check: { type: ['string', 'null'], description: 'state-check name to reopen, or null' },
    reason: { type: 'string' },
  },
}
const STR_ARR = { type: 'array', items: { type: 'string' } }

const VERDICT = {
  type: 'object',
  required: ['ready', 'fixNeeded', 'artifactPath', 'routeBack', 'summary'],
  properties: {
    ready: { type: 'boolean', description: 'true iff the verification artifact says Ready/Verified: yes' },
    fixNeeded: { type: 'boolean', description: 'true iff Fix Needed: yes' },
    artifactPath: { type: 'string', description: 'path to the verification.md you wrote' },
    mustFix: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, severity: { type: 'string' }, detail: { type: 'string' } } } },
    followUp: STR_ARR,
    acceptedRisk: STR_ARR,
    assumptions: STR_ARR,
    blockers: STR_ARR,
    routeBack: ROUTEBACK,
    summary: { type: 'string' },
  },
}
const FIX = {
  type: 'object',
  required: ['fixed', 'fixPath', 'routeBack'],
  properties: {
    fixed: { type: 'boolean' },
    fixPath: { type: 'string' },
    issuesAddressed: STR_ARR,
    changedFiles: STR_ARR,
    remaining: STR_ARR,
    assumptions: STR_ARR,
    routeBack: ROUTEBACK,
    reason: { type: 'string' },
  },
}
const SPEC = {
  type: 'object',
  required: ['specPath', 'summary'],
  properties: {
    specPath: { type: 'string' },
    summary: { type: 'string' },
    openDecisions: STR_ARR,
    assumptions: STR_ARR,
    blockers: STR_ARR,
  },
}
const PHASES = {
  type: 'object',
  required: ['developmentPlanPath', 'phases'],
  properties: {
    developmentPlanPath: { type: 'string' },
    phases: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'string', description: 'canonical phase id e.g. phase-01' },
          name: { type: 'string' },
          outcome: { type: 'string' },
          dependsOn: STR_ARR,
        },
      },
    },
    assumptions: STR_ARR,
    blockers: STR_ARR,
  },
}
const PHASE_SPEC = {
  type: 'object',
  required: ['phaseSpecPath', 'boundaryOk'],
  properties: {
    phaseSpecPath: { type: 'string' },
    boundaryOk: { type: 'boolean', description: 'false if the phase boundary is wrong (too broad/small/stale/horizontal)' },
    boundaryProblem: { type: ['string', 'null'] },
    assumptions: STR_ARR,
    blockers: STR_ARR,
  },
}
const SLICES = {
  type: 'object',
  required: ['slices'],
  properties: {
    slices: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'string', description: 'canonical slice id e.g. slice-01' },
          name: { type: 'string' },
          size: { type: 'string' },
          type: { type: 'string', description: 'Vertical | Non-vertical' },
          dependsOn: STR_ARR,
        },
      },
    },
    phaseSpecProblem: { type: ['string', 'null'], description: 'set if the phase spec was too vague/stale to slice' },
    assumptions: STR_ARR,
    blockers: STR_ARR,
  },
}
const RESEARCH = {
  type: 'object',
  required: ['researchPath', 'readyForPlanning', 'tooBroad'],
  properties: {
    researchPath: { type: 'string' },
    readyForPlanning: { type: 'boolean' },
    tooBroad: { type: 'boolean' },
    suggestedSplit: {
      type: 'array',
      items: { type: 'object', required: ['id', 'name'], properties: { id: { type: 'string' }, name: { type: 'string' } } },
      description: 'when tooBroad: the replacement slices (first replaces current, rest are appended)',
    },
    assumptions: STR_ARR,
    blockers: STR_ARR,
  },
}
const PLAN = {
  type: 'object',
  required: ['planPath', 'splitNeeded', 'readyToVerify'],
  properties: {
    planPath: { type: 'string' },
    splitNeeded: { type: 'boolean' },
    replacementSlices: {
      type: 'array',
      items: { type: 'object', required: ['id', 'name'], properties: { id: { type: 'string' }, name: { type: 'string' } } },
    },
    readyToVerify: { type: 'boolean' },
    assumptions: STR_ARR,
    blockers: STR_ARR,
  },
}
const BUILD = {
  type: 'object',
  required: ['buildPath', 'built', 'routeBack'],
  properties: {
    buildPath: { type: 'string' },
    built: { type: 'boolean' },
    changedFiles: STR_ARR,
    routeBack: ROUTEBACK,
    assumptions: STR_ARR,
    blockers: STR_ARR,
  },
}

// ----------------------------------------------------------------------------
// Skill runner — every step is a subagent told to follow the vendored SKILL.md verbatim
// ----------------------------------------------------------------------------

const HANDS_OFF = `
AUTONOMOUS RUN — no human is available to answer questions.
- Where the skill says to "ask one consequential question", instead choose the most reasonable,
  clearly-stated assumption, record it in the structured "assumptions" field, and continue.
- Only stop for a genuinely unrepairable blocker (a decision you cannot responsibly assume).
  Put such items in "blockers" and do the safest partial progress you can.
- Subagent fan-out is NOT available inside this run. Where the skill says to use read-only review
  subagents/lenses, run those lenses INLINE as separate read-only passes (the skill's documented
  fallback) and record them. Do not skip required lenses.
- Write all artifacts to the EXACT canonical paths named below (create parent dirs as needed).
- Return structured output whose fields faithfully reflect what you actually wrote — especially
  any Ready/Verified/Built and Route Back values.`

function runSkill({ skill, label, phaseGroup, schema, task }) {
  const prompt = `You are executing the Strike "${skill}" step for initiative "${initiative.id}" (${initiative.name}).

YOUR INSTRUCTION SET: read and follow EXACTLY the skill file at
  ${cfg.skillsDir}/${skill}/SKILL.md
That file is authoritative. Follow its Process, Quality Bar, Output shape, and Rules to the letter.

INITIATIVE CONTEXT (from a prior refine + grill session, already done with the user):
  Idea / refined outcome:
  ${initiative.idea || '(none provided)'}
  Resolved decisions / accepted assumptions / rejected paths:
  ${initiative.decisions || '(none provided)'}
  Constraints:
  ${initiative.constraints || '(none provided)'}
  Repo context:
  ${initiative.repoContext || '(infer from the working directory)'}

TASK SPECIFICS:
${task}
${HANDS_OFF}`
  return agent(prompt, { label, phase: phaseGroup, schema })
}

// ----------------------------------------------------------------------------
// Verify + fix loop (shared by all four verifiers)
// ----------------------------------------------------------------------------

async function verifyWithFix({ verifier, label, phaseGroup, verifyTask, fixScopeNote }) {
  let last
  for (let attempt = 1; attempt <= cfg.maxFixAttempts + 1; attempt++) {
    const v = await runSkill({ skill: verifier, label: `${label} · verify#${attempt}`, phaseGroup, schema: VERDICT, task: verifyTask })
    last = v
    if (!v) { note(report.blockers, { where: label, reason: 'verification agent returned no result (skipped mid-run)' }); return { status: 'blocked' } }
    absorb(`${verifier}`, v)
    if (v.ready) return { status: 'passed', verdict: v }
    if (v.routeBack?.needed) return { status: 'routeback', routeBack: v.routeBack, verdict: v }
    if (!v.fixNeeded) {
      note(report.blockers, { where: label, reason: v.summary || 'verification failed with no repairable fix path', detail: JSON.stringify(v.mustFix || []) })
      return { status: 'blocked', verdict: v }
    }
    // Repair, then re-verify the SAME verifier (Strike's fix contract).
    const fx = await runSkill({
      skill: 'fix', label: `${label} · fix#${attempt}`, phaseGroup, schema: FIX,
      task: `Repair the failed verification.
Failed verification artifact: ${v.artifactPath}
Scope: ${fixScopeNote}
Fix only the verifier's Must Fix items, write a compact fix-NNN.md next to the affected evidence,
then this engine will re-run "${verifier}". If an earlier workflow step owns the repair, set routeBack.`,
    })
    if (!fx) { note(report.blockers, { where: `fix:${label}`, reason: 'fix agent returned no result (skipped mid-run)' }); return { status: 'blocked', verdict: v } }
    absorb('fix', fx)
    if (fx.routeBack?.needed) return { status: 'routeback', routeBack: fx.routeBack, verdict: v, fix: fx }
    if (!fx.fixed) {
      note(report.blockers, { where: `fix:${label}`, reason: fx.reason || 'fix could not complete', detail: (fx.remaining || []).join('; ') })
      return { status: 'blocked', verdict: v, fix: fx }
    }
    // else: loop and re-verify
  }
  note(report.blockers, { where: label, reason: `did not pass after ${cfg.maxFixAttempts} fix attempts` })
  return { status: 'blocked', verdict: last }
}

function logRouteBack(from, rb) {
  note(report.routeBacks, { from, command: rb.command, target: `${rb.phase || ''}/${rb.slice || ''}:${rb.check || ''}`, reason: rb.reason })
  log(`↩ route-back from ${from} → ${rb.command} ${rb.check || ''} (${rb.reason || 'no reason given'})`)
}

// ----------------------------------------------------------------------------
// Slice driver — research → plan → verify-plan → build → verify-build, with bounded route-backs
// Returns: {result:'passed'} | {result:'blocked'} | {result:'split', slices:[...]} | {result:'escalate', routeBack}
// ----------------------------------------------------------------------------

async function runSlice(ph, slice) {
  const pid = ph.id, sid = slice.id
  const group = `Build ${pid}`
  const sliceCtx = `Phase: ${pid} (${ph.name}). Slice: ${sid} (${slice.name}).`
  let routeBacks = 0
  let cursor = 0 // index into SLICE_CHECKS

  const reopenTo = (check, where, rb) => {
    const c = sliceCursorOf(check)
    if (c === null) return false
    if (routeBacks >= cfg.maxRouteBacks) {
      note(report.blockers, { where, reason: `route-back budget exhausted (wanted ${check})`, detail: rb?.reason })
      return false
    }
    routeBacks++
    cursor = c
    if (rb) logRouteBack(where, rb)
    return true
  }

  while (cursor < SLICE_CHECKS.length) {
    const check = SLICE_CHECKS[cursor]

    if (check === 'researchComplete') {
      const r = await runSkill({
        skill: 'research-slice', label: `${sid} · research`, phaseGroup: group, schema: RESEARCH,
        task: `${sliceCtx}
Read the slice stub at ${P.slice(pid, sid)} and relevant phase spec at ${P.phaseSpec(pid)}.
Write research to ${P.research(pid, sid)}.`,
      })
      if (!r) { note(report.blockers, { where: `${sid}:research`, reason: 'research agent returned no result (skipped)' }); return { result: 'blocked' } }
      absorb('research-slice', r)
      if (r.tooBroad && (r.suggestedSplit?.length)) {
        log(`✂ ${sid} is too broad → splitting into ${r.suggestedSplit.length} slices`)
        return { result: 'split', slices: r.suggestedSplit }
      }
      if (!r.readyForPlanning) { note(report.blockers, { where: `${sid}:research`, reason: 'research not ready for planning', detail: (r.blockers || []).join('; ') }); return { result: 'blocked' } }
      cursor++
    }

    else if (check === 'planCreated') {
      const p = await runSkill({
        skill: 'plan-slice', label: `${sid} · plan`, phaseGroup: group, schema: PLAN,
        task: `${sliceCtx}
Read ${P.slice(pid, sid)}, research ${P.research(pid, sid)}, phase spec ${P.phaseSpec(pid)},
and any strike/user-guidance/implementation-discipline/*.md that exist.
Write the plan to ${P.plan(pid, sid)}.`,
      })
      if (!p) { note(report.blockers, { where: `${sid}:plan`, reason: 'plan agent returned no result (skipped)' }); return { result: 'blocked' } }
      absorb('plan-slice', p)
      if (p.splitNeeded && (p.replacementSlices?.length)) {
        log(`✂ ${sid} plan recommends split → ${p.replacementSlices.length} slices`)
        return { result: 'split', slices: p.replacementSlices }
      }
      if (!p.readyToVerify) { note(report.blockers, { where: `${sid}:plan`, reason: 'plan not ready', detail: (p.blockers || []).join('; ') }); return { result: 'blocked' } }
      cursor++
    }

    else if (check === 'planVerified') {
      const v = await verifyWithFix({
        verifier: 'verify-slice-plan', label: sid, phaseGroup: group,
        verifyTask: `${sliceCtx}
Verify the plan. Read ${P.slice(pid, sid)}, ${P.research(pid, sid)}, ${P.plan(pid, sid)}, ${P.phaseSpec(pid)}.
Write verification to ${P.planVerification(pid, sid)}.`,
        fixScopeNote: `slice ${sid} plan/research artifacts only`,
      })
      if (v.status === 'passed') { cursor++; continue }
      if (v.status === 'blocked') return { result: 'blocked' }
      // routeback
      const rb = v.routeBack
      if (rb.command === 'reopen-slice-check' && sliceCursorOf(rb.check) !== null) {
        // may carry a split (e.g. back to researchComplete to re-slice)
        if (!reopenTo(rb.check, `${sid}:verify-plan`, rb)) return { result: 'blocked' }
        continue
      }
      return { result: 'escalate', routeBack: rb }
    }

    else if (check === 'implemented') {
      const b = await runSkill({
        skill: 'build-slice', label: `${sid} · build`, phaseGroup: group, schema: BUILD,
        task: `${sliceCtx}
Implement the verified plan. Read ${P.plan(pid, sid)} and ${P.planVerification(pid, sid)} (must say Ready: yes).
Make the code changes in the repo. Write build evidence to ${P.build(pid, sid)}.`,
      })
      if (!b) { note(report.blockers, { where: `${sid}:build`, reason: 'build agent returned no result (skipped)' }); return { result: 'blocked' } }
      absorb('build-slice', b)
      if (!b.built) {
        if (b.routeBack?.needed && sliceCursorOf(b.routeBack.check) !== null) {
          if (!reopenTo(b.routeBack.check, `${sid}:build`, b.routeBack)) return { result: 'blocked' }
          continue
        }
        note(report.blockers, { where: `${sid}:build`, reason: 'build reported Built: no', detail: (b.blockers || []).join('; ') })
        return { result: 'blocked' }
      }
      cursor++
    }

    else if (check === 'buildVerified') {
      const v = await verifyWithFix({
        verifier: 'verify-slice-build', label: sid, phaseGroup: group,
        verifyTask: `${sliceCtx}
Verify the build against acceptance criteria. Read the slice artifacts under ${P.sliceDir(pid, sid)} and ${P.phaseSpec(pid)}.
Run focused checks; do browser/user-flow checks if the slice is UI-facing (report code-verified if blocked).
Write verification to ${P.buildVerification(pid, sid)}.`,
        fixScopeNote: `slice ${sid} implementation + tests + evidence`,
      })
      if (v.status === 'passed') { cursor++; continue }
      if (v.status === 'blocked') return { result: 'blocked' }
      const rb = v.routeBack
      if (rb.command === 'reopen-slice-check' && sliceCursorOf(rb.check) !== null) {
        if (!reopenTo(rb.check, `${sid}:verify-build`, rb)) return { result: 'blocked' }
        continue
      }
      return { result: 'escalate', routeBack: rb }
    }
  }
  return { result: 'passed' }
}

// ----------------------------------------------------------------------------
// Phase driver — phase-spec → create slices → run each slice → verify-phase
// ----------------------------------------------------------------------------

async function runPhase(ph) {
  const pid = ph.id
  const group = `Build ${pid}`
  phase(`Build ${pid}`) // narration group; safe because phases run sequentially
  log(`▶ Phase ${pid}: ${ph.name}`)

  // 1) phase spec
  const ps = await runSkill({
    skill: 'create-phase-spec', label: `${pid} · phase-spec`, phaseGroup: group, schema: PHASE_SPEC,
    task: `Create the phase spec for ${pid} (${ph.name}).
Read the main spec ${P.mainSpec()}, development plan ${P.devPlan()}, and the phase stub ${P.phaseStub(pid)} if present.
Write the phase spec to ${P.phaseSpec(pid)}.`,
  })
  absorb('create-phase-spec', ps)
  if (ps.boundaryOk === false) note(report.assumptions, { where: `${pid}:phase-spec`, note: `boundary flagged: ${ps.boundaryProblem || 'unspecified'} — proceeding under hands-off policy` })

  // 2) slices
  const sl = await runSkill({
    skill: 'create-phase-slices', label: `${pid} · slices`, phaseGroup: group, schema: SLICES,
    task: `Split phase ${pid} into small vertical slices.
Read the phase spec ${P.phaseSpec(pid)}.
Create one directory per slice under ${P.sliceDir(pid, '<slice-id>')} and write slice.md inside each (canonical ids slice-01, slice-02, ...).`,
  })
  absorb('create-phase-slices', sl)
  if (sl.phaseSpecProblem) note(report.blockers, { where: `${pid}:slices`, reason: 'phase spec too weak to slice', detail: sl.phaseSpecProblem })

  let slices = (sl.slices || []).slice()
  if (!slices.length) {
    note(report.blockers, { where: `${pid}:slices`, reason: 'no slices produced' })
    report.phases.push({ id: pid, name: ph.name, status: 'blocked' })
    return
  }

  // 3) run slices (sequential by default; build-slice mutates the working tree)
  let splits = 0
  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i]
    const outcome = await runSlice(ph, slice)
    if (outcome.result === 'split') {
      if (splits >= cfg.maxSplitsPerPhase) {
        note(report.blockers, { where: `${pid}:${slice.id}`, reason: 'split budget exhausted; building slice as-is not attempted' })
        continue
      }
      splits++
      // first replacement takes this slot; the rest are inserted after it
      slices.splice(i, 1, ...outcome.slices)
      i-- // re-process the (new) slice at index i
      continue
    }
    if (outcome.result === 'escalate') {
      logRouteBack(`${pid}:${slice.id}`, outcome.routeBack)
      // phase-level route-back (e.g. reopen slicesCreated / phaseSpecCreated): record and continue best-effort
      note(report.blockers, { where: `${pid}:${slice.id}`, reason: `escalated route-back not auto-handled in v1`, detail: outcome.routeBack?.reason })
    }
    // 'passed' or 'blocked' → continue to next slice (best-effort completion)
  }

  // 4) verify the phase
  const pv = await verifyWithFix({
    verifier: 'verify-phase', label: pid, phaseGroup: group,
    verifyTask: `Verify phase ${pid} against its phase spec and completed slice evidence.
Read ${P.phaseSpec(pid)} and every slice under ${P.phaseDir(pid)}/slices/.
Write verification to ${P.phaseVerification(pid)}.`,
    fixScopeNote: `phase ${pid} slices + cross-slice integration`,
  })
  if (pv.status === 'routeback') {
    logRouteBack(`verify-phase:${pid}`, pv.routeBack)
    note(report.blockers, { where: `verify-phase:${pid}`, reason: 'phase verifier routed back (not auto-handled in v1)', detail: pv.routeBack?.reason })
  }
  report.phases.push({ id: pid, name: ph.name, status: pv.status === 'passed' ? 'verified' : 'incomplete' })
  log(`${pv.status === 'passed' ? '✔' : '✖'} Phase ${pid} ${pv.status}`)
}

// ----------------------------------------------------------------------------
// Engine
// ----------------------------------------------------------------------------

phase('Bootstrap')
await agent(
  `Bootstrap the Strike workspace in the CURRENT working directory for initiative "${initiative.id}" (${initiative.name}).
- Create directory ${P.initDir()} and its parents.
- If PROJECT_LANGUAGE.md does not exist at the repo root, create it with a "# Project Language" heading and an empty "## Terms" section.
- Do NOT overwrite any existing strike/ content or existing PROJECT_LANGUAGE.md.
Return ok:true with any notes.`,
  { label: 'bootstrap', phase: 'Bootstrap', schema: { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' }, notes: STR_ARR } } },
)
log(`Workspace ready at ${P.initDir()}`)

phase('Main spec')
const spec = await runSkill({
  skill: 'create-main-spec', label: 'main-spec', phaseGroup: 'Main spec', schema: SPEC,
  task: `Create the durable main spec from the refined idea + decisions above.
Read PROJECT_LANGUAGE.md first if it exists. Write the main spec to ${P.mainSpec()}.`,
})
if (!spec) {
  note(report.blockers, { where: 'create-main-spec', reason: 'main-spec agent returned no result (skipped)' })
  log('✖ No main spec produced — stopping.')
  return { ...report, ready: false, summary: { ready: false, stoppedAt: 'create-main-spec', blockerCount: report.blockers.length } }
}
absorb('create-main-spec', spec)
log(`Main spec written: ${spec.specPath || P.mainSpec()}`)

phase('Phases')
const plan = await runSkill({
  skill: 'create-development-phases', label: 'phases', phaseGroup: 'Phases', schema: PHASES,
  task: `Break the main spec at ${P.mainSpec()} into the smallest ordered set of buildable phases.
Write the development plan to ${P.devPlan()} and one phase stub per phase at ${P.phaseStub('<phase-id>')}.`,
})
if (!plan) {
  note(report.blockers, { where: 'create-development-phases', reason: 'phases agent returned no result (skipped)' })
  log('✖ No development plan produced — stopping.')
  return { ...report, ready: false, summary: { ready: false, stoppedAt: 'create-development-phases', blockerCount: report.blockers.length } }
}
absorb('create-development-phases', plan)
const phases = plan.phases || []
log(`${phases.length} phase(s): ${phases.map((p) => p.id).join(', ') || '(none)'}`)

phase('Build phases')
for (const ph of phases) {
  // phases are sequential (Strike orders them by dependency)
  await runPhase(ph)
}

phase('Verify main spec')
const final = await verifyWithFix({
  verifier: 'verify-main-spec', label: 'main-spec', phaseGroup: 'Verify main spec',
  verifyTask: `Final gate. Verify the whole initiative against the main spec.
Read ${P.mainSpec()}, ${P.devPlan()}, and every phase's verification.md under ${P.initDir()}/phases/.
Include a visual screenshot check if the initiative is UI-facing (report code-verified if blocked).
Write final verification to ${P.finalVerification()}.`,
  fixScopeNote: 'cross-phase integration + final evidence',
})
report.ready = final.status === 'passed'
if (final.status === 'routeback') logRouteBack('verify-main-spec', final.routeBack)

log(report.ready
  ? '✅ Initiative verified against the main spec.'
  : `⚠ Initiative not fully verified — ${report.blockers.length} blocker(s) recorded.`)

return {
  ...report,
  summary: {
    ready: report.ready,
    phases: report.phases,
    assumptionCount: report.assumptions.length,
    blockerCount: report.blockers.length,
    routeBackCount: report.routeBacks.length,
    changedFileCount: report.changedFiles.length,
  },
}
