import FileWatcherPlugin from "src/main";
import { MappingWatcher } from "./MappingWatcher";
import { Debug } from "../services/DebugService";

export class WatcherManager {
	private watchers = new Map<string, MappingWatcher>();
	private starting = false;

	constructor(private plugin: FileWatcherPlugin) {}

	async startAll() {
		// Prevent concurrent startAll calls
		if (this.starting) {
			Debug.warn("Manager", "startAll() already in progress, skipping");
			return;
		}
		this.starting = true;

		try {
			Debug.info("Manager", `startAll() called`, {
				totalMappings: this.plugin.settings.folderMappings.length,
				mappings: this.plugin.settings.folderMappings.map((m) => ({
					id: m.id,
					description: m.description,
					enabled: m.enabled,
					sourceFolder: m.sourceFolder,
					targetFolder: m.targetFolder,
				})),
			});

			// Wait for all existing watchers to fully stop
			await this.stopAll();

			for (const m of this.plugin.settings.folderMappings) {
				if (!m.enabled) {
					Debug.debug("Manager", `Skipping disabled mapping: ${m.description || m.id}`);
					continue;
				}

				Debug.info("Manager", `Creating watcher for mapping`, {
					id: m.id,
					description: m.description,
					sourceFolder: m.sourceFolder,
					targetFolder: m.targetFolder,
				});

				const mw = new MappingWatcher(this.plugin.app, this.plugin, m);
				this.watchers.set(m.id, mw);
				mw.start();
			}

			Debug.info("Manager", `startAll() completed`, {
				activeWatchers: this.watchers.size,
			});

			this.plugin.statusbar?.onStatsChanged();
		} finally {
			this.starting = false;
		}
	}

	async stopAll() {
		if (this.watchers.size === 0) {
			Debug.debug("Manager", "stopAll() called but no watchers to stop");
			return;
		}

		Debug.info("Manager", `stopAll() stopping ${this.watchers.size} watchers`);
		const all = Array.from(this.watchers.values());
		this.watchers.clear();

		// Wait for all watchers to fully close
		await Promise.all(all.map((w) => w.stop()));
		Debug.info("Manager", `stopAll() completed`);
	}

	activeCount() {
		return this.watchers.size;
	}

	updateMappings() {
		Debug.info("Manager", `updateMappings() called`);
		void this.startAll();
	}
}
