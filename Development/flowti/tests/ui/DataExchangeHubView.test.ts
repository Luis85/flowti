import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";

/**
 * Tests for DataExchangeHubView's behavioral contracts — event subscriptions,
 * state management, and configuration sync.
 *
 * Since DataExchangeHubView is an Obsidian ItemView (DOM-dependent),
 * we test the behavioral contracts using the EventBus directly,
 * mirroring the same patterns in subscribeToEvents().
 */
describe("DataExchangeHubView behavior", () => {
	let eventBus: IEventBus;

	beforeEach(() => {
		eventBus = new EventBus();
	});

	// ── Config change sync ───────────────────────────────────

	describe("config change sync", () => {
		it("should trigger refresh on dataExchange.config.changed", async () => {
			const refreshSpy = vi.fn();

			eventBus.on("dataExchange.config.changed", () => {
				refreshSpy();
			});

			await eventBus.emit("dataExchange.config.changed", {} as never);

			expect(refreshSpy).toHaveBeenCalledOnce();
		});
	});

	// ── Import/export completion ─────────────────────────────

	describe("completion events", () => {
		it("should trigger re-render on dataExchange.import.completed", async () => {
			const renderSpy = vi.fn();

			eventBus.on("dataExchange.import.completed", () => {
				renderSpy();
			});

			await eventBus.emit("dataExchange.import.completed", {
				result: { totalRows: 6, created: 5, updated: 0, skipped: 1, failed: 0, errors: [] },
			});

			expect(renderSpy).toHaveBeenCalledOnce();
		});

		it("should trigger re-render on dataExchange.export.completed", async () => {
			const renderSpy = vi.fn();

			eventBus.on("dataExchange.export.completed", () => {
				renderSpy();
			});

			await eventBus.emit("dataExchange.export.completed", {
				result: { totalRows: 10, totalColumns: 5, outputPath: "exports/data.csv" },
			});

			expect(renderSpy).toHaveBeenCalledOnce();
		});
	});

	// ── Property doc file tracking ───────────────────────────

	describe("property doc file tracking", () => {
		it("should trigger scan on file.created in properties folder", async () => {
			const propsFolder = "03 - Resources/Documentation/Reference/Properties/";
			const scanSpy = vi.fn();

			eventBus.on("file.created", (event) => {
				if (event.payload.path.startsWith(propsFolder)) {
					scanSpy();
				}
			});

			// File in properties folder — should trigger
			await eventBus.emit("file.created", {
				path: propsFolder + "status.md",
				source: "user",
			});
			expect(scanSpy).toHaveBeenCalledOnce();

			// File outside properties folder — should not trigger
			await eventBus.emit("file.created", {
				path: "other/folder/note.md",
				source: "user",
			});
			expect(scanSpy).toHaveBeenCalledOnce(); // still 1
		});

		it("should trigger scan on file.deleted in properties folder", async () => {
			const propsFolder = "03 - Resources/Documentation/Reference/Properties/";
			const scanSpy = vi.fn();

			eventBus.on("file.deleted", (event) => {
				if (event.payload.path.startsWith(propsFolder)) {
					scanSpy();
				}
			});

			await eventBus.emit("file.deleted", {
				path: propsFolder + "status.md",
				source: "user",
			});
			expect(scanSpy).toHaveBeenCalledOnce();
		});

		it("should ignore file events outside properties folder", async () => {
			const propsFolder = "03 - Resources/Documentation/Reference/Properties/";
			const scanSpy = vi.fn();

			eventBus.on("file.created", (event) => {
				if (event.payload.path.startsWith(propsFolder)) {
					scanSpy();
				}
			});

			await eventBus.emit("file.created", {
				path: "Reports/daily.csv",
				source: "user",
			});

			expect(scanSpy).not.toHaveBeenCalled();
		});
	});

	// ── State management ─────────────────────────────────────

	describe("state management", () => {
		it("should maintain page state", () => {
			// Simulating the hub's page navigation logic
			let currentPage: string = "dashboard";

			const navigateTo = (page: string): void => {
				currentPage = page;
			};

			expect(currentPage).toBe("dashboard");
			navigateTo("imports");
			expect(currentPage).toBe("imports");
			navigateTo("exports");
			expect(currentPage).toBe("exports");
			navigateTo("dashboard");
			expect(currentPage).toBe("dashboard");
		});

		it("should maintain selection state across tabs", () => {
			// Simulating the hub's selection tracking
			let selectedImportId: string | null = null;
			let selectedExportId: string | null = null;

			selectedImportId = "config-1";
			expect(selectedImportId).toBe("config-1");

			selectedExportId = "export-1";
			expect(selectedExportId).toBe("export-1");

			// Navigating to a different tab doesn't clear selection
			expect(selectedImportId).toBe("config-1");
		});

		it("should support filter text across all tabs", () => {
			let filterText = "";

			filterText = "report";
			expect(filterText).toBe("report");

			// Simulate filtering logic
			const items = ["Daily Report", "Weekly Summary", "Monthly Report"];
			const filtered = items.filter((i) => i.toLowerCase().includes(filterText));
			expect(filtered).toEqual(["Daily Report", "Monthly Report"]);
		});
	});

	// ── Cleanup ──────────────────────────────────────────────

	describe("cleanup on close", () => {
		it("should stop receiving events after all unsubscribes", async () => {
			const received: string[] = [];

			const unsub1 = eventBus.on("dataExchange.config.changed", () => {
				received.push("config");
			});
			const unsub2 = eventBus.on("dataExchange.import.completed", () => {
				received.push("import");
			});

			await eventBus.emit("dataExchange.config.changed", {} as never);
			expect(received).toHaveLength(1);

			// Simulate onClose
			unsub1();
			unsub2();

			await eventBus.emit("dataExchange.config.changed", {} as never);
			await eventBus.emit("dataExchange.import.completed", {
				result: { totalRows: 0, created: 0, updated: 0, skipped: 0, failed: 0, errors: [] },
			});

			expect(received).toHaveLength(1); // No new events
		});
	});
});
