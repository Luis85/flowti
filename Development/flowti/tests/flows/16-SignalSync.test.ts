/**
 * Flow 16: Configure and Sync Azure DevOps Signal
 *
 * Tests the end-to-end sync pipeline:
 * Configure signal → test connection → sync (fetch → map → create notes) →
 * progress events → result → inbox notification.
 *
 * Event sequence:
 *   signal.configured → signal.connection.tested →
 *   signal.sync.started → signal.sync.progress (×N) →
 *   signal.item.created / signal.item.updated →
 *   signal.sync.completed → inbox.itemAdded
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { SignalService } from "../../src/domain/signal/SignalService";
import { InboxService } from "../../src/domain/inbox/InboxService";
import type { SignalAdapter, TestConnectionResult, FetchItemsResult } from "../../src/domain/signal/adapters/SignalAdapter";
import type { SignalConfig, SignalState, WorkItemMapping } from "../../src/domain/signal/types";
import type { InboxState } from "../../src/domain/inbox/types";
import { createMockStorage, createMockFileSystem, waitForAsync } from "./testHelpers";

// ── Mock adapter ────────────────────────────────────────────

function createMockAdapter(overrides: Partial<SignalAdapter> = {}): SignalAdapter {
	return {
		testConnection: vi.fn(async (): Promise<TestConnectionResult> => ({ success: true })),
		fetchItems: vi.fn(async (): Promise<FetchItemsResult> => ({ items: [], errors: [] })),
		...overrides,
	};
}

function makeWorkItem(overrides: Partial<WorkItemMapping> = {}): WorkItemMapping {
	return {
		id: 100,
		rev: 1,
		type: "User Story",
		title: "Test Item",
		state: "Active",
		assignedTo: "Dev User",
		areaPath: "MyProject\\Area",
		iterationPath: "MyProject\\Sprint 1",
		priority: 2,
		tags: ["signal"],
		url: "https://dev.azure.com/myorg/MyProject/_workitems/edit/100",
		description: "<p>Test description</p>",
		createdDate: "2026-02-20T10:00:00Z",
		changedDate: "2026-02-21T10:00:00Z",
		...overrides,
	};
}

describe("Flow 16: Configure and Sync Azure DevOps Signal", () => {
	let eventBus: IEventBus;
	let signalService: SignalService;
	let inboxService: InboxService;
	let adapter: SignalAdapter;
	let fileSystem: ReturnType<typeof createMockFileSystem>;

	beforeEach(async () => {
		eventBus = new EventBus();
		adapter = createMockAdapter();
		fileSystem = createMockFileSystem();

		const signalMock = createMockStorage<SignalState>();
		signalService = new SignalService({
			storage: signalMock.storage,
			eventBus,
			adapter,
			fileSystem,
		});
		await signalService.load();

		const inboxMock = createMockStorage<InboxState>();
		inboxService = new InboxService({ storage: inboxMock.storage, eventBus });
		await inboxService.load();
	});

	// ── Full pipeline ─────────────────────────────────────────

	it("should execute full sync pipeline: configure → sync → notes created", async () => {
		const items = [makeWorkItem({ id: 101, title: "Story A" }), makeWorkItem({ id: 102, title: "Story B" })];
		(adapter.fetchItems as ReturnType<typeof vi.fn>).mockResolvedValue({ items, errors: [] });

		const config = await signalService.configure({
			name: "Test Signal",
			type: "azure-devops",
			orgUrl: "https://dev.azure.com/org",
			project: "Proj",
			pat: "test-pat",
			targetFolder: "signals/items",
			itemTypeFilter: [],
			conflictStrategy: "update",
		});

		const result = await signalService.sync(config.id);

		expect(result.itemsCreated).toBe(2);
		expect(result.errors).toHaveLength(0);
		expect(fileSystem.createFile).toHaveBeenCalledTimes(2);
	});

	// ── testConnection ────────────────────────────────────────

	it("should update status to connected on successful test", async () => {
		const config = await signalService.configure({
			name: "Test",
			type: "azure-devops",
			orgUrl: "https://dev.azure.com/org",
			project: "Proj",
			pat: "pat",
			targetFolder: "signals/items",
			itemTypeFilter: [],
			conflictStrategy: "update",
		});

		const testedHandler = vi.fn();
		eventBus.on("signal.connection.tested", testedHandler);

		const result = await signalService.testConnection(config.id);

		expect(result.success).toBe(true);
		expect(signalService.getSignal(config.id)?.status).toBe("connected");
		expect(testedHandler).toHaveBeenCalledOnce();
	});

	it("should update status to error on failed test", async () => {
		(adapter.testConnection as ReturnType<typeof vi.fn>).mockResolvedValue({
			success: false,
			error: "Invalid PAT",
		});

		const config = await signalService.configure({
			name: "Test",
			type: "azure-devops",
			orgUrl: "https://dev.azure.com/org",
			project: "Proj",
			pat: "bad-pat",
			targetFolder: "signals/items",
			itemTypeFilter: [],
			conflictStrategy: "update",
		});

		const result = await signalService.testConnection(config.id);

		expect(result.success).toBe(false);
		expect(result.error).toBe("Invalid PAT");
		expect(signalService.getSignal(config.id)?.status).toBe("error");
	});

	// ── Per-item error resilience ─────────────────────────────

	it("should continue sync when one item fails to write", async () => {
		const items = [
			makeWorkItem({ id: 201, title: "Good Item 1" }),
			makeWorkItem({ id: 202, title: "Bad Item" }),
			makeWorkItem({ id: 203, title: "Good Item 2" }),
		];
		(adapter.fetchItems as ReturnType<typeof vi.fn>).mockResolvedValue({ items, errors: [] });

		// Make the second createFile call throw
		let callCount = 0;
		(fileSystem.createFile as ReturnType<typeof vi.fn>).mockImplementation(async () => {
			callCount++;
			if (callCount === 2) throw new Error("Disk full");
		});

		const config = await signalService.configure({
			name: "Test",
			type: "azure-devops",
			orgUrl: "https://dev.azure.com/org",
			project: "Proj",
			pat: "pat",
			targetFolder: "signals/items",
			itemTypeFilter: [],
			conflictStrategy: "update",
		});

		const result = await signalService.sync(config.id);

		expect(result.itemsCreated).toBe(2);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0].workItemId).toBe(202);
		expect(result.errors[0].message).toBe("Disk full");
	});

	// ── Progress events ───────────────────────────────────────

	it("should emit progress events per item", async () => {
		const items = [
			makeWorkItem({ id: 301, title: "Item 1" }),
			makeWorkItem({ id: 302, title: "Item 2" }),
			makeWorkItem({ id: 303, title: "Item 3" }),
		];
		(adapter.fetchItems as ReturnType<typeof vi.fn>).mockResolvedValue({ items, errors: [] });

		const config = await signalService.configure({
			name: "Test",
			type: "azure-devops",
			orgUrl: "https://dev.azure.com/org",
			project: "Proj",
			pat: "pat",
			targetFolder: "signals/items",
			itemTypeFilter: [],
			conflictStrategy: "update",
		});

		const progressEvents: Array<{ current: number; total: number }> = [];
		eventBus.on("signal.sync.progress", (e) => {
			progressEvents.push(e.payload as { current: number; total: number });
		});

		await signalService.sync(config.id);

		expect(progressEvents).toHaveLength(3);
		expect(progressEvents[0]).toMatchObject({ current: 1, total: 3 });
		expect(progressEvents[1]).toMatchObject({ current: 2, total: 3 });
		expect(progressEvents[2]).toMatchObject({ current: 3, total: 3 });
	});

	// ── Item-level events ─────────────────────────────────────

	it("should emit item.created events for new notes", async () => {
		const items = [makeWorkItem({ id: 401, title: "New Item" })];
		(adapter.fetchItems as ReturnType<typeof vi.fn>).mockResolvedValue({ items, errors: [] });

		const config = await signalService.configure({
			name: "Test",
			type: "azure-devops",
			orgUrl: "https://dev.azure.com/org",
			project: "Proj",
			pat: "pat",
			targetFolder: "signals/items",
			itemTypeFilter: [],
			conflictStrategy: "update",
		});

		const createdEvents: unknown[] = [];
		eventBus.on("signal.item.created", (e) => { createdEvents.push(e.payload); });

		await signalService.sync(config.id);

		expect(createdEvents).toHaveLength(1);
		expect(createdEvents[0]).toMatchObject({ signalId: config.id, workItemId: 401 });
	});

	// ── Config persistence ────────────────────────────────────

	it("should update lastSync and lastSyncItemCount after sync", async () => {
		const items = [makeWorkItem({ id: 501, title: "Item" }), makeWorkItem({ id: 502, title: "Item 2" })];
		(adapter.fetchItems as ReturnType<typeof vi.fn>).mockResolvedValue({ items, errors: [] });

		const config = await signalService.configure({
			name: "Test",
			type: "azure-devops",
			orgUrl: "https://dev.azure.com/org",
			project: "Proj",
			pat: "pat",
			targetFolder: "signals/items",
			itemTypeFilter: [],
			conflictStrategy: "update",
		});

		expect(signalService.getSignal(config.id)?.lastSync).toBeNull();

		await signalService.sync(config.id);

		const updated = signalService.getSignal(config.id)!;
		expect(updated.lastSync).not.toBeNull();
		expect(updated.lastSyncItemCount).toBe(2);
		expect(updated.status).toBe("connected");
	});

	// ── Inbox integration ─────────────────────────────────────

	it("should create inbox item on sync completed", async () => {
		const items = [makeWorkItem({ id: 601, title: "Item" })];
		(adapter.fetchItems as ReturnType<typeof vi.fn>).mockResolvedValue({ items, errors: [] });

		const config = await signalService.configure({
			name: "Test",
			type: "azure-devops",
			orgUrl: "https://dev.azure.com/org",
			project: "Proj",
			pat: "pat",
			targetFolder: "signals/items",
			itemTypeFilter: [],
			conflictStrategy: "update",
		});

		const addedHandler = vi.fn();
		eventBus.on("inbox.itemAdded", addedHandler);

		await signalService.sync(config.id);
		await waitForAsync();

		expect(addedHandler).toHaveBeenCalled();
	});

	it("should create inbox action item on sync failed", async () => {
		(adapter.fetchItems as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

		const config = await signalService.configure({
			name: "Test",
			type: "azure-devops",
			orgUrl: "https://dev.azure.com/org",
			project: "Proj",
			pat: "pat",
			targetFolder: "signals/items",
			itemTypeFilter: [],
			conflictStrategy: "update",
		});

		const addedHandler = vi.fn();
		eventBus.on("inbox.itemAdded", addedHandler);

		await signalService.sync(config.id);
		await waitForAsync();

		expect(addedHandler).toHaveBeenCalled();
	});

	// ── syncAll ───────────────────────────────────────────────

	it("should sync all configured signals", async () => {
		(adapter.fetchItems as ReturnType<typeof vi.fn>).mockResolvedValue({
			items: [makeWorkItem({ id: 701, title: "Item" })],
			errors: [],
		});

		await signalService.configure({
			name: "Signal 1",
			type: "azure-devops",
			orgUrl: "https://dev.azure.com/org",
			project: "Proj1",
			pat: "pat",
			targetFolder: "signals/proj1",
			itemTypeFilter: [],
			conflictStrategy: "update",
		});

		await signalService.configure({
			name: "Signal 2",
			type: "azure-devops",
			orgUrl: "https://dev.azure.com/org",
			project: "Proj2",
			pat: "pat",
			targetFolder: "signals/proj2",
			itemTypeFilter: [],
			conflictStrategy: "update",
		});

		const results = await signalService.syncAll();

		expect(results).toHaveLength(2);
		expect(results[0].itemsCreated).toBe(1);
		expect(results[1].itemsCreated).toBe(1);
	});

	// ── Empty sync ────────────────────────────────────────────

	it("should handle sync with zero items", async () => {
		(adapter.fetchItems as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [], errors: [] });

		const config = await signalService.configure({
			name: "Empty",
			type: "azure-devops",
			orgUrl: "https://dev.azure.com/org",
			project: "Proj",
			pat: "pat",
			targetFolder: "signals/items",
			itemTypeFilter: [],
			conflictStrategy: "update",
		});

		const result = await signalService.sync(config.id);

		expect(result.itemsCreated).toBe(0);
		expect(result.itemsUpdated).toBe(0);
		expect(result.itemsSkipped).toBe(0);
		expect(result.errors).toHaveLength(0);
	});
});
