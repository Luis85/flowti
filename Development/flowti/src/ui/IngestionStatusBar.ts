/**
 * Status bar component for ingestion pipeline status.
 * Shows idle/processing/scanning state with stats.
 */

import type { IEventBus } from "../infrastructure/events/types";

type StatusBarState = "idle" | "processing" | "scanning";

export class IngestionStatusBar {
	private statusEl: HTMLElement;
	private eventBus: IEventBus;
	private unsubscribes: (() => void)[] = [];

	private state: StatusBarState = "idle";
	private jobCount = 0;
	private processedCount = 0;
	private failedCount = 0;

	constructor(statusEl: HTMLElement, eventBus: IEventBus) {
		this.statusEl = statusEl;
		this.eventBus = eventBus;
	}

	register(): void {
		this.unsubscribes.push(
			this.eventBus.on("ingestion.batch.started", (event) => {
				this.state = "processing";
				this.jobCount = event.payload.jobCount;
				this.render();
			})
		);

		this.unsubscribes.push(
			this.eventBus.on("ingestion.batch.completed", (event) => {
				this.state = "idle";
				this.processedCount = event.payload.processedCount;
				this.failedCount = event.payload.failedCount;
				this.render();
			})
		);

		this.unsubscribes.push(
			this.eventBus.on("ingestion.stats", (event) => {
				this.processedCount = event.payload.stats.processedCount;
				this.failedCount = event.payload.stats.failedCount;
				this.render();
			})
		);

		this.unsubscribes.push(
			this.eventBus.on("catchup.started", () => {
				this.state = "scanning";
				this.render();
			})
		);

		this.unsubscribes.push(
			this.eventBus.on("catchup.completed", () => {
				this.state = "idle";
				this.render();
			})
		);

		this.render();
	}

	private render(): void {
		switch (this.state) {
			case "processing":
				this.statusEl.textContent = `Flowti: processing ${this.jobCount} files...`;
				break;
			case "scanning":
				this.statusEl.textContent = "Flowti: scanning folders...";
				break;
			default:
				this.statusEl.textContent = this.processedCount > 0 || this.failedCount > 0
					? `Flowti: idle (${this.processedCount} processed, ${this.failedCount} failed)`
					: "Flowti: idle";
				break;
		}
	}

	dispose(): void {
		for (const unsub of this.unsubscribes) {
			unsub();
		}
		this.unsubscribes = [];
	}
}
