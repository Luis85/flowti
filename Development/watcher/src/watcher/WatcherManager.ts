import FileWatcherPlugin from "src/main";
import { MappingWatcher } from "./MappingWatcher";

export class WatcherManager {
	private watchers = new Map<string, MappingWatcher>();

	constructor(private plugin: FileWatcherPlugin) {}

	startAll() {
		this.stopAllSync();
		for (const m of this.plugin.settings.folderMappings) {
			if (!m.enabled) continue;
			const mw = new MappingWatcher(this.plugin.app, this.plugin, m);
			this.watchers.set(m.id, mw);
			mw.start();
		}
		this.plugin.statusbar?.onStatsChanged();
	}

	async stopAll() {
		const all = Array.from(this.watchers.values());
		this.watchers.clear();
		await Promise.all(all.map((w) => w.stop()));
	}

	// sync stop helper
	private stopAllSync() {
		for (const w of this.watchers.values()) {
			void w.stop();
		}
		this.watchers.clear();
	}

	activeCount() {
		return this.watchers.size;
	}

	updateMappings() {
		this.startAll();
	}
}
