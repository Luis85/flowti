import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { SettingsService } from "../../../src/domain/settings/SettingsService";
import { DEFAULT_SETTINGS, FlowtiSettings } from "../../../src/domain/settings/settings";
import type { IStorageProvider } from "../../../src/utils/types";

/**
 * Creates a mock storage provider for testing.
 */
function createMockStorage(initialData: Record<string, unknown> = {}): {
	storage: IStorageProvider;
	getData: () => Record<string, unknown>;
} {
	let data = { ...initialData };
	return {
		storage: {
			load: vi.fn(async () => data),
			save: vi.fn(async (newData: unknown) => {
				data = newData as Record<string, unknown>;
			}),
		},
		getData: () => data,
	};
}

describe("SettingsService", () => {
	let settingsService: SettingsService;
	let storage: IStorageProvider;
	let eventBus: IEventBus;
	let getData: () => Record<string, unknown>;

	beforeEach(() => {
		const mock = createMockStorage();
		storage = mock.storage;
		getData = mock.getData;
		eventBus = new EventBus();
		settingsService = new SettingsService({ storage, eventBus });
	});

	describe("initial state", () => {
		it("should have default settings before load", () => {
			expect(settingsService.getSettings()).toEqual(DEFAULT_SETTINGS);
		});
	});

	describe("load", () => {
		it("should load settings from storage", async () => {
			const mock = createMockStorage({ debugMode: true });
			const service = new SettingsService({ storage: mock.storage, eventBus });

			await service.load();

			expect(service.getSettings().debugMode).toBe(true);
		});

		it("should use defaults for invalid settings", async () => {
			const mock = createMockStorage({ debugMode: "invalid" });
			const service = new SettingsService({ storage: mock.storage, eventBus });

			await service.load();

			expect(service.getSettings()).toEqual(DEFAULT_SETTINGS);
		});

		it("should use defaults for null storage", async () => {
			const mock = createMockStorage();
			mock.storage.load = vi.fn(async () => null);
			const service = new SettingsService({ storage: mock.storage, eventBus });

			await service.load();

			expect(service.getSettings()).toEqual(DEFAULT_SETTINGS);
		});

		it("should emit settings.loaded event", async () => {
			const handler = vi.fn();
			eventBus.on("settings.loaded", handler);

			await settingsService.load();

			expect(handler).toHaveBeenCalledOnce();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "settings.loaded",
					payload: { settings: DEFAULT_SETTINGS },
				})
			);
		});
	});

	describe("getSettings", () => {
		it("should return a copy of settings", async () => {
			await settingsService.load();
			const settings1 = settingsService.getSettings();
			const settings2 = settingsService.getSettings();

			expect(settings1).toEqual(settings2);
			expect(settings1).not.toBe(settings2); // Different object references
		});
	});

	describe("updateSettings", () => {
		beforeEach(async () => {
			await settingsService.load();
		});

		it("should update settings", async () => {
			await settingsService.updateSettings({ debugMode: true });

			expect(settingsService.getSettings().debugMode).toBe(true);
		});

		it("should persist settings to storage", async () => {
			await settingsService.updateSettings({ debugMode: true });

			expect(storage.save).toHaveBeenCalled();
			expect(getData().debugMode).toBe(true);
		});

		it("should emit settings.changed event", async () => {
			const handler = vi.fn();
			eventBus.on("settings.changed", handler);

			await settingsService.updateSettings({ debugMode: true });

			expect(handler).toHaveBeenCalledOnce();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "settings.changed",
					payload: { settings: expect.objectContaining({ debugMode: true }) },
				})
			);
		});

		it("should preserve other data in storage", async () => {
			const mock = createMockStorage({ user: { name: "Test" }, debugMode: false });
			const service = new SettingsService({ storage: mock.storage, eventBus });
			await service.load();

			await service.updateSettings({ debugMode: true });

			const savedData = mock.getData();
			expect(savedData.debugMode).toBe(true);
			expect(savedData.user).toEqual({ name: "Test" });
		});
	});

	describe("setDebugMode", () => {
		beforeEach(async () => {
			await settingsService.load();
		});

		it("should enable debug mode", async () => {
			await settingsService.setDebugMode(true);
			expect(settingsService.getSettings().debugMode).toBe(true);
		});

		it("should disable debug mode", async () => {
			await settingsService.updateSettings({ debugMode: true });
			await settingsService.setDebugMode(false);
			expect(settingsService.getSettings().debugMode).toBe(false);
		});

		it("should emit settings.changed event", async () => {
			const handler = vi.fn();
			eventBus.on("settings.changed", handler);

			await settingsService.setDebugMode(true);

			expect(handler).toHaveBeenCalledOnce();
		});
	});

	describe("without eventBus", () => {
		it("should work without eventBus (optional dependency)", async () => {
			const serviceWithoutEvents = new SettingsService({
				storage: createMockStorage().storage,
			});

			// Should not throw
			await serviceWithoutEvents.load();
			await serviceWithoutEvents.updateSettings({ debugMode: true });
			await serviceWithoutEvents.setDebugMode(false);

			expect(serviceWithoutEvents.getSettings().debugMode).toBe(false);
		});
	});

	describe("TD-72: concurrent save serialization", () => {
		beforeEach(async () => {
			await settingsService.load();
		});

		it("should not lose updates when two concurrent saves occur", async () => {
			// Fire two concurrent updates that would race without mutex
			const update1 = settingsService.updateSettings({ debugMode: true });
			const update2 = settingsService.updateSettings({ showSystemEvents: true });

			await Promise.all([update1, update2]);

			// Both updates should be visible — no lost writes
			const settings = settingsService.getSettings();
			expect(settings.debugMode).toBe(true);
			expect(settings.showSystemEvents).toBe(true);
		});

		it("should serialize saves even with rapid event-driven updates", async () => {
			// Simulate rapid settings events (the original TD-72 scenario)
			await eventBus.emit("settings.updateShowSystemEvents", { showSystemEvents: true });
			await eventBus.emit("settings.updateCollapsedCategories", { collapsed: ["User", "Settings"] });

			const settings = settingsService.getSettings();
			expect(settings.showSystemEvents).toBe(true);
			expect(settings.collapsedCategories).toEqual(["User", "Settings"]);
		});
	});

	describe("custom session types", () => {
		beforeEach(async () => {
			await settingsService.load();
		});

		it("should persist custom session types via settings.updateCustomSessionTypes event", async () => {
			const customTypes = {
				"my-custom": {
					type: "my-custom",
					label: "My Custom Type",
					icon: "star",
					guidingQuestions: ["What is the goal?"],
					defaultDuration: 30,
					defaultGoals: [],
				},
			};

			await eventBus.emit("settings.updateCustomSessionTypes", { types: customTypes });

			const settings = settingsService.getSettings();
			expect(settings.customSessionTypes).toEqual(customTypes);
		});

		it("should default customSessionTypes to empty object", async () => {
			const settings = settingsService.getSettings();
			expect(settings.customSessionTypes).toEqual({});
		});

		it("should emit settings.changed after custom type update", async () => {
			const changedPromise = new Promise<void>((resolve) => {
				eventBus.on("settings.changed", () => resolve());
			});

			await eventBus.emit("settings.updateCustomSessionTypes", { types: { test: { type: "test", label: "Test", icon: "x", guidingQuestions: [], defaultDuration: 25, defaultGoals: [] } } });

			await changedPromise;
			// If we reach here, the event was emitted
			expect(true).toBe(true);
		});
	});

	describe("session activity filter", () => {
		beforeEach(async () => {
			await settingsService.load();
		});

		it("should handle settings.updateSessionActivityFilter event", async () => {
			await eventBus.emit("settings.updateSessionActivityFilter", {
				filter: [".obsidian/", "node_modules/"],
			});

			const settings = settingsService.getSettings();
			expect(settings.sessionActivityFilterGlobal).toEqual([".obsidian/", "node_modules/"]);
		});

		it("should persist filter to storage", async () => {
			await eventBus.emit("settings.updateSessionActivityFilter", {
				filter: [".git/"],
			});

			expect(storage.save).toHaveBeenCalled();
			expect(getData().sessionActivityFilterGlobal).toEqual([".git/"]);
		});
	});

	describe("TD-115: saveSettings handles non-object storage data", () => {
		it("should not crash when storage returns null during save", async () => {
			const nullStorage: IStorageProvider = {
				load: vi.fn(async () => null),
				save: vi.fn(),
			};
			const service = new SettingsService({ storage: nullStorage, eventBus });
			await service.load();
			await service.updateSettings({ debugMode: true });

			expect(nullStorage.save).toHaveBeenCalledWith(
				expect.objectContaining({ debugMode: true }),
			);
		});

		it("should not crash when storage returns an array during save", async () => {
			let savedData: unknown = null;
			const arrayStorage: IStorageProvider = {
				load: vi.fn(async () => [1, 2, 3]),
				save: vi.fn(async (d: unknown) => { savedData = d; }),
			};
			const service = new SettingsService({ storage: arrayStorage, eventBus });
			await service.load(); // will use defaults since [1,2,3] fails validation
			await service.updateSettings({ debugMode: true });

			// Should not spread array properties into saved object
			expect(savedData).toEqual(expect.objectContaining({ debugMode: true }));
			expect(Array.isArray(savedData)).toBe(false);
		});
	});

});
