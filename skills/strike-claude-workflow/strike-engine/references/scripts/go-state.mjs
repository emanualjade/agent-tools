#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const DEFAULT_STATE_PATH = "strike/state.json";
const WORKSPACE_ROOT = "strike";
const LANGUAGE_FILE = "PROJECT_LANGUAGE.md";
const USER_GUIDANCE_DIR = "user-guidance";
const IMPLEMENTATION_DISCIPLINE_DIR = "implementation-discipline";
const REVIEW_LENSES_DIR = "review-lenses";
const IMPLEMENTATION_DISCIPLINE_TEMPLATES = new Map([
  [
    "global.md",
    `# Global Implementation Discipline

User/project-specific coding guidance for every Strike implementation
stage. Use this file for rare always-on implementation preferences.
Stage-specific guidance belongs in the matching stage file.

## Guidance

- None yet.
`,
  ],
  [
    "plan-slice.md",
    `# Plan Slice Implementation Discipline

Add user/project-specific coding guidance for slice planning.

## Guidance

- None yet.
`,
  ],
  [
    "build-slice.md",
    `# Build Slice Implementation Discipline

Add user/project-specific coding guidance for slice implementation.

## Guidance

- None yet.
`,
  ],
  [
    "fix.md",
    `# Fix Implementation Discipline

Add user/project-specific coding guidance for fixing failed verification items.

## Guidance

- None yet.
`,
  ],
  [
    "verify-slice-plan.md",
    `# Verify Slice Plan Implementation Discipline

Add user/project-specific implementation guidance for slice plan verification.

## Guidance

- None yet.
`,
  ],
  [
    "verify-slice-build.md",
    `# Verify Slice Build Implementation Discipline

Add user/project-specific implementation guidance for slice build verification.

## Guidance

- None yet.
`,
  ],
  [
    "verify-phase.md",
    `# Verify Phase Implementation Discipline

Add user/project-specific implementation guidance for phase verification.

## Guidance

- None yet.
`,
  ],
  [
    "verify-main-spec.md",
    `# Verify Main Spec Implementation Discipline

Add user/project-specific implementation guidance for final main spec
verification.

## Guidance

- None yet.
`,
  ],
]);
const REVIEW_LENS_TEMPLATES = new Map([
  [
    "global.md",
    `# Global Review Lenses

User/project-specific review lenses that apply to every Strike verifier.
Use this file for rare always-on review requirements. Stage-specific guidance
belongs in the matching verifier file.

Built-in Strike review lenses still apply. User review lenses are additive; they
do not disable built-in gates.

## Additional Lenses

- None yet.
`,
  ],
  [
    "verify-slice-plan.md",
    `# Verify Slice Plan Review Lenses

Add extra user/project-specific read-only review lenses for slice plan
verification.

Built-in Strike review lenses still apply. User review lenses are additive; they
do not disable built-in gates.

## Additional Lenses

- None yet.
`,
  ],
  [
    "verify-slice-build.md",
    `# Verify Slice Build Review Lenses

Add extra user/project-specific read-only review lenses for slice build
verification.

Built-in Strike review lenses still apply. User review lenses are additive; they
do not disable built-in gates.

## Additional Lenses

- None yet.
`,
  ],
  [
    "verify-phase.md",
    `# Verify Phase Review Lenses

Add extra user/project-specific read-only review lenses for phase verification.

Built-in Strike review lenses still apply. User review lenses are additive; they
do not disable built-in gates.

## Additional Lenses

- None yet.
`,
  ],
  [
    "verify-main-spec.md",
    `# Verify Main Spec Review Lenses

Add extra user/project-specific read-only review lenses for final main spec
verification.

Built-in Strike review lenses still apply. User review lenses are additive; they
do not disable built-in gates.

## Additional Lenses

- None yet.
`,
  ],
]);

