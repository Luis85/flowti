import { Plugin } from 'obsidian';

export class MeridianPlugin extends Plugin {
	async onload(): Promise<void> {
		console.log('Project Meridian loading...');
	}

	async onunload(): Promise<void> {
		console.log('Project Meridian unloading...');
	}
}
