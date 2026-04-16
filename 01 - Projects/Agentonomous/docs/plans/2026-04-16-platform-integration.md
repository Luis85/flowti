# Platform Integration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add platform integration: PlatformPort (locale), vue-i18n internationalization with per-module locales, file extension registry with .csv/.json handlers and File Detail View, and VaultPort (CRUD + frontmatter, dual Obsidian + localStorage backend).

**Architecture:** PlatformPort provides Obsidian's locale. vue-i18n provides i18n with a TranslationPort for non-Vue code. File extension registry lets modules claim file types; File Detail module ships .csv/.json handlers. VaultPort abstracts vault CRUD + frontmatter parsing with Obsidian and localStorage backends. All new ports are added to ModulePorts in a single coordinated change alongside their fakes.

**Tech Stack:** TypeScript 6, Vue 3, vue-i18n ^9.14, Vitest 4, Obsidian 1.12.7 API.

**Spec:** [`docs/specs/2026-04-16-platform-integration-design.md`](../specs/2026-04-16-platform-integration-design.md)

**Conventions:** Same as prior increments. Paths relative to `01 - Projects/Agentonomous/`. TDD. Tabs. `.js` imports.

---

## Chunk 1: PlatformPort + i18n + coordinated port wiring

**Goal:** Ship PlatformPort, TranslationPort, vue-i18n integration, per-module locale files, locale bridging from Obsidian, refactor all hardcoded strings to use `t()`. This is the biggest chunk because it touches many files (the i18n refactoring of existing strings).

### Task 1.1: Install vue-i18n + Vite plugin

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependencies**

```bash
npm install --save-dev vue-i18n@^9.14.0 @intlify/unplugin-vue-i18n
```

If version resolution fails (Vue 3.5 + Vite 8 compat), try `vue-i18n@latest` and report the resolved version. Do NOT downgrade Vue or Vite.

- [ ] **Step 2: Commit**: `chore(agentonomous): install vue-i18n + unplugin-vue-i18n`

### Task 1.2: PlatformPort + TranslationPort + VaultPort + FileExtensionPort interfaces

**Files:**
- Create: `src/domain/shared/platform-port.ts`
- Create: `src/domain/shared/translation-port.ts`
- Create: `src/domain/shared/vault-port.ts`
- Create: `src/domain/shared/file-extension-port.ts`

- [ ] **Step 1: Create all four port interfaces**

```ts
// src/domain/shared/platform-port.ts
export interface PlatformPort {
	readonly locale: string;
}
```

```ts
// src/domain/shared/translation-port.ts
export interface TranslationPort {
	t(key: string, params?: Record<string, unknown>): string;
	readonly locale: string;
}
```

```ts
// src/domain/shared/vault-port.ts
import type { Result } from './result.js';

export type VaultFile = {
	readonly path: string;
	readonly content: string;
	readonly frontmatter: Record<string, unknown>;
	readonly stat: { readonly size: number; readonly ctime: number; readonly mtime: number };
};

export interface VaultPort {
	read(path: string): Promise<Result<VaultFile, string>>;
	create(path: string, content: string): Promise<Result<void, string>>;
	update(path: string, content: string): Promise<Result<void, string>>;
	delete(path: string): Promise<Result<void, string>>;
	exists(path: string): Promise<boolean>;
	list(folder: string): Promise<Result<string[], string>>;
}
```

```ts
// src/domain/shared/file-extension-port.ts
import type { Unsubscribe } from './unsubscribe.js';

export interface FileExtensionPort {
	register(extensions: readonly string[], viewType: string): Unsubscribe;
}
```

- [ ] **Step 2: Run typecheck**

- [ ] **Step 3: Commit**: `feat(agentonomous): add PlatformPort, TranslationPort, VaultPort, FileExtensionPort interfaces`

### Task 1.3: Coordinated port wiring — ModulePorts + fakes

**Files:**
- Modify: `src/domain/shared/module.ts` — add `t`, `platform`, `vault` to `ModulePorts`; add `messages`, `extensions` to `Module` + `defineModule`
- Modify: `tests/__fakes__/fake-ports.ts` — add `fakeTranslation`, `fakePlatform`, `fakeVault`

