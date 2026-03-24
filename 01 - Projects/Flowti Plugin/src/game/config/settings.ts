import type { RoomId } from "../data/scene-configs.js";

export interface SceneTheme {
	readonly background: string;
	readonly workstationColor: string;
	readonly floorColor: string;
	readonly label: string;
}

export const SCENE_THEMES: Record<RoomId, SceneTheme> = {
	hub: { background: "#1a1208", workstationColor: "#1e293b", floorColor: "#1a1208", label: "Tavern" },
	office: { background: "#1a1508", workstationColor: "#4e3e20", floorColor: "#1a1508", label: "Dojo" },
	village: { background: "#1a1a1a", workstationColor: "#5c4033", floorColor: "#1a1a1a", label: "Market Square" },
	station: { background: "#0e0808", workstationColor: "#4a2a1a", floorColor: "#0e0808", label: "Workshop" },
};

export const WORKSTATION_COLS = 3;
export const WORKSTATION_SPACING = { x: 160, y: 140 };
export const WORKSTATION_START = { x: 180, y: 160 };
