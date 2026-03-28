import * as ex from 'excalibur';

export interface GameEngineConfig {
	width?: number;
	height?: number;
	/** CSS hex color string, e.g. '#1a1a2e'. Read from Obsidian's --background-primary CSS variable. */
	backgroundColor?: string;
}

export function createGameEngine(
	container: HTMLElement,
	config: GameEngineConfig = {},
): ex.Engine {
	const { width = 800, height = 600, backgroundColor } = config;

	const canvas = document.createElement('canvas');
	container.appendChild(canvas);

	const engine = new ex.Engine({
		canvasElement: canvas,
		width,
		height,
		backgroundColor: ex.Color.fromHex(backgroundColor ?? '#1a1a2e'),
		suppressPlayButton: true,
		antialiasing: false,
	});

	return engine;
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
