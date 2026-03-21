/**
 * Edit form for export configs — extracted from ExportsTab to reduce file size.
 */

import { Setting, setIcon } from "obsidian";
import type { SavedExportConfig } from "../../domain/dataExchange/types";
import { basename } from "../../utils/pathUtils";
import { FilePickerModal } from "../shared/FilePickerModal";
import { FolderPickerModal, getVaultFolders } from "../shared/FolderPickerModal";
import { showNativeSaveDialog } from "../export/electronDialog";
import type { HubComponentDeps } from "./types";

export function renderExportEditForm(
	panel: HTMLElement,
	cfg: SavedExportConfig,
	deps: HubComponentDeps,
	onSaved: () => void,
	onCancelled: () => void,
): void {
	panel.createEl("h3", { text: "Edit export config", cls: "ft-heading ft-heading-sm ft-mb-3" });

	const edits: Partial<SavedExportConfig> = {
		name: cfg.name,
		sourcePath: cfg.sourcePath,
		outputPath: cfg.outputPath,
		isExternal: cfg.isExternal ?? false,
		conflictStrategy: cfg.conflictStrategy ?? "overwrite",
		noteType: cfg.noteType ?? "",
	};

	new Setting(panel)
		.setName("Name")
		.addText((t) => t.setValue(cfg.name).onChange((v) => { edits.name = v; }));

	let sourceTextComponent: { setValue: (v: string) => unknown } | undefined;
	const sourceSetting = new Setting(panel)
		.setName("Source path")
		.addText((t) => {
			t.setValue(cfg.sourcePath).onChange((v) => { edits.sourcePath = v; });
			sourceTextComponent = t;
		});
	sourceSetting.addExtraButton((btn) =>
		btn.setIcon("folder").setTooltip("Browse").onClick(() => {
			if (cfg.sourceType === "base") {
				new FilePickerModal(deps.app, ["base"], (p) => {
					edits.sourcePath = p;
					sourceTextComponent?.setValue(p);
				}).open();
			} else {
				const folders = getVaultFolders(deps.app);
				new FolderPickerModal(deps.app, folders, (p) => {
					edits.sourcePath = p;
					sourceTextComponent?.setValue(p);
				}).open();
			}
		}),
	);

	let outputTextComponent: { setValue: (v: string) => unknown } | undefined;
	const externalBadgeFrag = document.createDocumentFragment();
	const externalBadgeEl = externalBadgeFrag.appendChild(document.createElement("span"));
	const updateExternalBadge = (): void => {
		externalBadgeEl.textContent = "";
		if (edits.isExternal) {
			const badge = document.createElement("span");
			badge.className = "ft-badge ft-badge-muted ft-text-sm";
			badge.textContent = "External";
			externalBadgeEl.replaceChildren(badge);
		}
	};
	const outputSetting = new Setting(panel)
		.setName("Output path")
		.setDesc(externalBadgeFrag)
		.addText((t) => {
			t.setValue(cfg.outputPath).onChange((v) => { edits.outputPath = v; });
			outputTextComponent = t;
		});
	outputSetting.addExtraButton((btn) =>
		btn.setIcon("folder").setTooltip("Browse vault folder").onClick(() => {
			const folders = getVaultFolders(deps.app);
			new FolderPickerModal(deps.app, folders, (folder) => {
				const filename = basename(edits.outputPath || cfg.outputPath || "export.csv") || "export.csv";
				edits.outputPath = folder ? `${folder}/${filename}` : filename;
				edits.isExternal = false;
				outputTextComponent?.setValue(edits.outputPath);
				updateExternalBadge();
			}).open();
		}),
	);
	outputSetting.addExtraButton((btn) =>
		btn.setIcon("hard-drive").setTooltip("Save to filesystem").onClick(() => {
			const format = cfg.format ?? "csv";
			const ext = format === "tab" ? "txt" : "csv";
			const currentFilename = basename(edits.outputPath || cfg.outputPath || `export.${ext}`) || `export.${ext}`;
			void showNativeSaveDialog({ format, defaultFilename: currentFilename }).then((result) => {
				if (result === null) {
					void deps.eventBus.emit("notice.error", { message: "Could not open save dialog. Try entering the path manually." });
					return;
				}
				if (!result.canceled && result.filePath) {
					edits.outputPath = result.filePath;
					edits.isExternal = true;
					outputTextComponent?.setValue(result.filePath);
					updateExternalBadge();
				}
			});
		}),
	);
	updateExternalBadge();

	new Setting(panel)
		.setName("Conflict strategy")
		.addDropdown((dd) =>
			dd
				.addOptions({ overwrite: "Overwrite", skip: "Skip", append: "Append" })
				.setValue(cfg.conflictStrategy ?? "overwrite")
				.onChange((v) => { edits.conflictStrategy = v as SavedExportConfig["conflictStrategy"]; }),
		);

	new Setting(panel)
		.setName("Note type")
		.setDesc("Associate this export with a type for TypeDoc creation (optional)")
		.addText((t) =>
			t
				.setValue(cfg.noteType ?? "")
				// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setPlaceholder("e.g. event, asset, service")
				.onChange((v) => { edits.noteType = v || undefined; }),
		);

	const nav = panel.createDiv({ cls: "ft-detail-actions ft-mt-4" });

	const saveLink = nav.createEl("span", { cls: "ft-nav-link" });
	const saveIcon = saveLink.createSpan();
	setIcon(saveIcon, "check");
	saveLink.appendText(" Save");
	saveLink.addEventListener("click", () => {
		void deps.dataExchangeService
			.updateExportConfig(cfg.id, edits)
			.then(() => {
				deps.setState({ editingExportId: null });
				onSaved();
				void deps.eventBus.emit("notice.success", { message: "Export config updated" });
			});
	});

	const cancelLink = nav.createEl("span", { cls: "ft-nav-link" });
	const cancelIcon = cancelLink.createSpan();
	setIcon(cancelIcon, "x");
	cancelLink.appendText(" Cancel");
	cancelLink.addEventListener("click", () => {
		deps.setState({ editingExportId: null });
		onCancelled();
	});
}