export const INITIATIVE_WORKFLOW = [
  ["refine-idea", ["ideaRefined"]],
  ["grill-idea", ["decisionsResolved"]],
  ["create-main-spec", ["specCreated"]],
  ["create-development-phases", ["phasesCreated"]],
  ["verify-main-spec", ["allPhasesVerified"]],
];

export const PHASE_WORKFLOW = [
  ["create-phase-spec", ["phaseSpecCreated"]],
  ["create-phase-slices", ["slicesCreated"]],
  ["verify-phase", ["allSlicesVerified"]],
];

export const SLICE_WORKFLOW = [
  ["research-slice", ["researchComplete"]],
  ["plan-slice", ["planCreated"]],
  ["verify-slice-plan", ["planVerified"]],
  ["build-slice", ["implemented"]],
  ["verify-slice-build", ["buildVerified"]],
];

const INITIATIVE_FINAL_SKILLS = new Set(["verify-main-spec"]);
const PHASE_FINAL_SKILLS = new Set(["verify-phase"]);
const INITIATIVE_UPSTREAM_CHECKS = new Set([
  "ideaRefined",
  "decisionsResolved",
  "specCreated",
  "phasesCreated",
]);
const PHASE_UPSTREAM_CHECKS = new Set(["phaseSpecCreated", "slicesCreated"]);

export function workflowFromTemplate(template) {
  return template.map(([skill, checks]) => ({
    skill,
    verified: Object.fromEntries(checks.map((check) => [check, false])),
  }));
}

export function createInitiative(id, name = id) {
  validateId(id, "Initiative id");
  return {
    id,
    name,
    status: "active",
    initiativeWorkflow: workflowFromTemplate(INITIATIVE_WORKFLOW),
    phases: [],
  };
}

export function createInitialState(id, name = id) {
  return {
    version: 1,
    initiatives: [createInitiative(id, name)],
  };
}

export function getActiveInitiative(state) {
  const initiatives = Array.isArray(state?.initiatives) ? state.initiatives : [];
  return initiatives.find((initiative) => initiative.status === "active") ?? null;
}

export function listInitiatives(state) {
  const initiatives = Array.isArray(state?.initiatives) ? state.initiatives : [];
  return initiatives.map((initiative) => ({
    id: initiative.id,
    name: initiative.name ?? initiative.id,
    status: initiative.status ?? "paused",
  }));
}

export function addInitiative(state, id, name = id) {
  state.initiatives ??= [];
  if (state.initiatives.some((initiative) => initiative.id === id)) {
    throw new Error(`Initiative already exists: ${id}`);
  }

  pauseActiveInitiatives(state);
  const initiative = createInitiative(id, name);
  state.initiatives.push(initiative);
  return initiative;
}

export function setActiveInitiative(state, id) {
  validateId(id, "Initiative id");
  const initiative = (state.initiatives ?? []).find((item) => item.id === id);
  if (!initiative) {
    throw new Error(`Initiative not found: ${id}`);
  }

  pauseActiveInitiatives(state);
  initiative.status = "active";
  return initiative;
}

export function finishInitiative(state, id = null) {
  const initiative = id
    ? (state.initiatives ?? []).find((item) => item.id === id)
    : getActiveInitiative(state);
  if (!initiative) {
    throw new Error(id ? `Initiative not found: ${id}` : "Cannot finish initiative: no active initiative.");
  }

  initiative.status = "complete";
  return initiative;
}

function pauseActiveInitiatives(state) {
  for (const initiative of state.initiatives ?? []) {
    if (initiative.status === "active") {
      initiative.status = "paused";
    }
  }
}

