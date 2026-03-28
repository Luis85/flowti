import * as ex from 'excalibur';

export interface GameEngineConfig {
	/** CSS hex color string, e.g. '#1a1a2e'. Read from Obsidian's --background-primary CSS variable. */
	backgroundColor?: string;
}

export interface GameEngineResult {
	engine: ex.Engine;
	/** Call on cleanup to disconnect the ResizeObserver. */
	dispose: () => void;
}

export function createGameEngine(
	container: HTMLElement,
	config: GameEngineConfig = {},
): GameEngineResult {
	const { backgroundColor } = config;

	const canvas = document.createElement('canvas');
	container.appendChild(canvas);

	const initialWidth = container.clientWidth || 800;
	const initialHeight = container.clientHeight || 600;

	const engine = new ex.Engine({
		canvasElement: canvas,
		displayMode: ex.DisplayMode.Fixed,
		width: initialWidth,
		height: initialHeight,
		backgroundColor: ex.Color.fromHex(backgroundColor ?? '#1a1a2e'),
		suppressPlayButton: true,
		suppressConsoleBootMessage: true,
		antialiasing: false,
		physics: {
			solver: ex.SolverStrategy.Arcade,
			gravity: ex.vec(0, 0),
		},
	});

	// Resize only when container has positive dimensions.
	// When Obsidian hides the tab (zero-size container), the canvas keeps its
	// last valid size — prevents WebGL zero-framebuffer errors while the
	// engine loop continues running (game simulation never pauses).
	const observer = new ResizeObserver((entries) => {
		const entry = entries[0];
		if (entry === undefined) return;
		const { width, height } = entry.contentRect;
		if (width > 0 && height > 0) {
			engine.screen.resolution = { width, height };
			engine.screen.viewport = { width, height };
		}
	});
	observer.observe(container);

	return {
		engine,
		dispose() { observer.disconnect(); },
	};
}

export function createTestActor(pos: { x: number; y: number }): ex.Actor {
	const actor = new ex.Actor({
		pos: new ex.Vector(pos.x, pos.y),
		width: 32,
		height: 32,
		color: ex.Color.fromHex('#e94560'),
	});
	return actor;
}
