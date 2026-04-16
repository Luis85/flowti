import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { PluginContext } from '../../../plugin.js';
import { VIEW_TYPE_FILE_DETAIL } from '../file-detail-module.js';

export { VIEW_TYPE_FILE_DETAIL };

type MountedView = { unmount: () => void };

type AnalysisResult = {
	analysis: { fileName: string; extension: string; sizeBytes: number; summary: Record<string, string | number> } | null;
	error: string | null;
};

function getFilePathFromState(state: unknown): string | null {
	if (typeof state !== 'object' || state === null) return null;
	const s = state as Record<string, unknown>;
	return typeof s['file'] === 'string' ? s['file'] : null;
}

function getContentFromState(state: unknown): string {
	if (typeof state !== 'object' || state === null) return '';
	const s = state as Record<string, unknown>;
	return typeof s['content'] === 'string' ? s['content'] : '';
}

/**
 * Obsidian ItemView for the File Detail panel.
 * Reads the file path from ViewState, runs the appropriate handler,
 * and mounts a Vue component to display the analysis result.
 */
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
			const state = this.getState();
			const result = await this.buildAnalysis(state);
			const { createModuleVueApp } = await import('../../../ui/create-module-vue-app.js');
			const { default: FileDetailViewComponent } = await import('./FileDetailView.vue');
			this.mounted = createModuleVueApp(FileDetailViewComponent, this.ctx, this.contentEl, result as Record<string, unknown>);
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
		return Promise.resolve();
	}

	private async buildAnalysis(state: unknown): Promise<AnalysisResult> {
		const filePath = getFilePathFromState(state);
		if (filePath === null) return { analysis: null, error: null };

		const { getHandler } = await import('../handlers/handler-registry.js');
		const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
		const handler = getHandler(ext);
		if (handler === undefined) {
			return { analysis: null, error: `No handler for extension: ${ext}` };
		}

		const content = getContentFromState(state);
		const fileName = filePath.split('/').pop() ?? filePath;
		const analysis = handler.analyze(content, fileName);
		return { analysis, error: null };
	}
}
