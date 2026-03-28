import { Plugin } from 'obsidian';
import { MeridianGameView, MERIDIAN_VIEW_TYPE } from './infrastructure/engine/game-view.js';

export class MeridianPlugin extends Plugin {
	async onload(): Promise<void> {
		this.registerView(MERIDIAN_VIEW_TYPE, (leaf) => new MeridianGameView(leaf));

		this.addRibbonIcon('gamepad-2', 'Project Meridian', async () => {
			const existingLeaves = this.app.workspace.getLeavesOfType(MERIDIAN_VIEW_TYPE);
			const first = existingLeaves[0];
			if (first !== undefined) {
				this.app.workspace.revealLeaf(first);
				return;
			}
			const leaf = this.app.workspace.getLeaf('tab');
			await leaf.setViewState({ type: MERIDIAN_VIEW_TYPE, active: true });
		});
	}

	async onunload(): Promise<void> {
		this.app.workspace.detachLeavesOfType(MERIDIAN_VIEW_TYPE);
	}
}
