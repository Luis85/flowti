/**
 * station-scene.ts — Station room scene.
 *
 * Uses the "station" SceneTheme. Agents here are in a technical, mission-control setting.
 */

import { RoomScene, type RoomSceneConfig } from "./room-scene.js";

export function createStationScene(config: RoomSceneConfig): RoomScene {
	return new RoomScene("station", config);
}
