import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { SignalService, type SignalConfigInput } from "../../../src/domain/signal/SignalService";
import type { SignalState } from "../../../src/domain/signal/types";
import { createMockStorage } from "../../mocks/storage";

function makeInput(overrides: Partial<SignalConfigInput> = {}): SignalConfigInput {
	return {
		name: "My Project",
		type: "azure-devops",
		orgUrl: "https://dev.azure.com/myorg",
		project: "MyProject",
		pat: "test-pat-token",
		targetFolder: "resources/signals/myproject/items",
		itemTypeFilter: ["Bug", "User Story", "Task"],
		conflictStrategy: "update",
		...overrides,
	};
}

describe("SignalService", () => {
	let service: SignalService;
	let eventBus: IEventBus;
	let getData: () => SignalState | undefined;

	beforeEach(() => {
		const mock = createMockStorage<SignalState>();
		getData = mock.getData;
		eventBus = new EventBus();
		service = new SignalService({ storage: mock.storage, eventBus });
	});

	afterEach(() => {
		service.dispose();
	});

	// ── load ─────────────────────────────────────────────────

	describe("load", () => {
		it("should initialize with empty signals array", async () => {
			await service.load();
			expect(service.getSignals()).toEqual([]);
		});

		it("should load persisted state from storage", async () => {
			const mock = createMockStorage<SignalState>({
				signals: [{
					id: "sig_existing",
					name: "Existing",
					type: "azure-devops",
					orgUrl: "https://dev.azure.com/org",
					project: "Proj",
					pat: "pat",
					targetFolder: "resources/signals/proj/items",
					itemTypeFilter: [],
					conflictStrategy: "skip",
					lastSync: "2026-02-21T10:00:00Z",
					lastSyncItemCount: 42,
					status: "connected",
				}],
			});
			service = new SignalService({ storage: mock.storage, eventBus });

			await service.load();

			expect(service.getSignals()).toHaveLength(1);
			expect(service.getSignals()[0].name).toBe("Existing");
		});

		it("should emit signal.loaded event with signal count", async () => {
			const handler = vi.fn();
			eventBus.on("signal.loaded", handler);

			await service.load();

			expect(handler).toHaveBeenCalledOnce();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { signalCount: 0 },
				}),
			);
		});

		it("should emit correct count when signals exist", async () => {
			const mock = createMockStorage<SignalState>({
				signals: [
					{ id: "s1", name: "A", type: "azure-devops", orgUrl: "", project: "", pat: "", targetFolder: "", itemTypeFilter: [], conflictStrategy: "skip", lastSync: null, lastSyncItemCount: 0, status: "disconnected" },
					{ id: "s2", name: "B", type: "azure-devops", orgUrl: "", project: "", pat: "", targetFolder: "", itemTypeFilter: [], conflictStrategy: "skip", lastSync: null, lastSyncItemCount: 0, status: "disconnected" },
				],
			});
			const handler = vi.fn();
			eventBus.on("signal.loaded", handler);
			service = new SignalService({ storage: mock.storage, eventBus });

			await service.load();

			expect(handler.mock.calls[0][0].payload.signalCount).toBe(2);
		});
	});

	// ── configure ────────────────────────────────────────────

	describe("configure", () => {
		beforeEach(async () => {
			await service.load();
		});

		it("should add a new signal config", async () => {
			await service.configure(makeInput());

			expect(service.getSignals()).toHaveLength(1);
			expect(service.getSignals()[0].name).toBe("My Project");
		});

		it("should persist state after configure", async () => {
			await service.configure(makeInput());

			expect(getData()?.signals).toHaveLength(1);
		});

		it("should emit signal.configured event", async () => {
			const handler = vi.fn();
			eventBus.on("signal.configured", handler);

			await service.configure(makeInput());

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload).toEqual(
				expect.objectContaining({
					name: "My Project",
					type: "azure-devops",
					project: "MyProject",
				}),
			);
		});

		it("should generate unique IDs", async () => {
			const a = await service.configure(makeInput({ name: "A" }));
			const b = await service.configure(makeInput({ name: "B" }));

			expect(a.id).not.toBe(b.id);
			expect(a.id).toMatch(/^sig_/);
			expect(b.id).toMatch(/^sig_/);
		});

		it("should set default status, lastSync, and lastSyncItemCount", async () => {
			const config = await service.configure(makeInput());

			expect(config.status).toBe("disconnected");
			expect(config.lastSync).toBeNull();
			expect(config.lastSyncItemCount).toBe(0);
		});

		it("should return the created config with id", async () => {
			const config = await service.configure(makeInput());

			expect(config.id).toBeDefined();
			expect(config.name).toBe("My Project");
			expect(config.pat).toBe("test-pat-token");
		});
	});

	// ── update ───────────────────────────────────────────────

	describe("update", () => {
		beforeEach(async () => {
			await service.load();
		});

		it("should update existing signal config fields", async () => {
			const config = await service.configure(makeInput());

			const updated = await service.update(config.id, { name: "Renamed" });

			expect(updated?.name).toBe("Renamed");
			expect(service.getSignal(config.id)?.name).toBe("Renamed");
		});

		it("should persist state after update", async () => {
			const config = await service.configure(makeInput());

			await service.update(config.id, { project: "NewProject" });

			expect(getData()?.signals[0].project).toBe("NewProject");
		});

		it("should emit signal.configured event on update", async () => {
			const config = await service.configure(makeInput());
			const handler = vi.fn();
			eventBus.on("signal.configured", handler);

			await service.update(config.id, { name: "Updated" });

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload.name).toBe("Updated");
		});

		it("should return undefined for non-existent signal ID", async () => {
			const result = await service.update("non-existent", { name: "X" });

			expect(result).toBeUndefined();
		});
	});

	// ── remove ───────────────────────────────────────────────

	describe("remove", () => {
		beforeEach(async () => {
			await service.load();
		});

		it("should remove signal from state", async () => {
			const config = await service.configure(makeInput());

			const removed = await service.remove(config.id);

			expect(removed).toBe(true);
			expect(service.getSignals()).toHaveLength(0);
		});

		it("should persist state after remove", async () => {
			const config = await service.configure(makeInput());

			await service.remove(config.id);

			expect(getData()?.signals).toHaveLength(0);
		});

		it("should emit signal.removed event with name", async () => {
			const config = await service.configure(makeInput());
			const handler = vi.fn();
			eventBus.on("signal.removed", handler);

			await service.remove(config.id);

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload).toEqual({
				signalId: config.id,
				name: "My Project",
			});
		});

		it("should return false for non-existent signal ID", async () => {
			const result = await service.remove("non-existent");

			expect(result).toBe(false);
		});
	});

	// ── getSignals / getSignal ───────────────────────────────

	describe("getSignals / getSignal", () => {
		beforeEach(async () => {
			await service.load();
		});

		it("should return a copy of signals array (not reference)", async () => {
			await service.configure(makeInput());

			const signals = service.getSignals();
			signals.pop();

			expect(service.getSignals()).toHaveLength(1);
		});

		it("should return undefined for non-existent ID", () => {
			expect(service.getSignal("non-existent")).toBeUndefined();
		});

		it("should return signal by ID", async () => {
			const config = await service.configure(makeInput());

			const found = service.getSignal(config.id);

			expect(found?.name).toBe("My Project");
		});
	});

	// ── dispose ──────────────────────────────────────────────

	describe("dispose", () => {
		it("should work without eventBus (optional dependency)", async () => {
			const mock = createMockStorage<SignalState>();
			const serviceNoEvents = new SignalService({ storage: mock.storage });

			await serviceNoEvents.load();
			await serviceNoEvents.configure(makeInput());

			expect(serviceNoEvents.getSignals()).toHaveLength(1);
			serviceNoEvents.dispose();
		});

		it("should not throw when called multiple times", () => {
			service.dispose();
			expect(() => service.dispose()).not.toThrow();
		});
	});
});
