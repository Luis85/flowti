/**
 * Pipeline edit form component — Settings-based inline form with folder picker.
 */

import { Notice, Setting, setIcon } from "obsidian";
import type { SavedMultiImportPipeline } from "../../../domain/dataExchange/types";
import { FolderPickerModal, getVaultFolders } from "../../FolderPickerModal";
import type { PipelineComponentDeps } from "./types";

export class PipelineEditForm {
	constructor(
		private container: HTMLElement,
		private deps: PipelineComponentDeps,
	) {}

	render(pipe: SavedMultiImportPipeline): void {
		const panel = this.container;
		panel.createEl("h3", { text: "Edit Pipeline", cls: "ft-heading ft-heading-sm ft-mb-3" });

		const edits: Partial<SavedMultiImportPipeline> = {
			name: pipe.name,
			targetFolder: pipe.targetFolder,
			mergeKey: pipe.mergeKey,
			noteType: pipe.noteType ?? "",
			namePrefix: pipe.namePrefix ?? "",
			nameSuffix: pipe.nameSuffix ?? "",
			createBase: pipe.createBase ?? false,
			basePath: pipe.basePath ?? "",
		};

		new Setting(panel)
			.setName("Name")
			.addText((t) => t.setValue(pipe.name).onChange((v) => { edits.name = v; }));

		let targetTextComponent: { setValue: (v: string) => unknown } | undefined;
		const targetSetting = new Setting(panel)
			.setName("Target folder")
			.addText((t) => {
				t.setValue(pipe.targetFolder).onChange((v) => { edits.targetFolder = v; });
				targetTextComponent = t;
			});
		targetSetting.addExtraButton((btn) =>
			btn.setIcon("folder").setTooltip("Browse").onClick(() => {
				const folders = getVaultFolders(this.deps.app);
				new FolderPickerModal(this.deps.app, folders, (folder) => {
					edits.targetFolder = folder;
					targetTextComponent?.setValue(folder);
				}).open();
			}),
		);

		const grid = panel.createDiv();
		grid.style.display = "grid";
		grid.style.gridTemplateColumns = "1fr 1fr";
		grid.style.columnGap = "1rem";
		grid.style.rowGap = "0";

		new Setting(grid)
			.setName("Merge key")
			.addText((t) => t
				.setValue(pipe.mergeKey)
				.setPlaceholder("e.g. item_id")
				.onChange((v) => { edits.mergeKey = v; }),
			);

		new Setting(grid)
			.setName("Note type")
			.addText((t) => t
				.setValue(pipe.noteType ?? "")
				.setPlaceholder("e.g. Event, Asset")
				.onChange((v) => { edits.noteType = v || undefined; }),
			);

		new Setting(grid)
			.setName("Filename prefix")
			.addText((t) => t
				.setValue(pipe.namePrefix ?? "")
				.setPlaceholder("optional")
				.onChange((v) => { edits.namePrefix = v || undefined; }),
			);

		new Setting(grid)
			.setName("Filename suffix")
			.addText((t) => t
				.setValue(pipe.nameSuffix ?? "")
				.setPlaceholder("optional")
				.onChange((v) => { edits.nameSuffix = v || undefined; }),
			);

		new Setting(grid)
			.setName("Create .base view")
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
			.addText((t) =>
				t
					.setValue(edits.basePath ?? "")
					.setPlaceholder("path/to/view.base")
					.onChange((v) => { edits.basePath = v || undefined; }),
			);
		basePathSetting.settingEl.toggle(edits.createBase ?? false);

		const nav = panel.createDiv({ cls: "ft-detail-actions ft-mt-4" });

		const saveLink = nav.createEl("span", { cls: "ft-nav-link" });
		const saveIcon = saveLink.createSpan();
		setIcon(saveIcon, "check");
		saveLink.appendText(" Save");
		saveLink.addEventListener("click", () => {
			void this.deps.dataExchangeService
				.updatePipeline(pipe.id, edits)
				.then(() => {
					this.deps.setState({ editingPipelineId: null });
					this.deps.scheduleRender();
					new Notice("Pipeline updated");
				});
		});

		const cancelLink = nav.createEl("span", { cls: "ft-nav-link" });
		const cancelIcon = cancelLink.createSpan();
		setIcon(cancelIcon, "x");
		cancelLink.appendText(" Cancel");
		cancelLink.addEventListener("click", () => {
			this.deps.setState({ editingPipelineId: null });
			this.deps.renderDetail();
		});
	}
}
