/**
 * Associated Base Views section for the CsvLanding page.
 * Finds and displays .base files whose inFolder filter matches import config target folders.
 */

import { setIcon } from "obsidian";
import type { CsvComponentDeps } from "./types";

export class CsvAssociatedBases {
	private basesContainerEl: HTMLElement | null = null;

	constructor(private deps: CsvComponentDeps) {}

	render(container: HTMLElement): void {
		// Persistent wrapper so we can refresh after import
		if (!this.basesContainerEl || !this.basesContainerEl.isConnected) {
			this.basesContainerEl = container.createDiv();
		}
		this.basesContainerEl.empty();

		const bases = this.findAssociatedBases();
		if (bases.length === 0) return;

		this.renderBasesList(this.basesContainerEl, bases);
	}

	/** Refreshes the associated bases section without re-rendering the full landing page. */
	refresh(): void {
		if (this.basesContainerEl?.isConnected) {
			this.basesContainerEl.empty();
			const bases = this.findAssociatedBases();
			if (bases.length === 0) return;

			this.renderBasesList(this.basesContainerEl, bases);
		}
	}

	private renderBasesList(container: HTMLElement, bases: { path: string; name: string }[]): void {
		const section = container.createDiv({ cls: "ft-mb-3" });
		section.createEl("h3", { text: "Associated views", cls: "ft-heading ft-heading-sm ft-mb-2" });

		const card = section.createDiv({ cls: "ft-card ft-mb-2" });
		const cardHeader = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-1" });
		const iconEl = cardHeader.createSpan();
		setIcon(iconEl, "table");
		iconEl.addClass("ft-icon-muted");
		cardHeader.createSpan({ text: "Base views", cls: "ft-text-sm ft-font-semibold" });

		for (const base of bases) {
			const row = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-1" });
			const link = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			const linkIcon = link.createSpan();
			setIcon(linkIcon, "file-code");
			link.appendText(` ${base.name}`);
			link.addEventListener("click", () => {
				void this.deps.app.workspace.openLinkText(base.path, "", false);
			});
			row.createSpan({ text: base.path, cls: "ft-text-sm ft-text-muted" });
		}
	}

	/** Finds .base files whose inFolder filter matches any import config target folder. */
	private findAssociatedBases(): { path: string; name: string }[] {
		const file = this.deps.getFile();
		if (!file) return [];
		const configs = this.deps.dataExchangeService.getImportConfigsForFile(file.path);
		const targetFolders = new Set(configs.map((c) => c.targetFolder).filter(Boolean));

		// Collect explicit basePath entries from configs
		const explicitPaths = new Set<string>();
		for (const cfg of configs) {
			if (cfg.basePath) {
				let bp = cfg.basePath.trim();
				if (bp && !bp.endsWith(".base")) bp += ".base";
				if (bp) explicitPaths.add(bp);
			}
		}

		if (targetFolders.size === 0 && explicitPaths.size === 0) return [];

		const results: { path: string; name: string }[] = [];
		const seen = new Set<string>();
		const allFiles = this.deps.app.vault.getFiles();
		for (const f of allFiles) {
			if (!f.path.endsWith(".base")) continue;
			if (seen.has(f.path)) continue;

			// Direct match from config basePath
			if (explicitPaths.has(f.path)) {
				results.push({ path: f.path, name: f.basename });
				seen.add(f.path);
				continue;
			}

			// Check if the base file lives in or next to a target folder
			for (const folder of targetFolders) {
				const baseDir = f.path.substring(0, f.path.lastIndexOf("/"));
				if (baseDir === folder || f.path.startsWith(folder + "/")) {
					results.push({ path: f.path, name: f.basename });
					seen.add(f.path);
					break;
				}
			}
		}
		return results;
	}
}
