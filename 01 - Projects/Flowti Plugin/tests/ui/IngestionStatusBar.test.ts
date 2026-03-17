import { describe, it, expect, beforeEach } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { IngestionStatusBar } from "../../src/ui/shared/IngestionStatusBar";

/**
 * Minimal HTMLElement mock for status bar testing.
 */
function createMockElement(): HTMLElement {
	return { textContent: "" } as unknown as HTMLElement;
}

describe("IngestionStatusBar", () => {
	let statusEl: HTMLElement;
	let eventBus: IEventBus;
	let statusBar: IngestionStatusBar;

	beforeEach(() => {
		statusEl = createMockElement();
		eventBus = new EventBus();
		statusBar = new IngestionStatusBar(statusEl, eventBus);
	});

	it("should render idle by default after register", () => {
		statusBar.register();
		expect(statusEl.textContent).toBe("Flowti: idle");
	});

	it("should update on batch started", async () => {
		statusBar.register();

		await eventBus.emit("ingestion.batch.started", { jobCount: 5 });

		expect(statusEl.textContent).toBe("Flowti: processing 5 files...");
	});

	it("should update on batch completed", async () => {
		statusBar.register();

		await eventBus.emit("ingestion.batch.started", { jobCount: 3 });
		await eventBus.emit("ingestion.batch.completed", {
			processedCount: 3,
			failedCount: 0,
		});

		expect(statusEl.textContent).toBe("Flowti: idle (3 processed, 0 failed)");
	});

	it("should show scanning state on catchup", async () => {
		statusBar.register();

		await eventBus.emit("catchup.started", { folderCount: 2 });

		expect(statusEl.textContent).toBe("Flowti: scanning folders...");
	});

	it("should return to idle after catchup completed", async () => {
		statusBar.register();

		await eventBus.emit("catchup.started", { folderCount: 2 });
		await eventBus.emit("catchup.completed", { scannedCount: 10, newCount: 3 });

		expect(statusEl.textContent).toBe("Flowti: idle");
	});

	it("should update stats from ingestion.stats", async () => {
		statusBar.register();

		await eventBus.emit("ingestion.stats", {
			stats: {
				processedCount: 10,
				failedCount: 2,
				queuedCount: 0,
				activeCount: 0,
			},
		});

		expect(statusEl.textContent).toBe("Flowti: idle (10 processed, 2 failed)");
	});

	it("should stop updating after dispose", async () => {
		statusBar.register();
		statusBar.dispose();

		await eventBus.emit("ingestion.batch.started", { jobCount: 5 });

		// Should still show idle since we disposed
		expect(statusEl.textContent).toBe("Flowti: idle");
	});
});
