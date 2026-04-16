import { ItemView } from 'obsidian';
import { VIEW_TYPE_FILE_DETAIL } from '../file-detail-module.js';

export { VIEW_TYPE_FILE_DETAIL };

type MountedView = { unmount: () => void };

/**
 * Obsidian ItemView for the File Detail panel.
 * Reads the file path from ViewState, runs the appropriate handler,
 * and mounts a Vue component to display the analysis result.
 */
export class FileDetailView extends ItemView {
	private mounted: MountedView | null = null;
	private mounting = false;

	getViewType(): string { return VIEW_TYPE_FILE_DETAIL; }
	getDisplayText(): string { return 'File detail'; }
	getIcon(): string { return 'file-search'; }

	async onOpen(): Promise<void> {
		if (this.mounted !== null || this.mounting) return;
		this.mounting = true;
		try {
			const state = this.getState() as Record<string, unknown>;
			const filePath = typeof state['file'] === 'string' ? state['file'] : null;

			const { createApp } = await import('vue');
			const { default: FileDetailViewComponent } = await import('./FileDetailView.vue');
			const { getHandler } = await import('../handlers/handler-registry.js');

			let analysis = null;
			let error: string | null = null;

			if (filePath !== null) {
				const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
				const handler = getHandler(ext);
				if (handler !== undefined) {
					try {
						// Read raw content — vault access is done at open time.
						// In Obsidian we read via app.vault; here we pass content
						// through getState to keep the view testable.
						const content = typeof state['content'] === 'string' ? state['content'] : '';
						const fileName = filePath.split('/').pop() ?? filePath;
						analysis = handler.analyze(content, fileName);
					} catch (e) {
						error = e instanceof Error ? e.message : String(e);
					}
				} else {
					error = `No handler for extension: ${filePath.split('.').pop() ?? 'unknown'}`;
				}
			}

			const app = createApp(FileDetailViewComponent, { analysis, error });
			app.mount(this.contentEl);
			this.mounted = { unmount: () => { app.unmount(); } };
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
}
