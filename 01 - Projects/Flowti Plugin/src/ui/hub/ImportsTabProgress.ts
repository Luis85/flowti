/**
 * Active import progress renderer — extracted from ImportsTab for max-lines compliance.
 */

import { setIcon } from "obsidian";
import type { ActiveOperation, HubComponentDeps } from "./types";

export function renderActiveImportProgress(
	container: HTMLElement,
	op: ActiveOperation,
	deps: HubComponentDeps,
	liveUnsubscribes: (() => void)[],
): void {
	const section = container.createDiv({ cls: "ft-import-progress ft-card ft-mt-3" });

	const statusRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
	const spinnerIcon = statusRow.createSpan();
	setIcon(spinnerIcon, "loader");
	spinnerIcon.addClass("ft-opacity-60");
	spinnerIcon.addClass("ft-spin");
	const statusText = statusRow.createSpan({ cls: "ft-text-sm" });
	if (op.progress) {
		statusText.textContent = `Importing... ${op.progress.current} / ${op.progress.total}`;
		if (op.progress.lastFilename) statusText.textContent += ` — ${op.progress.lastFilename}`;
	} else {
		statusText.textContent = `Running import: ${op.name}...`;
	}

	const barBg = section.createDiv({ cls: "ft-progress-bar-track-4" });
	const barFill = barBg.createDiv({ cls: "ft-progress-bar-fill-animated" });
	const pct = op.progress && op.progress.total > 0
		? Math.round((op.progress.current / op.progress.total) * 100)
		: 0;
	barFill.style.width = `${pct}%`;

	const detailText = section.createDiv({ cls: "ft-text-muted ft-text-sm ft-px-2 ft-pb-2" });

	// Live progress listener
	liveUnsubscribes.push(
		deps.eventBus.on("dataExchange.import.progress", (event) => {
			if (event.payload.operationId !== op.operationId) return;
			const { current, total, lastFilename } = event.payload;
			const livePct = total > 0 ? Math.round((current / total) * 100) : 0;
			barFill.style.width = `${livePct}%`;
			statusText.textContent = `Importing... ${current} / ${total}`;
			if (lastFilename) statusText.textContent += ` — ${lastFilename}`;
			detailText.textContent = lastFilename ? `Last: ${lastFilename}` : "";
		}),
	);

	// Completion/failure listener
	liveUnsubscribes.push(
		deps.eventBus.on("dataExchange.import.completed", (event) => {
			if (event.payload.operationId !== op.operationId) return;
			section.empty();
			const resultRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
			const icon = resultRow.createSpan();
			setIcon(icon, "check-circle");
			icon.addClass("ft-text-success");
			const r = event.payload.result;
			resultRow.createSpan({
				text: `Import complete: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped` +
					(r.failed > 0 ? `, ${r.failed} failed` : ""),
				cls: "ft-text-sm",
			});
		}),
	);
	liveUnsubscribes.push(
		deps.eventBus.on("dataExchange.import.failed", (event) => {
			if (event.payload.operationId !== op.operationId) return;
			section.empty();
			const resultRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
			const icon = resultRow.createSpan();
			setIcon(icon, "x-circle");
			icon.addClass("ft-text-error");
			resultRow.createSpan({ text: `Import failed: ${event.payload.error}`, cls: "ft-text-sm" });
		}),
	);
}
