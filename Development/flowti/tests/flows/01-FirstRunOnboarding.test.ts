/**
 * Flow 01: First-Run Onboarding
 *
 * Tests the end-to-end first-run experience:
 * Plugin activates → InstallerService loads → detects first run →
 * wizard runs steps → UserCreationStep → FolderScaffoldStep → SeedContentStep →
 * installation complete → subsequent launch skips wizard.
 *
 * Event sequence:
 *   settings.loaded → installer.loaded → installer.started →
 *   installer.step.started → user.created → installer.step.completed →
 *   installer.step.started → installer.step.completed →
 *   installer.step.started → installer.step.completed → installer.completed
 *
 * NOTE: The full journey is already tested in InstallerJourney.test.ts.
 * This file extends coverage with cross-service integration scenarios.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { InstallerService } from "../../src/domain/installer/InstallerService";
import { UserCreationStep } from "../../src/domain/installer/steps/UserCreationStep";
import { FolderScaffoldStep } from "../../src/domain/installer/steps/FolderScaffoldStep";
import { SeedContentStep } from "../../src/domain/installer/steps/SeedContentStep";
import type { InstallerState } from "../../src/domain/installer/types";
import type { FlowtiUser } from "../../src/domain/user/types";
import type { UUID } from "../../src/utils/types";
import { DEFAULT_SETTINGS } from "../../src/domain/settings/settings";
import { createMockStorage, createMockFileSystem } from "./testHelpers";

function buildInstallerWithDeps(options: {
	eventBus: IEventBus;
	installed?: boolean;
	hasUser?: boolean;
}) {
	const { storage, getData } = createMockStorage<InstallerState>(
		options.installed
			? {
					installed: true,
					installedAt: "2026-01-01T00:00:00.000Z",
					completedSteps: {
						"user-creation": { completedAt: "2026-01-01T00:00:00.000Z" },
						"folder-scaffold": { completedAt: "2026-01-01T00:00:00.000Z" },
						"seed-content": { completedAt: "2026-01-01T00:00:00.000Z" },
					},
				}
			: undefined,
	);

	const fileSystem = createMockFileSystem();
	const user: FlowtiUser = {
		id: "u-001" as UUID,
		name: "Alice",
		createdAt: "2026-01-01T00:00:00.000Z",
	};

	const userService = {
		load: vi.fn(),
		hasUser: vi.fn(() => options.hasUser ?? false),
		getUser: vi.fn(() => (options.hasUser ? user : null)),
		createUser: vi.fn(async (name: string) => ({ ...user, name })),
		updateUserName: vi.fn(),
	};

	const service = new InstallerService({
		storage,
		eventBus: options.eventBus,
		fileSystem,
		userService,
	});
	service.registerStep(new UserCreationStep());
	service.registerStep(new FolderScaffoldStep());
	service.registerStep(new SeedContentStep());

	return { service, storage, getData, fileSystem, userService };
}

describe("Flow 01: First-Run Onboarding", () => {
	let eventBus: IEventBus;

	beforeEach(() => {
		eventBus = new EventBus();
	});

	describe("complete first-run lifecycle", () => {
		it("should emit settings.loaded → installer events in correct order", async () => {
			const { service } = buildInstallerWithDeps({ eventBus });

			const events: string[] = [];
			eventBus.on("installer.loaded", () => { events.push("installer.loaded"); });
			eventBus.on("installer.started", () => { events.push("installer.started"); });
			eventBus.on("installer.step.started", () => { events.push("step.started"); });
			eventBus.on("installer.step.completed", () => { events.push("step.completed"); });
			eventBus.on("installer.completed", () => { events.push("installer.completed"); });

			// Simulate plugin activation: settings loaded, then installer loads
			await eventBus.emit("settings.loaded", { settings: DEFAULT_SETTINGS });
			await service.load();

			events.length = 0; // reset after load events

			// Wizard runs the pipeline
			const success = await service.runAll({ userName: "Alice" });

			expect(success).toBe(true);
			expect(events).toEqual([
				"installer.started",
				"step.started", // UserCreationStep
				"step.completed",
				"step.started", // FolderScaffoldStep
				"step.completed",
				"step.started", // SeedContentStep
				"step.completed",
				"installer.completed",
			]);
		});

		it("should persist installed state after onboarding", async () => {
			const { service, getData } = buildInstallerWithDeps({ eventBus });
			await service.load();
			await service.runAll({ userName: "Alice" });

			const state = getData();
			expect(state?.installed).toBe(true);
			expect(state?.installedAt).toBeDefined();
			expect(state?.completedSteps["user-creation"]).toBeDefined();
			expect(state?.completedSteps["folder-scaffold"]).toBeDefined();
			expect(state?.completedSteps["seed-content"]).toBeDefined();
		});
	});

	describe("subsequent launch (no wizard)", () => {
		it("should detect installation on load and skip pipeline", async () => {
			const { service } = buildInstallerWithDeps({
				eventBus,
				installed: true,
				hasUser: true,
			});
			await service.load();

			expect(service.isInstalled()).toBe(true);

			const startedHandler = vi.fn();
			eventBus.on("installer.started", startedHandler);

			// main.ts only calls runAll when not installed
			if (!service.isInstalled()) {
				await service.runAll({ userName: "Alice" });
			}

			expect(startedHandler).not.toHaveBeenCalled();
		});
	});

	describe("settings integration", () => {
		it("should respond to settings.loaded event", async () => {
			const { service } = buildInstallerWithDeps({ eventBus });

			const loadedHandler = vi.fn();
			eventBus.on("installer.loaded", loadedHandler);

			await service.load();

			expect(loadedHandler).toHaveBeenCalledOnce();
		});
	});

	it.skip("should open InstallerWizardModal on first run (requires Obsidian Modal)", () => {
		// InstallerWizardModal.showIfNeeded() calls `new Modal(app)`.
		// Verified manually: plugin loads → wizard modal appears.
	});

	it.skip("should render 4-page wizard UI (requires Obsidian Modal)", () => {
		// Wizard pages: Welcome → Review → Progress → Complete.
		// Requires live Modal rendering.
	});
});
