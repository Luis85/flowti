import { Plugin } from 'obsidian';
import { MeridianGameView, MERIDIAN_VIEW_TYPE } from './infrastructure/engine/game-view.js';

export class MeridianPlugin extends Plugin {
	async onload(): Promise<void> {
		// Lightweight registrations only — keep onload fast (Obsidian load-time guide)
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

		// Heavy initialization deferred until workspace is ready
		// Note: vault.on('create'|'modify'|'delete') MUST also go inside
		// onLayoutReady to avoid processing every file during vault init.
		this.app.workspace.onLayoutReady(() => {
			this.initializeGame();
		});
	}

	/** Deferred game initialization — called after Obsidian workspace is fully loaded */
	private initializeGame(): void {
		// Phase 1+: GameDeps composition root, VaultSync startup, system registration
		// This method will grow as systems are added in subsequent chunks
	}

	async onunload(): Promise<void> {
		this.app.workspace.detachLeavesOfType(MERIDIAN_VIEW_TYPE);
	}
}
