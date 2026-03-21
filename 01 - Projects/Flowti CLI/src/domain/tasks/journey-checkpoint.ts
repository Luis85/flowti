/**
 * journey-checkpoint.ts — Persistent checkpoint for review-gated journey pauses.
 *
 * Stored at .flowti/var/staging/{task-id}/journey-checkpoint.json.
 * Pure domain — I/O is injected via deps.
 */

import type { IFileSystem, IPaths, IClock } from "../../infrastructure/types.js";

// ── Types ─────────────────────────────────────────────────────────────

export interface StepResult {
	readonly step: number;
	readonly status: "completed" | "awaiting-review" | "failed";
	readonly at: string;
}

export interface JourneyCheckpoint {
	readonly journeyId: string;
	readonly taskId: string;
	readonly currentStep: number;
	readonly totalSteps: number;
	readonly status: "running" | "paused-for-review" | "completed" | "failed";
	readonly stepResults: readonly StepResult[];
}

// ── Internal ──────────────────────────────────────────────────────────

type CheckpointDeps = {
	readonly disk: Pick<IFileSystem, "existsSync" | "readFileSync" | "writeFileSync" | "mkdirSync">;
	readonly paths: Pick<IPaths, "join" | "dirname">;
};

const STAGING_DIR = ".flowti/var/staging";
const CHECKPOINT_FILE = "journey-checkpoint.json";

function checkpointPath(deps: CheckpointDeps, vaultRoot: string, taskId: string): string {
	return deps.paths.join(vaultRoot, STAGING_DIR, taskId, CHECKPOINT_FILE);
}

// ── Public API ────────────────────────────────────────────────────────

export function createCheckpoint(
	deps: CheckpointDeps,
	vaultRoot: string,
	checkpoint: JourneyCheckpoint,
): void {
	const filePath = checkpointPath(deps, vaultRoot, checkpoint.taskId);
	const dir = deps.paths.dirname(filePath);
	deps.disk.mkdirSync(dir, { recursive: true });
	deps.disk.writeFileSync(filePath, JSON.stringify(checkpoint, null, "\t"), "utf-8");
}

export function readCheckpoint(
	deps: CheckpointDeps,
	vaultRoot: string,
	taskId: string,
): JourneyCheckpoint | null {
	const filePath = checkpointPath(deps, vaultRoot, taskId);
	if (!deps.disk.existsSync(filePath)) return null;
	try {
		const raw = deps.disk.readFileSync(filePath, "utf-8");
		return JSON.parse(raw) as JourneyCheckpoint;
	} catch {
		return null;
	}
}

export function updateStepResult(
	checkpoint: JourneyCheckpoint,
	step: number,
	status: StepResult["status"],
	clock: Pick<IClock, "iso">,
): JourneyCheckpoint {
	const existing = checkpoint.stepResults.filter(r => r.step !== step);
	const newResult: StepResult = { step, status, at: clock.iso() };
	return { ...checkpoint, currentStep: step, stepResults: [...existing, newResult] };
}

export function pauseForReview(
	checkpoint: JourneyCheckpoint,
	step: number,
	clock: Pick<IClock, "iso">,
): JourneyCheckpoint {
	const existing = checkpoint.stepResults.filter(r => r.step !== step);
	const newResult: StepResult = { step, status: "awaiting-review", at: clock.iso() };
	return {
		...checkpoint,
		currentStep: step,
		status: "paused-for-review",
		stepResults: [...existing, newResult],
	};
}

export function resumeFromCheckpoint(checkpoint: JourneyCheckpoint): JourneyCheckpoint {
	return { ...checkpoint, status: "running" };
}