export function getCurrentState(state) {
  const initiative = getActiveInitiative(state);
  if (!initiative) {
    return { status: "idle", reason: "No active initiative." };
  }

  const initiativeScope = { initiativeId: initiative.id };
  const initiativeWork = firstIncomplete(
    initiative.initiativeWorkflow,
    INITIATIVE_FINAL_SKILLS,
    initiativeScope,
  );
  if (initiativeWork) return withArtifacts(initiativeWork);

  for (const phase of initiative.phases ?? []) {
    const phaseScope = { initiativeId: initiative.id, phaseId: phase.id };
    const phaseWork = firstIncomplete(phase.phaseWorkflow, PHASE_FINAL_SKILLS, phaseScope);
    if (phaseWork) return withArtifacts(phaseWork);

    for (const slice of phase.slices ?? []) {
      const sliceScope = { initiativeId: initiative.id, phaseId: phase.id, sliceId: slice.id };
      const sliceWork = firstIncomplete(slice.sliceWorkflow, new Set(), sliceScope);
      if (sliceWork) return withArtifacts(sliceWork);
    }

    const phaseFinal = firstIncomplete(phase.phaseWorkflow, null, phaseScope, PHASE_FINAL_SKILLS);
    if (phaseFinal) return withArtifacts(phaseFinal);
  }

  const initiativeFinal = firstIncomplete(
    initiative.initiativeWorkflow,
    null,
    initiativeScope,
    INITIATIVE_FINAL_SKILLS,
  );
  if (initiativeFinal) return withArtifacts(initiativeFinal);

  return { status: "complete", initiativeId: initiative.id };
}

export function markCurrent(state, verificationKey) {
  const current = getCurrentState(state);
  if (current.status !== "active") {
    throw new Error(`Cannot mark current verification: current status is ${current.status}.`);
  }

  const item = findCurrentWorkflowItem(state, current);
  const verified = item.verified;
  if (!verified || typeof verified !== "object" || Array.isArray(verified)) {
    throw new Error(`Current workflow item ${item.skill} has invalid verified data.`);
  }

  const validKeys = Object.keys(verified);
  if (!validKeys.includes(verificationKey)) {
    throw new Error(
      `Unknown verification key "${verificationKey}" for ${item.skill}. Valid keys: ${validKeys.join(", ")}`,
    );
  }
  if (verified[verificationKey] === true) {
    throw new Error(`Verification key "${verificationKey}" is already complete for ${item.skill}.`);
  }

  verified[verificationKey] = true;
  return getCurrentState(state);
}

export function reopenCheck(state, verificationKey) {
  const current = getCurrentState(state);
  if (current.status !== "active") {
    throw new Error(`Cannot reopen verification: current status is ${current.status}.`);
  }

  const workflow = workflowForCurrentScope(state, current);
  reopenWorkflowCheck(workflow, verificationKey, "current scope");
  reopenCurrentScopeDependents(state, current, verificationKey);
  return getCurrentState(state);
}

export function reopenPhaseCheck(state, phaseId, verificationKey) {
  const normalizedPhaseId = normalizePhaseId(phaseId);

  const initiative = getActiveInitiative(state);
  if (!initiative) {
    throw new Error("Cannot reopen phase verification: no active initiative.");
  }

  const phase = (initiative.phases ?? []).find((item) => item.id === normalizedPhaseId);
  if (!phase) {
    throw new Error(`Phase not found: ${normalizedPhaseId}`);
  }

  reopenWorkflowCheck(phase.phaseWorkflow, verificationKey, normalizedPhaseId);
  if (verificationKey === "phaseSpecCreated" || verificationKey === "slicesCreated") {
    for (const slice of phase.slices ?? []) {
      resetWorkflow(slice.sliceWorkflow);
    }
  }
  reopenWorkflowKey(initiative.initiativeWorkflow, "allPhasesVerified");
  return getCurrentState(state);
}

