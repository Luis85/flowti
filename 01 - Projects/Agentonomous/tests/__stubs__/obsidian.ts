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
	getState(): Record<string, unknown> { return {}; }
	setState(_state: unknown, _result: unknown): Promise<void> { return Promise.resolve(); }
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
	registerExtensions = (_extensions: string[], _viewType: string): void => undefined;
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

// ---------------------------------------------------------------------------
// Vault / TFile / MetadataCache stubs — used by ObsidianVaultAdapter tests
// ---------------------------------------------------------------------------

export type FrontmatterCache = { [key: string]: unknown };
export type CachedMetadata = { frontmatter?: FrontmatterCache };

export class TFile {
	readonly path: string;
	readonly stat: { size: number; ctime: number; mtime: number };
	constructor(path: string, stat?: { size?: number; ctime?: number; mtime?: number }) {
		this.path = path;
		this.stat = { size: stat?.size ?? 0, ctime: stat?.ctime ?? 0, mtime: stat?.mtime ?? Date.now() };
	}
}

type StoredEntry = { content: string; ctime: number; mtime: number };

/** In-memory Vault stub sufficient for ObsidianVaultAdapter tests. */
export class Vault {
	private readonly _files = new Map<string, StoredEntry>();

	async read(file: TFile): Promise<string> {
		const entry = this._files.get(file.path);
		if (entry === undefined) throw new Error(`File not found: ${file.path}`);
		return entry.content;
	}

	async create(path: string, content: string): Promise<TFile> {
		const now = Date.now();
		this._files.set(path, { content, ctime: now, mtime: now });
		return new TFile(path, { ctime: now, mtime: now, size: content.length });
	}

	async modify(file: TFile, content: string): Promise<void> {
		const entry = this._files.get(file.path);
		if (entry === undefined) throw new Error(`File not found: ${file.path}`);
		this._files.set(file.path, { ...entry, content, mtime: Date.now() });
	}

	async delete(file: TFile): Promise<void> {
		this._files.delete(file.path);
	}

	getAbstractFileByPath(path: string): TFile | null {
		if (!this._files.has(path)) return null;
		const entry = this._files.get(path)!;
		return new TFile(path, { size: entry.content.length, ctime: entry.ctime, mtime: entry.mtime });
	}

	getFiles(): TFile[] {
		return [...this._files.entries()].map(
			([path, entry]) => new TFile(path, { size: entry.content.length, ctime: entry.ctime, mtime: entry.mtime }),
		);
	}
}

/** MetadataCache stub — returns null (no YAML cache in tests; adapter falls back to extractFrontmatter). */
export class MetadataCache {
	getFileCache(_file: TFile): CachedMetadata | null {
		return null;
	}
}

export class App {
	readonly vault = new Vault();
	readonly metadataCache = new MetadataCache();
}
