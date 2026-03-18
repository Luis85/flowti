/**
 * office-scene.ts — Office room scene.
 *
 * Uses the "office" SceneTheme. Agents here are typically in structured work mode.
 */

import { drawOfficeFloor } from "../actors/scene-backgrounds.js";
import { RoomScene, type RoomSceneConfig } from "./room-scene.js";

export function createOfficeScene(config: RoomSceneConfig): RoomScene {
	return new RoomScene("office", { ...config, workstationStyle: "desk", drawBackground: drawOfficeFloor });
}
