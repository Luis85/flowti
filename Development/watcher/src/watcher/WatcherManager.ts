import FileWatcherPlugin from "src/main";
import { MappingWatcher } from "./MappingWatcher";
import { Debug } from "../services/DebugService";

export class WatcherManager {
	private watchers = new Map<string, MappingWatcher>();

	constructor(private plugin: FileWatcherPlugin) {}

	startAll() {
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

		this.stopAllSync();

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
	}

	async stopAll() {
		Debug.info("Manager", `stopAll() called, stopping ${this.watchers.size} watchers`);
		const all = Array.from(this.watchers.values());
		this.watchers.clear();
		await Promise.all(all.map((w) => w.stop()));
		Debug.info("Manager", `stopAll() completed`);
	}

	// sync stop helper
	private stopAllSync() {
		Debug.debug("Manager", `stopAllSync() stopping ${this.watchers.size} watchers`);
		for (const w of this.watchers.values()) {
			void w.stop();
		}
		this.watchers.clear();
	}

	activeCount() {
		return this.watchers.size;
	}

	updateMappings() {
		Debug.info("Manager", `updateMappings() called`);
		this.startAll();
	}
}
