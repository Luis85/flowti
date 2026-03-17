/**
 * Processes tab for the Event Catalog view.
 *
 * Master panel: process list with validation badges.
 * Detail panel: process info, node list with types, validation findings.
 */

import { setIcon } from "obsidian";
import type { ProcessDefinition, ValidationFinding, ValidationResult } from "../../domain/process/types";
import type { CatalogComponentDeps } from "./types";

/** Callback interface for process data access. */
export interface ProcessesTabDeps {
	getProcesses: () => ProcessDefinition[];
	validateProcess: (def: ProcessDefinition) => ValidationResult;
}

const NODE_TYPE_ICONS: Record<string, string> = {
	start: "play",
	end: "square",
	activity: "box",
	decision: "git-branch",
};

const SEVERITY_ICONS: Record<string, string> = {
	error: "x-circle",
	warning: "alert-triangle",
	info: "info",
};

/**
 * Processes tab component for the Event Catalog view.
 * Renders a process list master with validation detail panel.
 */
export class ProcessesTab {
	private selectedProcess: string | null = null;

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: CatalogComponentDeps,
		private processDeps: ProcessesTabDeps,
	) {}

	// ── Public API ───────────────────────────────────────────

	getEntries(): ProcessDefinition[] {
		return this.processDeps.getProcesses();
	}

	getSelectedProcess(): string | null {
		return this.selectedProcess;
	}

	setSelectedProcess(name: string | null): void {
		this.selectedProcess = name;
	}

	render(): void {
		this.renderMaster();
		this.renderDetail();
	}

	getCountText(): string {
		const processes = this.getEntries();
		const filterText = this.deps.getState().filterText;
		if (filterText) {
			const filtered = processes.filter((p) =>
				p.name.toLowerCase().includes(filterText));
			return `${filtered.length} / ${processes.length} processes`;
		}
		return `${processes.length} processes`;
	}

	// ── Master (left panel) ─────────────────────────────────

	private renderMaster(): void {
		this.masterEl.empty();

		const processes = this.getEntries();
		const filterText = this.deps.getState().filterText;

		const filtered = filterText
			? processes.filter((p) => p.name.toLowerCase().includes(filterText))
			: processes;

		if (filtered.length === 0) {
			const empty = this.masterEl.createDiv({ cls: "ft-master-empty" });
			if (processes.length === 0) {
				empty.textContent = "No process definitions found. Add *.process.canvas files to your processes folder.";
			} else {
				empty.textContent = "No matching processes";
			}
			return;
		}

		for (const process of filtered) {
			const validation = this.processDeps.validateProcess(process);
			const isSelected = this.selectedProcess === process.name;

			const item = this.masterEl.createDiv({
				cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
			});
			item.dataset.processName = process.name;

			// Validation badge
			const badge = item.createSpan({ cls: "ft-badge ft-badge-sm" });
			if (validation.valid) {
				badge.textContent = "Valid";
				badge.classList.add("ft-badge-muted");
			} else if (validation.errorCount > 0) {
				badge.textContent = `${validation.errorCount} error${validation.errorCount === 1 ? "" : "s"}`;
				badge.classList.add("ft-badge-accent");
			} else {
				badge.textContent = `${validation.warningCount} warning${validation.warningCount === 1 ? "" : "s"}`;
				badge.classList.add("ft-badge-accent");
			}

			// Name
			item.createSpan({ text: process.name, cls: "ft-master-item-label" });

			// Node count
			item.createSpan({
				text: `${process.nodes.length} nodes`,
				cls: "ft-master-item-meta",
			});

			item.addEventListener("click", () => {
				this.selectedProcess = process.name;
				this.renderMaster();
				this.renderDetail();
			});
		}
	}

	// ── Detail (right panel) ────────────────────────────────

	private renderDetail(): void {
		this.detailEl.empty();

		const process = this.getEntries().find((p) => p.name === this.selectedProcess);
		if (!process) {
			this.renderDetailEmpty();
			return;
		}

		const validation = this.processDeps.validateProcess(process);

		this.renderDetailHeader(process, validation);
		this.renderNodeList(process);
		this.renderValidationFindings(validation);
	}

	private renderDetailEmpty(): void {
		const empty = this.detailEl.createDiv({ cls: "ft-catalog-detail-empty" });

		const iconEl = empty.createDiv({ cls: "ft-mb-3" });
		setIcon(iconEl, "waypoints");
		iconEl.addClass("ft-opacity-40");
		iconEl.querySelector("svg")?.setAttribute("width", "48");
		iconEl.querySelector("svg")?.setAttribute("height", "48");

		empty.createDiv({
			text: "Select a process to view details",
			cls: "ft-text-muted ft-mb-3",
		});

		const stats = empty.createDiv({ cls: "ft-flex ft-gap-4 ft-catalog-quick-stats" });
		const processes = this.getEntries();
		const valid = processes.filter((p) => this.processDeps.validateProcess(p).valid).length;
		this.renderStat(stats, String(processes.length), "Processes");
		this.renderStat(stats, String(valid), "Valid");
		this.renderStat(stats, String(processes.length - valid), "With Issues");
	}

	private renderStat(container: HTMLElement, value: string, label: string): void {
		const stat = container.createDiv({ cls: "ft-catalog-stat" });
		stat.createDiv({ text: value, cls: "ft-catalog-stat-value" });
		stat.createDiv({ text: label, cls: "ft-catalog-stat-label" });
	}

	private renderDetailHeader(process: ProcessDefinition, validation: ValidationResult): void {
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });

		// Title row
		const titleRow = header.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const iconEl = titleRow.createSpan();
		setIcon(iconEl, "waypoints");
		titleRow.createSpan({ text: process.name, cls: "ft-detail-event-type" });

		// Badges
		const badges = header.createDiv({ cls: "ft-flex ft-gap-2 ft-mt-1" });
		badges.createSpan({
			text: validation.valid ? "VALID" : "INVALID",
			cls: `ft-badge ft-badge-${validation.valid ? "muted" : "accent"}`,
		});
		badges.createSpan({
			text: `${process.nodes.length} nodes`,
			cls: "ft-badge ft-badge-muted",
		});
		badges.createSpan({
			text: `${process.edges.length} edges`,
			cls: "ft-badge ft-badge-muted",
		});

		// File path
		if (process.filePath) {
			header.createDiv({
				text: process.filePath,
				cls: "ft-text-sm ft-text-muted ft-mt-1",
			});
		}
	}

	private renderNodeList(process: ProcessDefinition): void {
		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		section.createDiv({ cls: "ft-detail-section-header" }).createSpan({
			text: `Nodes (${process.nodes.length})`,
			cls: "ft-heading ft-heading-sm",
		});

		for (const node of process.nodes) {
			const row = section.createDiv({ cls: "ft-catalog-row" });

			// Node type icon
			const iconEl = row.createSpan();
			setIcon(iconEl, NODE_TYPE_ICONS[node.type] ?? "circle");

			// Node name
			row.createSpan({ text: node.name, cls: "ft-event-type" });

			// Type badge
			row.createSpan({
				text: node.type,
				cls: "ft-badge ft-badge-sm ft-badge-muted",
			});

			// Phase metadata
			if (node.metadata?.phase) {
				row.createSpan({
					text: `Phase ${node.metadata.phase}`,
					cls: "ft-catalog-meta ft-text-muted",
				});
			}
		}
	}

	private renderValidationFindings(validation: ValidationResult): void {
		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		const header = section.createDiv({ cls: "ft-detail-section-header" });
		header.createSpan({
			text: `Validation (${validation.findings.length} findings)`,
			cls: "ft-heading ft-heading-sm",
		});

		if (validation.findings.length === 0) {
			section.createDiv({
				text: "No issues found.",
				cls: "ft-text-muted ft-text-sm ft-p-3",
			});
			return;
		}

		for (const finding of validation.findings) {
			this.renderFinding(section, finding);
		}
	}

	private renderFinding(container: HTMLElement, finding: ValidationFinding): void {
		const row = container.createDiv({ cls: "ft-catalog-row" });

		// Severity icon
		const iconEl = row.createSpan();
		setIcon(iconEl, SEVERITY_ICONS[finding.severity] ?? "info");
		iconEl.addClass(`ft-health-severity-icon-${finding.severity === "error" ? "fail" : finding.severity === "warning" ? "warn" : "pass"}`);

		// Message
		row.createSpan({ text: finding.message, cls: "ft-text-sm" });

		// Rule badge
		row.createSpan({
			text: finding.ruleId,
			cls: "ft-badge ft-badge-sm ft-badge-muted ft-ml-auto",
		});
	}
}
