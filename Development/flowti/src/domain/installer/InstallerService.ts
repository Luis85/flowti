import { ValidationError } from "../../infrastructure/errors/FlowtiError";
import type { IEventBus } from "../../infrastructure/events/types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { ITypedStorage } from "../../utils/TypedStorage";
import type { IUserService } from "../user/types";
import type {
	IInstallerService,
	IInstallerStep,
	InstallerContext,
	InstallerState,
	InstallerStepDeps,
} from "./types";

/**
 * Configuration options for the InstallerService.
 */
export interface InstallerServiceOptions {
	storage: ITypedStorage<InstallerState>;
	eventBus?: IEventBus;
	fileSystem?: IFileSystemClient;
	userService?: IUserService;
}

/**
 * Creates a fresh default installer state.
 * Returns a new object each time to avoid shared-reference mutations.
 */
function createDefaultState(): InstallerState {
	return { installed: false, completedSteps: {} };
}

/**
 * Service for orchestrating the Flowti IBDE installation pipeline.
 *
 * Manages a registry of pluggable {@link IInstallerStep} instances,
 * executes them in order, tracks progress via events, and persists
 * the installation state.
 */
export class InstallerService implements IInstallerService {
	private state: InstallerState = createDefaultState();
	private steps: Map<string, IInstallerStep> = new Map();
	private storage: ITypedStorage<InstallerState>;
	private eventBus?: IEventBus;
	private fileSystem?: IFileSystemClient;
	private userService?: IUserService;

	constructor(options: InstallerServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;
		this.fileSystem = options.fileSystem;
		this.userService = options.userService;
	}

	/**
	 * Loads installer state from storage.
	 * Emits "installer.loaded" if state is found.
	 */
	async load(): Promise<void> {
		const saved = await this.storage.load();
		if (saved) {
			this.state = saved;
		}
		await this.eventBus?.emit("installer.loaded", { state: this.state });
	}

	/**
	 * Checks if the installation has been completed.
	 */
	isInstalled(): boolean {
		return this.state.installed;
	}

	/**
	 * Returns all registered steps sorted by order.
	 */
	getSteps(): IInstallerStep[] {
		return [...this.steps.values()].sort((a, b) => a.order - b.order);
	}

	/**
	 * Registers a new installation step.
	 * @throws ValidationError if a step with the same id is already registered
	 */
	registerStep(step: IInstallerStep): void {
		if (this.steps.has(step.id)) {
			throw new ValidationError({
				code: "DUPLICATE_STEP_ID",
				message: `Installer step "${step.id}" is already registered`,
				severity: "medium",
				context: "InstallerService.registerStep",
			});
		}
		this.steps.set(step.id, step);
	}

	/**
	 * Executes all registered steps in order.
	 *
	 * Emits events for each step transition and persists the final state.
	 * Halts on the first failed step.
	 *
	 * @returns true if all steps succeeded, false if any step failed
	 */
	async runAll(context: InstallerContext): Promise<boolean> {
		const sortedSteps = this.getSteps();

		await this.eventBus?.emit("installer.started", {
			stepCount: sortedSteps.length,
		});

		const deps: InstallerStepDeps = {
			fileSystem: this.fileSystem!,
			eventBus: this.eventBus!,
			userService: this.userService!,
		};

		for (const step of sortedSteps) {
			await this.eventBus?.emit("installer.step.started", {
				stepId: step.id,
				stepName: step.name,
			});

			const result = await step.execute(context, deps);

			await this.eventBus?.emit("installer.step.completed", {
				id: step.id,
				name: step.name,
				status: result.status,
				message: result.message,
			});

			if (result.status === "failed") {
				await this.eventBus?.emit("installer.failed", {
					failedStepId: step.id,
					error: result.message ?? "Unknown error",
				});
				return false;
			}

			if (result.status === "completed" || result.status === "skipped") {
				this.state.completedSteps[step.id] = {
					completedAt: new Date().toISOString(),
				};
			}
		}

		this.state.installed = true;
		this.state.installedAt = new Date().toISOString();
		await this.saveState();

		await this.eventBus?.emit("installer.completed", { state: this.state });

		return true;
	}

	/**
	 * Resets installer state so the wizard can run again.
	 * Persists the reset to storage.
	 */
	async reset(): Promise<void> {
		this.state = createDefaultState();
		await this.saveState();
	}

	/**
	 * Returns the current installer state.
	 */
	getState(): InstallerState {
		return this.state;
	}

	/**
	 * Persists the installer state to storage.
	 */
	private async saveState(): Promise<void> {
		await this.storage.save(this.state);
	}
}
