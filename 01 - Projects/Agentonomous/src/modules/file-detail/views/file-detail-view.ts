import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { PluginContext } from '../../../plugin.js';
import { VIEW_TYPE_FILE_DETAIL } from '../file-detail-module.js';
import { setFileDetail, clearFileDetail } from '../file-detail-store.js';

export { VIEW_TYPE_FILE_DETAIL };

type MountedView = { unmount: () => void };

function getFilePathFromState(state: unknown): string | null {
	if (typeof state !== 'object' || state === null) return null;
	const s = state as Record<string, unknown>;
	return typeof s['file'] === 'string' ? s['file'] : null;
}

export class FileDetailView extends ItemView {
	private mounted: MountedView | null = null;
	private mounting = false;
	private readonly ctx: PluginContext;

	constructor(leaf: WorkspaceLeaf, ctx: PluginContext) {
		super(leaf);
		this.ctx = ctx;
	}

	getViewType(): string { return VIEW_TYPE_FILE_DETAIL; }
	getDisplayText(): string { return 'File detail'; }
	getIcon(): string { return 'file-search'; }

	async onOpen(): Promise<void> {
		if (this.mounted !== null || this.mounting) return;
		this.mounting = true;
		try {
			await this.loadFileAnalysis();
			const { createModuleVueApp } = await import('../../../ui/create-module-vue-app.js');
			const { default: FileDetailViewComponent } = await import('./FileDetailView.vue');
			this.mounted = createModuleVueApp(FileDetailViewComponent, this.ctx, this.contentEl);
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
		clearFileDetail();
		return Promise.resolve();
	}

	private async loadFileAnalysis(): Promise<void> {
		const filePath = getFilePathFromState(this.getState());
		if (filePath === null) {
			setFileDetail(null, null);
			return;
		}

		const result = await this.ctx.vault.read(filePath);
		if (result.kind === 'err') {
			setFileDetail(null, `Could not read file: ${result.error}`);
			return;
		}

		const { getHandler } = await import('../handlers/handler-registry.js');
		const file = result.value;
		const ext = file.path.split('.').pop()?.toLowerCase() ?? '';
		const handler = getHandler(ext);
		if (handler === undefined) {
			setFileDetail(null, `No handler for extension: ${ext}`);
			return;
		}

		const fileName = file.path.split('/').pop() ?? file.path;
		const analysis = handler.analyze(file.content, fileName);
		setFileDetail(analysis, null);
	}
}
