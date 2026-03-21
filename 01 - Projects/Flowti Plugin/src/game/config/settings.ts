import type { Setting } from "../data/types.js";

export interface SceneTheme {
	readonly background: string;
	readonly workstationColor: string;
	readonly floorColor: string;
	readonly label: string;
}

export const SCENE_THEMES: Record<Setting, SceneTheme> = {
	hub: { background: "#0a0a0f", workstationColor: "#1e293b", floorColor: "#111827", label: "Hub" },
	office: { background: "#0f172a", workstationColor: "#1e3a5f", floorColor: "#0c1524", label: "Office" },
	village: { background: "#1a1510", workstationColor: "#3d2e1a", floorColor: "#15120d", label: "Village" },
	station: { background: "#0a0f1a", workstationColor: "#0e3d4a", floorColor: "#080d14", label: "Station" },
};

export const WORKSTATION_COLS = 3;
export const WORKSTATION_SPACING = { x: 160, y: 140 };
export const WORKSTATION_START = { x: 180, y: 160 };
