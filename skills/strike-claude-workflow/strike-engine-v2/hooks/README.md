# Strike v2 — Optional hooks layer (mechanical stall enforcement)

**Enforcement layer 3 of 3** (DESIGN §9.3). This is the *optional, opt-in* mechanical layer. The
engine runs **fully without it** and never assumes it is present; with it enabled, the engine gains
**sharper, earlier mid-build stall detection** — per-tool-call, instead of only the engine's
across-agent-call zero-progress signal.

> Skip this whole directory unless you want tighter loop-arrest. Nothing in the pipeline breaks if
> you never read it. **If you do enable it, do so deliberately — the hook is GLOBAL to the Claude
> Code session, not scoped to this initiative.** See [Honest tradeoff](#honest-tradeoff).

---

## 1. What it does

A Claude Code `PostToolUse` hook fires after every `Edit`, `Write`, and `Bash` tool call. It:

1. **Fingerprints** each call as `(tool + target-region + hash-of-resulting-error)`:
   - `tool` — `Edit` | `Write` | `Bash`.
   - `target-region` — for `Edit`/`Write`, the absolute file path; for `Bash`, the first executable
     token of the command (the program being run). This is the *region* the call acts on.
   - `hash-of-resulting-error` — a short stable hash of the call's failure text (normalized: line
     numbers, hex addresses, timestamps, and tmp paths stripped so the *same* error recurs to the
     *same* hash). Successful calls hash to `ok`.
2. **Counts repeats in a sliding window** — keeps the last `WINDOW` fingerprints. When the same
   `(tool, target-region, error-hash)` triple appears `≥ REPEAT_THRESHOLD` times in the window
   (error-hash ≠ `ok`), it is a **repeat** stall: the agent is re-applying the same change to the
   same place and getting the same failure.
3. **Detects footprint-escape** — if a `FOOTPRINT` file is present (a newline-delimited list of
   path globs the active slice is allowed to touch, written by the engine), any `Edit`/`Write`
   whose target path matches **no** glob is a **footprint-escape** stall (DESIGN §7 Channel A:
   "editing outside the slice's recorded footprint").
4. **Writes a stall-signal file** the engine reads if present (§2). Repeat → `signal: "repeat"`;
   footprint-escape → `signal: "footprint-escape"`. The hook **only writes**; it never blocks the
   tool call. Arrest is the engine's job (DESIGN §1.1: *the loop owns the triggers, never the
   agent*). The hook is a sensor, not an actuator.

It corroborates the same surface facts the engine already trusts (paths, recurring errors), so it
never invents a new judgement — it just sees them *between* agent calls, where the engine is blind.

This is the per-tool-call sharpening referenced by `disciplines/obstruction-loop.md` **Channel B**.
That discipline owns the zero-progress semantics; this file owns only the mechanism. Do not restate
Channel B here — read it there.

---

## 2. The stall-signal contract

The hook writes **one JSON file** that the engine polls. The engine's authoritative path (from
`.claude/workflows/strike-v2.mjs`) is:

```
strike/initiatives/<initiativeId>/.stall-signal.json
```

The hook discovers this path via the `STRIKE_STALL_SIGNAL` env var (the engine exports it; §3).
If the var is unset the hook is a no-op — so the same global hook stays silent outside a Strike run.

**Shape** (the contract — keep it stable; the engine reads exactly these fields):

```jsonc
{
  "sliceId": "p1-s3",            // optional; the active slice if STRIKE_SLICE_ID is set, else null
  "signal":  "repeat",          // "repeat" | "footprint-escape" | "no-progress"
  "count":   4,                 // occurrences of this fingerprint in the window (repeat),
                                //   or footprint-escape count; ≥1
  "target":  "src/auth/jwt.ts", // the target-region: file path, or Bash program token
  "ts":      "2026-06-01T20:55:00.000Z"  // ISO-8601 write time
}
```

| Field     | Type             | Meaning |
| --------- | ---------------- | ------- |
| `sliceId` | `string \| null` | Active slice id (`STRIKE_SLICE_ID`) or `null`. |
| `signal`  | enum             | `repeat`, `footprint-escape`, or `no-progress`. |
| `count`   | number ≥ 1       | Repeats of the firing fingerprint in the window. |
| `target`  | string           | The target-region that stalled (file path or Bash program). |
| `ts`      | ISO-8601 string  | When the hook wrote it. |

