import type { InstallerState, InstallerStepStatusEntry } from "./types";

/**
 * Event types owned by the Installer domain.
 */
export interface InstallerEventMap {
	/** Emitted when the installation pipeline starts */
	"installer.started": { stepCount: number };
	/** Emitted when an individual step begins */
	"installer.step.started": { stepId: string; stepName: string };
	/** Emitted when an individual step completes (success, fail, or skip) */
	"installer.step.completed": InstallerStepStatusEntry;
	/** Emitted when the entire installation pipeline finishes successfully */
	"installer.completed": { state: InstallerState };
	/** Emitted when the installation pipeline fails */
	"installer.failed": { failedStepId: string; error: string };
	/** Emitted when installer state is loaded from storage */
	"installer.loaded": { state: InstallerState };
}
