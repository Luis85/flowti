import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type * as ex from 'excalibur';
import { createGameEngine, createTestActor } from './game-engine.js';
import { createGameLoader } from './game-loader.js';
import { createTickRunner } from './tick-runner.js';
import { MeridianTickSystem } from './tick-system.js';
import type { BatchableEventBus } from './batchable-event-bus.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';

export const MERIDIAN_VIEW_TYPE = 'meridian-game-view';

export class MeridianGameView extends ItemView {
	private engine: ex.Engine | null = null;
	private deps: GameCoreDeps | null;

	constructor(leaf: WorkspaceLeaf, deps: GameCoreDeps | null) {
		super(leaf);
		this.deps = deps;
	}

	getViewType(): string {
		return MERIDIAN_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Project Meridian';
	}

	// eslint-disable-next-line @typescript-eslint/require-await -- Obsidian ItemView interface requires async
	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.classList.add('meridian-game-container');

		try {
			const style = getComputedStyle(container);
			const bgColor = style.getPropertyValue('--background-primary').trim() || '#1a1a2e';

			this.engine = createGameEngine(container, {
				backgroundColor: bgColor,
			});

			// Add a test actor to verify rendering (Phase 0 acceptance criterion 1)
			const testActor = createTestActor({ x: 400, y: 300 });
			this.engine.currentScene.add(testActor);

			// Wire tick infrastructure if deps are available
			if (this.deps !== null) {
				const batchableEventBus = this.deps.eventBus as BatchableEventBus;
				const tickRunner = createTickRunner(batchableEventBus);
				const tickSystem = new MeridianTickSystem(tickRunner, this.deps);
				this.engine.currentScene.world.add(tickSystem);
				this.deps.logger.info('Meridian', 'Tick system registered');
			}

			const loader = createGameLoader();
			void this.engine.start(loader).catch((err: unknown) => {
				this.showError(container, err);
			});
		} catch (err: unknown) {
			this.showError(container, err);
		}
	}

	// eslint-disable-next-line @typescript-eslint/require-await -- Obsidian ItemView interface requires async
	async onClose(): Promise<void> {
		if (this.engine !== null) {
			this.engine.stop();
			this.engine = null;
		}
	}

	private showError(container: HTMLElement, err: unknown): void {
		const message = err instanceof Error ? err.message : String(err);
		console.error('[Meridian] Engine failed to initialize:', message);

		// Clear any partial canvas state
		container.empty();

		const errorEl = container.createDiv({ cls: 'meridian-error' });
		errorEl.createEl('h3', { text: 'Project Meridian' });
		errorEl.createEl('p', { text: 'The game engine failed to start.' });
		errorEl.createEl('code', { text: message });
		errorEl.createEl('p', { text: 'Check the developer console for details.' });
	}
}