`no-progress` is reserved for an engine-written variant of this same file (the engine may write it
on its own Channel-B zero-progress trip so all three signals share one reader); the hook itself
emits only `repeat` and `footprint-escape`.

**Engine read semantics (already implemented — do not re-implement here):** before/within each
build step the engine reads this file if present and treats the signal as a **hard instruction to
step back / revert-and-reset** (per `disciplines/altitude-stepback.md`) rather than push the same
approach (strike-v2.mjs `HANDS_OFF`). **The engine deletes the file once consumed**; the hook only
ever *creates/overwrites* it. One-writer-per-side keeps it race-free without locking.

**Verdict — `stall-signal-well-formed` (PASS when):** the file is valid JSON, `signal` is one of the
three enum values, `count ≥ 1`, `target` is a non-empty string, and `ts` parses as a date. A
malformed file is ignored by the engine (degrade gracefully), so a buggy hook can never wedge a run.

---

## 3. Enable it — ready-to-paste

### 3a. `settings.json` snippet

Paste into your Claude Code `settings.json` (user-level `~/.claude/settings.json`, or project
`.claude/settings.json`). Adjust the absolute path to where you vendored this directory.

```jsonc
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node /ABSOLUTE/PATH/TO/strike-engine-v2/hooks/stall-hook.mjs"
          }
        ]
      }
    ]
  }
}
```

The hook reads the tool call from `stdin` (Claude Code passes the `PostToolUse` event as JSON),
reads its config from env, and exits `0` regardless — it is **non-blocking by construction** (it
never returns a `block` decision), so a hook bug can slow nothing and stop nothing.

### 3b. Environment (exported by the engine; set manually only to test)

| Env var                | Set by | Purpose |
| ---------------------- | ------ | ------- |
| `STRIKE_STALL_SIGNAL`  | engine | Absolute path to write the signal file. **Unset ⇒ hook is a no-op.** |
| `STRIKE_FOOTPRINT`     | engine | Absolute path to a newline-delimited list of allowed path globs for the active slice. Absent ⇒ footprint-escape detection is skipped (repeat detection still runs). |
| `STRIKE_SLICE_ID`      | engine | Active slice id, copied into `sliceId`. Optional. |
| `STRIKE_STALL_WINDOW`  | you    | Sliding-window size. Default `12`. |
| `STRIKE_STALL_REPEATS` | you    | Repeat threshold. Default `3`. |

The window state lives in a sibling temp file next to the signal path
(`<signal>.window.json`), so counts persist across the separate process invocations of the hook.

---

## 4. The hook script

Self-contained, zero dependencies (Node ≥ 18). Save as
`strike-engine-v2/hooks/stall-hook.mjs` and point the snippet at it.

