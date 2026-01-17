/**
 * Stub for the main plugin module
 */
import { Plugin } from "obsidian";

export default class FlowtiBasePlugin extends Plugin {
	settings = { debugMode: false };
	userService = {
		getUser: () => null,
		hasUser: () => false,
		createUser: async () => ({ id: "test", name: "Test", createdAt: new Date().toISOString() }),
		updateUserName: async () => {},
		load: async () => {},
	};

	async loadSettings(): Promise<void> {}
	async saveSettings(): Promise<void> {}
}
