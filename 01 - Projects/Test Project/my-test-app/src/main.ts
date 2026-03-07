import { Plugin } from "obsidian";
import { EventBus } from "./infrastructure/events/EventBus";
import type { IEventBus } from "./infrastructure/events/types";

export default class MyTestAppPlugin extends Plugin {
	private eventBus!: IEventBus;

	async onload(): Promise<void> {
		this.eventBus = new EventBus();

		console.log(`[My Test App] loaded`);
		await this.eventBus.emit("app.loaded", {});
	}

	async onunload(): Promise<void> {
		await this.eventBus.emit("app.unloaded", {});
		this.eventBus.clear();

		console.log(`[My Test App] unloaded`);
	}
}
