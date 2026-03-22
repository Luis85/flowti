/**
 * scene-configs.ts — Declarative configuration for all game scenes.
 *
 * Each scene declares its doors, workstation layout, background,
 * and optional overlays. The GameScene class consumes these configs.
 */

import { drawDojoFloor, drawMarketSquareFloor, drawWorkshopFloor, drawTavernFloor } from "../actors/scene-backgrounds.js";
import type { DoorConfig } from "../systems/scene-registry.js";

export interface OverlayConfig {
	readonly type: "connection-status" | "iteration-badge";
	readonly position: { readonly x: number; readonly y: number };
}

export interface GameSceneConfig {
	readonly id: string;
	readonly label: string;
	readonly doors: readonly DoorConfig[];
	readonly drawBackground: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
	readonly workstationStyle?: "desk" | "workbench" | "console" | "scroll-table" | "craft-stall" | "forge-station";
	readonly workstationCount: number;
	readonly workstationColor?: string;
	readonly floorColor: string;
	readonly overlays?: readonly OverlayConfig[];
}

export const SCENE_CONFIGS: Record<string, GameSceneConfig> = {
	hub: {
		id: "hub",
		label: "Tavern",
		doors: [
			{ target: "office", label: "Dojo", position: { x: 750, y: 130 } },
			{ target: "village", label: "Market", position: { x: 750, y: 250 } },
			{ target: "station", label: "Workshop", position: { x: 750, y: 370 } },
		],
		workstationCount: 0,
		floorColor: "#1a1208",
		drawBackground: drawTavernFloor,
		overlays: [
			{ type: "connection-status", position: { x: 780, y: 20 } },
		],
	},
	office: {
		id: "office",
		label: "Dojo",
		doors: [
			{ target: "hub", label: "Back", position: { x: 40, y: 250 } },
		],
		workstationCount: 6,
		workstationStyle: "scroll-table",
		workstationColor: "#4e3e20",
		floorColor: "#1a1508",
		drawBackground: drawDojoFloor,
	},
	village: {
		id: "village",
		label: "Market Square",
		doors: [
			{ target: "hub", label: "Back", position: { x: 40, y: 250 } },
		],
		workstationCount: 6,
		workstationStyle: "craft-stall",
		workstationColor: "#5c4033",
		floorColor: "#1a1a1a",
		drawBackground: drawMarketSquareFloor,
	},
	station: {
		id: "station",
		label: "Workshop",
		doors: [
			{ target: "hub", label: "Back", position: { x: 40, y: 250 } },
		],
		workstationCount: 6,
		workstationStyle: "forge-station",
		workstationColor: "#4a2a1a",
		floorColor: "#0e0808",
		drawBackground: drawWorkshopFloor,
	},
};