```js
#!/usr/bin/env node
// strike-engine-v2/hooks/stall-hook.mjs
// Strike v2 OPTIONAL PostToolUse stall sensor. Non-blocking by construction: always exits 0,
// never returns a block decision. No-op unless STRIKE_STALL_SIGNAL is set (so it is safe global).
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'

const out = process.env.STRIKE_STALL_SIGNAL
if (!out) process.exit(0)                                 // not in a Strike run → silent

const WINDOW  = Number(process.env.STRIKE_STALL_WINDOW  || 12)
const REPEATS = Number(process.env.STRIKE_STALL_REPEATS || 3)
const winFile = out + '.window.json'

const safe = (fn, d) => { try { return fn() } catch { return d } }
const fail = (e) => process.exit(0)                       // any error ⇒ no-op, never disrupt the run

// 1. Read the PostToolUse event from stdin.
const raw = safe(() => readFileSync(0, 'utf8'), '')
const ev  = safe(() => JSON.parse(raw), null)
if (!ev) fail()

const tool = ev.tool_name || ev.toolName || ''
if (!['Edit', 'Write', 'Bash'].includes(tool)) process.exit(0)
const input = ev.tool_input || ev.toolInput || {}
const resp  = ev.tool_response || ev.toolResponse || {}

// 2. target-region: file path for Edit/Write, first command token for Bash.
const target = tool === 'Bash'
  ? String(input.command || '').trim().split(/\s+/)[0] || '<empty>'
  : String(input.file_path || input.filePath || '<unknown>')

// 3. error text → normalized → short hash ('ok' when the call succeeded).
const errText = [
  resp.is_error || resp.error ? (resp.stderr || resp.error || resp.output || '') : '',
  ev.error || '',
].join('\n').trim()
const norm = errText
  .replace(/0x[0-9a-f]+/gi, '0x_')      // addresses
  .replace(/:\d+(:\d+)?/g, ':_')        // line:col
  .replace(/\b\d{4}-\d{2}-\d{2}[T \d:.Z+-]*/g, '_ts_')  // timestamps
  .replace(/\/tmp\/\S+|\/var\/folders\/\S+/g, '/_tmp_') // ephemeral paths
  .slice(0, 4000)
const errHash = errText ? createHash('sha1').update(norm).digest('hex').slice(0, 12) : 'ok'

const fp = `${tool}${target}${errHash}`

// 4. sliding window (persisted between process invocations).
const win = safe(() => JSON.parse(readFileSync(winFile, 'utf8')), [])
win.push(fp)
while (win.length > WINDOW) win.shift()
safe(() => writeFileSync(winFile, JSON.stringify(win)), null)

const emit = (signal, count) => safe(() => writeFileSync(out, JSON.stringify({
  sliceId: process.env.STRIKE_SLICE_ID || null,
  signal, count, target, ts: new Date().toISOString(),
}) + '\n'), null)

// 5a. footprint-escape (Edit/Write only) — target outside the slice's allowed globs.
const fpFile = process.env.STRIKE_FOOTPRINT
if (fpFile && existsSync(fpFile) && tool !== 'Bash') {
  const globs = safe(() => readFileSync(fpFile, 'utf8'), '')
    .split('\n').map((s) => s.trim()).filter(Boolean)
  const toRe = (g) => new RegExp('^' + g.split('**').map((p) =>
    p.split('*').map((q) => q.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')
  ).join('.*') + '$')
  const allowed = globs.length === 0 || globs.some((g) => safe(() => toRe(g).test(target), false))
  if (!allowed) { emit('footprint-escape', 1); process.exit(0) }
}

// 5b. repeat — same (tool,target,error) ≥ threshold in the window, error ≠ ok.
if (errHash !== 'ok') {
  const count = win.filter((x) => x === fp).length
  if (count >= REPEATS) emit('repeat', count)
}
process.exit(0)
```

**Adapting the event shape:** Claude Code's `PostToolUse` payload field names can vary by version
— the script reads both snake_case and camelCase and falls back to no-op on anything unexpected, so
a shape mismatch degrades to "hook does nothing," never to a broken run. If your version nests the
tool result differently, adjust the `resp`/`errText` extraction only; the contract (§2) is fixed.

---

## 5. Honest tradeoff

**This layer is OPTIONAL. Read this before enabling.**

- **The engine works fully without it.** All three obstruction-detection mechanisms ship in the
  engine + agent prompts: Channel A (declared `Obstruction`, corroborated against the diff) and
  Channel B (engine-measured zero-progress across agent calls) per
  `disciplines/obstruction-loop.md`. The hook adds **none** of the pipeline's correctness — it adds
  *latency reduction* on the stall trip: the engine's Channel B can only fire **after**
  `maxFixAttempts` whole agent calls; the hook can fire **within** a single agent's tool loop.
- **What you gain WITH it:** sharper, earlier mid-build detection — a tight repeat-edit or a
  silent footprint-escape gets a signal before the agent burns a full fix-attempt budget.
- **What it costs:** the hook is **GLOBAL to the Claude Code session**, not scoped to a Strike run.
  Once in `settings.json` it fires on *every* `Edit`/`Write`/`Bash` in that session. It is designed
  to be inert outside a run (no-op unless `STRIKE_STALL_SIGNAL` is set, always exits 0,
  never blocks), so the blast radius is bounded — but it is still global state you opted into.
  **Enable deliberately; prefer project-level `.claude/settings.json` over user-level** so it lives
  and dies with the repo where you run Strike.
- **It never decides, only senses.** Consistent with DESIGN §1.1, the hook writes a signal; the
  engine owns the trigger. A buggy or malformed signal is ignored by the engine
  (`stall-signal-well-formed` fails → degrade gracefully), so the hook can never wedge or
  false-arrest a run — at worst it goes silent.

**Recommendation:** leave it off for normal runs; switch it on for long, obstruction-heavy
initiatives where you want the loop arrested a fix-attempt sooner.
