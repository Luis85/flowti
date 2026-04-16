---
title: Agentonomous — Platform Integration (Increment 4b)
date: 2026-04-16
status: approved-for-planning
author: Luis Mendez
project: Agentonomous
---

# Agentonomous — Platform Integration (Increment 4b)

## 1. Purpose & Scope

Increment 4a shipped 8 hardening mechanisms. Increment 4b adds **platform integration**: internationalization, platform-state bridging, file-extension handling, and vault access — the infrastructure modules need to interact with Obsidian's content layer.

**In scope (4 items)**
1. PlatformPort (locale from Obsidian)
2. Internationalization via vue-i18n (per-module locales, TranslationPort, locale bridging)
3. File extension registry + File Detail View (.csv, .json handlers)
4. Vault service (CRUD + frontmatter parsing, Obsidian + localStorage dual backend)

**Out of scope**
- Additional locales beyond English (framework ships `en` only; translations are a content task)
- File editing (File Detail View is read-only)
- Additional file types beyond .csv and .json
- Rich document model / dirty tracking (consumers type-narrow frontmatter themselves)
- Module scaffold wizard (separate increment)

## 2. PlatformPort

### 2.1 Interface (`src/domain/shared/platform-port.ts`)

```ts
interface PlatformPort {
    readonly locale: string;
}
```

Only `locale` ships this increment. Additional fields (`vaultPath`, `isDarkTheme`, `isMobile`, `prefersReducedMotion`) are added when a consuming module exists.

### 2.2 Obsidian adapter (`src/infrastructure/obsidian/obsidian-platform-adapter.ts`)

```ts
class ObsidianPlatformAdapter implements PlatformPort {
    get locale(): string {
        return window.moment?.locale() ?? navigator.language?.split('-')[0] ?? 'en';
    }
}
```

### 2.3 Integration

- Added to `ModulePorts` as `platform: PlatformPort`.
- Added to `CorePorts` (PluginCore receives it).
- `fakeModulePorts()` gains `fakePlatform()` returning `{ locale: 'en' }`.
- Shell (`main.ts`) creates `ObsidianPlatformAdapter` and passes to PluginCore.

## 3. Internationalization (vue-i18n)

### 3.1 Library

`vue-i18n` (latest version compatible with Vue 3.5 + Vite 8) as a devDependency (Vite bundles it). Plus `@intlify/unplugin-vue-i18n` for build-time message compilation.

### 3.2 Two access patterns, one instance

```
Shell (main.ts)
  createI18n({ locale, fallbackLocale: 'en', messages }) → i18n
  Passes i18n.global.t to TranslationPort
  Installs i18n on Vue app via app.use(i18n)

Domain/Core         UI (Vue)
  ports.t.t(key)      useI18n() / {{ $t('key') }}
```

### 3.3 TranslationPort (`src/domain/shared/translation-port.ts`)

```ts
interface TranslationPort {
    t(key: string, params?: Record<string, unknown>): string;
    readonly locale: string;
}
```

Added to `ModulePorts` as `t: TranslationPort`. `fakeModulePorts()` gains `fakeTranslation()` returning `{ t: (key) => key, locale: 'en' }`.

### 3.4 Per-module locale files

Each module declares `messages` on the Module interface:

```ts
interface Module {
    // ... existing fields ...
    readonly messages?: Record<string, Record<string, string>>;
}
```

Example:
```ts
messages: {
    en: {
        'core.settings.showRibbonIcon': 'Show ribbon icon',
        'core.settings.logLevel': 'Log level',
    },
}
```

`PluginCore.init()` merges all modules' messages via `i18n.global.mergeLocaleMessage(locale, messages)`.

Locale files live in each module's folder:
```
src/modules/core/locales/en.json
src/modules/event-inspector/locales/en.json
src/modules/health-monitor/locales/en.json
src/modules/file-detail/locales/en.json
```

### 3.5 Locale selection

