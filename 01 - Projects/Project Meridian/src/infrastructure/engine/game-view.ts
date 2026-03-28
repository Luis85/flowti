import { ItemView, WorkspaceLeaf } from 'obsidian';
import * as ex from 'excalibur';
import { createGameEngine, createTestActor } from './game-engine.js';
import { createGameLoader } from './game-loader.js';

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
		container.classList.add('meridian-game-container');

		const style = getComputedStyle(container);
		const bgColor = style.getPropertyValue('--background-primary').trim() || '#1a1a2e';

		this.engine = createGameEngine(container, {
			width: container.clientWidth,
			height: container.clientHeight,
			backgroundColor: bgColor,
		});

		// Add a test actor to verify rendering (Phase 0 acceptance criterion 1)
		const testActor = createTestActor({ x: 400, y: 300 });
		this.engine.currentScene.add(testActor);

		// Fire-and-forget — don't block onOpen() with engine initialization
		// This prevents the '[Violation] click handler took Xms' browser warning
		const loader = createGameLoader();
		// Future: add resources here — loader.addResource(sprite), etc.
		void this.engine.start(loader);
	}

	async onClose(): Promise<void> {
		if (this.engine !== null) {
			this.engine.stop();
			this.engine = null;
		}
	}
}
