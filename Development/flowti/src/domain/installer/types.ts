import type { IEventBus } from "../../infrastructure/events/types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { FlowtiUser, IUserService } from "../user/types";

/**
 * Status of a single installation step.
 */
export type InstallerStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

/**
 * Result returned after a step executes.
 */
export interface InstallerStepResult {
	status: "completed" | "failed" | "skipped";
	message?: string;
	error?: Error;
}

/**
 * Context passed to each step during execution.
 * Contains shared data accumulated across steps.
 */
export interface InstallerContext {
	/** User name entered in the welcome step */
	userName?: string;
	/** The created user object (populated after UserCreationStep) */
	user?: FlowtiUser;
	/** Folders that were created (populated after FolderScaffoldStep) */
	createdFolders?: string[];
	/** Extensible: future steps add their own keys */
	[key: string]: unknown;
}

/**
 * Dependencies injected into each step at execution time.
 */
export interface InstallerStepDeps {
	fileSystem: IFileSystemClient;
	eventBus: IEventBus;
	userService: IUserService;
}

/**
 * Pluggable installation step interface.
 * Each step is a self-contained unit with a unique id, display metadata,
 * an ordering hint, and an execute function.
 */
export interface IInstallerStep {
	/** Unique step identifier */
	readonly id: string;
	/** Human-readable name shown in the wizard UI */
	readonly name: string;
	/** Short description shown in the review screen */
	readonly description: string;
	/** Numeric order for sorting (lower = runs first) */
	readonly order: number;
	/** Execute the step */
	execute(context: InstallerContext, deps: InstallerStepDeps): Promise<InstallerStepResult>;
}

/**
 * Persisted installation state (saved to plugin storage).
 */
export interface InstallerState {
	/** Whether the full installation has been completed */
	installed: boolean;
	/** ISO timestamp of when installation completed */
	installedAt?: string;
	/** Record of which steps completed, keyed by step id */
	completedSteps: Record<string, { completedAt: string }>;
}

/**
 * Entry tracking real-time status of a step during execution.
 */
export interface InstallerStepStatusEntry {
	id: string;
	name: string;
	status: InstallerStepStatus;
	message?: string;
}

/**
 * Interface for the installer service.
 */
export interface IInstallerService {
	/** Load persisted installer state from storage */
	load(): Promise<void>;
	/** Check if installation has been completed */
	isInstalled(): boolean;
	/** Get all registered steps sorted by order */
	getSteps(): IInstallerStep[];
	/** Register a new step (for extensibility) */
	registerStep(step: IInstallerStep): void;
	/** Run all steps sequentially. Returns true if all succeeded. */
	runAll(context: InstallerContext): Promise<boolean>;
	/** Get current state */
	getState(): InstallerState;
}
