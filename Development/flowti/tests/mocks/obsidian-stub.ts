/**
 * Minimal stub for Obsidian module to allow unit testing
 */

export class TAbstractFile {
	path: string = "";
}

export class TFile extends TAbstractFile {
	stat = { ctime: 0, mtime: 0, size: 0 };
	basename: string = "";
	extension: string = "";
}

export class TFolder extends TAbstractFile {
	children: TAbstractFile[] = [];
	isRoot(): boolean {
		return this.path === "/";
	}
}

export type EventRef = { id: string };

export class ItemView {
	file: TFile | null = null;
}

export class MarkdownView extends ItemView {}

export class WorkspaceLeaf {
	view: ItemView = new ItemView();
}

export class App {}

export class Plugin {
	app: App = new App();
	async loadData(): Promise<unknown> {
		return null;
	}
	async saveData(_data: unknown): Promise<void> {}
	registerEvent(_ref: EventRef): void {}
}

export class Modal {
	app: App;
	contentEl: HTMLElement = document.createElement("div");

	constructor(app: App) {
		this.app = app;
	}

	open(): void {}
	close(): void {}
	onOpen(): void {}
	onClose(): void {}
}

export class PluginSettingTab {
	app: App;
	plugin: Plugin;
	containerEl: HTMLElement = document.createElement("div");

	constructor(app: App, plugin: Plugin) {
		this.app = app;
		this.plugin = plugin;
	}

	display(): void {}
}

export class Setting {
	constructor(_containerEl: HTMLElement) {}

	setName(_name: string): this {
		return this;
	}

	setDesc(_desc: string): this {
		return this;
	}

	addText(_cb: (text: TextComponent) => void): this {
		return this;
	}

	addToggle(_cb: (toggle: ToggleComponent) => void): this {
		return this;
	}

	addButton(_cb: (btn: ButtonComponent) => void): this {
		return this;
	}
}

export class TextComponent {
	setValue(_value: string): this {
		return this;
	}

	setPlaceholder(_placeholder: string): this {
		return this;
	}

	setDisabled(_disabled: boolean): this {
		return this;
	}

	onChange(_cb: (value: string) => void): this {
		return this;
	}
}

export class ToggleComponent {
	setValue(_value: boolean): this {
		return this;
	}

	onChange(_cb: (value: boolean) => void): this {
		return this;
	}
}

export class ButtonComponent {
	setButtonText(_text: string): this {
		return this;
	}

	setCta(): this {
		return this;
	}

	onClick(_cb: () => void): this {
		return this;
	}
}
