/**
 * Source configuration panel sub-component.
 *
 * Renders source rows (alias, locale, row count)
 * and source preview delegation.
 */

import { setIcon } from "obsidian";
import type { QueriesSubDeps, LocaleId } from "./types";
import { LOCALE_OPTIONS } from "./types";
import { SourcePreviewPanel } from "../SourcePreviewPanel";

export class SourcePanel {
	constructor(
		private container: HTMLElement,
		private deps: QueriesSubDeps,
	) {}

	render(): void {
		const sources = this.deps.sources();
		const section = this.container.createDiv({ cls: "ft-card ft-mt-3" });

		const headerRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		headerRow.createSpan({ text: "Sources", cls: "ft-text-sm ft-font-semibold" });

		// Preview toggle — only show when sources are loaded
		const loadedCount = sources.filter((s) => s.data).length;
		if (loadedCount > 0) {
			const previewLink = headerRow.createEl("span", { cls: "ft-nav-link ft-text-xs ft-ml-auto" });
			const previewIcon = previewLink.createSpan();
			setIcon(previewIcon, this.deps.showPreview() ? "eye-off" : "eye");
			previewLink.appendText(this.deps.showPreview() ? " Hide Preview" : " Preview Data");
			if (this.deps.showPreview()) previewLink.addClass("ft-text-accent");
			previewLink.addEventListener("click", () => {
				this.deps.togglePreview();
				this.deps.renderDetail();
			});
		}

		// Source table with overflow containment
		const tableWrap = section.createDiv({ cls: "ft-overflow-auto" });

		for (let i = 0; i < sources.length; i++) {
			const src = sources[i];
			const row = tableWrap.createDiv({ cls: `ft-flex ft-items-center ft-gap-2 ft-source-row${i < sources.length - 1 ? " ft-border-bottom" : ""}` });

			const aliasInput = row.createEl("input", { type: "text", cls: "ft-source-alias-input" });
			aliasInput.value = src.alias;
			aliasInput.addEventListener("change", () => {
				src.alias = aliasInput.value.trim() || src.alias;
			});

			row.createSpan({ text: src.csvPath.split("/").pop() ?? src.csvPath, cls: "ft-text-xs ft-text-muted ft-source-path" });

			row.createSpan({ text: "Locale:", cls: "ft-text-xs ft-text-muted ft-flex-shrink-0" });
			const localeSelect = row.createEl("select", { cls: "ft-select-input ft-flex-shrink-0" });
			for (const opt of LOCALE_OPTIONS) {
				const option = localeSelect.createEl("option");
				option.value = opt.id;
				option.textContent = opt.label;
				if (src.locale === opt.id) option.selected = true;
			}
			localeSelect.addEventListener("change", () => {
				src.locale = localeSelect.value as LocaleId;
			});

			// Show auto-detected locale when source locale is "auto"
			if (src.detectedLocale && (!src.locale || src.locale === "auto")) {
				row.createSpan({ text: `Detected: ${src.detectedLocale}`, cls: "ft-text-xs ft-text-muted ft-source-detected-locale" });
			}

			if (src.loading) {
				row.createSpan({ text: "Loading...", cls: "ft-text-muted ft-text-xs ft-flex-shrink-0" });
			} else if (src.error) {
				row.createSpan({ text: src.error, cls: "ft-text-xs ft-source-error" });
			} else if (src.data) {
				row.createSpan({ text: `${src.data.rows.length} rows`, cls: "ft-badge ft-badge-muted ft-text-xs ft-flex-shrink-0" });
			}
		}

		// Source previews — only shown when preview toggle is active
		const loadedSources = sources.filter((s) => s.data);
		if (this.deps.showPreview()) {
			for (const src of loadedSources) {
				const previewHost = section.createDiv({ cls: "ft-mt-2 ft-source-preview-host" });
				// Child container for the preview panel (.empty() won't affect the separator)
				const previewContainer = previewHost.createDiv();
				const fileName = src.csvPath.split("/").pop() ?? src.csvPath;
				const displayName = src.alias !== fileName ? `${src.alias} — ${fileName}` : src.alias;
				new SourcePreviewPanel({
					container: previewContainer,
					data: src.data!,
					typeHints: this.deps.columnTypeHints(),
					sourceName: displayName,
				}).render();
			}
		}

	}
}
