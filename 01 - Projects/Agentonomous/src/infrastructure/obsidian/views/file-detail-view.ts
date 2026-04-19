import { FileView, type TFile, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import type { PluginContext } from '../../../plugin.js';
import type { MountedModuleApp } from '../../../ui/create-module-vue-app.js';
import type { ViewRegistration } from '../view-registry.js';
import { useFileDetailStore } from '../../../ui/stores/file-detail-store.js';
import { VIEW_TYPE_FILE_DETAIL } from '../../../modules/file-detail/file-detail-module.js';
import { getHandler } from '../../../modules/file-detail/handlers/handler-registry.js';
import { decideTabAction } from './file-detail-tab-policy.js';

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
	private mountPromise: Promise<void> | null = null;
	private store: FileDetailStore | null = null;
	private readonly ctx: PluginContext;

	constructor(leaf: WorkspaceLeaf, ctx: PluginContext) {
		super(leaf);
		this.ctx = ctx;
	}

	getViewType(): string { return VIEW_TYPE_FILE_DETAIL; }
	getDisplayText(): string {
		// Obsidian's FileView types `file` as TFile | null, but at runtime
		// it is undefined between construction and the first onLoadFile.
		const file = this.file as TFile | null | undefined;
		if (file === null || file === undefined) return 'File detail';
		return basenameOf(file.path);
	}
	getIcon(): string { return 'file-search'; }

	canAcceptExtension(extension: string): boolean {
		return getHandler(extension) !== undefined;
	}

	async onOpen(): Promise<void> {
		if (this.mountPromise !== null) { await this.mountPromise; return; }
		this.mountPromise = this.performMount();
		await this.mountPromise;
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const siblings = this.siblingLeaves();
		const decision = decideTabAction({
			currentPath: this.file?.path,
			newPath: getFilePathFromState(state),
			otherLeafPaths: siblings.map((leaf) => (leaf.view as FileDetailView | undefined)?.file?.path ?? null),
		});
		switch (decision.kind) {
			case 'accept':
				await super.setState(state, result);
				return;
			case 'activate': {
				const target = siblings[decision.leafIndex];
				if (target !== undefined) this.deferredActivate(target);
				return;
			}
			case 'newTab':
				await this.openInNewTab(decision.path);
				return;
		}
	}

	async onLoadFile(file: TFile): Promise<void> {
		await super.onLoadFile(file);
		// Obsidian may drive onLoadFile while performMount is still
		// importing Vue/panel modules — wait for the mount to finish
		// before we reach into the store.
		if (this.mountPromise !== null) {
			try { await this.mountPromise; } catch { return; /* error UI already rendered */ }
		}
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
		this.mountPromise = null;
		return Promise.resolve();
	}

	private async performMount(): Promise<void> {
		this.contentEl.empty();
		try {
			const { createModuleVueApp } = await import('../../../ui/create-module-vue-app.js');
			const { default: FileDetailPanel } = await import('../../../ui/panels/FileDetailPanel.vue');
			this.mounted = createModuleVueApp(FileDetailPanel, this.ctx, this.contentEl);
			this.store = useFileDetailStore(this.mounted.pinia);
			const file = this.file as TFile | null | undefined;
			if (file !== null && file !== undefined) await this.analyzeFile(file);
		} catch (err) {
			this.contentEl.empty();
			this.contentEl.createEl('div', {
				text: `File detail failed to load: ${err instanceof Error ? err.message : String(err)}`,
			});
			throw err;
		}
	}

	private siblingLeaves(): readonly WorkspaceLeaf[] {
		return this.app.workspace
			.getLeavesOfType(VIEW_TYPE_FILE_DETAIL)
			.filter((leaf) => leaf !== this.leaf);
	}

	private async openInNewTab(path: string): Promise<void> {
		const target = this.app.vault.getFileByPath(path);
		if (target === null) return;
		const newLeaf = this.app.workspace.getLeaf('tab');
		await newLeaf.openFile(target, { active: true });
		this.deferredActivate(newLeaf);
	}

	/**
	 * Obsidian's openLinkText flow re-activates the origin leaf after
	 * our setState resolves (the caller's await-continuation is itself
	 * a microtask, which runs after any microtask we queue here).  Defer
	 * the setActiveLeaf call into the next task so we win the race.
	 */
	private deferredActivate(leaf: WorkspaceLeaf): void {
		setTimeout(() => {
			this.app.workspace.setActiveLeaf(leaf, { focus: true });
		}, 0);
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
