/**
 * sprite-loader.ts — Loads Ninja Adventure spritesheets into ExcaliburJS animations.
 *
 * Each character has Idle.png (4 frames, 1 row) and Walk.png (4 frames, 4 directions).
 * All sprites are 16x16 pixels, displayed at 4x scale via engine pixelArt mode.
 */

import * as ex from "excalibur";

export interface AgentSprites {
	readonly idle: ex.Animation;
	readonly walkDown: ex.Animation;
	readonly walkLeft: ex.Animation;
	readonly walkRight: ex.Animation;
	readonly walkUp: ex.Animation;
}

/** Frame durations in ms for each animation type. */
export const FRAME_DURATIONS = {
	idle: 300,
	walkSlow: 250,
	walkFast: 150,
	onBreak: 400,
} as const;

/**
 * Load a character's Idle and Walk spritesheets and return pre-built animations.
 * Must be called after images are loaded (e.g. via ex.Loader or manual .load()).
 */
export async function loadAgentSprites(
	characterName: string,
	basePath: string,
): Promise<AgentSprites> {
	const charPath = `${basePath}${characterName}/SeparateAnim`;

	const idleImage = new ex.ImageSource(`${charPath}/Idle.png`, {
		filtering: ex.ImageFiltering.Pixel,
	});
	const walkImage = new ex.ImageSource(`${charPath}/Walk.png`, {
		filtering: ex.ImageFiltering.Pixel,
	});

	await Promise.all([idleImage.load(), walkImage.load()]);

	const idleSheet = ex.SpriteSheet.fromImageSource({
		image: idleImage,
		grid: { columns: 4, rows: 1, spriteWidth: 16, spriteHeight: 16 },
	});

	const walkSheet = ex.SpriteSheet.fromImageSource({
		image: walkImage,
		grid: { columns: 4, rows: 4, spriteWidth: 16, spriteHeight: 16 },
	});

	// Idle: frames 0-3
	const idle = ex.Animation.fromSpriteSheet(idleSheet, [0, 1, 2, 3], FRAME_DURATIONS.idle);
	idle.strategy = ex.AnimationStrategy.Loop;

	// Walk rows: 0=down, 1=left, 2=right, 3=up (4 frames each)
	const walkDown = ex.Animation.fromSpriteSheet(walkSheet, [0, 1, 2, 3], FRAME_DURATIONS.walkSlow);
	walkDown.strategy = ex.AnimationStrategy.Loop;

	const walkLeft = ex.Animation.fromSpriteSheet(walkSheet, [4, 5, 6, 7], FRAME_DURATIONS.walkSlow);
	walkLeft.strategy = ex.AnimationStrategy.Loop;

	const walkRight = ex.Animation.fromSpriteSheet(walkSheet, [8, 9, 10, 11], FRAME_DURATIONS.walkSlow);
	walkRight.strategy = ex.AnimationStrategy.Loop;

	const walkUp = ex.Animation.fromSpriteSheet(walkSheet, [12, 13, 14, 15], FRAME_DURATIONS.walkSlow);
	walkUp.strategy = ex.AnimationStrategy.Loop;

	return { idle, walkDown, walkLeft, walkRight, walkUp };
}

/**
 * Preload sprites for a set of characters and return a registry keyed by character name.
 */
export async function preloadSpriteRegistry(
	characters: readonly string[],
	basePath: string,
): Promise<Map<string, AgentSprites>> {
	const registry = new Map<string, AgentSprites>();
	const unique = [...new Set(characters)];
	const results = await Promise.all(
		unique.map(async (name) => ({ name, sprites: await loadAgentSprites(name, basePath) })),
	);
	for (const { name, sprites } of results) {
		registry.set(name, sprites);
	}
	return registry;
}