This is a single coordinated change — all ports + all fakes land together so `fakeModulePorts()` compiles.

- [ ] **Step 1: Update `ModulePorts` in `module.ts`**

Add three new fields:
```ts
import type { TranslationPort } from './translation-port.js';
import type { PlatformPort } from './platform-port.js';
import type { VaultPort } from './vault-port.js';

export interface ModulePorts {
	readonly eventBus: EventBus;
	readonly logger: LoggerPort;
	readonly settings: SettingsPort;
	readonly notifications: NotificationPort;
	readonly views: ViewRegistryPort;
	readonly t: TranslationPort;
	readonly platform: PlatformPort;
	readonly vault: VaultPort;
}
```

Add `messages` and `extensions` to `Module` interface and `defineModule` def parameter:
```ts
readonly messages?: Record<string, Record<string, string>>;
readonly extensions?: readonly { ext: string; viewType: string }[];
```

- [ ] **Step 2: Update `tests/__fakes__/fake-ports.ts`**

Add three new fakes:
```ts
export function fakeTranslation(): TranslationPort {
	return { t: vi.fn((key: string) => key), locale: 'en' };
}

export function fakePlatform(): PlatformPort {
	return { locale: 'en' };
}

export function fakeVault(): VaultPort {
	const files = new Map<string, { content: string; ctime: number; mtime: number }>();
	return {
		read: vi.fn(async (path: string) => {
			const f = files.get(path);
			if (!f) return { kind: 'err' as const, error: `not found: ${path}` };
			return ok({ path, content: f.content, frontmatter: {}, stat: { size: f.content.length, ctime: f.ctime, mtime: f.mtime } });
		}),
		create: vi.fn(async (path: string, content: string) => {
			files.set(path, { content, ctime: Date.now(), mtime: Date.now() });
			return ok(undefined);
		}),
		update: vi.fn(async (path: string, content: string) => {
			const f = files.get(path);
			if (!f) return { kind: 'err' as const, error: `not found: ${path}` };
			files.set(path, { ...f, content, mtime: Date.now() });
			return ok(undefined);
		}),
		delete: vi.fn(async (path: string) => {
			files.delete(path);
			return ok(undefined);
		}),
		exists: vi.fn(async (path: string) => files.has(path)),
		list: vi.fn(async (folder: string) => ok([...files.keys()].filter((k) => k.startsWith(folder)))),
	};
}
```

Update `fakeModulePorts()` to include all 8 ports:
```ts
export function fakeModulePorts(overrides?: Partial<ModulePorts>): ModulePorts {
	return {
		eventBus: overrides?.eventBus ?? /* existing inline bus fake */,
		logger: overrides?.logger ?? fakeLogger(),
		settings: overrides?.settings ?? fakeSettings(),
		notifications: overrides?.notifications ?? fakeNotifications(),
		views: overrides?.views ?? fakeViews(),
		t: overrides?.t ?? fakeTranslation(),
		platform: overrides?.platform ?? fakePlatform(),
		vault: overrides?.vault ?? fakeVault(),
		...overrides,
	};
}
```

- [ ] **Step 3: Run `npm test` — all 196 tests must pass**

Existing tests that call `fakeModulePorts()` will now get the three new ports automatically. No test should break since modules don't use `t`/`platform`/`vault` yet.

- [ ] **Step 4: Commit**: `feat(agentonomous): add t, platform, vault to ModulePorts + messages/extensions to Module`

### Task 1.4: ObsidianPlatformAdapter

**Files:**
- Create: `src/infrastructure/obsidian/obsidian-platform-adapter.ts`
- Create: `tests/infrastructure/obsidian/obsidian-platform-adapter.test.ts`

- [ ] **Step 1: Create adapter + test**

```ts
// src/infrastructure/obsidian/obsidian-platform-adapter.ts
import type { PlatformPort } from '../../domain/shared/platform-port.js';

export class ObsidianPlatformAdapter implements PlatformPort {
	get locale(): string {
		return (typeof window !== 'undefined' && window.moment?.locale?.())
			?? navigator?.language?.split('-')[0]
			?? 'en';
	}
}
```