`CoreSettings` gains an optional `locale` field:
- When absent from persisted blob → `PlatformPort.locale` is used (Obsidian's language).
- When present as string → overrides.
- `validateCoreSettings` uses `'locale' in raw` narrowing (not `!== undefined`) for `exactOptionalPropertyTypes` compatibility.
- Settings tab shows "Language" dropdown with "Auto (from Obsidian)" as first option.
- `createI18n({ fallbackLocale: 'en' })` — silently falls back to English when locale has no translation.

### 3.6 Refactoring existing hardcoded strings

All user-facing strings move to locale files:
- Settings tab labels and descriptions
- Command names (`'Open homepage'`, `'Toggle event inspector'`, `'Show health status'`)
- View display names (`'Agentonomous homepage'`, `'Event inspector'`)
- Notice messages (ErrorHandler, settings tab)

Developer-only log messages (`console.*` output) stay in English — same convention as Symfony.

### 3.7 i18n in the shell

`main.ts` creates the i18n instance before PluginCore:
```ts
const i18n = createI18n({
    locale: platformAdapter.locale,
    fallbackLocale: 'en',
    messages: {},
});
```

After `core.init()` (which merges module messages), `createVueApp` installs `i18n` on the Vue app.

The `TranslationPort` implementation wraps `i18n.global.t`:
```ts
const translationPort: TranslationPort = {
    t: (key, params) => i18n.global.t(key, params ?? {}),
    get locale() { return i18n.global.locale; },
};
```

## 4. File Extension Registry + File Detail View

### 4.1 FileExtensionPort (`src/domain/shared/file-extension-port.ts`)

```ts
interface FileExtensionPort {
    register(extensions: readonly string[], viewType: string): Unsubscribe;
}
```

### 4.2 Obsidian adapter

```ts
class ObsidianFileExtensionAdapter implements FileExtensionPort {
    constructor(private plugin: Plugin) {}
    register(extensions: readonly string[], viewType: string): Unsubscribe {
        this.plugin.registerExtensions(extensions, viewType);
        return () => {};
    }
}
```

### 4.3 Module interface addition

```ts
interface Module {
    // ... existing fields ...
    readonly extensions?: readonly FileExtensionEntry[];
}

type FileExtensionEntry = {
    readonly ext: string;
    readonly viewType: string;
};
```

`PluginCore.init()` collects all modules' `extensions` arrays and registers them via `FileExtensionPort`.

### 4.4 File-type handlers (pure functions)

```ts
type FileAnalysis = {
    readonly fileName: string;
    readonly extension: string;
    readonly sizeBytes: number;
    readonly summary: Record<string, string | number>;
};

type FileTypeHandler = {
    readonly extension: string;
    analyze(content: string, fileName: string): FileAnalysis;
};
```

**CSV handler** returns: row count (excl. header), column count, column names, file size.

**JSON handler** returns: top-level type (`object`/`array`/`primitive`), key count or item count, max nesting depth, file size.

Both live in `src/modules/file-detail/handlers/`. Pure functions, zero Obsidian imports, easily testable.

**Handler registry:** `src/modules/file-detail/handlers/handler-registry.ts` maps extension → handler. Adding a new handler = one entry in the registry + one handler file.

### 4.5 File Detail module

```
src/modules/file-detail/
├── file-detail-module.ts
├── file-detail-settings.ts       # { enabled: boolean }
├── file-detail-events.ts         # EventMap augmentation
├── handlers/
│   ├── csv-handler.ts
│   ├── json-handler.ts
│   └── handler-registry.ts
├── views/
│   ├── file-detail-view.ts       # ItemView subclass
│   └── FileDetailView.vue        # summary panel
└── locales/
    └── en.json
```

The module declares:
```ts
extensions: [
    { ext: 'csv', viewType: VIEW_TYPE_FILE_DETAIL },
    { ext: 'json', viewType: VIEW_TYPE_FILE_DETAIL },
],
```

### 4.6 File Detail View UI

`FileDetailView.vue` renders a card:
- File name + extension badge
- Size in human-readable format
- Summary key-value pairs as a definition list
- "Open in editor" button → opens the file in Obsidian's default editor

Styled with Obsidian CSS variables. Minimal — utility view, not a rich editor.

## 5. Vault Service

### 5.1 VaultPort (`src/domain/shared/vault-port.ts`)

```ts
type VaultFile = {
    readonly path: string;
    readonly content: string;
    readonly frontmatter: Record<string, unknown>;
    readonly stat: { readonly size: number; readonly ctime: number; readonly mtime: number };
};

interface VaultPort {
    read(path: string): Promise<Result<VaultFile, string>>;
    create(path: string, content: string): Promise<Result<void, string>>;
    update(path: string, content: string): Promise<Result<void, string>>;
    delete(path: string): Promise<Result<void, string>>;
    exists(path: string): Promise<boolean>;
    list(folder: string): Promise<Result<string[], string>>;
}
```

### 5.2 ObsidianVaultAdapter

```ts
class ObsidianVaultAdapter implements VaultPort {
    constructor(private app: App) {}

    async read(path: string): Promise<Result<VaultFile, string>> {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!file || !(file instanceof TFile)) return err(`File not found: ${path}`);
        const content = await this.app.vault.read(file);
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        const stat = { size: file.stat.size, ctime: file.stat.ctime, mtime: file.stat.mtime };
        return ok({ path, content, frontmatter, stat });
    }

    async create(path: string, content: string): Promise<Result<void, string>> {
        try {
            await this.app.vault.create(path, content);
            return ok(undefined);
        } catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    }

    // update, delete, exists, list follow same pattern
}
```

### 5.3 LocalStorageVaultAdapter (headless/testing fallback)

```ts
class LocalStorageVaultAdapter implements VaultPort {
    private files = new Map<string, { content: string; ctime: number; mtime: number }>();

    // CRUD operates on the Map
    // Frontmatter extracted by splitting content on --- fences and parsing YAML header
}
```

Frontmatter extraction:
```ts
function extractFrontmatter(content: string): Record<string, unknown> {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};
    // Parse YAML key: value pairs (simple line-based parser, no library needed for flat frontmatter)
    // For nested YAML: use the yaml package if available, or return raw strings
}
```

For this increment, a simple line-based parser handles flat `key: value` frontmatter. Nested YAML is returned as unparsed strings. If the `yaml` package is needed later, it's added as a devDependency.

### 5.4 Integration

- Added to `ModulePorts` as `vault: VaultPort`.
- Added to `CorePorts`.
- `fakeModulePorts()` gains `fakeVault()` wrapping `LocalStorageVaultAdapter`.
- Shell (`main.ts`) creates `ObsidianVaultAdapter(this.app)`.
- The File Detail module uses `ports.vault.read(path)` to load file content for analysis.

### 5.5 Shared test suite

Both adapters pass the same abstract test suite:

```ts
function vaultPortTests(createAdapter: () => VaultPort) {
    it('create + read round-trips', async () => { ... });
    it('update modifies content', async () => { ... });
    it('delete removes the file', async () => { ... });
    it('exists returns true/false', async () => { ... });
    it('list returns files in folder', async () => { ... });
    it('read extracts frontmatter', async () => { ... });
    it('read returns err for missing file', async () => { ... });
}
```

`LocalStorageVaultAdapter` tests run this suite directly. `ObsidianVaultAdapter` tests run against the obsidian test stub.

## 6. File Inventory

### New files

```
src/domain/shared/platform-port.ts
src/domain/shared/translation-port.ts
src/domain/shared/file-extension-port.ts
src/domain/shared/vault-port.ts
src/infrastructure/obsidian/obsidian-platform-adapter.ts
src/infrastructure/obsidian/obsidian-file-extension-adapter.ts
src/infrastructure/obsidian/obsidian-vault-adapter.ts
src/infrastructure/vault/local-storage-vault-adapter.ts
src/infrastructure/vault/extract-frontmatter.ts
src/modules/file-detail/file-detail-module.ts
src/modules/file-detail/file-detail-settings.ts
src/modules/file-detail/file-detail-events.ts
src/modules/file-detail/handlers/csv-handler.ts
src/modules/file-detail/handlers/json-handler.ts
src/modules/file-detail/handlers/handler-registry.ts
src/modules/file-detail/views/file-detail-view.ts
src/modules/file-detail/views/FileDetailView.vue
src/modules/file-detail/locales/en.json
src/modules/core/locales/en.json
src/modules/event-inspector/locales/en.json
src/modules/health-monitor/locales/en.json
```

### Modified files

```
src/domain/shared/module.ts              # messages, extensions fields
src/core/plugin-core.ts                  # i18n merge, extension registration
src/main.ts                              # createI18n, PlatformPort, VaultPort, FileExtensionPort wiring
src/plugin.ts                            # PluginContext gains t, platform, vault
src/ui/app.ts                            # app.use(i18n)
src/infrastructure/settings/settings-tab.ts   # use t() for labels
src/modules/core/core-module.ts          # messages field
src/modules/event-inspector/event-inspector-module.ts  # messages field
src/modules/health-monitor/health-monitor-module.ts    # messages field
src/domain/settings/plugin-settings.ts   # optional locale field
configs/eslint.config.mjs                # allowlist for new adapters
package.json                             # vue-i18n dependency
tests/__fakes__/fake-ports.ts            # fakeTranslation, fakePlatform, fakeVault
tests/__stubs__/obsidian.ts              # TFile, vault mock surface
```

## 7. Acceptance Criteria

1. `PlatformPort.locale` returns Obsidian's locale in shell, `'en'` in tests.
2. vue-i18n installed; `useI18n()` works in Vue components; `ports.t.t('key')` works in modules.
3. All user-facing strings come from locale files.
4. CoreSettings `locale` optional override works; settings tab shows Language dropdown.
5. `.csv` file click opens File Detail View with row/column/header info.
6. `.json` file click opens File Detail View with type/count/depth info.
7. File-type handlers are pure functions with dedicated tests.
8. `VaultPort.read()` returns `VaultFile` with parsed frontmatter.
9. `VaultPort.create/update/delete/exists/list` work via Obsidian adapter.
10. `LocalStorageVaultAdapter` passes the same test suite as the Obsidian adapter.
11. `npm test` green, coverage >= 80/70/80/80.

## 8. Risks

- **vue-i18n version resolution** — pin to latest compatible with Vue 3.5 + Vite 8; if resolution fails, stop and report (same protocol as Increment 1).
- **Obsidian `registerExtensions` behavior** — some extensions (.md, .json) may already be claimed by Obsidian core. If `.json` conflicts, fall back to a context-menu command instead of auto-opening.
- **Frontmatter parsing in LocalStorageVaultAdapter** — the simple line-based parser handles flat `key: value` only. Nested YAML returns unparsed strings. Sufficient for the skeleton; upgrade to `yaml` package when needed.
- **`exactOptionalPropertyTypes` + `locale?` field** — the `'locale' in raw` narrowing pattern must be used consistently; `raw.locale !== undefined` will fail compilation.

## 9. Next Step

After this spec is approved, the `writing-plans` skill produces the implementation plan.
