# Surface Pack: Infra-as-Code

A **first-class** modality pack conforming to the uniform pack interface in `surfaces/_registry.md`
(DESIGN §5): `detect` → `guardrails[{surface, when, check, oneWayDoor}]` → `verification` →
`modelingNotes`. It owns the modality where **the code's effect is provisioning, mutating, or
destroying real infrastructure** — Terraform/OpenTofu, Pulumi, CloudFormation/CDK/SAM, Kubernetes
manifests/Helm/Kustomize, and Ansible.

The core insight that shapes the whole pack: in this modality **an `apply` is a one-way door by
default.** The plan/dry-run is the cheap, reversible place to find the destroy you didn't intend —
so the entire verification core is "inspect the plan, never apply." The fired surfaces below feed
`disciplines/risk-tiering.md`'s domain-surface gate; where this pack and another disagree on a
guardrail, the registry's **stricter / more one-way** rule wins.

---

## `detect`

Run over the slice's plan + changed files. Any match flags this pack and the listed surface(s).

| Signal (file glob · path · content) | Flags |
| --- | --- |
| `*.tf`, `*.tf.json`, `*.tfvars`, `.terraform.lock.hcl`, `terraform/` dirs | Terraform/OpenTofu → **iac** |
| `Pulumi.yaml`/`Pulumi.*.yaml`, `@pulumi/*` imports, `pulumi.Stack`/`new aws.*` resource ctors | Pulumi → **iac** |
| `template.yaml`/`*.template.json` with `AWSTemplateFormatVersion`/`Resources:`, `cdk.json`, `aws-cdk-lib`, SAM `Transform:` | CloudFormation/CDK/SAM → **iac** |
| k8s manifests (`apiVersion:`+`kind:` YAML), `kustomization.yaml`, `Chart.yaml`/`templates/*.yaml`, `values*.yaml` | Kubernetes/Helm/Kustomize → **iac** |
| `playbook*.yml`, `roles/*/tasks/`, `ansible.cfg`, `inventory`/`hosts` | Ansible → **iac** |
| Resource verbs in any of the above touching **stateful** kinds: a DB/instance/volume/bucket/disk, `aws_db_instance`, `aws_s3_bucket`, `PersistentVolumeClaim`, `StatefulSet`, `google_sql_*`, `azurerm_*_database` | **iac** + **stateful-resource** |
| A diff that `destroy`s, `replace`s (delete-then-create), renames a resource address, or changes a `ForceNew`/immutable attribute | **iac** + **destructive-op** |
| Secrets in config or state: literal credentials, `*.tfstate`/`*.tfstate.backup` in tree, k8s `Secret` with inline `data:`, unencrypted state backend | **iac** + **secrets-in-state** (→ `security`/`PII` per risk-tiering) |

**Maps onto risk-tiering's domain surfaces:** **iac** with a write/apply path ⇒ **persistence/migration**
and **external-effect** (provisioning is a foreign-state mutation a retry can double-apply);
**stateful-resource** destroy/replace ⇒ **destructive op**; **secrets-in-state** ⇒ **security**
(and **PII** if the secret guards regulated data). Any of these fired ⇒ the slice is **CRITICAL /
FULL lane** by `disciplines/risk-tiering.md` — do not re-derive that here; this pack only supplies
the signals and the guardrails.

A read-only/inspection-only change (a comment, a `description`, an output value, a non-`ForceNew`
tag on a non-stateful resource that the plan confirms is an in-place **update**) flags **iac** but
fires no destructive guardrail — keep ceremony off the no-op.

---

## `guardrails`

`when` is the firing condition; `check` is the named, checkable PASS criterion; `oneWayDoor` routes
`disciplines/obstruction-loop.md` (one-way ⇒ Tier 3 escalation, never "just apply it").

