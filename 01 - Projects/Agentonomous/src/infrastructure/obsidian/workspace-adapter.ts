import { TFile, type App, type PaneType } from 'obsidian';
import type { WorkspacePort, OpenFileMode } from '../../domain/shared/workspace-port.js';
import { err, ok, type Result } from '../../domain/shared/result.js';

const MODE_MAP: Record<OpenFileMode, PaneType | boolean> = {
	current: false,
	tab:     'tab',
	split:   'split',
};

export class ObsidianWorkspaceAdapter implements WorkspacePort {
	constructor(private readonly app: App) {}

	async openFile(path: string, mode: OpenFileMode): Promise<Result<void, string>> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return err(`not-found: ${path}`);
		await this.app.workspace.getLeaf(MODE_MAP[mode]).openFile(file);
		return ok(undefined);
	}
}
