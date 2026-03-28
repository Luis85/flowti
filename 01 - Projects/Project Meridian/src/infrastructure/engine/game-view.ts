import { ItemView, WorkspaceLeaf } from 'obsidian';
import * as ex from 'excalibur';
import { createGameEngine, createTestSprite } from './game-engine.js';

export const MERIDIAN_VIEW_TYPE = 'meridian-game-view';

export class MeridianGameView extends ItemView {
	private engine: ex.Engine | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return MERIDIAN_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Project Meridian';
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.style.padding = '0';
		container.style.overflow = 'hidden';

		const style = getComputedStyle(container);
		const bgColor = style.getPropertyValue('--background-primary').trim() || '#1a1a2e';

		this.engine = createGameEngine(container, {
			width: container.clientWidth,
			height: container.clientHeight,
			backgroundColor: bgColor,
		});

		// Add a test sprite to verify rendering (Phase 0 acceptance criterion 1)
		const testSprite = createTestSprite({ x: 400, y: 300 });
		this.engine.currentScene.add(testSprite);

		await this.engine.start();
	}

	async onClose(): Promise<void> {
		if (this.engine !== null) {
			this.engine.stop();
			this.engine = null;
		}
	}
}
