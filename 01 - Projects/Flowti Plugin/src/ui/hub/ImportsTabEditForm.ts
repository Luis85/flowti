/**
 * Edit form for import configs — extracted from ImportsTab to reduce file size.
 */

import { Setting, setIcon } from "obsidian";
import type { SavedImportConfig } from "../../domain/dataExchange/types";
import { FolderPickerModal, getVaultFolders } from "../shared/FolderPickerModal";
import type { HubComponentDeps } from "./types";

export function renderImportEditForm(
	panel: HTMLElement,
	cfg: SavedImportConfig,
	deps: HubComponentDeps,
	onSaved: () => void,
	onCancelled: () => void,
): void {
	panel.createEl("h3", { text: "Edit import config", cls: "ft-heading ft-heading-sm ft-mb-3" });

	const edits: Partial<SavedImportConfig> = {
		name: cfg.name,
		targetFolder: cfg.targetFolder,
		nameColumn: cfg.nameColumn,
		conflictStrategy: cfg.conflictStrategy,
		createBase: cfg.createBase ?? false,
		basePath: cfg.basePath ?? "",
		noteType: cfg.noteType ?? "",
	};

	new Setting(panel)
		.setName("Name")
		.addText((t) => t.setValue(cfg.name).onChange((v) => { edits.name = v; }));

	const targetSetting = new Setting(panel)
		.setName("Target folder")
		.addText((t) => t.setValue(cfg.targetFolder).onChange((v) => { edits.targetFolder = v; }));
	targetSetting.addExtraButton((btn) =>
		btn.setIcon("folder").setTooltip("Browse").onClick(() => {
			const folders = getVaultFolders(deps.app);
			new FolderPickerModal(deps.app, folders, (folder) => {
				edits.targetFolder = folder;
				onCancelled(); // triggers re-render with editing still active
			}).open();
		}),
	);

	new Setting(panel)
		.setName("Name column")
		.addText((t) => t.setValue(cfg.nameColumn).onChange((v) => { edits.nameColumn = v; }));

	new Setting(panel)
		.setName("Conflict strategy")
		.addDropdown((dd) =>
			dd
				.addOptions({ skip: "Skip", update: "Update frontmatter", overwrite: "Overwrite" })
				.setValue(cfg.conflictStrategy)
				.onChange((v) => { edits.conflictStrategy = v as SavedImportConfig["conflictStrategy"]; }),
		);

	new Setting(panel)
		.setName("Create .base view")
		.setDesc("Generate a table view for imported notes")
		.addToggle((toggle) =>
			toggle
				.setValue(edits.createBase ?? false)
				.onChange((v) => {
					edits.createBase = v || undefined;
					basePathSetting.settingEl.toggle(v);
				}),
		);

	const basePathSetting = new Setting(panel)
		.setName("Base file path")
		.setDesc("Where to save the .base view file")
		.addText((t) =>
			t
				.setValue(edits.basePath ?? "")
				.setPlaceholder("path/to/view.base")
				.onChange((v) => { edits.basePath = v || undefined; }),
		);
	basePathSetting.settingEl.toggle(edits.createBase ?? false);

	new Setting(panel)
		.setName("Note type")
		.setDesc("Type value added to every note's frontmatter (optional)")
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
			.updateImportConfig(cfg.id, edits)
			.then(() => {
				deps.setState({ editingImportId: null });
				onSaved();
				void deps.eventBus.emit("notice.success", { message: "Import config updated" });
			});
	});

	const cancelLink = nav.createEl("span", { cls: "ft-nav-link" });
	const cancelIcon = cancelLink.createSpan();
	setIcon(cancelIcon, "x");
	cancelLink.appendText(" Cancel");
	cancelLink.addEventListener("click", () => {
		deps.setState({ editingImportId: null });
		onCancelled();
	});
}
