/**
 * scene-configs.ts — Declarative configuration for all game scenes.
 *
 * Each scene declares its doors, workstation layout, background,
 * and optional overlays. The GameScene class consumes these configs.
 */

import { drawOfficeFloor, drawVillageFloor, drawStationFloor, drawHubFloor } from "../actors/scene-backgrounds.js";
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
	readonly workstationStyle?: "desk" | "workbench" | "console";
	readonly workstationCount: number;
	readonly workstationColor?: string;
	readonly floorColor: string;
	readonly overlays?: readonly OverlayConfig[];
}

export const SCENE_CONFIGS: Record<string, GameSceneConfig> = {
	hub: {
		id: "hub",
		label: "Hub",
		doors: [
			{ target: "office", label: "Office", position: { x: 750, y: 130 } },
			{ target: "village", label: "Village", position: { x: 750, y: 250 } },
			{ target: "station", label: "Station", position: { x: 750, y: 370 } },
		],
		workstationCount: 0,
		floorColor: "#111827",
		drawBackground: drawHubFloor,
		overlays: [
			{ type: "connection-status", position: { x: 780, y: 20 } },
		],
	},
	office: {
		id: "office",
		label: "Office",
		doors: [
			{ target: "hub", label: "Back", position: { x: 40, y: 250 } },
		],
		workstationCount: 6,
		workstationStyle: "desk",
		workstationColor: "#1e3a5f",
		floorColor: "#0c1524",
		drawBackground: drawOfficeFloor,
	},
	village: {
		id: "village",
		label: "Village",
		doors: [
			{ target: "hub", label: "Back", position: { x: 40, y: 250 } },
		],
		workstationCount: 6,
		workstationStyle: "workbench",
		workstationColor: "#3d2e1a",
		floorColor: "#15120d",
		drawBackground: drawVillageFloor,
	},
	station: {
		id: "station",
		label: "Station",
		doors: [
			{ target: "hub", label: "Back", position: { x: 40, y: 250 } },
		],
		workstationCount: 6,
		workstationStyle: "console",
		workstationColor: "#0e3d4a",
		floorColor: "#080d14",
		drawBackground: drawStationFloor,
	},
};
