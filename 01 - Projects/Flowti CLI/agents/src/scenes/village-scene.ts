/**
 * village-scene.ts — Village room scene.
 *
 * Uses the "village" SceneTheme. Agents here are in a collaborative, informal setting.
 */

import { RoomScene, type RoomSceneConfig } from "./room-scene.js";

export function createVillageScene(config: RoomSceneConfig): RoomScene {
	return new RoomScene("village", config);
}
