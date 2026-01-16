import chokidar, { ChokidarOptions, FSWatcher } from "chokidar";
import FileWatcherPlugin from "src/main";
import { App, Notice } from "obsidian";
import { PendingJob, FolderMapping, ChangeType } from "../types";
import * as fs from "fs";
import * as path from "path";

export class MappingWatcher {
	private watcher: FSWatcher | null = null;
	private pending = new Map<string, PendingJob>();

	// separate debounce for directories (prevents tons of scans)
	private pendingDirs = new Map<string, number>();

	constructor(
		private app: App,
		private plugin: FileWatcherPlugin,
		public mapping: FolderMapping
	) {}

	start() {
		const m = this.mapping;

		if (!m.enabled) return;

		if (!m.sourceFolder || !fs.existsSync(m.sourceFolder)) {
			this.plugin.bumpError(m.id);
			new Notice(
				`Mapping "${m.description || m.id}": source folder missing`
			);
			return;
		}

		const ignored = this.buildIgnoredMatcher();

		const watchOptions: ChokidarOptions = {
			ignored,
			persistent: true,
			ignoreInitial: true,

			// IMPORTANT: watch subfolders when enabled
			depth: m.watchSubfolders ? undefined : 0,

			// OneDrive / network folders
			usePolling: m.usePolling ?? false,
			interval: m.pollingInterval ?? 300,

			// Avoid chokidar "atomic" rename confusion on some FS
			atomic: true,

			// Let our own stability check handle it if desired
			awaitWriteFinish: false,
		};

		this.watcher = chokidar.watch(m.sourceFolder, watchOptions);

		this.watcher
			.on("add", (p) => this.enqueue(p, "added"))
			.on("change", (p) => this.enqueue(p, "changed"))
			.on("unlink", (p) => this.enqueue(p, "deleted"))
			.on("addDir", (dir) => this.onDirAdded(dir))
			.on("error", (err) => {
				console.error("Watcher error:", err);
				this.plugin.bumpError(m.id);
				new Notice(
					`Watcher error (${m.description || m.id}): ${String(err)}`
				);
			});
	}

	async stop() {
		for (const j of this.pending.values()) {
			if (j.timer) window.clearTimeout(j.timer);
		}
		this.pending.clear();

		for (const t of this.pendingDirs.values()) window.clearTimeout(t);
		this.pendingDirs.clear();

		if (!this.watcher) return;
		const w = this.watcher;
		this.watcher = null;

		try {
			await w.close();
		} catch (e) {
			console.warn("Error closing watcher:", e);
		}
	}

	private enqueue(filePath: string, changeType: ChangeType) {
		// ignore delete (we don't delete inside vault)
		if (changeType === "deleted") {
			this.plugin.bumpSkipped(this.mapping.id);
			return;
		}

		if (!this.isAllowed(filePath)) return;

		const key = filePath;
		const existing = this.pending.get(key);
		if (existing?.timer) window.clearTimeout(existing.timer);

		const delay = Math.max(0, this.mapping.debounceDelay ?? 500);
		const job: PendingJob = { filePath, changeType };

		job.timer = window.setTimeout(() => {
			this.pending.delete(key);
			void this.process(job);
		}, delay);

		this.pending.set(key, job);
	}

	private async process(job: PendingJob) {
		try {
			// IMPORTANT: plugin.syncFile already updates stats + notices in your main.ts
			await this.plugin.syncFile(
				this.mapping,
				job.filePath,
				job.changeType
			);
		} catch (e) {
			console.error("Process error:", e);
			this.plugin.bumpError(this.mapping.id);
		}
	}

	private onDirAdded(dirPath: string) {
		const m = this.mapping;

		if (!m.watchSubfolders) return;
		if (!dirPath) return;

		// Debounce directory reconcile
		const key = dirPath;
		const existing = this.pendingDirs.get(key);
		if (existing) window.clearTimeout(existing);

		const delay = Math.max(250, m.debounceDelay ?? 500);

		const t = window.setTimeout(() => {
			this.pendingDirs.delete(key);
			void this.reconcileNewDir(dirPath);
		}, delay);

		this.pendingDirs.set(key, t);
	}

	private async reconcileNewDir(dirPath: string) {
		try {
			// Reconcile only the new folder subtree (FAST + correct)
			// Requires FileSyncService.reconcileFolder(..)
			if (!this.plugin.fileSync?.reconcileFolder) return;

			await this.plugin.fileSync.reconcileFolder(
				this.mapping,
				dirPath,
				(p) => {
					// Optional: feed your statusbar snapshot
					// this.plugin.setReconcileSnapshot?.({ ... })
				}
			);
		} catch (e) {
			console.error("reconcileNewDir error:", e);
			this.plugin.bumpError(this.mapping.id);
		}
	}

	private isAllowed(filePath: string): boolean {
		const ext = path.extname(filePath).toLowerCase();
		const list = this.mapping.fileExtensions ?? [];
		if (list.length > 0 && !list.includes(ext)) return false;
		return true;
	}

	private buildIgnoredMatcher():
		| ((p: string) => boolean)
		| RegExp
		| undefined {
		const ignoreDotfiles = /(^|[\/\\])\../;

		if (!this.plugin.settings.ignoreOneDriveTemp) return ignoreDotfiles;

		const officeLock = /(^|[\/\\])~\$/; // "~$file.docx"
		const tmpExt = /\.(tmp|temp|partial|crdownload)$/i;
		const onedriveTmpNames = /(^|[\/\\])(desktop\.ini|thumbs\.db)$/i;

		return (p: string) => {
			if (ignoreDotfiles.test(p)) return true;
			if (officeLock.test(p)) return true;
			if (tmpExt.test(p)) return true;
			if (onedriveTmpNames.test(p)) return true;
			return false;
		};
	}
}
