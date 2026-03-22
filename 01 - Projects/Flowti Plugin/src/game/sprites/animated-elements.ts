/**
 * animated-elements.ts — Room-specific animated background decorations.
 * Loads spritesheet strips and creates positioned ExcaliburJS Animation actors.
 */

import * as ex from "excalibur";

export interface AnimatedElementConfig {
	readonly name: string;
	readonly spritePath: string;
	readonly frameWidth: number;
	readonly frameHeight: number;
	readonly frameCount: number;
	readonly frameDuration: number;
	readonly x: number;
	readonly y: number;
	readonly scale: number;
	readonly zIndex: number;
}

export const ROOM_ELEMENTS: Record<string, readonly AnimatedElementConfig[]> = {
	hub: [
		{ name: "fountain", spritePath: "Backgrounds/Animated/Water Ripples/SpriteSheet16x16.png", frameWidth: 16, frameHeight: 16, frameCount: 4, frameDuration: 200, x: 400, y: 280, scale: 3, zIndex: 5 },
		{ name: "banner-l", spritePath: "Backgrounds/Animated/Flag/FlagBlue16x16.png", frameWidth: 16, frameHeight: 16, frameCount: 4, frameDuration: 200, x: 150, y: 40, scale: 2, zIndex: 5 },
		{ name: "banner-r", spritePath: "Backgrounds/Animated/Flag/FlagBrown16x16.png", frameWidth: 16, frameHeight: 16, frameCount: 4, frameDuration: 200, x: 650, y: 40, scale: 2, zIndex: 5 },
	],
	office: [
		{ name: "bamboo", spritePath: "Backgrounds/Animated/Plant/SpriteSheet16x16.png", frameWidth: 16, frameHeight: 16, frameCount: 4, frameDuration: 300, x: 60, y: 120, scale: 3, zIndex: 5 },
		{ name: "dojo-banner", spritePath: "Backgrounds/Animated/Flag/FlagBrown16x16.png", frameWidth: 16, frameHeight: 16, frameCount: 4, frameDuration: 200, x: 400, y: 30, scale: 2, zIndex: 5 },
	],
	village: [
		{ name: "flowers-l", spritePath: "Backgrounds/Animated/Flower/SpriteSheet16x16.png", frameWidth: 16, frameHeight: 16, frameCount: 4, frameDuration: 250, x: 120, y: 400, scale: 2, zIndex: 5 },
		{ name: "flowers-r", spritePath: "Backgrounds/Animated/Flower/SpriteSheet16x16.png", frameWidth: 16, frameHeight: 16, frameCount: 4, frameDuration: 250, x: 680, y: 400, scale: 2, zIndex: 5 },
		{ name: "market-flag", spritePath: "Backgrounds/Animated/Flag/FlagGreen16x16.png", frameWidth: 16, frameHeight: 16, frameCount: 4, frameDuration: 200, x: 400, y: 25, scale: 2, zIndex: 5 },
	],
	station: [
		{ name: "forge-plant", spritePath: "Backgrounds/Animated/Plant/SpriteSheet16x16.png", frameWidth: 16, frameHeight: 16, frameCount: 4, frameDuration: 300, x: 730, y: 350, scale: 2, zIndex: 5 },
		{ name: "water-channel", spritePath: "Backgrounds/Animated/Water Ripples/SpriteSheet16x16.png", frameWidth: 16, frameHeight: 16, frameCount: 4, frameDuration: 200, x: 700, y: 400, scale: 2, zIndex: 5 },
	],
};

export async function loadAnimatedElement(
	config: AnimatedElementConfig,
	basePath: string,
): Promise<ex.Actor> {
	const source = new ex.ImageSource(`${basePath}/${config.spritePath}`, {
		filtering: ex.ImageFiltering.Pixel,
	});
	await source.load();

	const sheet = ex.SpriteSheet.fromImageSource({
		image: source,
		grid: { columns: config.frameCount, rows: 1, spriteWidth: config.frameWidth, spriteHeight: config.frameHeight },
	});

	const frames = Array.from({ length: config.frameCount }, (_, i) => i);
	const animation = ex.Animation.fromSpriteSheet(sheet, frames, config.frameDuration);
	animation.strategy = ex.AnimationStrategy.Loop;
	animation.scale = ex.vec(config.scale, config.scale);

	const actor = new ex.Actor({
		x: config.x,
		y: config.y,
		z: config.zIndex,
		anchor: ex.vec(0.5, 0.5),
	});
	actor.graphics.use(animation);

	return actor;
}

export async function loadRoomElements(
	roomId: string,
	basePath: string,
): Promise<ex.Actor[]> {
	const configs = ROOM_ELEMENTS[roomId];
	if (!configs || configs.length === 0) return [];
	const results = await Promise.allSettled(
		configs.map(cfg => loadAnimatedElement(cfg, basePath)),
	);
	return results
		.filter((r): r is PromiseFulfilledResult<ex.Actor> => r.status === "fulfilled")
		.map(r => r.value);
}
