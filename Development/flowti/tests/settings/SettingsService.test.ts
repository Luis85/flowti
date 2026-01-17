import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/events/EventBus";
import type { IEventBus } from "../../src/events/types";
import { SettingsService } from "../../src/settings/SettingsService";
import { DEFAULT_SETTINGS, FlowtiSettings } from "../../src/settings/settings";
import type { IStorageProvider } from "../../src/utils/types";

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
});
