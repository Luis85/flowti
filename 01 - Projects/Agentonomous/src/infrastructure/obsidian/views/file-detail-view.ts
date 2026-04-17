import { ItemView, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import type { PluginContext } from '../../../plugin.js';
import type { MountedModuleApp } from '../../../ui/create-module-vue-app.js';
import type { ViewRegistration } from '../view-registry.js';
import { useFileDetailStore } from '../../../ui/stores/file-detail-store.js';
import { VIEW_TYPE_FILE_DETAIL } from '../../../modules/file-detail/file-detail-module.js';

export { VIEW_TYPE_FILE_DETAIL };

type FileDetailStore = ReturnType<typeof useFileDetailStore>;

function getFilePathFromState(state: unknown): string | null {
	if (typeof state !== 'object' || state === null) return null;
	const s = state as Record<string, unknown>;
	return typeof s['file'] === 'string' ? s['file'] : null;
}

export class FileDetailView extends ItemView {
	private mounted: MountedModuleApp | null = null;
	private mounting = false;
	private store: FileDetailStore | null = null;
	private currentFile: string | null = null;
	private readonly ctx: PluginContext;

	constructor(leaf: WorkspaceLeaf, ctx: PluginContext) {
		super(leaf);
		this.ctx = ctx;
	}

	getViewType(): string { return VIEW_TYPE_FILE_DETAIL; }
	getDisplayText(): string {
		if (this.currentFile === null) return 'File detail';
		return this.currentFile.split('/').pop() ?? 'File detail';
	}
	getIcon(): string { return 'file-search'; }

	getState(): Record<string, unknown> {
		const base = (super.getState() as Record<string, unknown> | null) ?? {};
		if (this.currentFile === null) return base;
		return { ...base, file: this.currentFile };
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const filePath = getFilePathFromState(state);
		this.currentFile = filePath;
		await super.setState(state, result);
		if (this.mounted !== null) {
			await this.loadCurrentFile();
		}
	}

	async onOpen(): Promise<void> {
		if (this.mounted !== null || this.mounting) return;
		this.mounting = true;
		try {
			const { createModuleVueApp } = await import('../../../ui/create-module-vue-app.js');
			const { default: FileDetailPanel } = await import('../../../ui/panels/FileDetailPanel.vue');
			this.mounted = createModuleVueApp(FileDetailPanel, this.ctx, this.contentEl);
			this.store = useFileDetailStore(this.mounted.pinia);
			await this.loadCurrentFile();
		} catch (err) {
			this.contentEl.empty();
			this.contentEl.createEl('div', {
				text: `File detail failed to load: ${err instanceof Error ? err.message : String(err)}`,
			});
		} finally {
			this.mounting = false;
		}
	}

	onClose(): Promise<void> {
		this.mounted?.unmount();
		this.mounted = null;
		this.store = null;
		return Promise.resolve();
	}

	private async loadCurrentFile(): Promise<void> {
		if (this.store === null) return;
		const filePath = this.currentFile;
		if (filePath === null) {
			this.store.clear();
			return;
		}

		const result = await this.ctx.vault.read(filePath);
		if (result.kind === 'err') {
			this.store.setError(`Could not read file: ${result.error}`);
			return;
		}

		const { getHandler } = await import('../../../modules/file-detail/handlers/handler-registry.js');
		const file = result.value;
		const ext = file.path.split('.').pop()?.toLowerCase() ?? '';
		const handler = getHandler(ext);
		if (handler === undefined) {
			this.store.setError(`No handler for extension: ${ext}`);
			return;
		}

		const fileName = file.path.split('/').pop() ?? file.path;
		this.store.setAnalysis(handler.analyze(file.content, fileName));
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
