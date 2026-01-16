import FileWatcherPlugin from "src/main";
import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import { FolderMapping } from "../types";
import { FolderMappingModal } from "src/modals/FolderMappingModal";

export class FileWatcherSettingTab extends PluginSettingTab {
	plugin: FileWatcherPlugin;

	constructor(app: App, plugin: FileWatcherPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// ===== Global settings =====
		containerEl.createEl("h3", { text: "Global settings" });

		new Setting(containerEl)
			.setName("Ignore OneDrive/Office temp files")
			.setDesc(
				"Ignores ~$ lock files and temporary files. Recommended for OneDrive."
			)
			.addToggle((t) =>
				t
					.setValue(this.plugin.settings.ignoreOneDriveTemp)
					.onChange(async (v) => {
						this.plugin.settings.ignoreOneDriveTemp = v;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Sync on start (global default)")
			.setDesc(
				"When enabled, active mappings reconcile existing files on startup (if mapping allows it)."
			)
			.addToggle((t) =>
				t
					.setValue(this.plugin.settings.syncOnStart)
					.onChange(async (v) => {
						this.plugin.settings.syncOnStart = v;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h4", { text: "Stability checks (OneDrive)" });

		new Setting(containerEl)
			.setName("Verify file stability before copying")
			.setDesc(
				"Waits until file size/mtime is stable across checks (good for OneDrive)."
			)
			.addToggle((t) =>
				t
					.setValue(this.plugin.settings.verifyFileStability)
					.onChange(async (v) => {
						this.plugin.settings.verifyFileStability = v;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		if (this.plugin.settings.verifyFileStability) {
			new Setting(containerEl)
				.setName("Stability check interval (ms)")
				.setDesc("Lower = faster, higher = safer on syncing folders.")
				.addText((t) =>
					t
						.setValue(
							String(this.plugin.settings.stabilityCheckInterval)
						)
						.onChange(async (v) => {
							const n = Number(v);
							if (!Number.isFinite(n) || n < 50) return;
							this.plugin.settings.stabilityCheckInterval = n;
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName("Stability checks")
				.setDesc("How many consecutive stable readings are required.")
				.addText((t) =>
					t
						.setValue(String(this.plugin.settings.stabilityChecks))
						.onChange(async (v) => {
							const n = Number(v);
							if (!Number.isFinite(n) || n < 1) return;
							this.plugin.settings.stabilityChecks = n;
							await this.plugin.saveSettings();
						})
				);
		}

		// ===== Reconcile options =====
		containerEl.createEl("hr");
		containerEl.createEl("h3", { text: "Reconcile options" });

		const r = this.plugin.settings.reconcile;

		new Setting(containerEl)
			.setName("Parallelism")
			.setDesc(
				"How many files are processed concurrently during reconcile. Higher = faster, too high may stress disk."
			)
			.addText((t) =>
				t.setValue(String(r.parallelism ?? 8)).onChange(async (v) => {
					const n = Number(v);
					if (!Number.isFinite(n) || n < 1) return;
					r.parallelism = Math.min(64, Math.max(1, Math.floor(n)));
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Progress update throttle (ms)")
			.setDesc(
				"UI updates are throttled to avoid slowing reconcile. Higher = faster reconcile, less smooth UI."
			)
			.addText((t) =>
				t
					.setValue(String(r.progressThrottleMs ?? 250))
					.onChange(async (v) => {
						const n = Number(v);
						if (!Number.isFinite(n) || n < 0) return;
						r.progressThrottleMs = Math.min(
							5000,
							Math.max(0, Math.floor(n))
						);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Fast skip unchanged")
			.setDesc(
				"Skip copying if target exists and is up-to-date (mtime/size). Huge speedup for big folders."
			)
			.addToggle((t) =>
				t.setValue(!!r.fastSkipUnchanged).onChange(async (v) => {
					r.fastSkipUnchanged = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Disable stability checks during reconcile")
			.setDesc(
				"Reconcile is usually a batch job; stability checks can make it much slower on 10k files."
			)
			.addToggle((t) =>
				t
					.setValue(!!r.disableStabilityCheckDuringReconcile)
					.onChange(async (v) => {
						r.disableStabilityCheckDuringReconcile = v;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Notify when a mapping finishes")
			.setDesc("Shows one notice per mapping at the end of reconcile.")
			.addToggle((t) =>
				t.setValue(!!r.notifyOnMappingDone).onChange(async (v) => {
					r.notifyOnMappingDone = v;
					await this.plugin.saveSettings();
				})
			);

		// ===== Mappings =====
		containerEl.createEl("hr");
		containerEl.createEl("h3", { text: "Folder mappings" });

		new Setting(containerEl)
			.setName("Manage mappings")
			.setDesc(
				"Each mapping watches an external folder and syncs to a vault folder."
			)
			.addButton((b) =>
				b
					.setButtonText("Add mapping")
					.setCta()
					.onClick(async () => {
						const m = this.createDefaultMapping();
						this.plugin.settings.folderMappings.push(m);
						await this.plugin.saveSettings();

						new FolderMappingModal(this.app, this.plugin, m, {
							onSave: async () => {
								await this.plugin.saveSettings();
								this.display();
							},
							onDelete: async () => {
								this.plugin.settings.folderMappings =
									this.plugin.settings.folderMappings.filter(
										(x) => x.id !== m.id
									);
								await this.plugin.saveSettings();
								this.display();
							},
						}).open();
					})
			)
			.addButton((b) =>
				b.setButtonText("Reconcile enabled now").onClick(async () => {
					if (!this.plugin.reconcile) {
						new Notice("Reconcile service not available");
						return;
					}
					const enabled = this.plugin.settings.folderMappings.filter(
						(m) => m.enabled && m.reconcileOnStart !== false
					);
					if (enabled.length === 0) {
						new Notice("No enabled mappings to reconcile.");
						return;
					}
					new Notice(`Reconciling ${enabled.length} mapping(s)…`);
					await this.plugin.reconcile.reconcileMappings(enabled, {
						onProgress: (p, meta) => {
							this.plugin.setReconcileSnapshot?.(p);
							this.plugin.statusbar?.setReconcileProgress?.(
								p,
								meta
							);
						},
						onMappingDone: () => {
							this.plugin.statusbar?.onStatsChanged();
						},
					});
					new Notice("Reconcile finished.");
				})
			);

		// Optional: lightweight search
		const searchWrap = containerEl.createDiv({ cls: "filewatcher-search" });
		let filter = "";

		new Setting(searchWrap)
			.setName("Search")
			.setDesc("Filter mappings by description/source/target.")
			.addText((t) =>
				t.setPlaceholder("Type to filter…").onChange((v) => {
					filter = v.trim().toLowerCase();
					this.renderMappingsList(containerEl, filter);
				})
			);

		this.renderMappingsList(containerEl, filter);
	}

	private renderMappingsList(containerEl: HTMLElement, filter: string) {
		containerEl
			.querySelectorAll(".filewatcher-mapping-list")
			.forEach((el) => el.remove());

		const listEl = containerEl.createDiv({
			cls: "filewatcher-mapping-list",
		});
		const mappings = this.plugin.settings.folderMappings.slice();

		const filtered = filter
			? mappings.filter((m) => {
					const hay = [
						m.description ?? "",
						m.sourceFolder ?? "",
						m.targetFolder ?? "",
						m.id ?? "",
					]
						.join(" ")
						.toLowerCase();
					return hay.includes(filter);
			  })
			: mappings;

		if (filtered.length === 0) {
			listEl.createEl("div", { text: "No mappings yet." });
			return;
		}

		filtered.forEach((m) => {
			const row = listEl.createDiv({ cls: "filewatcher-mapping-row" });

			new Setting(row)
				.setName(m.description || "Untitled mapping")
				.setDesc(
					`${shortPath(m.sourceFolder)} → ${normalizeVaultPath(
						m.targetFolder
					)}`
				)
				.addToggle((t) =>
					t.setValue(m.enabled).onChange(async (v) => {
						m.enabled = v;
						await this.plugin.saveSettings();
					})
				)
				.addExtraButton((b) =>
					b
						.setIcon(
							m.reconcileOnStart === false
								? "minus-circle"
								: "check-circle"
						)
						.setTooltip("Reconcile on start (per mapping)")
						.onClick(async () => {
							m.reconcileOnStart = !(m.reconcileOnStart ?? true);
							await this.plugin.saveSettings();
							this.display();
						})
				)
				.addButton((b) =>
					b.setButtonText("Edit").onClick(() => {
						new FolderMappingModal(this.app, this.plugin, m, {
							onSave: async () => {
								await this.plugin.saveSettings();
								this.display();
							},
							onDelete: async () => {
								this.plugin.settings.folderMappings =
									this.plugin.settings.folderMappings.filter(
										(x) => x.id !== m.id
									);
								await this.plugin.saveSettings();
								this.display();
							},
						}).open();
					})
				)
				.addButton((b) =>
					b.setButtonText("Reconcile").onClick(async () => {
						if (!this.plugin.reconcile) {
							new Notice("Reconcile service not available");
							return;
						}
						if (!m.enabled) {
							new Notice("Enable the mapping first.");
							return;
						}
						new Notice(`Reconciling: ${m.description || m.id}…`);
						await this.plugin.reconcile.reconcileMappings([m], {
							onProgress: (p, meta) => {
								this.plugin.setReconcileSnapshot?.(p);
								this.plugin.statusbar?.setReconcileProgress?.(
									p,
									meta
								);
							},
							onMappingDone: () => {
								this.plugin.statusbar?.onStatsChanged();
							},
						});
						new Notice("Reconcile finished.");
					})
				)
				.addButton((b) =>
					b.setButtonText("Duplicate").onClick(async () => {
						const copy: FolderMapping = {
							...m,
							id: makeId(),
							description: `${m.description || "Mapping"} (copy)`,
							enabled: false,
						};
						this.plugin.settings.folderMappings.push(copy);
						await this.plugin.saveSettings();
						new Notice("Mapping duplicated");
						this.display();
					})
				)
				.addButton((b) =>
					b
						.setButtonText("Remove")
						.setWarning()
						.onClick(async () => {
							this.plugin.settings.folderMappings =
								this.plugin.settings.folderMappings.filter(
									(x) => x.id !== m.id
								);
							await this.plugin.saveSettings();
							this.display();
						})
				);
		});
	}

	private createDefaultMapping(): FolderMapping {
		return {
			id: makeId(),
			enabled: false,
			sourceFolder: "",
			targetFolder: "imported",
			watchSubfolders: true,
			fileExtensions: [".md", ".pdf"],
			conflictResolution: "keepNewer",
			debounceDelay: 800,
			description: "New mapping",
			usePolling: false,
			pollingInterval: 300,
			reconcileOnStart: true,
		};
	}
}

function makeId(): string {
	return crypto.randomUUID?.() ?? String(Date.now());
}

function normalizeVaultPath(p: string): string {
	return (p || "").replace(/\\/g, "/").replace(/\/+/g, "/");
}

function shortPath(p: string): string {
	const s = p || "";
	if (!s) return "(not set)";
	return s.length > 60 ? `…${s.slice(-60)}` : s;
}
