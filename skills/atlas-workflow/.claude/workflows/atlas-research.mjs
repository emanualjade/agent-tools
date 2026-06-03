export const meta = {
  name: 'atlas-research',
  description: 'Atlas pre-grill research engine: one worker per approved topic (official docs + actual source first), a multi-pass diverse-lens audit that loops until every claim is verified — and that SHRINKS the file by cutting/flagging anything unbacked — then a lean resources/index.md digest. Accurate, not lengthy; never a dumping ground.',
  whenToUse: 'Launched by the research-idea front-door skill after the user approves a research scope. Researches each approved topic into atlas/initiatives/<id>/resources/ so the grill can pressure-test decisions on grounded facts instead of guesses.',
  phases: [
    { title: 'Research', detail: 'one worker per topic → multi-pass audit loop (cut/flag unbacked claims) → lean report' },
    { title: 'Rollup', detail: 'resources/index.md digest — the menu the grill reads first' },
  ],
}

/*
 * ATLAS RESEARCH — the pre-grill grounding phase (FRONTDOOR-REDESIGN.md, Phase B).
 *
 * Seam: the research-idea skill runs the scope-chat + result checkpoint WITH the user, then launches
 * this hands-off engine via the Workflow tool with the approved topics. This engine never talks to the
 * user. It fans out one worker per topic, audits each through diverse lenses until clean (or a bounded
 * number of rounds), and writes lean, accurate reports + a digest into atlas/initiatives/<id>/resources/.
 *
 * Principle: accurate, not lengthy. Audits make files SHORTER and truer — an unbacked claim is cut or
 * marked unknown, never left in. On audit exhaustion the run degrades gracefully (unresolved items are
 * logged as open questions, not silently passed).
 */

// ---------------------------------------------------------------------------
// Inputs (args may arrive as an object OR a JSON string — normalize)
// ---------------------------------------------------------------------------
let a = args || {}
if (typeof a === 'string') { try { a = JSON.parse(a) || {} } catch { a = {} } }

const cfg = {
  initiativeId: a.initiativeId || 'initiative',
  repoContext: a.repoContext || '',
  maxAuditRounds: a.maxAuditRounds ?? 4, // audit/fix cycles per topic; round 1 already runs all lenses
}
const topics = Array.isArray(a.topics) ? a.topics.filter((t) => t && t.id && t.topic) : []
const initDir = `atlas/initiatives/${cfg.initiativeId}`
const resourcesDir = `${initDir}/resources`

if (!topics.length) {
  // The skill owns the "No research needed" fast path; this engine expects ≥1 approved topic.
  log('⚠ No valid topics in args — nothing to research. (The research-idea skill handles the no-research fast path.)')
  return { initiativeId: cfg.initiativeId, topics: [], index: `${resourcesDir}/index.md`, readyForGrill: false, openQuestions: ['no topics were provided to the research engine'] }
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const STR = { type: 'array', items: { type: 'string' } }
const REPORT = {
  type: 'object', additionalProperties: false, required: ['file', 'verdict'],
  properties: {
    file: { type: 'string', description: 'the resources/<id>.md path written' },
    verdict: { type: 'string', description: 'DRAFTED | NO-MATERIAL-FINDINGS' },
    decisionsForGrill: STR,
    unknowns: STR,
  },
}
const AUDIT = {
  type: 'object', additionalProperties: false, required: ['clean'],
  properties: {
    clean: { type: 'boolean', description: 'true iff this lens found ZERO Must-Fix issues' },
    mustFix: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['problem', 'action'], properties: {
      claim: { type: 'string', description: 'the specific claim/line at fault' },
      problem: { type: 'string' },
      action: { type: 'string', description: 'fix | cut | mark-unknown' },
    } } },
    notes: { type: 'string' },
  },
}
const FIX = { type: 'object', additionalProperties: false, required: ['revised'], properties: {
  revised: { type: 'boolean' }, stillOpen: STR } }
const ROLLUP = { type: 'object', additionalProperties: false, required: ['file', 'readyForGrill'], properties: {
  file: { type: 'string' }, readyForGrill: { type: 'boolean' }, openQuestions: STR, summary: { type: 'string' } } }

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------
const sourcesLine = (t) => (Array.isArray(t.sources) && t.sources.length) ? t.sources.join(', ') : 'find the official / primary sources yourself'

