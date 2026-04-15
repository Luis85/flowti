// Minimal runtime stub for the `obsidian` types-only package.
// Used by Vitest via a resolve alias so tests that extend Obsidian classes work.

function augmentEl(el: HTMLElement): HTMLElement & { empty: () => void; createEl: (tag: string, opts?: { text?: string }) => HTMLElement } {
	const augmented = el as HTMLElement & { empty: () => void; createEl: (tag: string, opts?: { text?: string }) => HTMLElement };
	augmented.empty = () => { el.innerHTML = ''; };
	augmented.createEl = (tag: string, opts?: { text?: string }) => {
		const child = document.createElement(tag);
		if (opts?.text) child.textContent = opts.text;
		el.appendChild(child);
		return child;
	};
	return augmented;
}

export class ItemView {
	protected contentEl: ReturnType<typeof augmentEl>;
	constructor(_leaf: unknown) {
		this.contentEl = augmentEl(document.createElement('div'));
	}
	getViewType(): string { return ''; }
	getDisplayText(): string { return ''; }
	getIcon(): string { return ''; }
}

export class WorkspaceLeaf {}

export class Plugin {
	app: unknown = {};
	manifest: { version: string } = { version: '0.0.0' };
	loadData = async (): Promise<unknown> => null;
	saveData = async (_data: unknown): Promise<void> => undefined;
	registerView = (_type: string, _factory: unknown): void => undefined;
	addRibbonIcon = (_icon: string, _title: string, _cb: () => void): { remove: () => void } => ({ remove: () => {} });
	addCommand = (_cmd: unknown): void => undefined;
	addSettingTab = (_tab: unknown): void => undefined;
	register = (_cb: () => void): void => undefined;
}

export class PluginSettingTab {
	protected app: unknown;
	protected plugin: unknown;
	protected containerEl: ReturnType<typeof augmentEl>;
	constructor(app: unknown, plugin: unknown) {
		this.app = app;
		this.plugin = plugin;
		this.containerEl = augmentEl(document.createElement('div'));
	}
}

export class Setting {
	private el: HTMLElement;
	constructor(container: HTMLElement) {
		this.el = container.createEl?.('div') ?? document.createElement('div');
	}
	setName(_name: string): this { return this; }
	setDesc(_desc: string): this { return this; }
	addToggle(cb: (t: { setValue: (v: boolean) => { onChange: (fn: (v: boolean) => void) => void } }) => void): this {
		cb({ setValue: () => ({ onChange: () => {} }) });
		return this;
	}
	addDropdown(cb: (d: { addOption: (v: string, l: string) => void; setValue: (v: string) => { onChange: (fn: (v: string) => void) => void } }) => void): this {
		cb({ addOption: () => {}, setValue: () => ({ onChange: () => {} }) });
		return this;
	}
}

export class Notice {
	constructor(_message: string) {}
}