export function reopenSliceCheck(state, phaseId, sliceId, verificationKey) {
  const normalizedPhaseId = normalizePhaseId(phaseId);
  const normalizedSliceId = normalizeSliceId(sliceId);

  const initiative = getActiveInitiative(state);
  if (!initiative) {
    throw new Error("Cannot reopen slice verification: no active initiative.");
  }

  const phase = (initiative.phases ?? []).find((item) => item.id === normalizedPhaseId);
  if (!phase) {
    throw new Error(`Phase not found: ${normalizedPhaseId}`);
  }

  const slice = (phase.slices ?? []).find((item) => item.id === normalizedSliceId);
  if (!slice) {
    throw new Error(`Slice not found in ${normalizedPhaseId}: ${normalizedSliceId}`);
  }

  reopenWorkflowCheck(slice.sliceWorkflow, verificationKey, `${normalizedPhaseId}/${normalizedSliceId}`);
  reopenWorkflowKey(phase.phaseWorkflow, "allSlicesVerified");
  reopenWorkflowKey(initiative.initiativeWorkflow, "allPhasesVerified");
  return getCurrentState(state);
}

function reopenWorkflowCheck(workflow, verificationKey, label) {
  const itemIndex = (workflow ?? []).findIndex((entry) =>
    Object.hasOwn(entry.verified ?? {}, verificationKey),
  );
  if (itemIndex === -1) {
    const validKeys = (workflow ?? []).flatMap((entry) => Object.keys(entry.verified ?? {}));
    throw new Error(
      `Unknown verification key "${verificationKey}" in ${label}. Valid keys: ${validKeys.join(", ")}`,
    );
  }

  for (const item of workflow.slice(itemIndex)) {
    for (const key of Object.keys(item.verified ?? {})) {
      item.verified[key] = false;
    }
  }
}

function reopenWorkflowKey(workflow, verificationKey) {
  const item = (workflow ?? []).find((entry) =>
    Object.hasOwn(entry.verified ?? {}, verificationKey),
  );
  if (item) {
    item.verified[verificationKey] = false;
  }
}

function resetWorkflow(workflow) {
  for (const item of workflow ?? []) {
    for (const key of Object.keys(item.verified ?? {})) {
      item.verified[key] = false;
    }
  }
}

function reopenCurrentScopeDependents(state, current, verificationKey) {
  const initiative = (state.initiatives ?? []).find((item) => item.id === current.initiativeId);
  if (!initiative) return;

  if (current.sliceId) {
    const phase = (initiative.phases ?? []).find((item) => item.id === current.phaseId);
    if (phase) {
      reopenWorkflowKey(phase.phaseWorkflow, "allSlicesVerified");
    }
    reopenWorkflowKey(initiative.initiativeWorkflow, "allPhasesVerified");
    return;
  }

  if (current.phaseId) {
    const phase = (initiative.phases ?? []).find((item) => item.id === current.phaseId);
    if (phase && PHASE_UPSTREAM_CHECKS.has(verificationKey)) {
      for (const slice of phase.slices ?? []) {
        resetWorkflow(slice.sliceWorkflow);
      }
    }
    reopenWorkflowKey(initiative.initiativeWorkflow, "allPhasesVerified");
    return;
  }

  if (INITIATIVE_UPSTREAM_CHECKS.has(verificationKey)) {
    for (const phase of initiative.phases ?? []) {
      resetWorkflow(phase.phaseWorkflow);
      for (const slice of phase.slices ?? []) {
        resetWorkflow(slice.sliceWorkflow);
      }
    }
  }
}

export function addPhase(state, phaseId, name = null) {
  const normalizedPhaseId = normalizePhaseId(phaseId);

  const initiative = getActiveInitiative(state);
  if (!initiative) {
    throw new Error("Cannot add phase: no active initiative.");
  }

  initiative.phases ??= [];
  if (initiative.phases.some((phase) => phase.id === normalizedPhaseId)) {
    throw new Error(`Phase already exists: ${normalizedPhaseId}`);
  }

  const phase = {
    id: normalizedPhaseId,
    name: name || normalizedPhaseId,
    phaseWorkflow: workflowFromTemplate(PHASE_WORKFLOW),
    slices: [],
  };
  initiative.phases.push(phase);
  initiative.phases.sort((left, right) => compareNumberedIds(left.id, right.id, "phase"));
  return phase;
}

