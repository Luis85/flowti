import { ItemView } from 'obsidian';
import type * as ex from 'excalibur';
import { createGameEngine, createTestActor } from './game-engine.js';
import { createGameLoader } from './game-loader.js';

export const MERIDIAN_VIEW_TYPE = 'meridian-game-view';

export class MeridianGameView extends ItemView {
	private engine: ex.Engine | null = null;

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

			// Fire-and-forget — don't block onOpen() with engine initialization
			// This prevents the '[Violation] click handler took Xms' browser warning
			const loader = createGameLoader();
			// Future: add resources here — loader.addResource(sprite), etc.
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
