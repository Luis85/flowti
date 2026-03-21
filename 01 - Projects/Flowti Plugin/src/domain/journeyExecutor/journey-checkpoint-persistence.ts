/**
 * journey-checkpoint-persistence.ts — Checkpoint read/write bridge for journey tasks.
 *
 * Minimal bridge — reads/writes checkpoint JSON for journey tasks.
 * Full JourneyExecutorService pause/resume integration is deferred to when
 * journeys are wired to the SSE event contract.
 */

export interface JourneyCheckpointData {
	readonly journeyId: string;
	readonly taskId: string;
	readonly currentStep: number;
	readonly totalSteps: number;
	readonly status: "running" | "paused-for-review" | "completed" | "failed";
}

export function readCheckpoint(
	disk: { existsSync(p: string): boolean; readFileSync(p: string, e: string): string },
	path: string,
): JourneyCheckpointData | null {
	if (!disk.existsSync(path)) return null;
	try { return JSON.parse(disk.readFileSync(path, "utf-8")); }
	catch { return null; }
}

export function writeCheckpoint(
	disk: { writeFileSync(p: string, c: string): void },
	path: string,
	data: JourneyCheckpointData,
): void {
	disk.writeFileSync(path, JSON.stringify(data, null, "\t"));
}