export function addSlice(state, phaseId, sliceId, name = null) {
  const normalizedPhaseId = normalizePhaseId(phaseId);
  const normalizedSliceId = normalizeSliceId(sliceId);

  const initiative = getActiveInitiative(state);
  if (!initiative) {
    throw new Error("Cannot add slice: no active initiative.");
  }

  const phase = (initiative.phases ?? []).find((item) => item.id === normalizedPhaseId);
  if (!phase) {
    throw new Error(`Phase not found: ${normalizedPhaseId}`);
  }

  phase.slices ??= [];
  if (phase.slices.some((slice) => slice.id === normalizedSliceId)) {
    throw new Error(`Slice already exists in ${normalizedPhaseId}: ${normalizedSliceId}`);
  }

  const slice = {
    id: normalizedSliceId,
    name: name || normalizedSliceId,
    sliceWorkflow: workflowFromTemplate(SLICE_WORKFLOW),
  };
  phase.slices.push(slice);
  phase.slices.sort((left, right) => compareNumberedIds(left.id, right.id, "slice"));
  return { initiative, phase, slice };
}

function firstIncomplete(workflow, skipSkills, scope, onlySkills = null) {
  for (const item of workflow ?? []) {
    if (skipSkills?.has(item.skill)) continue;
    if (onlySkills && !onlySkills.has(item.skill)) continue;

    const missing = missingChecks(item);
    if (missing.length > 0) {
      return {
        status: "active",
        ...scope,
        skill: item.skill,
        missing,
      };
    }
  }

  return null;
}

function missingChecks(item) {
  const verified = item?.verified;
  if (!verified || typeof verified !== "object" || Array.isArray(verified)) {
    return ["verified"];
  }

  const entries = Object.entries(verified);
  if (entries.length === 0) {
    return ["verified"];
  }

  return entries.filter(([, value]) => value !== true).map(([key]) => key);
}

function withArtifacts(current) {
  return {
    ...current,
    artifacts: artifactPathsForCurrent(current),
  };
}

export function artifactPathsForCurrent(current) {
  if (current.status !== "active") return [];

  const initiativeRoot = `${WORKSPACE_ROOT}/initiatives/${current.initiativeId}`;
  const phaseRoot = current.phaseId ? `${initiativeRoot}/phases/${current.phaseId}` : null;
  const sliceRoot =
    phaseRoot && current.sliceId ? `${phaseRoot}/slices/${current.sliceId}` : null;

  switch (current.skill) {
    case "refine-idea":
      return [`${initiativeRoot}/idea.md`];
    case "grill-idea":
      return [`${initiativeRoot}/decisions.md`];
    case "create-main-spec":
      return [`${initiativeRoot}/main-spec.md`];
    case "create-development-phases":
      return [`${initiativeRoot}/development-plan.md`, `${initiativeRoot}/phases/<phase-id>/phase.md`];
    case "create-phase-spec":
      return phaseRoot ? [`${phaseRoot}/phase-spec.md`] : [];
    case "create-phase-slices":
      return phaseRoot ? [`${phaseRoot}/slices/<slice-id>/slice.md`] : [];
    case "research-slice":
      return sliceRoot ? [`${sliceRoot}/research.md`] : [];
    case "plan-slice":
      return sliceRoot ? [`${sliceRoot}/plan.md`] : [];
    case "verify-slice-plan":
      return sliceRoot ? [`${sliceRoot}/plan-verification.md`] : [];
    case "build-slice":
      return sliceRoot ? ["implementation files", `${sliceRoot}/build.md`] : ["implementation files"];
    case "verify-slice-build":
      return sliceRoot ? [`${sliceRoot}/build-verification.md`] : [];
    case "verify-phase":
      return phaseRoot ? [`${phaseRoot}/verification.md`] : [];
    case "verify-main-spec":
      return [`${initiativeRoot}/verification.md`];
    default:
      return [];
  }
}

function findCurrentWorkflowItem(state, current) {
  const workflow = workflowForCurrentScope(state, current);
  const item = (workflow ?? []).find((entry) => entry.skill === current.skill);
  if (!item) {
    throw new Error(`Workflow item not found: ${current.skill}`);
  }

  return item;
}

