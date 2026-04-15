// Minimal runtime stub for the `obsidian` types-only package.
// Used by Vitest via a resolve alias so tests that extend Obsidian classes work.

function augmentEl(el: HTMLElement): HTMLElement & { empty: () => void; createEl: (tag: string, opts?: { text?: string }) => HTMLElement } {
	const augmented = el as HTMLElement & { empty: () => void; createEl: (tag: string, opts?: { text?: string }) => HTMLElement };
	augmented.empty = () => { el.innerHTML = ''; };
	augmented.createEl = (tag: string, opts?: { text?: string }) => {
		const child = document.createElement(tag);
		if (opts?.text !== undefined) child.textContent = opts.text;
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

/**
 * Per-container registry so tests can reach the Setting instances that
 * display() creates without needing a module-level global.
 * WeakMap keyed by containerEl.
 */
export const _settingsByContainer = new WeakMap<HTMLElement, Setting[]>();

export class Setting {
	private readonly _el: HTMLElement;
	/** Exposed for tests: all toggle components created by this Setting instance. */
	_toggles: Array<{
		_onChange: ((value: boolean) => void) | null;
		setValue(v: boolean): this;
		onChange(fn: (value: boolean) => void): this;
		_trigger(value: boolean): void;
	}> = [];
	/** Exposed for tests: all dropdown components created by this Setting instance. */
	_dropdowns: Array<{
		_onChange: ((value: string) => void) | null;
		addOption(v: string, l: string): this;
		setValue(v: string): this;
		onChange(fn: (value: string) => void): this;
		_trigger(value: string): void;
	}> = [];

	constructor(container: HTMLElement) {
		this._el = container.createEl?.('div') ?? document.createElement('div');
		// Register this instance under the container so tests can look it up.
		const existing = _settingsByContainer.get(container) ?? [];
		existing.push(this);
		_settingsByContainer.set(container, existing);
	}
	setName(_name: string): this { return this; }
	setDesc(_desc: string): this { return this; }
	addToggle(cb: (t: Setting['_toggles'][number]) => void): this {
		const toggle: Setting['_toggles'][number] = {
			_onChange: null,
			setValue(_v: boolean) { return this; },
			onChange(fn: (value: boolean) => void) { this._onChange = fn; return this; },
			_trigger(value: boolean) { this._onChange?.(value); },
		};
		cb(toggle);
		this._toggles.push(toggle);
		return this;
	}
	addDropdown(cb: (d: Setting['_dropdowns'][number]) => void): this {
		const dropdown: Setting['_dropdowns'][number] = {
			_onChange: null,
			addOption(_v: string, _l: string) { return this; },
			setValue(_v: string) { return this; },
			onChange(fn: (value: string) => void) { this._onChange = fn; return this; },
			_trigger(value: string) { this._onChange?.(value); },
		};
		cb(dropdown);
		this._dropdowns.push(dropdown);
		return this;
	}
}

/** Tracks all Notice messages constructed after last reset. */
export const _noticeMessages: string[] = [];

export class Notice {
	constructor(message: string) {
		_noticeMessages.push(message);
	}
}
