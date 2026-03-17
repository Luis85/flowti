/**
 * Landing page for the Canvas Action View.
 * Shows canvas file info and action buttons.
 */

import { setIcon } from "obsidian";
import type { CanvasComponentDeps } from "./types";

export class CanvasLanding {
	constructor(
		private container: HTMLElement,
		private deps: CanvasComponentDeps,
	) {}

	render(): void {
		const el = this.container;
		el.empty();

		const state = this.deps.getState();

		// ── Header ──
		const header = el.createDiv({ cls: "ft-csv-header" });
		const iconEl = header.createDiv({ cls: "ft-csv-header-icon" });
		setIcon(iconEl, "layout-dashboard");
		const titleCol = header.createDiv();
		const filename = state.canvasPath.split("/").pop() ?? "Canvas File";
		titleCol.createEl("h2", { text: filename, cls: "ft-heading ft-csv-title" });
		titleCol.createDiv({ text: state.canvasPath, cls: "ft-text-sm ft-text-muted" });

		// ── Info dashboard ──
		const dashboard = el.createDiv({ cls: "ft-flex ft-gap-4 ft-mt-3 ft-p-3" });

		const configs = this.deps.canvasService.getConfigs().filter(
			(c) => c.canvasPath === state.canvasPath,
		);

		this.renderStat(dashboard, "settings", `${configs.length}`, "saved configs");

		const config = configs.length > 0 ? configs[0] : null;
		if (config?.lastUsed) {
			this.renderStat(dashboard, "clock", new Date(config.lastUsed).toLocaleDateString(), "last imported");
		}

		// ── Actions ──
		const actions = el.createDiv({ cls: "ft-detail-actions ft-mt-4 ft-p-3" });

		const importBtn = actions.createEl("button", { cls: "ft-btn mod-cta" });
		const importIcon = importBtn.createSpan({ cls: "flowti-csv-btn-icon" });
		setIcon(importIcon, "file-input");
		importBtn.appendText(" Import as Notes");
		importBtn.addEventListener("click", () => {
			this.deps.setState({ currentPage: "config" });
			this.deps.renderContent();
		});

		// ── Saved configs section ──
		if (configs.length > 0) {
			const section = el.createDiv({ cls: "ft-mt-4" });
			section.createDiv({ text: "Saved Configurations", cls: "ft-detail-section-header" });

			for (const cfg of configs) {
				const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1 ft-canvas-config-row" });

				const info = row.createDiv({ cls: "ft-flex-1" });
				info.createDiv({ text: cfg.name, cls: "ft-text-sm ft-font-medium" });
				info.createDiv({
					text: `${cfg.targetFolder} | ${cfg.conflictStrategy} | ${cfg.hierarchyMode}`,
					cls: "ft-text-sm ft-text-muted",
				});

				const runBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
				const runIcon = runBtn.createSpan();
				setIcon(runIcon, "play");
				runBtn.appendText(" Run");
				runBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					this.deps.setState({ loadedConfigId: cfg.id });
					void this.deps.runImport();
				});

				row.addEventListener("click", () => {
					this.loadConfig(cfg.id);
					this.deps.setState({ currentPage: "config" });
					this.deps.renderContent();
				});
			}
		}
	}

	private loadConfig(id: string): void {
		const cfg = this.deps.canvasService.getConfig(id);
		if (!cfg) return;
		this.deps.setState({
			loadedConfigId: cfg.id,
			configName: cfg.name,
			targetFolder: cfg.targetFolder,
			conflictStrategy: cfg.conflictStrategy,
			hierarchyMode: cfg.hierarchyMode,
			subfolderName: cfg.subfolderName || "",
			createCanvas: cfg.createCanvas !== false,
			createBase: cfg.createBase !== false,
			colorMap: { ...cfg.colorMap },
			shapeMap: { ...cfg.shapeMap },
			excludedTypes: [...(cfg.excludedTypes ?? [])],
		});
	}

	private renderStat(container: HTMLElement, icon: string, value: string, label: string): void {
		const stat = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const iconEl = stat.createSpan();
		setIcon(iconEl, icon);
		iconEl.addClass("ft-icon-muted");
		const textCol = stat.createDiv();
		textCol.createDiv({ text: value, cls: "ft-text-sm ft-font-medium" });
		textCol.createDiv({ text: label, cls: "ft-text-sm ft-text-muted" });
	}
}