Test:
```ts
import { describe, expect, it } from 'vitest';
import { ObsidianPlatformAdapter } from '../../../src/infrastructure/obsidian/obsidian-platform-adapter.js';

describe('ObsidianPlatformAdapter', () => {
	it('locale returns a non-empty string', () => {
		const adapter = new ObsidianPlatformAdapter();
		expect(typeof adapter.locale).toBe('string');
		expect(adapter.locale.length).toBeGreaterThan(0);
	});
});
```

- [ ] **Step 2: Update ESLint obsidian allowlist** if needed.

- [ ] **Step 3: Commit**: `feat(agentonomous): add ObsidianPlatformAdapter`

### Task 1.5: i18n setup in shell + TranslationPort wiring

**Files:**
- Modify: `src/main.ts` — create i18n instance, wire TranslationPort + PlatformPort
- Modify: `src/ui/app.ts` — `app.use(i18n)`
- Modify: `src/core/plugin-core.ts` — merge module messages into i18n, pass TranslationPort + PlatformPort to ModulePorts

- [ ] **Step 1: Create i18n in `main.ts`**

```ts
import { createI18n } from 'vue-i18n';

const platform = new ObsidianPlatformAdapter();
const i18n = createI18n({
	locale: platform.locale,
	fallbackLocale: 'en',
	messages: {},
	legacy: false,
});

const translationPort: TranslationPort = {
	t: (key, params) => i18n.global.t(key, params ?? {}),
	get locale() { return i18n.global.locale.value; },
};
```

Pass `platform` and `translationPort` to PluginCore alongside existing ports.

- [ ] **Step 2: Update PluginCore to merge module messages**

In `init()`, after sorting modules but before calling `module.init()`:
```ts
for (const module of sortedModules) {
	if (module.messages) {
		for (const [locale, messages] of Object.entries(module.messages)) {
			// Merge via the translation port or i18n instance
			// PluginCore receives an i18n merge callback via ports
		}
	}
}
```