const workerPrompt = (t) => `You are an Atlas research worker. Research EXACTLY ONE topic and write ONE lean, accurate report. Initiative "${cfg.initiativeId}".

TOPIC (${t.id}): ${t.topic}
Why it matters: ${t.why || '(it grounds a decision the grill will pressure-test)'}
Questions to answer: ${(Array.isArray(t.questions) && t.questions.join(' | ')) || '(the consequential facts about this topic)'}
Expected sources: ${sourcesLine(t)}
${t.repoPaths ? `Repo paths to inspect: ${t.repoPaths}` : ''}
Repo context: ${cfg.repoContext || '(infer from the working directory)'}

SOURCING RULES (non-negotiable):
- Start from OFFICIAL / PRIMARY sources: official docs, the ACTUAL SDK/source code at the version this repo uses, the provider's own reference. NEVER a stale blog/forum as the basis of a claim.
- For SOLVED problems (money, accounting, commerce, refunds, coupons, auth, dates/timezones, crypto): research how the established players solve it — e.g. how Stripe / Shopify / Amazon do it — AND the professional principles (e.g. accounting standards). These are solved; do NOT invent them.
- For repo topics, inspect the ACTUAL files and name them.
- Mark anything you cannot verify against a primary source as **unknown** — never guess to fill a gap.

WRITE the report to ${resourcesDir}/${t.id}.md with a descriptive H1 and EXACTLY this lean shape:
# <descriptive title>
## Scope            — one line: what this answers
## Sources          — each: source • version/date-checked • why authoritative
## Findings         — each as: Finding → Evidence (cited source/file) → Implication for the build
## Capability / Constraint Summary   — Supported | Unsupported | Unknown | Limits
## Existing Repo Pattern   — Files inspected / Pattern to reuse / Pattern NOT to copy  (OMIT this whole section if the topic is purely external)
## Decisions For Grill   — the specific decisions this research now lets the grill pin down

LEAN — accurate, not lengthy (HARD RULE):
- Three sharp lines beat a page. Every line must carry a planning implication or be deleted.
- BANNED: raw API dumps, link lists, pasted doc paragraphs, search trails, narrative diary.
- Aim under ~1 page. If you cannot back a claim with a cited primary source, cut it or mark it unknown.

Return the file path and a short structured summary. Do NOT research any other topic.`

const auditPrompt = (t, lens) => `You are an Atlas research AUDITOR. You are READ-ONLY on the report — you do NOT edit it. Adversarially audit ONE report through ONE lens. Default to skepticism: hallucinations are the enemy, and accurate-not-lengthy is the goal.

REPORT: ${resourcesDir}/${t.id}.md   (read it)
TOPIC (${t.id}): ${t.topic}
Expected sources: ${sourcesLine(t)}

LENS — ${lens.key}: ${lens.ask}

Verify against PRIMARY sources (fetch the official docs) and the ACTUAL repo code — never against the report's own assertions. For each problem, set action = fix (correctable with a real source), cut (unbacked or irrelevant — prefer this), or mark-unknown (genuinely unverifiable). Return clean:true ONLY if this lens has ZERO Must-Fix issues.`

const fixPrompt = (t, issues) => `You are an Atlas research worker fixing your report at ${resourcesDir}/${t.id}.md after an audit. Apply ONLY these Must-Fix items, then stop:

${issues.map((i, n) => `${n + 1}. [${i.action}] ${i.problem}${i.claim ? ` (claim: ${i.claim})` : ''}`).join('\n')}

Rules: verify each fix against the primary source / actual code BEFORE writing it. fix = correct the claim with a cited source; cut = delete the unbacked/irrelevant claim; mark-unknown = replace the claim with an explicit "unknown: <what's unverifiable>". The file must get SHORTER and truer, never longer. Keep the lean shape. Return revised:true and anything still genuinely unresolvable in stillOpen.`

const rollupPrompt = (results) => `You are writing the research ROLLUP — the ONE file the grill reads first. Write ${resourcesDir}/index.md.

The per-topic reports just landed in ${resourcesDir}/ (read them):
${results.map((r) => `- ${r.id} → ${r.file} (${r.status}${r.openItems.length ? `, ${r.openItems.length} open` : ''})`).join('\n')}

WRITE ${resourcesDir}/index.md as a LEAN DIGEST (not a concatenation):
# Research Index
## Reports          — one line each: <id> → the single fact/decision it grounds
## Capability Matrix — one row per topic: Supported | Unsupported | Unknown | key limit
## Decisions For Grill — the consequential decisions the research now lets the grill pin down
## Open Questions    — anything still unknown/unverified; carry forward, never hide
## Ready For Grill    — yes/no + one-line reason ("yes" only if every report exists and its hard unknowns are logged here)

Keep it scannable — three sharp lines beat a page. This digest plus the descriptive filenames are the MENU later agents scan; they open a full report only when they need its detail. Return the file path, readyForGrill, and the open questions.`