function workflowForCurrentScope(state, current) {
  const initiative = (state.initiatives ?? []).find((item) => item.id === current.initiativeId);
  if (!initiative) {
    throw new Error(`Initiative not found: ${current.initiativeId}`);
  }

  let workflow = initiative.initiativeWorkflow;
  if (current.phaseId) {
    const phase = (initiative.phases ?? []).find((item) => item.id === current.phaseId);
    if (!phase) {
      throw new Error(`Phase not found: ${current.phaseId}`);
    }
    workflow = phase.phaseWorkflow;

    if (current.sliceId) {
      const slice = (phase.slices ?? []).find((item) => item.id === current.sliceId);
      if (!slice) {
        throw new Error(`Slice not found: ${current.sliceId}`);
      }
      workflow = slice.sliceWorkflow;
    }
  }

  return workflow;
}

function readState(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeState(filePath, state) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`);
  fs.renameSync(tempPath, filePath);
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(args) {
  const positional = [];
  let statePath = DEFAULT_STATE_PATH;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--state") {
      statePath = args[index + 1];
      if (!statePath) {
        throw new Error("--state requires a path.");
      }
      index += 1;
    } else {
      positional.push(arg);
    }
  }

  return { positional, statePath };
}

function validateId(id, label) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new Error(`${label} must use lowercase letters, numbers, and dashes: ${id}`);
  }
}

function normalizePhaseId(id) {
  return normalizeNumberedId(id, "phase", "Phase id");
}

function normalizeSliceId(id) {
  return normalizeNumberedId(id, "slice", "Slice id");
}

function normalizeNumberedId(id, prefix, label) {
  const value = String(id ?? "").trim().toLowerCase();
  const body = value.startsWith(`${prefix}-`) ? value.slice(prefix.length + 1) : value;
  const match = body.match(/^(\d+)(?:-?([a-z]))?$/);
  if (!match) {
    throw new Error(
      `${label} must be numeric or canonical, such as ${prefix}-01 or ${prefix}-01-b. Use the display name argument for human names.`,
    );
  }

  const number = Number.parseInt(match[1], 10);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new Error(`${label} number must be 1 or greater, such as ${prefix}-01.`);
  }

  const ordinal = String(number).padStart(2, "0");
  const suffix = match[2] ? `-${match[2]}` : "";
  return `${prefix}-${ordinal}${suffix}`;
}

function compareNumberedIds(leftId, rightId, prefix) {
  const left = parseNumberedId(leftId, prefix);
  const right = parseNumberedId(rightId, prefix);
  if (left.number !== right.number) {
    return left.number - right.number;
  }
  return left.suffix.localeCompare(right.suffix);
}

function parseNumberedId(id, prefix) {
  const match = String(id ?? "").match(new RegExp(`^${prefix}-(\\d+)(?:-([a-z]))?$`));
  if (!match) {
    return { number: Number.MAX_SAFE_INTEGER, suffix: String(id ?? "") };
  }

  return {
    number: Number.parseInt(match[1], 10),
    suffix: match[2] ?? "",
  };
}

function initWorkspace(id, name, statePath) {
  validateId(id, "Initiative id");

  if (fs.existsSync(statePath)) {
    throw new Error(`State already exists: ${statePath}`);
  }

  const paths = workspacePaths(statePath);
  const initiativePath = path.join(paths.workspaceRoot, "initiatives", id);

  fs.mkdirSync(path.dirname(paths.helperPath), { recursive: true });
  fs.mkdirSync(initiativePath, { recursive: true });
  createLanguageFile(paths.languagePath);
  createGuidanceFiles(paths.implementationDisciplinePath, IMPLEMENTATION_DISCIPLINE_TEMPLATES);
  createReviewLensFiles(paths.reviewLensesPath);
  copyHelper(paths.helperPath);

  const state = createInitialState(id, name);
  writeState(statePath, state);
  return {
    statePath,
    helperPath: paths.helperPath,
    initiativePath,
    languagePath: paths.languagePath,
    implementationDisciplinePath: paths.implementationDisciplinePath,
    reviewLensesPath: paths.reviewLensesPath,
    current: getCurrentState(state),
  };
}

function workspacePaths(statePath) {
  const workspaceRoot = path.dirname(statePath);
  const repoRoot = path.dirname(workspaceRoot);
  const userGuidancePath = path.join(workspaceRoot, USER_GUIDANCE_DIR);
  return {
    workspaceRoot,
    helperPath: path.join(workspaceRoot, "scripts/state.mjs"),
    languagePath: path.join(repoRoot, LANGUAGE_FILE),
    implementationDisciplinePath: path.join(userGuidancePath, IMPLEMENTATION_DISCIPLINE_DIR),
    reviewLensesPath: path.join(userGuidancePath, REVIEW_LENSES_DIR),
  };
}

function createLanguageFile(languagePath) {
  if (fs.existsSync(languagePath)) return;
  fs.writeFileSync(
    languagePath,
    `# Project Language

This file names durable project language for code, UI, docs, planning, and modeling.
It is a glossary, not a spec, implementation guide, ADR, or planning scratchpad.
`,
  );
}

function createReviewLensFiles(reviewLensesPath) {
  createGuidanceFiles(reviewLensesPath, REVIEW_LENS_TEMPLATES);
}

function createGuidanceFiles(rootPath, templates) {
  fs.mkdirSync(rootPath, { recursive: true });
  for (const [filename, content] of templates) {
    const filePath = path.join(rootPath, filename);
    if (fs.existsSync(filePath)) continue;
    fs.writeFileSync(filePath, content);
  }
}

function copyHelper(helperPath) {
  if (fs.existsSync(helperPath)) {
    const existing = fs.readFileSync(helperPath, "utf8");
    const source = fs.readFileSync(SCRIPT_FILE, "utf8");
    if (existing !== source) {
      throw new Error(`Refusing to overwrite existing helper: ${helperPath}`);
    }
    return;
  }

  fs.copyFileSync(SCRIPT_FILE, helperPath);
}

export function main() {
  const [command, ...rawArgs] = process.argv.slice(2);
  const { positional: args, statePath } = parseArgs(rawArgs);

  if (command === "template") {
    const id = args[0];
    if (!id) {
      throw new Error("Usage: state.mjs template <initiative-id> [name]");
    }
    printJson(createInitialState(id, args[1] ?? id));
    return;
  }

  if (command === "init") {
    const id = args[0];
    if (!id) {
      throw new Error("Usage: state.mjs init <initiative-id> [name] [--state path]");
    }
    printJson(initWorkspace(id, args.slice(1).join(" ") || id, statePath));
    return;
  }

  if (command === "current") {
    printJson(getCurrentState(readState(statePath)));
    return;
  }

  if (command === "list-initiatives") {
    const state = readState(statePath);
    const active = getActiveInitiative(state);
    printJson({
      activeInitiativeId: active?.id ?? null,
      initiatives: listInitiatives(state),
    });
    return;
  }

  if (command === "add-initiative") {
    const id = args[0];
    if (!id) {
      throw new Error("Usage: state.mjs add-initiative <initiative-id> [name] [--state path]");
    }
    const state = readState(statePath);
    const initiative = addInitiative(state, id, args.slice(1).join(" ") || id);
    const initiativePath = path.join(path.dirname(statePath), "initiatives", initiative.id);
    fs.mkdirSync(initiativePath, { recursive: true });
    writeState(statePath, state);
    printJson({
      initiative,
      initiativePath,
      current: getCurrentState(state),
      initiatives: listInitiatives(state),
    });
    return;
  }

  if (command === "set-active") {
    const id = args[0];
    if (!id) {
      throw new Error("Usage: state.mjs set-active <initiative-id> [--state path]");
    }
    const state = readState(statePath);
    const initiative = setActiveInitiative(state, id);
    writeState(statePath, state);
    printJson({
      initiative,
      current: getCurrentState(state),
      initiatives: listInitiatives(state),
    });
    return;
  }

  if (command === "finish-initiative") {
    const state = readState(statePath);
    const initiative = finishInitiative(state, args[0] ?? null);
    writeState(statePath, state);
    printJson({
      initiative,
      current: getCurrentState(state),
      initiatives: listInitiatives(state),
    });
    return;
  }

  if (command === "complete-check" || command === "mark-current") {
    const verificationKey = args[0];
    if (!verificationKey) {
      throw new Error("Usage: state.mjs complete-check <check-name> [--state path]");
    }
    const state = readState(statePath);
    const current = markCurrent(state, verificationKey);
    writeState(statePath, state);
    printJson(current);
    return;
  }

  if (command === "reopen-check") {
    const verificationKey = args[0];
    if (!verificationKey) {
      throw new Error("Usage: state.mjs reopen-check <check-name> [--state path]");
    }
    const state = readState(statePath);
    const current = reopenCheck(state, verificationKey);
    writeState(statePath, state);
    printJson(current);
    return;
  }

  if (command === "reopen-phase-check") {
    const phaseId = args[0];
    const verificationKey = args[1];
    if (!phaseId || !verificationKey) {
      throw new Error("Usage: state.mjs reopen-phase-check <phase-id> <check-name> [--state path]");
    }
    const state = readState(statePath);
    const current = reopenPhaseCheck(state, phaseId, verificationKey);
    writeState(statePath, state);
    printJson(current);
    return;
  }

  if (command === "reopen-slice-check") {
    const phaseId = args[0];
    const sliceId = args[1];
    const verificationKey = args[2];
    if (!phaseId || !sliceId || !verificationKey) {
      throw new Error("Usage: state.mjs reopen-slice-check <phase-id> <slice-id> <check-name> [--state path]");
    }
    const state = readState(statePath);
    const current = reopenSliceCheck(state, phaseId, sliceId, verificationKey);
    writeState(statePath, state);
    printJson(current);
    return;
  }

  if (command === "add-phase") {
    const phaseId = args[0];
    if (!phaseId) {
      throw new Error("Usage: state.mjs add-phase <phase-id> [name] [--state path]");
    }
    const state = readState(statePath);
    const phase = addPhase(state, phaseId, args.slice(1).join(" ") || null);
    const initiative = getActiveInitiative(state);
    const phasePath = path.join(
      path.dirname(statePath),
      "initiatives",
      initiative.id,
      "phases",
      phase.id,
    );
    fs.mkdirSync(phasePath, { recursive: true });
    writeState(statePath, state);
    printJson({
      phase,
      phasePath,
      current: getCurrentState(state),
    });
    return;
  }

  if (command === "add-slice") {
    const phaseId = args[0];
    const sliceId = args[1];
    if (!phaseId || !sliceId) {
      throw new Error("Usage: state.mjs add-slice <phase-id> <slice-id> [name] [--state path]");
    }
    const state = readState(statePath);
    const { initiative, phase, slice } = addSlice(
      state,
      phaseId,
      sliceId,
      args.slice(2).join(" ") || null,
    );
    const slicePath = path.join(
      path.dirname(statePath),
      "initiatives",
      initiative.id,
      "phases",
      phase.id,
      "slices",
      slice.id,
    );
    fs.mkdirSync(slicePath, { recursive: true });
    writeState(statePath, state);
    printJson({
      slice,
      slicePath,
      current: getCurrentState(state),
    });
    return;
  }

  throw new Error(
    "Usage: state.mjs <template|init|current|list-initiatives|add-initiative|set-active|finish-initiative|complete-check|reopen-check|reopen-phase-check|reopen-slice-check|add-phase|add-slice> ...",
  );
}

function isMainModule() {
  try {
    return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(SCRIPT_FILE);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