Since PluginCore cannot import vue-i18n directly (it's platform-agnostic), add an `i18nMerge` callback to CorePorts:
```ts
readonly i18nMerge?: (locale: string, messages: Record<string, string>) => void;
```

Shell passes: `i18nMerge: (locale, msgs) => i18n.global.mergeLocaleMessage(locale, msgs)`.

- [ ] **Step 3: Update `createVueApp` in `app.ts` to install i18n**

The i18n instance needs to reach the Vue app. Pass it through `PluginContext` or via a separate parameter. Simplest: add `i18n` to `PluginContext` (it's in the shell, which already imports vue-i18n):

```ts
// In createVueApp:
if (ctx.i18n) vue.use(ctx.i18n);
```

- [ ] **Step 4: Run `npm test` — verify green**

- [ ] **Step 5: Commit**: `feat(agentonomous): wire i18n in shell + PluginCore message merging`

### Task 1.6: Per-module locale files + refactor existing strings

**Files:**
- Create: `src/modules/core/locales/en.json`
- Create: `src/modules/event-inspector/locales/en.json`
- Create: `src/modules/health-monitor/locales/en.json`
- Modify: `src/modules/core/core-module.ts` — add `messages` field
- Modify: `src/modules/event-inspector/event-inspector-module.ts` — add `messages` field
- Modify: `src/modules/health-monitor/health-monitor-module.ts` — add `messages` field
- Modify: `src/infrastructure/settings/settings-tab.ts` — use `t()` for labels
- Modify: `src/domain/settings/plugin-settings.ts` — add optional `locale` field to CoreSettings

- [ ] **Step 1: Create locale files**

```json
// src/modules/core/locales/en.json
{
	"core.settings.showRibbonIcon": "Show ribbon icon",
	"core.settings.showRibbonIcon.desc": "Show the Agentonomous icon in the left ribbon.",
	"core.settings.defaultView": "Default view",
	"core.settings.defaultView.desc": "Which view opens when the plugin launches.",
	"core.settings.logLevel": "Log level",
	"core.settings.logLevel.desc": "Controls console output verbosity.",
	"core.settings.locale": "Language",
	"core.settings.locale.desc": "Plugin language. Auto uses Obsidian's language setting.",
	"core.settings.locale.auto": "Auto (from Obsidian)",
	"core.commands.openHomepage": "Open homepage",
	"core.views.homepage": "Agentonomous homepage"
}
```

Similar for event-inspector and health-monitor (command names, view names, settings labels).

- [ ] **Step 2: Add `messages` field to each module**

Import the JSON and set `messages: { en: enMessages }` on each module definition. If importing JSON requires `resolveJsonModule` in tsconfig, verify it's enabled (it should be from Increment 1).

- [ ] **Step 3: Add optional `locale` field to CoreSettings**

In `plugin-settings.ts`:
```ts
export type CoreSettings = {
	readonly showRibbonIcon: boolean;
	readonly defaultView: DefaultViewName;
	readonly logLevel: LogLevel;
	readonly locale?: string;  // absent = auto from Obsidian
};
```

Update `validateCoreSettings`: use `'locale' in raw` narrowing. If present, validate it's a string.

Update `CORE_SETTINGS_DEFAULTS` — do NOT include `locale` (absent = auto).

- [ ] **Step 4: Refactor settings-tab to use `t()`**

The settings tab needs access to `TranslationPort`. It currently receives `(app, plugin, port)`. Add the translation port as a 4th constructor arg or pass it through the settings port. Simplest: add it as a constructor param:

```ts
constructor(app: App, plugin: Plugin, port: SettingsPort, private readonly t: TranslationPort) { ... }
```

Replace hardcoded strings:
```ts
new Setting(containerEl)
	.setName(this.t.t('core.settings.showRibbonIcon'))
	.setDesc(this.t.t('core.settings.showRibbonIcon.desc'))
	// ...
```

Add the Language dropdown using `KNOWN_LOG_LEVELS`-style pattern for available locales.

- [ ] **Step 5: Update `main.ts`** to pass `translationPort` to `AgentonomousSettingsTab`.

- [ ] **Step 6: Run `npm test` — verify green**

- [ ] **Step 7: Commit**: `feat(agentonomous): per-module locales + refactor strings to t()`

---

## Chunk 2: File extensions + Vault service

**Goal:** Ship FileExtensionPort adapter, File Detail module with .csv/.json handlers, VaultPort with dual Obsidian + localStorage backend, and the shared VaultPort test suite.

### Task 2.1: extractFrontmatter utility (TDD)

**Files:**
- Create: `src/infrastructure/vault/extract-frontmatter.ts`
- Create: `tests/infrastructure/vault/extract-frontmatter.test.ts`

- [ ] **Step 1: Write tests for all edge cases**

```ts
import { describe, expect, it } from 'vitest';
import { extractFrontmatter } from '../../../src/infrastructure/vault/extract-frontmatter.js';

describe('extractFrontmatter', () => {
	it('extracts flat key-value pairs', () => {
		const content = '---\ntitle: Hello\ntags: test\n---\nBody content';
		const fm = extractFrontmatter(content);
		expect(fm.title).toBe('Hello');
		expect(fm.tags).toBe('test');
	});

	it('returns empty object when no frontmatter', () => {
		expect(extractFrontmatter('Just body')).toEqual({});
	});

	it('returns empty object for empty frontmatter block', () => {
		expect(extractFrontmatter('---\n---\nBody')).toEqual({});
	});

	it('handles colons in values (splits on first colon-space only)', () => {
		const content = '---\ntitle: My Project: Phase 1\n---\n';
		expect(extractFrontmatter(content).title).toBe('My Project: Phase 1');
	});

	it('trims whitespace from values', () => {
		const content = '---\ntitle:   spaced   \n---\n';
		expect(extractFrontmatter(content).title).toBe('spaced');
	});

	it('handles numeric values as strings', () => {
		const content = '---\ncount: 42\n---\n';
		expect(extractFrontmatter(content).count).toBe('42');
	});
});
```

- [ ] **Step 2: Implement**

```ts
// src/infrastructure/vault/extract-frontmatter.ts
export function extractFrontmatter(content: string): Record<string, string> {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match || !match[1]) return {};
	const lines = match[1].split('\n');
	const result: Record<string, string> = {};
	for (const line of lines) {
		const colonIndex = line.indexOf(': ');
		if (colonIndex === -1) continue;
		const key = line.slice(0, colonIndex).trim();
		const value = line.slice(colonIndex + 2).trim();
		if (key.length > 0) result[key] = value;
	}
	return result;
}
```

- [ ] **Step 3: Commit**: `feat(agentonomous): add extractFrontmatter utility`

### Task 2.2: LocalStorageVaultAdapter (TDD)

**Files:**
- Create: `src/infrastructure/vault/local-storage-vault-adapter.ts`
- Create: `tests/infrastructure/vault/local-storage-vault-adapter.test.ts`

- [ ] **Step 1: Write the shared test suite**

```ts
import { describe, expect, it } from 'vitest';
import { LocalStorageVaultAdapter } from '../../../src/infrastructure/vault/local-storage-vault-adapter.js';
import { isOk, isErr } from '../../../src/domain/shared/result.js';

describe('LocalStorageVaultAdapter', () => {
	it('create + read round-trips', async () => {
		const adapter = new LocalStorageVaultAdapter();
		await adapter.create('test.md', '---\ntitle: Hello\n---\nBody');
		const result = await adapter.read('test.md');
		expect(isOk(result)).toBe(true);
		if (isOk(result)) {
			expect(result.value.content).toContain('Body');
			expect(result.value.frontmatter.title).toBe('Hello');
			expect(result.value.path).toBe('test.md');
		}
	});

	it('update modifies content', async () => {
		const adapter = new LocalStorageVaultAdapter();
		await adapter.create('test.md', 'v1');
		await adapter.update('test.md', 'v2');
		const result = await adapter.read('test.md');
		if (isOk(result)) expect(result.value.content).toBe('v2');
	});

	it('delete removes the file', async () => {
		const adapter = new LocalStorageVaultAdapter();
		await adapter.create('test.md', 'content');
		await adapter.delete('test.md');
		expect(await adapter.exists('test.md')).toBe(false);
	});

	it('exists returns true for existing files', async () => {
		const adapter = new LocalStorageVaultAdapter();
		await adapter.create('test.md', 'content');
		expect(await adapter.exists('test.md')).toBe(true);
		expect(await adapter.exists('nope.md')).toBe(false);
	});

	it('list returns files in folder', async () => {
		const adapter = new LocalStorageVaultAdapter();
		await adapter.create('folder/a.md', 'a');
		await adapter.create('folder/b.md', 'b');
		await adapter.create('other/c.md', 'c');
		const result = await adapter.list('folder/');
		if (isOk(result)) {
			expect(result.value).toHaveLength(2);
			expect(result.value).toContain('folder/a.md');
		}
	});

	it('read returns err for missing file', async () => {
		const adapter = new LocalStorageVaultAdapter();
		const result = await adapter.read('missing.md');
		expect(isErr(result)).toBe(true);
	});

	it('read extracts frontmatter', async () => {
		const adapter = new LocalStorageVaultAdapter();
		await adapter.create('fm.md', '---\ntitle: Test\ntags: a\n---\nBody');
		const result = await adapter.read('fm.md');
		if (isOk(result)) {
			expect(result.value.frontmatter.title).toBe('Test');
			expect(result.value.frontmatter.tags).toBe('a');
		}
	});
});
```

- [ ] **Step 2: Implement**

```ts
// src/infrastructure/vault/local-storage-vault-adapter.ts
import type { VaultFile, VaultPort } from '../../domain/shared/vault-port.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { extractFrontmatter } from './extract-frontmatter.js';

export class LocalStorageVaultAdapter implements VaultPort {
	private readonly files = new Map<string, { content: string; ctime: number; mtime: number }>();

	async read(path: string): Promise<Result<VaultFile, string>> {
		const f = this.files.get(path);
		if (!f) return err(`File not found: ${path}`);
		return ok({
			path,
			content: f.content,
			frontmatter: extractFrontmatter(f.content),
			stat: { size: f.content.length, ctime: f.ctime, mtime: f.mtime },
		});
	}

	async create(path: string, content: string): Promise<Result<void, string>> {
		if (this.files.has(path)) return err(`File already exists: ${path}`);
		this.files.set(path, { content, ctime: Date.now(), mtime: Date.now() });
		return ok(undefined);
	}

	async update(path: string, content: string): Promise<Result<void, string>> {
		const f = this.files.get(path);
		if (!f) return err(`File not found: ${path}`);
		this.files.set(path, { ...f, content, mtime: Date.now() });
		return ok(undefined);
	}

	async delete(path: string): Promise<Result<void, string>> {
		this.files.delete(path);
		return ok(undefined);
	}

	async exists(path: string): Promise<boolean> {
		return this.files.has(path);
	}

	async list(folder: string): Promise<Result<string[], string>> {
		return ok([...this.files.keys()].filter((k) => k.startsWith(folder)));
	}
}
```

- [ ] **Step 3: Run — verify 7 tests pass**

- [ ] **Step 4: Commit**: `feat(agentonomous): add LocalStorageVaultAdapter with frontmatter extraction`

### Task 2.3: ObsidianVaultAdapter

**Files:**
- Create: `src/infrastructure/obsidian/obsidian-vault-adapter.ts`
- Create: `tests/infrastructure/obsidian/obsidian-vault-adapter.test.ts`

- [ ] **Step 1: Implement the adapter**

The adapter wraps `this.app.vault.*` and `this.app.metadataCache.*`. The test stub in `tests/__stubs__/obsidian.ts` needs extensions: `TFile` class, `Vault` with `read/create/modify/delete/getAbstractFileByPath/getFiles`, `MetadataCache` with `getFileCache`. Add these to the stub.

The adapter uses Obsidian's built-in `metadataCache` for frontmatter (already parsed YAML — much richer than the line-based parser). Falls back to `extractFrontmatter` if the cache returns null.

- [ ] **Step 2: Write basic tests against the stub**

Test the same CRUD operations as LocalStorageVaultAdapter. The stub's `Vault` methods manipulate an in-memory Map, similar to the localStorage adapter.

- [ ] **Step 3: Update ESLint obsidian allowlist** for the new adapter file.

- [ ] **Step 4: Commit**: `feat(agentonomous): add ObsidianVaultAdapter`

### Task 2.4: File-type handlers (TDD — pure functions)

**Files:**
- Create: `src/modules/file-detail/handlers/csv-handler.ts`
- Create: `src/modules/file-detail/handlers/json-handler.ts`
- Create: `src/modules/file-detail/handlers/handler-registry.ts`
- Create: `tests/modules/file-detail/handlers/csv-handler.test.ts`
- Create: `tests/modules/file-detail/handlers/json-handler.test.ts`

- [ ] **Step 1: CSV handler tests**

```ts
import { describe, expect, it } from 'vitest';
import { csvHandler } from '../../../../src/modules/file-detail/handlers/csv-handler.js';

describe('csvHandler', () => {
	it('counts rows excluding header', () => {
		const result = csvHandler.analyze('name,age\nAlice,30\nBob,25', 'data.csv');
		expect(result.summary['Row count']).toBe(2);
	});

	it('counts columns from header', () => {
		const result = csvHandler.analyze('a,b,c\n1,2,3', 'data.csv');
		expect(result.summary['Column count']).toBe(3);
	});

	it('extracts column names', () => {
		const result = csvHandler.analyze('name,age,city\nA,1,X', 'data.csv');
		expect(result.summary['Columns']).toBe('name, age, city');
	});

	it('handles empty content', () => {
		const result = csvHandler.analyze('', 'empty.csv');
		expect(result.summary['Row count']).toBe(0);
	});
});
```

- [ ] **Step 2: JSON handler tests**

```ts
import { describe, expect, it } from 'vitest';
import { jsonHandler } from '../../../../src/modules/file-detail/handlers/json-handler.js';

describe('jsonHandler', () => {
	it('detects object type and key count', () => {
		const result = jsonHandler.analyze('{"a":1,"b":2}', 'data.json');
		expect(result.summary['Type']).toBe('object');
		expect(result.summary['Key count']).toBe(2);
	});

	it('detects array type and item count', () => {
		const result = jsonHandler.analyze('[1,2,3]', 'data.json');
		expect(result.summary['Type']).toBe('array');
		expect(result.summary['Item count']).toBe(3);
	});

	it('calculates max nesting depth', () => {
		const result = jsonHandler.analyze('{"a":{"b":{"c":1}}}', 'deep.json');
		expect(result.summary['Depth']).toBe(3);
	});

	it('handles invalid JSON gracefully', () => {
		const result = jsonHandler.analyze('not json', 'bad.json');
		expect(result.summary['Type']).toBe('invalid');
	});

	it('handles primitive type', () => {
		const result = jsonHandler.analyze('"hello"', 'str.json');
		expect(result.summary['Type']).toBe('string');
	});
});
```

- [ ] **Step 3: Implement both handlers + registry**

```ts
// csv-handler.ts
export const csvHandler: FileTypeHandler = {
	extension: 'csv',
	analyze(content: string, fileName: string): FileAnalysis {
		const lines = content.split('\n').filter((l) => l.trim().length > 0);
		const header = lines[0]?.split(',').map((c) => c.trim()) ?? [];
		return {
			fileName,
			extension: 'csv',
			sizeBytes: new TextEncoder().encode(content).length,
			summary: {
				'Row count': Math.max(0, lines.length - 1),
				'Column count': header.length,
				'Columns': header.join(', '),
			},
		};
	},
};
```

```ts
// json-handler.ts
export const jsonHandler: FileTypeHandler = {
	extension: 'json',
	analyze(content: string, fileName: string): FileAnalysis {
		const size = new TextEncoder().encode(content).length;
		try {
			const parsed: unknown = JSON.parse(content);
			const type = Array.isArray(parsed) ? 'array' : typeof parsed === 'object' && parsed !== null ? 'object' : typeof parsed;
			const summary: Record<string, string | number> = { Type: type };
			if (type === 'object') summary['Key count'] = Object.keys(parsed as object).length;
			if (type === 'array') summary['Item count'] = (parsed as unknown[]).length;
			summary['Depth'] = calcDepth(parsed);
			return { fileName, extension: 'json', sizeBytes: size, summary };
		} catch {
			return { fileName, extension: 'json', sizeBytes: size, summary: { Type: 'invalid' } };
		}
	},
};

function calcDepth(value: unknown, current = 0): number {
	if (typeof value !== 'object' || value === null) return current;
	const entries = Array.isArray(value) ? value : Object.values(value);
	if (entries.length === 0) return current + 1;
	return Math.max(...entries.map((v) => calcDepth(v, current + 1)));
}
```

```ts
// handler-registry.ts
import type { FileTypeHandler } from './types.js';  // or inline the type
import { csvHandler } from './csv-handler.js';
import { jsonHandler } from './json-handler.js';

const handlers = new Map<string, FileTypeHandler>([
	['csv', csvHandler],
	['json', jsonHandler],
]);

export function getHandler(extension: string): FileTypeHandler | undefined {
	return handlers.get(extension);
}
```

- [ ] **Step 4: Run — verify 9 handler tests pass**

- [ ] **Step 5: Commit**: `feat(agentonomous): add CSV + JSON file-type handlers`

### Task 2.5: ObsidianFileExtensionAdapter + File Detail module

**Files:**
- Create: `src/infrastructure/obsidian/obsidian-file-extension-adapter.ts`
- Create: `src/modules/file-detail/file-detail-module.ts`
- Create: `src/modules/file-detail/file-detail-settings.ts`
- Create: `src/modules/file-detail/file-detail-events.ts`
- Create: `src/modules/file-detail/views/file-detail-view.ts`
- Create: `src/modules/file-detail/views/FileDetailView.vue`
- Create: `src/modules/file-detail/locales/en.json`
- Create: `tests/modules/file-detail/file-detail-module.test.ts`

- [ ] **Step 1: Create the extension adapter**

```ts
// src/infrastructure/obsidian/obsidian-file-extension-adapter.ts
import type { Plugin } from 'obsidian';
import type { FileExtensionPort } from '../../domain/shared/file-extension-port.js';
import type { Unsubscribe } from '../../domain/shared/unsubscribe.js';

export class ObsidianFileExtensionAdapter implements FileExtensionPort {
	constructor(private readonly plugin: Plugin) {}

	register(extensions: readonly string[], viewType: string): Unsubscribe {
		this.plugin.registerExtensions(extensions as string[], viewType);
		return () => {};  // no deregistration API; Obsidian cleans up on unload
	}
}
```

- [ ] **Step 2: Create the File Detail module**

Settings type + validator + defaults. EventMap augmentation. Module definition using `defineModule`. Declares `extensions: [{ ext: 'csv', viewType }, { ext: 'json', viewType }]`.

The module's `init()` is minimal — logs that it's active. The handlers are pure functions called by the view at render time, not during init.

- [ ] **Step 3: Create the File Detail View**

`ItemView` subclass (`VIEW_TYPE_FILE_DETAIL`). `onOpen()` reads the file path from `this.getState()`, calls `vault.read(path)`, runs the handler, mounts a Vue app rendering `FileDetailView.vue`.

The Vue component renders a card with file name, size, summary key-value pairs, and an "Open in editor" button.

- [ ] **Step 4: Write module test**

Test that `init()` logs, `destroy()` cleans up. Test that the handler registry resolves csv and json.

- [ ] **Step 5: Update ESLint allowlist for new adapter**

- [ ] **Step 6: Commit**: `feat(agentonomous): add File Detail module with CSV + JSON handlers`

### Task 2.6: Wire everything in `main.ts`

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Wire new adapters and module**

```ts
import { ObsidianPlatformAdapter } from './infrastructure/obsidian/obsidian-platform-adapter.js';
import { ObsidianVaultAdapter } from './infrastructure/obsidian/obsidian-vault-adapter.js';
import { ObsidianFileExtensionAdapter } from './infrastructure/obsidian/obsidian-file-extension-adapter.js';
import { FileDetailModule } from './modules/file-detail/file-detail-module.js';

// In onload():
const platform = new ObsidianPlatformAdapter();
const vault = new ObsidianVaultAdapter(this.app);
const fileExtensions = new ObsidianFileExtensionAdapter(this);

// Pass to PluginCore:
this.core = new PluginCore(
	{ settings, commands, views, logger, notifications, eventBus: bus, platform, t: translationPort, vault, i18nMerge: ... },
	[CoreModule, EventInspectorModule, HealthMonitorModule, FileDetailModule],
);

// After core.init() and views.registerAll():
this.core.registerExtensions(fileExtensions);
```

- [ ] **Step 2: Register File Detail View in ViewRegistry entries**

Add the File Detail view entry alongside Homepage and Event Inspector views.

- [ ] **Step 3: Run `npm test` — verify all green**

- [ ] **Step 4: Run `npm run build` — verify dist/ is clean**

- [ ] **Step 5: Commit**: `feat(agentonomous): wire platform, vault, i18n, file-detail into shell`

### Task 2.7: Final quality gate

- [ ] **Step 1: Full suite with coverage**

```bash
npx vitest run --config configs/vitest.config.ts --coverage
```

Expected: ~225+ tests, coverage >= 80/70/80/80.

- [ ] **Step 2: Build + lint + npm test**

All green, exit 0.

- [ ] **Step 3: Commit any final adjustments**

---

## Done

Increment 4b ships:
- PlatformPort (locale from Obsidian)
- vue-i18n integration with TranslationPort, per-module locale files, locale bridging
- All user-facing strings externalized to locale files
- FileExtensionPort + ObsidianFileExtensionAdapter
- File Detail module with CSV + JSON pure-function handlers + File Detail View
- VaultPort with ObsidianVaultAdapter + LocalStorageVaultAdapter + shared test suite
- extractFrontmatter utility with edge-case coverage

Spec acceptance criteria 1-11 satisfied.