// Diverse audit lenses — each pass looks from a DIFFERENT angle (repetition catches less than diversity).
const LENSES = [
  { key: 'sourcing', ask: 'Does EVERY material claim cite a real primary source (official doc / actual source file)? Flag any uncited, vague, or blog-only assertion.' },
  { key: 'faithfulness', ask: 'Re-open the cited sources (fetch the docs / read the cited files). Does the source ACTUALLY say what the report claims? Flag any misread, overstated, or fabricated citation.' },
  { key: 'version', ask: "Check claims against the ACTUALLY-installed / pinned version in this repo (package manifests, lockfiles, installed source). Flag anything wrong for the version in use. If the topic is purely external, confirm the named version/edition is current." },
  { key: 'completeness', ask: 'What CRITICAL thing does the build need that the report omits? Flag gaps — but do NOT pad: a gap is Must-Fix only if the build would get it wrong without it.' },
]

// ---------------------------------------------------------------------------
// Per-topic: draft → audit (diverse lenses) → fix → re-audit failed lenses, bounded
// ---------------------------------------------------------------------------
async function researchTopic(t) {
  const file = `${resourcesDir}/${t.id}.md`
  const draft = await agent(workerPrompt(t), { label: `research:${t.id}`, phase: 'Research', schema: REPORT })
  if (!draft) return { id: t.id, status: 'failed', file, openItems: [`${t.id}: research worker produced no report`], decisionsForGrill: [] }

  let lensesToRun = LENSES
  let lastOpen = []
  let verified = false
  for (let round = 1; round <= cfg.maxAuditRounds; round++) {
    // Keep the lens identity even when an audit agent fails (null/throws), so a dropped lens is never
    // mistaken for a pass — it must re-run (or surface as open) before the topic can be called verified.
    const audits = await parallel(lensesToRun.map((lens) => () =>
      agent(auditPrompt(t, lens), { label: `audit:${t.id}:${lens.key}·r${round}`, phase: 'Research', schema: AUDIT })
        .then((res) => ({ lens, res })).catch(() => ({ lens, res: null }))))
    const ran = audits.filter((x) => x && x.res)
    const failedToRun = audits.filter((x) => x && !x.res).map((x) => x.lens)
    const unclean = ran.filter((x) => !x.res.clean)
    // verified ONLY when every lens this round actually ran AND was clean
    if (!unclean.length && !failedToRun.length) { verified = true; lastOpen = []; break }

    const mustFix = unclean.flatMap((x) => x.res.mustFix || [])
    // never let the open list be empty while unverified — cover the unclean-but-no-mustFix and failed-lens cases
    const residual = [
      ...unclean.filter((x) => !(x.res.mustFix && x.res.mustFix.length))
        .map((x) => `${t.id}: ${x.lens.key} audit unclean — ${x.res.notes || 'no specifics returned'}`),
      ...failedToRun.map((l) => `${t.id}: ${l.key} audit did not complete — re-run before relying on this report`),
    ]
    lastOpen = [...mustFix.map((i) => `${t.id}: ${i.problem}`), ...residual]

    lensesToRun = [...unclean.map((x) => x.lens), ...failedToRun] // re-verify the failed/unclean lenses; never silently drop one
    if (round === cfg.maxAuditRounds) break                       // terminal round: don't apply a fix we can't re-verify
    if (mustFix.length) await agent(fixPrompt(t, mustFix), { label: `fix:${t.id}·r${round}`, phase: 'Research', schema: FIX })
  }
  if (!verified) log(`⚠ ${t.id}: ${lastOpen.length} item(s) still open after ${cfg.maxAuditRounds} audit rounds — recorded as unknown/open, not silently passed`)
  return { id: t.id, status: verified ? 'verified' : 'open', file, openItems: verified ? [] : lastOpen, decisionsForGrill: draft.decisionsForGrill || [] }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
phase('Research')
log(`Researching ${topics.length} topic(s) into ${resourcesDir}/ — official-docs-first, ${cfg.maxAuditRounds}-round diverse-lens audit`)
const results = (await parallel(topics.map((t) => () => researchTopic(t)))).filter(Boolean)

phase('Rollup')
const rollup = await agent(rollupPrompt(results), { label: 'rollup:index', phase: 'Rollup', schema: ROLLUP })

const openQuestions = [...results.flatMap((r) => r.openItems), ...((rollup && rollup.openQuestions) || [])]
const verifiedCount = results.filter((r) => r.status === 'verified').length
log(`Research done: ${verifiedCount}/${results.length} topics fully verified; ${openQuestions.length} open question(s) carried to grill`)

return {
  initiativeId: cfg.initiativeId,
  topics: results.map((r) => ({ id: r.id, status: r.status, file: r.file, open: r.openItems, decisionsForGrill: r.decisionsForGrill })),
  index: rollup ? rollup.file : `${resourcesDir}/index.md`,
  readyForGrill: rollup ? !!rollup.readyForGrill : false,
  openQuestions,
}