| # | surface | when | check (named PASS criterion) | oneWayDoor |
| --- | --- | --- | --- | --- |
| G1 | **iac** | **always** — any apply/converge/sync is contemplated | `plan_before_apply`: a `plan`/dry-run/diff was generated and **read** before any state-mutating command; no `apply`/`up`/`create-change-set`+execute/`kubectl apply`/`ansible-playbook` (without `--check`) runs in plan, build, **or** verification without a reviewed plan first | yes (the apply is the door) |
| G2 | **iac** + **stateful-resource** | the plan shows a `destroy` or `replace` (delete+create) of a stateful resource (DB, volume, bucket, PVC, StatefulSet, anything holding data or with a stable identity/endpoint) | `no_stateful_oneway`: **zero** unintended destroy/replace of a stateful resource; any *intended* one is called out explicitly, has a backup/snapshot or `prevent_destroy`/`deletionPolicy: Retain` (or k8s finalizer) guard named in the plan, and is escalated as Tier 3 — it is **never** taken silently because the plan said so | yes |
| G3 | **iac** + **destructive-op** | the diff renames a resource address, flips a `ForceNew`/immutable field, or reorders a `count`/`for_each` such that resources shift | `move_not_recreate`: the change is expressed as a **non-destructive move** (`terraform state mv` / `moved {}` block / `import`, Pulumi `aliases`, CFN logical-id retention) where one exists, so the plan shows **update/move, not delete+create**; if no non-destructive path exists it is G2 | yes |
| G4 | **iac** (drift) | the slice edits resources that may already have **out-of-band drift** (manual console changes, another pipeline, a shared environment) | `drift_aware`: a fresh `plan`/`refresh` (or `terraform plan -refresh-only`, `pulumi refresh`, `kubectl diff`, `helm diff`) was run against **live** state so the diff reflects reality-vs-desired, not stale state; any drift surfaced is reconciled or recorded, not overwritten blindly | no (detecting drift is safe; **resolving** it may be G2) |
| G5 | **iac** + **secrets-in-state** | the change places a secret/credential into state, into a committed file, or into an unencrypted backend, or reads one into a plan output | `secrets_protected`: no plaintext secret in committed config, in `*.tfstate`, in a plan/output rendered to logs, or in a k8s `Secret`'s inline `data:`; secrets come from a manager (Vault/SSM/Secrets Manager/sealed-secrets) and state lives in an **encrypted, access-controlled** backend; canonical lens (`disciplines/canonical-research.md`) confirms the proven secrets pattern for this stack | yes |
| G6 | **iac** (irreversible delete) | the slice removes a resource block / manifest, or sets a deletion/lifecycle policy that drops data | `delete_is_reversible_or_escalated`: a delete that destroys data or breaks a live consumer carries an explicit backup/retention guard and is Tier-3 escalated; deletes of empty/stateless/ephemeral resources confirmed by the plan may proceed | yes (data/consumer-affecting); no (stateless) |
| G7 | **iac** (state lock) | any command that acquires the state lock (apply, and most `plan`/`refresh` on locking backends) | `state_lock_clean`: the slice does not assume an exclusive lock it cannot get; concurrent-run / held-lock / `force-unlock` situations are acknowledged, and the plan/verification does not break or steal another holder's lock | no |

**Conservative-by-rule (feeds `disciplines/obstruction-loop.md` §3):** because **persistence/migration
+ external-effect** fire for any apply, IaC reversibility is **one-way by rule** the moment a
state-mutating path is in play — `reversibility:"unknown"` is treated as one-way. A stateful
destroy/replace (G2/G3/G6) is a **one-way door**: it goes to **Tier 3** (write the ADR, drop the
`ARCH-DEBT(<slice-id>)` marker, proceed on a `reversibleInterim` — e.g. a `create_before_destroy`
seam, a renamed-not-deleted resource, a flag-gated default-off resource — and `routeBack` if the
spec/phase shape forces the destroy). Do not restate the obstruction protocol; apply it.

---

## `verification`

Resolves what **"real entry point with real data" (R2 in `disciplines/honest-verification.md`)**
means for this modality. **The plan/dry-run IS the entry point here — `apply` is forbidden in
verification.** Applying to prove a change works walks through the one-way door the whole pack
exists to guard.

**R2 — `iac_plan_inspected` (the spine):** generate the plan/dry-run against **live state** and
**read the diff**, asserting all of:

- [ ] **No unintended destroy/replace.** Enumerate the plan's change summary (`N to add, M to
      change, K to destroy/replace`). Every destroy/replace is **intended and named** in the slice's
      plan; an unexpected one is an **immediate FAIL** (it is the confidently-wrong signature — the
      change "works" but silently recreates a database). For stateful resources this is G2.
- [ ] **The intended change is present and shaped right** — the resource the slice adds/changes
      appears in the diff as the spec-stated create/update (right type, right key attributes), not
      a no-op and not a surprise replace.
- [ ] **Blast radius counted** — record the add/change/destroy/replace counts; a destroy/replace
      count that exceeds what the slice's plan declared is a FAIL pending reconciliation.
- [ ] **Drift reconciled** (G4) — the plan was run against refreshed live state; surfaced drift is
      explained, not silently overwritten.
- [ ] **Idempotent re-plan** — re-running `plan` immediately after (no apply) shows the **same**
      pending diff (provider non-determinism / perpetual-diff bugs caught here). For Ansible/k8s,
      the analogue is a `--check`/`--dry-run=server` run that converges to "no changes" on a
      no-op replay.

The exact command per stack: Terraform/OpenTofu `plan`/`plan -refresh-only`; Pulumi `preview`;
CloudFormation `create-change-set` + `describe-change-set` (do **not** execute it); CDK `cdk diff`;
SAM `sam deploy --no-execute-changeset`; k8s `kubectl diff -f` / `kubectl apply --dry-run=server`;
Helm `helm diff upgrade` or `helm template` + `helm upgrade --dry-run`; Kustomize `kustomize build`;
Ansible `ansible-playbook --check --diff`.

**R3 — negative/edge probe (mandatory, CRITICAL):** because every applying IaC slice is CRITICAL,
R3 is required. Exercise at least one of, through the plan:

- **Destroy probe** — confirm a `prevent_destroy` / `deletionPolicy: Retain` / finalizer actually
  blocks the destroy (the plan errors or the resource is retained), proving the guard is real, not
  decorative.
- **Bad-input rejection** — an invalid value (out-of-range size, missing required var, malformed
  policy) is rejected at `plan`/`validate` (e.g. `terraform validate`, `kubeval`/`kubeconform`,
  `cfn-lint`, `helm lint`) with a structured error — not silently defaulted.
- **Drift probe** — introduce/observe a known drift and confirm the plan surfaces it.

**State-lock awareness:** verification must not hold or steal a lock another run needs (G7); use
read-only refresh where possible and release promptly.

**`verified` vs `code-verified` (per `disciplines/honest-verification.md`):** a plan inspected
clean is **`verified` at R2** for this modality — the apply is *deliberately* out of scope, so a
clean, idempotent, no-unintended-destroy plan **is** the real behavior check, not a downgrade. Use
**`code-verified`** only when even the plan/dry-run is unreachable (no cloud credentials, no live
state backend, provider unavailable): list the exact blocker, the residual risk (the diff not
inspectable against live state), and `ladderReached`. Never report `verified` off a plan you did
not actually run and read — a pasted or assumed plan is a tamper (claiming a rung not reached).

The **canonical** and **security** lenses (mandatory for CRITICAL) resolve to: the proven module/
pattern for this resource (vetted registry module, official Helm chart, AWS-published policy) over
a hand-rolled one, least-privilege IAM/RBAC, encrypted state, and G5 secrets handling — via
`disciplines/canonical-research.md`. The tautology/test-tamper audit is owned by the **verifier
step (S3/S5), not the implementer**, per that discipline.

---

## `modelingNotes`

Modality-specific naming/tagging guidance; the `disciplines/adjective-noun.md` field-not-table lens
maps here to **field-not-new-resource** (an attribute/tag/variant on a noun is a property or a
`for_each` key on the existing resource, not a brand-new copy-pasted resource block) — apply that
discipline, don't restate it.

- **Resource naming** — names are part of the contract: many providers treat a name change as a
  **destroy+create** (G3). Prefer stable logical names + `for_each`/`count` keyed on a stable
  identifier over positional indexes (reindexing `count` recreates resources). A rename you *must*
  do is a `moved {}` / `state mv` / alias, never an edit-in-place that the plan turns into a replace.
- **Tagging convention** — every taggable resource carries the org's required tags (owner,
  environment, cost-center, managed-by-IaC, data-classification). Tags are **fields on the
  resource**, centralized via `default_tags`/a tags module/a Helm label template — never a parallel
  resource and never hand-duplicated per block.
- **One resource, many environments** — environment is a **variable/workspace/stack/overlay**
  (a value on the same definition), not a forked, copy-pasted set of resources. A "prod database"
  and a "staging database" are the same resource definition parameterized — the adjective-noun
  smell of duplicated near-identical resource blocks per env is over-split; collapse to one
  parameterized definition.

---

## Pack gate (PASS condition, named)

This pack is **satisfied** for an IaC slice iff:

1. **`plan_before_apply`** (G1) — a real plan/dry-run was generated and read; **no `apply`** ran in
   plan/build/verification without it (and none ran in verification at all).
2. **`no_stateful_oneway`** (G2/G3/G6) — the plan shows **no unintended** destroy/replace; every
   intended stateful destroy is guarded, named, and Tier-3 escalated via `obstruction-loop`.
3. **`drift_aware`** (G4) — the plan ran against refreshed live state; drift surfaced is handled.
4. **`secrets_protected`** (G5) — no plaintext secret in config/state/output/logs; encrypted backend.
5. **`iac_plan_inspected`** (R2) — blast radius counted, intended change present, re-plan idempotent;
   `state_lock_clean` (G7) held; canonical + security lenses passed (CRITICAL).

All hold → pack PASS. Any fails → the step names the failing criterion in `failedCriterion`
(e.g. `no_stateful_oneway: plan destroys aws_db_instance.main, not in slice plan`). An unintended
stateful destroy/replace or a plaintext secret is a **Must-Fix**, never a nitpick — and a one-way
door, so it routes to Tier 3, not to a quick apply.
