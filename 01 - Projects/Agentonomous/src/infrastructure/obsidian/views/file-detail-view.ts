import { FileView, type TFile, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import type { PluginContext } from '../../../plugin.js';
import type { MountedModuleApp } from '../../../ui/create-module-vue-app.js';
import type { ViewRegistration } from '../view-registry.js';
import { useFileDetailStore } from '../../../ui/stores/file-detail-store.js';
import { VIEW_TYPE_FILE_DETAIL } from '../../../modules/file-detail/file-detail-module.js';
import { getHandler } from '../../../modules/file-detail/handlers/handler-registry.js';

export { VIEW_TYPE_FILE_DETAIL };

type FileDetailStore = ReturnType<typeof useFileDetailStore>;

function extensionOf(path: string): string {
	return path.split('.').pop()?.toLowerCase() ?? '';
}

function basenameOf(path: string): string {
	return path.split('/').pop() ?? path;
}

function getFilePathFromState(state: unknown): string | null {
	if (typeof state !== 'object' || state === null) return null;
	const s = state as Record<string, unknown>;
	return typeof s['file'] === 'string' ? s['file'] : null;
}

export class FileDetailView extends FileView {
	private mounted: MountedModuleApp | null = null;
	private mounting = false;
	private store: FileDetailStore | null = null;
	private readonly ctx: PluginContext;

	constructor(leaf: WorkspaceLeaf, ctx: PluginContext) {
		super(leaf);
		this.ctx = ctx;
	}

	getViewType(): string { return VIEW_TYPE_FILE_DETAIL; }
	getDisplayText(): string {
		const file = this.file;
		if (file === null || file === undefined) return 'File detail';
		return basenameOf(file.path);
	}
	getIcon(): string { return 'file-search'; }

	canAcceptExtension(extension: string): boolean {
		return getHandler(extension) !== undefined;
	}

	async onOpen(): Promise<void> {
		if (this.mounted !== null || this.mounting) return;
		this.mounting = true;
		try {
			const { createModuleVueApp } = await import('../../../ui/create-module-vue-app.js');
			const { default: FileDetailPanel } = await import('../../../ui/panels/FileDetailPanel.vue');
			this.mounted = createModuleVueApp(FileDetailPanel, this.ctx, this.contentEl);
			this.store = useFileDetailStore(this.mounted.pinia);
			const file = this.file;
			if (file !== null && file !== undefined) await this.analyzeFile(file);
		} catch (err) {
			this.contentEl.empty();
			this.contentEl.createEl('div', {
				text: `File detail failed to load: ${err instanceof Error ? err.message : String(err)}`,
			});
		} finally {
			this.mounting = false;
		}
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		// Default Obsidian behavior swaps the file in-place when the user
		// clicks a different file while one is already open in this leaf.
		// We want a fresh tab per distinct file instead — if the incoming
		// path differs from the one we're currently showing, redirect the
		// open to a new tab and leave this leaf on its current file.
		const newPath = getFilePathFromState(state);
		const currentPath = this.file?.path;
		if (currentPath !== undefined && newPath !== null && currentPath !== newPath) {
			const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_FILE_DETAIL)
				.find((l) => (l.view as FileDetailView).file?.path === newPath);
			if (existing !== undefined) {
				this.app.workspace.setActiveLeaf(existing, { focus: true });
				return;
			}
			const target = this.app.vault.getFileByPath(newPath);
			if (target !== null) {
				const newLeaf = this.app.workspace.getLeaf('tab');
				await newLeaf.openFile(target, { active: true });
				// Obsidian's openLinkText flow re-activates the original leaf
				// after our setState resolves, AFTER all queued microtasks
				// (the awaiter's continuation runs in a microtask too). A
				// setTimeout(0) runs in the next task, winning the race.
				setTimeout(() => {
					this.app.workspace.setActiveLeaf(newLeaf, { focus: true });
				}, 0);
				return;
			}
		}
		await super.setState(state, result);
	}

	async onLoadFile(file: TFile): Promise<void> {
		await super.onLoadFile(file);
		if (this.store !== null) await this.analyzeFile(file);
	}

	async onUnloadFile(file: TFile): Promise<void> {
		await super.onUnloadFile(file);
		this.store?.clear();
	}

	onClose(): Promise<void> {
		this.mounted?.unmount();
		this.mounted = null;
		this.store = null;
		return Promise.resolve();
	}

	private async analyzeFile(file: TFile): Promise<void> {
		if (this.store === null) return;
		const readResult = await this.ctx.vault.read(file.path);
		if (readResult.kind === 'err') {
			this.store.setError(`Could not read file: ${readResult.error}`);
			return;
		}
		const ext = extensionOf(file.path);
		const handler = getHandler(ext);
		if (handler === undefined) {
			this.store.setError(`No handler for extension: ${ext}`);
			return;
		}
		this.store.setAnalysis(handler.analyze(readResult.value.content, basenameOf(file.path)));
	}
}

export const FILE_DETAIL_VIEW_INTENT = {
	type: VIEW_TYPE_FILE_DETAIL,
	displayName: 'File detail',
	icon: 'file-search',
	defaultLocation: 'right',
} as const;

export const FILE_DETAIL_VIEW_REGISTRATION: ViewRegistration = {
	...FILE_DETAIL_VIEW_INTENT,
	viewFactory: (leaf, ctx) => new FileDetailView(leaf, ctx),
};
