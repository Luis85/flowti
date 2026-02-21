/**
 * Signals tab component for the Data Exchange Hub.
 * Renders the master list of signal connections and the detail panel.
 */

import { setIcon } from "obsidian";
import { ConfirmModal } from "../modals";
import { renderEmptyDetail, getEmptyDetailStats } from "./helpers";
import { SignalConfigModal } from "./SignalConfigModal";
import type { HubComponentDeps } from "./types";
import type { SignalConfig } from "../../domain/signal/types";

const STATUS_COLORS: Record<string, string> = {
	connected: "var(--color-green)",
	error: "var(--color-red)",
	disconnected: "var(--text-faint)",
};

export class SignalsTab {
	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: HubComponentDeps,
	) {}

	// ─────────────────────────────────────────────────────────
	// Master list
	// ─────────────────────────────────────────────────────────

	renderMaster(): void {
		this.masterEl.empty();

		const state = this.deps.getState();
		const signalService = this.deps.signalService;
		if (!signalService) return;

		let signals = signalService.getSignals();
		if (state.filterText) {
			signals = signals.filter((s) =>
				s.name.toLowerCase().includes(state.filterText) ||
				s.project.toLowerCase().includes(state.filterText),
			);
		}

		const header = this.masterEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Signals" });
		header.createSpan({
			text: `${signals.length}`,
			cls: "ft-master-category-count",
		});
		const headerSpacer = header.createDiv();
		headerSpacer.addClass("ft-flex-1");
		const addBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const addIcon = addBtn.createSpan();
		setIcon(addIcon, "plus");
		addBtn.setAttribute("aria-label", "New Signal");
		addBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			new SignalConfigModal(
				this.deps.app,
				signalService,
				() => this.deps.scheduleRender(),
			).open();
		});

		if (signals.length === 0) {
			const empty = this.masterEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm" });
			empty.textContent = state.filterText ? "No matching signals" : "No signals configured";
			return;
		}

		for (const signal of signals) {
			const isSelected = state.selectedSignalId === signal.id;
			const item = this.masterEl.createDiv({
				cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
			});
			item.style.alignItems = "flex-start";

			// Status dot
			const dot = item.createSpan();
			dot.style.width = "8px";
			dot.style.height = "8px";
			dot.style.borderRadius = "50%";
			dot.style.backgroundColor = STATUS_COLORS[signal.status] ?? STATUS_COLORS.disconnected;
			dot.style.flexShrink = "0";
			dot.style.marginTop = "0.35rem";
			dot.setAttribute("aria-label", signal.status);

			const textBlock = item.createDiv({ cls: "ft-master-event-name" });
			textBlock.style.minWidth = "0";
			textBlock.createDiv({ text: signal.name });
			const sub = textBlock.createDiv({ cls: "ft-text-muted ft-text-sm" });
			sub.style.whiteSpace = "nowrap";
			sub.style.overflow = "hidden";
			sub.style.textOverflow = "ellipsis";
			sub.textContent = signal.project;

			// Item count badge
			if (signal.lastSyncItemCount > 0) {
				item.createSpan({
					text: `${signal.lastSyncItemCount}`,
					cls: "ft-badge ft-badge-muted",
				});
			}

			item.addEventListener("click", () => {
				this.deps.setState({ selectedSignalId: signal.id });
				this.renderMaster();
				this.renderDetail();
			});
		}
	}

	// ─────────────────────────────────────────────────────────
	// Detail panel
	// ─────────────────────────────────────────────────────────

	renderDetail(): void {
		this.detailEl.empty();
		const state = this.deps.getState();
		const signalService = this.deps.signalService;
		if (!signalService) return;

		if (!state.selectedSignalId) {
			const { count, label } = getEmptyDetailStats(this.deps);
			renderEmptyDetail(this.detailEl, "radio", "Select a signal to view details", count, label);
			return;
		}

		const signal = signalService.getSignal(state.selectedSignalId);
		if (!signal) {
			const { count, label } = getEmptyDetailStats(this.deps);
			renderEmptyDetail(this.detailEl, "radio", "Signal not found", count, label);
			return;
		}

		this.renderDetailHeader(signal);
		this.renderConnectionInfo(signal);
		this.renderSyncInfo(signal);
		this.renderActions(signal, signalService);
	}

	private renderDetailHeader(signal: SignalConfig): void {
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: signal.name, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: signal.type, cls: "ft-badge ft-badge-muted" });
		const statusBadge = badges.createSpan({ text: signal.status, cls: "ft-badge" });
		statusBadge.style.color = STATUS_COLORS[signal.status] ?? STATUS_COLORS.disconnected;
	}

	private renderConnectionInfo(signal: SignalConfig): void {
		const section = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
		section.createDiv({ text: "Connection", cls: "ft-detail-section-header" });
		const rows: Array<[string, string]> = [
			["Organization", signal.orgUrl],
			["Project", signal.project],
			["Target Folder", signal.targetFolder],
			["Conflict Strategy", signal.conflictStrategy],
		];
		if (signal.itemTypeFilter.length > 0) {
			rows.push(["Type Filter", signal.itemTypeFilter.join(", ")]);
		}
		for (const [label, value] of rows) {
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
			row.style.padding = "0.35rem 0.5rem";
			row.style.borderBottom = "1px solid var(--background-modifier-border)";
			row.createSpan({ text: label, cls: "ft-text-muted ft-text-sm" });
			const spacer = row.createDiv();
			spacer.addClass("ft-flex-1");
			row.createSpan({ text: value, cls: "ft-text-sm" });
		}
	}

	private renderSyncInfo(signal: SignalConfig): void {
		const section = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
		section.createDiv({ text: "Last Sync", cls: "ft-detail-section-header" });
		const content = section.createDiv({ cls: "ft-p-2" });
		if (signal.lastSync) {
			content.createDiv({ text: new Date(signal.lastSync).toLocaleString(), cls: "ft-text-sm" });
			content.createDiv({
				text: `${signal.lastSyncItemCount} item${signal.lastSyncItemCount !== 1 ? "s" : ""} synced`,
				cls: "ft-text-muted ft-text-sm ft-mt-1",
			});
		} else {
			content.createDiv({ text: "Never synced", cls: "ft-text-muted ft-text-sm" });
		}
	}

	private renderActions(signal: SignalConfig, signalService: NonNullable<HubComponentDeps["signalService"]>): void {
		const actions = this.detailEl.createDiv({ cls: "ft-detail-actions ft-mt-2" });

		// Sync Now (disabled — wired in Inc 5)
		const syncLink = actions.createEl("span", { cls: "ft-nav-link" });
		syncLink.style.opacity = "0.4";
		syncLink.style.cursor = "default";
		const syncIcon = syncLink.createSpan();
		setIcon(syncIcon, "refresh-cw");
		syncLink.appendText(" Sync Now");
		syncLink.setAttribute("aria-label", "Sync Now (available after sync orchestration)");

		// Test Connection (disabled — wired in Inc 5)
		const testLink = actions.createEl("span", { cls: "ft-nav-link" });
		testLink.style.opacity = "0.4";
		testLink.style.cursor = "default";
		const testIcon = testLink.createSpan();
		setIcon(testIcon, "plug");
		testLink.appendText(" Test Connection");
		testLink.setAttribute("aria-label", "Test Connection (available after sync orchestration)");

		// Edit
		const editLink = actions.createEl("span", { cls: "ft-nav-link" });
		const editIcon = editLink.createSpan();
		setIcon(editIcon, "pencil");
		editLink.appendText(" Edit");
		editLink.addEventListener("click", () => {
			new SignalConfigModal(
				this.deps.app,
				signalService,
				() => this.deps.scheduleRender(),
				signal,
			).open();
		});

		// Remove
		const deleteLink = actions.createEl("span", { cls: "ft-nav-link" });
		deleteLink.style.color = "var(--text-error)";
		const delIcon = deleteLink.createSpan();
		setIcon(delIcon, "trash-2");
		deleteLink.appendText(" Remove");
		deleteLink.addEventListener("click", () => {
			new ConfirmModal(this.deps.app, {
				message: `Remove signal "${signal.name}"? Synced notes will be preserved.`,
				confirmLabel: "Remove",
				onConfirm: () => {
					void signalService.remove(signal.id).then(() => {
						this.deps.setState({ selectedSignalId: null });
						this.deps.scheduleRender();
					});
				},
			}).open();
		});
	}
}
