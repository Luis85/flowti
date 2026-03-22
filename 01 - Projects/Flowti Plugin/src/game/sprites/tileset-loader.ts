/**
 * tileset-loader.ts — Loads Ninja Adventure interior tilesets for scene backgrounds.
 * Provides tile extraction from spritesheet grids for compositing room backgrounds.
 */

import * as ex from "excalibur";

export interface TilesetAtlas {
	readonly floor: ex.SpriteSheet;
	readonly wall: ex.SpriteSheet;
	readonly interior: ex.SpriteSheet;
	readonly elements: ex.SpriteSheet;
	getTile(sheet: "floor" | "wall" | "interior" | "elements", index: number): ex.Sprite;
}

export async function loadTilesets(basePath: string): Promise<TilesetAtlas> {
	const sources = {
		floor: new ex.ImageSource(
			`${basePath}/Backgrounds/Tilesets/Interior/TilesetInteriorFloor.png`,
			{ filtering: ex.ImageFiltering.Pixel },
		),
		wall: new ex.ImageSource(
			`${basePath}/Backgrounds/Tilesets/Interior/TilesetWallSimple.png`,
			{ filtering: ex.ImageFiltering.Pixel },
		),
		interior: new ex.ImageSource(
			`${basePath}/Backgrounds/Tilesets/Interior/TilesetInterior.png`,
			{ filtering: ex.ImageFiltering.Pixel },
		),
		elements: new ex.ImageSource(
			`${basePath}/Backgrounds/Tilesets/Interior/Elements.png`,
			{ filtering: ex.ImageFiltering.Pixel },
		),
	};

	await Promise.all(Object.values(sources).map(s => s.load()));

	const sheets = {
		floor: ex.SpriteSheet.fromImageSource({
			image: sources.floor,
			grid: { columns: 22, rows: 17, spriteWidth: 16, spriteHeight: 16 },
		}),
		wall: ex.SpriteSheet.fromImageSource({
			image: sources.wall,
			grid: { columns: 10, rows: 11, spriteWidth: 16, spriteHeight: 16 },
		}),
		interior: ex.SpriteSheet.fromImageSource({
			image: sources.interior,
			grid: { columns: 16, rows: 20, spriteWidth: 16, spriteHeight: 16 },
		}),
		elements: ex.SpriteSheet.fromImageSource({
			image: sources.elements,
			grid: { columns: 9, rows: 3, spriteWidth: 16, spriteHeight: 16 },
		}),
	};

	return {
		...sheets,
		getTile(sheet: "floor" | "wall" | "interior" | "elements", index: number): ex.Sprite {
			const s = sheets[sheet];
			const col = index % s.columns;
			const row = Math.floor(index / s.columns);
			const sprite = s.getSprite(col, row);
			if (!sprite) {
				throw new Error(`Tile ${index} (col=${col}, row=${row}) not found in ${sheet}`);
			}
			return sprite;
		},
	};
}
