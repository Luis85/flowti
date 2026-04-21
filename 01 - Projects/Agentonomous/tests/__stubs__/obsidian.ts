// Minimal runtime stub for the `obsidian` types-only package.
// Used by Vitest via a resolve alias so tests that extend Obsidian classes work.

type AugmentedEl = HTMLElement & {
	empty: () => void;
	createEl: (tag: string, opts?: { text?: string }) => HTMLElement;
	setText: (text: string) => void;
};

function augmentEl(el: HTMLElement): AugmentedEl {
	const augmented = el as AugmentedEl;
	augmented.empty = () => { el.innerHTML = ''; };
	augmented.createEl = (tag: string, opts?: { text?: string }) => {
		const child = document.createElement(tag);
		if (opts?.text !== undefined) child.textContent = opts.text;
		el.appendChild(child);
		return child;
	};
	augmented.setText = (text: string) => { el.textContent = text; };
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

export class FileView extends ItemView {
	file: TFile | null = null;
	allowNoFile = true;
	navigation = true;
	canAcceptExtension(_extension: string): boolean { return false; }
	onLoadFile(_file: TFile): Promise<void> { return Promise.resolve(); }
	onUnloadFile(_file: TFile): Promise<void> { return Promise.resolve(); }
	onRename(_file: TFile): Promise<void> { return Promise.resolve(); }
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
	addButton(cb: (b: { _label: string; _clicked: boolean; _onClick: (() => void) | null; setButtonText(t: string): { _label: string; _clicked: boolean; _onClick: (() => void) | null }; setCta(): unknown; setWarning(): unknown; onClick(fn: () => void): unknown; _trigger(): void }) => void): this {
		const btn = {
			_label: '',
			_clicked: false,
			_onClick: null as (() => void) | null,
			setButtonText(text: string) { this._label = text; return this; },
			setCta() { return this; },
			setWarning() { return this; },
			onClick(fn: () => void) { this._onClick = fn; return this; },
			_trigger() { this._clicked = true; this._onClick?.(); },
		};
		cb(btn);
		return this;
	}
	addText(cb: (t: { inputEl: { addEventListener(ev: string, fn: (e: KeyboardEvent) => void): void }; setValue(v: string): unknown; setPlaceholder(v: string): unknown; onChange(fn: (v: string) => void): unknown }) => void): this {
		const txt = {
			inputEl: {
				addEventListener(_ev: string, _fn: (e: KeyboardEvent) => void) {},
			},
			setValue(_v: string) { return this; },
			setPlaceholder(_v: string) { return this; },
			onChange(_fn: (v: string) => void) { return this; },
		};
		cb(txt);
		return this;
	}
}

/** Captures modals opened in tests so assertions can reach them. */
export const _openModals: Modal[] = [];

export class Modal {
	protected app: unknown;
	titleEl: ReturnType<typeof augmentEl>;
	contentEl: ReturnType<typeof augmentEl>;
	constructor(app: unknown) {
		this.app = app;
		this.titleEl = augmentEl(document.createElement('div'));
		this.contentEl = augmentEl(document.createElement('div'));
	}
	open(): void {
		_openModals.push(this);
		(this as unknown as { onOpen?: () => void }).onOpen?.();
	}
	close(): void {
		(this as unknown as { onClose?: () => void }).onClose?.();
	}
}

/** Minimal SuggestModal stub. Extends Modal so subclasses inherit open()/close() semantics. Tests drive selection via `_chooseSuggestion(path)` or `_closeWithoutChoice()`. */
export class SuggestModal<T> extends Modal {
	private _placeholder = '';
	setPlaceholder(text: string): void { this._placeholder = text; }
	getSuggestions(_query: string): T[] | Promise<T[]> { return []; }
	renderSuggestion(_value: T, _el: HTMLElement): void { /* subclass override */ }
	onChooseSuggestion(_value: T, _evt: MouseEvent | KeyboardEvent): void { /* subclass override */ }
	/** Test helper: drive onChooseSuggestion as if the user clicked a suggestion. */
	_chooseSuggestion(value: T): void {
		this.onChooseSuggestion(value, new MouseEvent('click'));
		this.close();
	}
	/** Test helper: drive onClose without a prior choose (dismiss). */
	_closeWithoutChoice(): void { this.close(); }
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

export class TFolder {
	readonly path: string;
	constructor(path: string = '') {
		this.path = path;
	}
}

type StoredEntry = { content: string; ctime: number; mtime: number };

/** In-memory Vault stub sufficient for ObsidianVaultAdapter tests. */
export class Vault {
	private readonly _files = new Map<string, StoredEntry>();
	private readonly _folders = new Set<string>();

	async read(file: TFile): Promise<string> {
		const entry = this._files.get(file.path);
		if (entry === undefined) throw new Error(`File not found: ${file.path}`);
		return entry.content;
	}

	async create(path: string, content: string): Promise<TFile> {
		// Mirror Obsidian's real behaviour: refuse to create files under a
		// non-existent parent folder. This is what exposes the user-reported
		// ENOENT bug in the Make create flow when the types folder is
		// missing on a fresh vault.
		const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
		if (parent !== '' && !this._folders.has(parent)) {
			throw new Error(`ENOENT: no such file or directory, open '${path}'`);
		}
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

	async createFolder(path: string): Promise<TFolder> {
		if (this._folders.has(path)) throw new Error(`Folder already exists: ${path}`);
		this._folders.add(path);
		return new TFolder(path);
	}

	getAbstractFileByPath(path: string): TFile | TFolder | null {
		if (this._files.has(path)) {
			const entry = this._files.get(path)!;
			return new TFile(path, { size: entry.content.length, ctime: entry.ctime, mtime: entry.mtime });
		}
		if (this._folders.has(path)) return new TFolder(path);
		return null;
	}

	getFiles(): TFile[] {
		return [...this._files.entries()].map(
			([path, entry]) => new TFile(path, { size: entry.content.length, ctime: entry.ctime, mtime: entry.mtime }),
		);
	}

	/**
	 * Returns every TFile + TFolder in the vault.  Matches Obsidian's API shape,
	 * including the always-present root TFolder('').
	 */
	getAllLoadedFiles(): Array<TFile | TFolder> {
		const all: Array<TFile | TFolder> = this.getFiles();
		// Root folder is always loaded in Obsidian; mirror that here so
		// callers don't special-case it.
		all.push(new TFolder(''));
		for (const path of this._folders) all.push(new TFolder(path));
		return all;
	}

	/** Vault event listeners by event name.  Tests that subscribe via on() can fire via _trigger(). */
	private readonly _listeners = new Map<string, Set<(...args: unknown[]) => void>>();

	on(event: string, listener: (...args: unknown[]) => void): { event: string; listener: (...args: unknown[]) => void } {
		const set = this._listeners.get(event) ?? new Set();
		set.add(listener);
		this._listeners.set(event, set);
		return { event, listener };
	}

	offref(ref: { event: string; listener: (...args: unknown[]) => void }): void {
		this._listeners.get(ref.event)?.delete(ref.listener);
	}

	_trigger(event: string, ...args: unknown[]): void {
		const set = this._listeners.get(event);
		if (set === undefined) return;
		for (const listener of set) listener(...args);
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
