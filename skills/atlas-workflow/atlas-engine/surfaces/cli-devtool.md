# Surface pack: cli-devtool

A **first-class** modality pack (DESIGN §5). Owns the surfaces of **command-line entry points** —
CLIs, subcommands, scripts, devtools, generators, build/release tooling. Conforms to the uniform
pack interface in `surfaces/_registry.md` (`detect` / `guardrails` / `verification` /
`modelingNotes`); the registry runs detection and resolves multi-pack conflicts to the stricter
guardrail. This file is the **contents** of those four keys for this modality — never the mechanism.

> A CLI's API is its **invocation contract**: the exit code, the stdout/stderr split, and the
> flag/arg surface. Consuming scripts and CI depend on all three by value. A silent change to any of
> them is the confidently-wrong class (DESIGN §1.11) — it "works" in a terminal and breaks a pipe.

---

## detect

The slice touches this pack iff **any** trigger fires over the slice plan + `changedFiles`. Each
fired trigger sets the named surface flag(s) it owns (right column); those flags arm the matching
guardrails below.

| Trigger (file globs / imports / path conventions / keywords / AST signal) | Surface flag(s) set |
| --- | --- |
| **CLI framework import/use** — py `argparse`/`click`/`typer`/`sys.argv`; js `commander`/`yargs`/`oclif`/`process.argv`; go `cobra`/`flag`/`urfave/cli`/`os.Args`; rust `clap`/`std::env::args`; ruby `optparse`/`thor` | `cli.entrypoint`, `cli.flags` |
| **Declared executable entry** — `package.json#bin`, `[project.scripts]`/`console_scripts` (pyproject/setup), `Cargo.toml#[[bin]]`, a `main()` that parses args, `#!`-shebang script, `Makefile`/`Justfile`/`Taskfile` target | `cli.entrypoint` |
| **Subcommand / verb routing** — a command dispatch table, `add_subparsers`, `commander.command(...)`, cobra `AddCommand`, clap subcommands | `cli.subcommand`, `cli.flags` |
| **A flag / positional arg / option is added, renamed, removed, or its type/default/required-ness changes** | `cli.flags` (+ `cli.compat` if pre-existing) |
| **Exit-code logic** — `sys.exit(n)`/`process.exit(n)`/`os.Exit(n)`/`return code`, or a `try/except`→exit path | `cli.exitcode` |
| **Writes to stdout/stderr** — `print`/`console.log`/`fmt.Print*`/`println!`/`echo`, logging-to-stdout, a `--json`/`--quiet`/`--verbose` path | `cli.streams` |
| **Destructive / mutating op invoked by command** — delete/overwrite/drop/reset/prune/force-push/migrate/deploy, writes outside cwd, network mutation | `cli.destructive` (and the owning domain pack's surface, e.g. web-backend migration/money — both apply, §below) |
| **Idempotency is claimed** — help text / spec says "safe to re-run", `--force`-only-on-change, a sync/apply/ensure verb | `cli.idempotent` |
| **Devtool that emits consumable output** — codegen, scaffolder, formatter, linter, reporter whose stdout/files feed another tool | `cli.streams`, `cli.contract` |

**Modality entry-point fact for the verification core (DESIGN §5):** *real entry point with real
data* = **invoke the built command as a user/script would** (the installed binary or the documented
run command — `python -m pkg`, `node ./bin/cli.js`, `cargo run --`, `./script.sh`, the `bin` alias),
with **real arguments**, and observe exit code + the two streams. Not "call the handler function in
a unit test" — that bypasses arg parsing, exit mapping, and stream routing, which are the contract.

**Multi-pack composition.** A CLI is frequently a *thin shell over a domain*: a `migrate` command
also fires web-backend (migration, one-way), a `refund` command also fires web-backend (money). When
`cli.destructive` or a domain trigger fires, **both packs' guardrails apply**, and the registry
resolves to the **stricter / more one-way** (DESIGN §5). This pack guards the *invocation surface*;
the domain pack guards the *effect*. Do not duplicate the domain rule here — read it from its pack.

---

## guardrails

Format per `surfaces/_registry.md`: `{ surface, when, check, oneWayDoor }`. A guardrail attaches
**only when its `when` fires** (surface-triggered rigor, DESIGN §1.8). Each `check` is the named,
checkable PASS criterion the verifier asserts.

| surface | when | check (named PASS criterion) | oneWayDoor |
| --- | --- | --- | --- |
| `cli.exitcode` | any exit path touched | **`exit_contract`** — success path exits **0**; every failure mode exits a **documented, non-zero, distinct-enough** code (convention: 1 = generic error, 2 = usage/CLI-misuse; reserve others by table in `--help`/spec). No path exits 0 on a real failure, and no uncaught exception leaks a stack trace as the exit story. | no |
| `cli.streams` | any stdout/stderr write | **`stream_split`** — **stdout carries the data/result only; stderr carries logs, progress, prompts, diagnostics, warnings.** They are never interleaved on one stream. A machine reading stdout (piped, redirected) gets clean parseable output with zero log noise. | no |
| `cli.contract` | devtool output is consumed by another tool, or `--json`/structured mode exists | **`output_contract`** — stdout format is **stable and documented** (the schema/shape a consumer parses); structured mode (`--json`) is valid, complete, and unpolluted by human-only text. A format change is treated as a `cli.compat` break. | yes (consumed format) |
| `cli.compat` | a **pre-existing** flag/arg/subcommand/exit-code/output-shape is renamed, removed, retyped, or has its default/required-ness changed | **`flag_compat`** — the change is **additive, not breaking** (taxonomy below). A breaking change to a consumed surface is **one-way for every script/CI/alias that calls it** → it is an obstruction, not a quiet edit. | **yes** |
| `cli.destructive` | command deletes/overwrites/drops/resets/force-pushes/deploys/mutates external state | **`destructive_guard`** — the destructive effect is **gated behind explicit confirmation** (interactive prompt **on stderr** + an explicit `--force`/`--yes` to bypass for non-interactive use); a non-TTY invocation **without** the bypass flag **refuses and exits non-zero**, it does not silently proceed. Dry-run (`--dry-run`/`-n`) available where feasible. | **yes** (effect is one-way) |
| `cli.idempotent` | help/spec claims re-runnable / "safe to re-run" / sync/apply/ensure semantics | **`idempotent_proof`** — re-running the **same command with the same args** a second time is a **no-op** (same exit code, no duplicate effect, "nothing to do"-class output) — *claimed* idempotency is **proven by the double-invoke in verification**, never assumed. | no |
| `cli.flags` | any flag/arg/subcommand added or changed | **`help_documented`** — `--help` (and per-subcommand `--help`) **runs, exits 0, and documents** every flag/arg the slice adds or changes, including its type, default, and whether required; the exit-code table and any destructive bypass flag are discoverable there. | no |

**`flag_compat` taxonomy (the additive-vs-breaking decision, named).** Mirrors the web-backend
contract taxonomy for the CLI surface:

- **Additive (safe, ship freely):** a *new optional* flag/arg with a backward-compatible default; a
  *new* subcommand; a *new* accepted value of an existing option that does not change old values'
  meaning; a *new* exit code for a *previously-unhandled* failure; *added* lines to `--help`.
- **Breaking (one-way for consumers — DESIGN §1.9, money/migrations/auth/external-effects one-way by
  rule):** removing/renaming a flag, arg, or subcommand; making an optional arg required or changing
  its type/order/default; **repurposing an exit code** (0→nonzero or changing what a code means);
  **changing stdout's shape/format** in a consumed mode; tightening previously-accepted input.
- **Verdict.** A breaking change is permitted **only** via the **expand/contract** path — *add the
  new surface, keep the old working with a deprecation warning on **stderr** (never stdout), remove
  the old in a later, separately-argued slice.* A bare break is an **`Obstruction`**
  (`disciplines/obstruction-loop.md` Channel A: a changed public contract not in the plan ⇒ Tier 3,
  `reversibility:"one-way"`): write the ADR, drop the `ARCH-DEBT(slice-id)` marker, proceed on the
  expand/contract interim. **Do not** silently break a consumed flag.

---

## verification

What "verified" means for this pack — the per-rung resolution of `disciplines/honest-verification.md`
(R0→R4). This pack defines **R2** (the spine) for CLI slices and supplies the R3 negative probes; it
does not restate the ladder or the tamper audit.

**R2 — `R2_real_entry` for a CLI slice = INVOKE the command.** The verifier (S5, not the implementer)
**runs the actual command** through its documented entry point with **real args**, and asserts, as
named sub-checks, the full invocation contract:

- [ ] **`exit_contract`** — happy-path invocation exits **0**; at least one real failure-mode
      invocation exits the **documented non-zero** code. Assert the *numeric* code (`$?` / captured
      exit status), not just "it errored."
- [ ] **`stream_split`** — capture stdout and stderr **separately** (`cmd >out 2>err`). Assert the
      result/data is on **stdout** and is clean (pipe-safe: `cmd | <consumer>` works); logs/progress/
      warnings are on **stderr**. A diagnostic found on stdout, or data found only on stderr, FAILS.
- [ ] **`help_documented`** — `<cmd> --help` and `<cmd> <subcmd> --help` each run and **exit 0**, and
      the changed flags/args appear in the output. (`--help` must never exit non-zero.)
- [ ] **`output_contract`** (when `cli.contract` fired) — pipe stdout into the real consumer / parse
      `--json`; assert it parses and matches the documented shape against a **spec-stated** example
      (not blessed from current output — that is a tamper, `honest-verification` audit).

**R3 — negative + idempotency probes (mandatory for CRITICAL; `cli.destructive`/domain ⇒ CRITICAL via
`disciplines/risk-tiering.md`).** Exercised through the **real invocation**, not only as unit tests:

- [ ] **Bad-usage probe** — invoke with a missing required arg / unknown flag / wrong-type value;
      assert a **usage error on stderr + non-zero exit** (convention 2), **not** a stack trace, **not**
      exit 0, **not** a silent default.
- [ ] **`destructive_guard` probe** (when `cli.destructive`) — invoke the destructive command in a
      **non-TTY** context **without** `--force`/`--yes`; assert it **refuses and exits non-zero** and
      did **not** perform the effect; then with the bypass flag assert it performs exactly once. Run
      `--dry-run` and assert **zero** mutation. (The effect itself is verified per its **domain pack**.)
- [ ] **`idempotent_proof` probe** (when `cli.idempotent`) — invoke twice with identical args; assert
      the **second run is a no-op** (same/zero exit, no duplicated effect). A claimed-idempotent
      command that mutates on re-run FAILS.

**`code-verified` fallback (honest, not a pass-grade).** If the command genuinely cannot be invoked
in this environment (needs a credential/daemon/target it cannot reach), report **`code-verified`** per
`disciplines/honest-verification.md`: name the exact blocker, the residual risk (the part of the
invocation contract not exercised), and `ladderReached`. For a STANDARD/CRITICAL CLI slice that is
**`verdict:BLOCKED`** (`failedCriterion: R2_real_entry blocked`) — never a silent green. Prefer
running against a **temp dir / fixture / `--dry-run`** before declaring it unreachable; most CLIs are
the *most* invocable surface there is.

**R4 — `R4_compose`:** when the command is itself called by another script/Make target/CI step in the
repo, exercise it **through that caller** end-to-end (the pipe + exit-code contract is what the caller
depends on).

---

## modelingNotes

Refines (never overrides) `disciplines/adjective-noun.md` for the CLI command tree. The "table" of
this modality is the **command/flag namespace** and the config/message record (see that module's
modality map).

- **Core noun before qualifier.** Name a subcommand `<noun> <verb>` / `<resource> <action>` —
  `user create`, `db migrate`, `cache clear` — not `create-user`, `clear-the-cache`. The core noun
  groups; the qualifier specializes. This is the adjective-noun lens at the command surface: a
  qualifier on a noun is a **flag/value/subcommand under the existing command group**, not a new
  top-level command. `user create --admin`, never a separate `create-admin-user` command.
- **A flag is a field on the invocation, not a new command.** "verbose run", "dry run", "forced
  delete" are `--verbose` / `--dry-run` / `--force` on the existing verb — the same
  `union-over-split` smell as cloning a command per mode. Do not fork `deploy` into
  `deploy-fast`/`deploy-safe`; that is a `--mode`/flag.
- **Consistency is contract.** Reuse the repo's existing flag spellings, exit-code table, and the
  stdout-data/stderr-logs split (find them via `disciplines/read-before-write.md` before adding) — a
  new command that invents `--out`/`-o` where the rest of the tool uses `--output` is a usability and
  compat hazard.
- Config/message **structs** the CLI reads or emits follow `adjective-noun.md` directly: a state of a
  config is an enum field, not a new config type or a new subcommand per state.

---

## Pack gate (named)

`surface:cli-devtool` is **satisfied** for the slice iff: every **fired** surface's guardrail `check`
above is PASS (`exit_contract`, `stream_split`, `output_contract`, `flag_compat`, `destructive_guard`,
`idempotent_proof`, `help_documented` — each only when its `when` fired), the R2 **invoke-the-command**
check ran (or `BLOCKED` is honestly recorded with residual risk), and any breaking `flag_compat` was
routed as an `Obstruction` with its ADR + `ARCH-DEBT` marker — not silently shipped. The gate **FAILs**
naming the specific failed criterion (e.g. `stream_split` FAIL: logs on stdout; or `flag_compat` FAIL:
`--input` removed without expand/contract). Where a domain pack co-fired, its gate must also pass; the
stricter guardrail wins.
