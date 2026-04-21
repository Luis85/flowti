# Folder Field Kind + Make Settings Autocomplete — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `folder` field kind to the generic settings-schema renderer, backed by a new `DialogPort.pickFolder` method that opens Obsidian's `SuggestModal` over vault folders. Migrate Make's three folder fields (`typesFolder`, `basesFolder`, `defaultInstancesRoot`) to the new kind.

**Architecture:** Layered. Domain defines the port method and the kind; infrastructure implements the Obsidian adapter (`FolderSuggestModal` + `pickFolder`) and renders the new kind (`renderFolder`) inside the existing `renderSettingsSchema` dispatch; the settings tab threads the port callback into the renderer; Make's module declaration swaps `text` → `folder`. Zero Vue, zero new UI surface, zero data migration.

**Tech Stack:** TypeScript (strict), Obsidian 1.x plugin API (`SuggestModal`, `PluginSettingTab`, `Setting`), Vitest, ESLint, existing project conventions (tabs, `.js` ESM imports, `Result<T, E>` where appropriate, no `try/catch` in `src/modules/`).

**Spec:** `docs/specs/2026-04-20-folder-field-kind-design.md`

> **Convention reminder:** the project uses **tabs** for indentation (see `CLAUDE.md`). Code snippets in this plan are shown with 4-space indent for readability — convert to tabs when pasting, or your editor will do it if `editor.detectIndentation` matches the surrounding file. ESLint will not flag the difference but git diffs become noisy.
>
> **Locale-file format:** `src/modules/core/locales/en.json` is a **flat dotted-key dictionary** (e.g. `"core.settings.showRibbonIcon": "Show ribbon icon"`), not nested objects. Any new key added in this plan must follow that convention.

---

## File Structure

**Create:**
- None. Every change lives in an existing file.

**Modify — source:**
- `src/domain/shared/dialog-port.ts` — add `pickFolder` + `PickFolderOptions` types
- `src/domain/settings/settings-schema.ts` — add `FolderField` to the `SettingsField` union
- `src/infrastructure/obsidian/obsidian-dialog-adapter.ts` — add `FolderSuggestModal` class + `pickFolder` method
- `src/infrastructure/settings/render-settings-schema.ts` — add `options` parameter + `renderFolder` function + `'folder'` case in the dispatcher
- `src/infrastructure/settings/settings-tab.ts` — constructor takes `DialogPort`, threads `pickFolder` through to the renderer
- `src/modules/make/make-module.ts` — change three path fields from `kind: 'text'` to `kind: 'folder'`
- `src/modules/core/locales/en.json` — add `settings.folder.browse` and `settings.folder.pickTitle`
- `src/main.ts` (line 151) — pass `dialogPort` into the `AgentonomousSettingsTab` constructor

**Modify — tests:**
- `tests/__stubs__/obsidian.ts` — add `SuggestModal` class stub + `Vault.getAllLoadedFiles` method
- `tests/__fakes__/fake-ports.ts` — extend `fakeDialogs` with `pickedFolder` option and `pickFolder` method
- `tests/infrastructure/obsidian/obsidian-dialog-adapter.test.ts` — new test cases for `pickFolder`
- `tests/infrastructure/settings/render-settings-schema.test.ts` — new test cases for `folder` kind
- `tests/infrastructure/settings/settings-tab.test.ts` — new test cases for the DialogPort wiring
- `tests/modules/make/make-module.test.ts` — update the assertion that enumerates field kinds

Each file has one focused responsibility. No file grows beyond its existing responsibility envelope; the biggest additions are ~45 lines (`renderSettingsSchema` gains `renderFolder`) and ~40 lines (`obsidian-dialog-adapter` gains `FolderSuggestModal`).

---

## Project commands (expected output)

Run from `cd "01 - Projects/Agentonomous"`:

```bash
npm run typecheck      # tsc --noEmit         (expect: silent)
npm run lint           # eslint src/ tests/ stories/  (expect: 0 errors, 0 warnings)
npm run docs           # typedoc              (expect: 0 errors, 1 third-party warning)
npx vitest run         # full suite           (expect: 1212 → 1221 passing, 135 → 136 files)
```

Test-file-specific invocations are called out per task.

Baseline before this plan starts: **1212 passing, 135 files, 0 lint errors, 0 lint warnings, 0 typedoc errors.**

---

## Chunk 1: Port, test harness, adapter

### Task 1: Extend test stubs — `SuggestModal` + `Vault.getAllLoadedFiles`

**Files:**
- Modify: `tests/__stubs__/obsidian.ts`

Pure test-infrastructure change. Downstream tasks consume these symbols; no standalone test.

- [ ] **Step 1: Add `getAllLoadedFiles` to the `Vault` stub**

In `tests/__stubs__/obsidian.ts`, inside `class Vault` (currently ends around line 286), add anywhere after `getFiles()` (before `_listeners`):

```typescript
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
```

- [ ] **Step 2: Add a minimal `SuggestModal` class stub that extends `Modal`**

Add after the `Modal` class (after line 175). Extending `Modal` inherits the `open()`/`close()` semantics and lets subclasses override `onClose()` without the runtime landmine of calling `super.onClose()` against a class that lacks it.

```typescript
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
```

- [ ] **Step 3: Run the test suite — should still pass unchanged**

```bash
cd "01 - Projects/Agentonomous" && npm run typecheck
```
Expected: silent.

```bash
npx vitest run
```
Expected: 1212/1212 still passing. The new stub symbols are not yet imported anywhere.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Agentonomous/tests/__stubs__/obsidian.ts"
git commit -m "$(cat <<'EOF'
test(agentonomous): stub SuggestModal + Vault.getAllLoadedFiles for folder-picker tests

Preparation for the folder field kind. Matches Obsidian's API shape; tests
drive selection via _chooseSuggestion(value) or _closeWithoutChoice().

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Extend `DialogPort` interface + `fakeDialogs`

**Files:**
- Modify: `src/domain/shared/dialog-port.ts`
- Modify: `tests/__fakes__/fake-ports.ts`

Single atomic change: adding the interface method with its fake implementation in one commit keeps every consumer of `DialogPort` compilable.

- [ ] **Step 1: Add `PickFolderOptions` + `pickFolder` to `DialogPort`**

In `src/domain/shared/dialog-port.ts`, append to the existing exports:

```typescript
export type PickFolderOptions = {
    /** Modal title / placeholder shown in the suggest UI. */
    readonly title?: string;
};
```

And add to the `DialogPort` interface, after `prompt`:

```typescript
/**
 * Open a folder-picker over the vault's folders. Resolves with the chosen
 * folder path (without trailing slash), or `null` if the user dismissed
 * the modal. Root folder is returned as the empty string `""`.
 */
pickFolder(opts?: PickFolderOptions): Promise<string | null>;
```

- [ ] **Step 2: Extend `fakeDialogs` with `pickedFolder` option**

In `tests/__fakes__/fake-ports.ts`, change the existing:

```typescript
export function fakeDialogs(overrides?: { confirm?: boolean; prompt?: string | null }): DialogPort {
    return {
        confirm: vi.fn(async () => overrides?.confirm ?? false),
        prompt: vi.fn(async () => overrides?.prompt ?? null),
    };
}
```

to:

```typescript
export function fakeDialogs(overrides?: { confirm?: boolean; prompt?: string | null; pickedFolder?: string | null }): DialogPort {
    return {
        confirm:    vi.fn(async () => overrides?.confirm ?? false),
        prompt:     vi.fn(async () => overrides?.prompt ?? null),
        pickFolder: vi.fn(async () => overrides?.pickedFolder ?? null),
    };
}
```

- [ ] **Step 3: Verify typecheck — the Obsidian adapter now fails to compile (expected)**

```bash
cd "01 - Projects/Agentonomous" && npm run typecheck 2>&1 | head -10
```

Expected: exactly one error reporting that `ObsidianDialogAdapter` does not implement `pickFolder`. Example:

```
src/infrastructure/obsidian/obsidian-dialog-adapter.ts:4:14 - error TS2420:
Class 'ObsidianDialogAdapter' incorrectly implements interface 'DialogPort'.
    Property 'pickFolder' is missing in type 'ObsidianDialogAdapter' but required in type 'DialogPort'.
```

This is the intentional signal that Task 3 is the next step.

- [ ] **Step 4: No commit yet**

Task 3 lands the adapter implementation; these two changes commit together there. *(Alternative: commit both changes from Task 2 now and accept a transiently broken tsc on a single commit. Chosen convention here — commit once implementations exist.)*

---

### Task 3: TDD — `FolderSuggestModal` + `ObsidianDialogAdapter.pickFolder`

**Files:**
- Modify: `src/infrastructure/obsidian/obsidian-dialog-adapter.ts`
- Modify: `tests/infrastructure/obsidian/obsidian-dialog-adapter.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/infrastructure/obsidian/obsidian-dialog-adapter.test.ts`. Use the existing test-file conventions (check the top of the file for imports + the App stub pattern). Every new test resets `_openModals` at the top to avoid cross-test leaks.

```typescript
describe('ObsidianDialogAdapter.pickFolder', () => {
    beforeEach(() => { _openModals.splice(0); });

    it('resolves the chosen folder path', async () => {
        const app = new App();
        await app.vault.createFolder('Make');
        await app.vault.createFolder('Make/Types');
        const adapter = new ObsidianDialogAdapter(app as never);
        const promise = adapter.pickFolder({ title: 'Pick' });
        const modal = _openModals[_openModals.length - 1] as unknown as SuggestModal<string>;
        modal._chooseSuggestion('Make/Types');
        expect(await promise).toBe('Make/Types');
    });

    it('resolves null when the modal closes without a choice', async () => {
        const app = new App();
        const adapter = new ObsidianDialogAdapter(app as never);
        const promise = adapter.pickFolder();
        const modal = _openModals[_openModals.length - 1] as unknown as SuggestModal<string>;
        modal._closeWithoutChoice();
        expect(await promise).toBeNull();
    });

    it('suggest list includes existing folders and root as "/"', async () => {
        const app = new App();
        await app.vault.createFolder('Make');
        await app.vault.createFolder('Make/Types');
        const adapter = new ObsidianDialogAdapter(app as never);
        const promise = adapter.pickFolder();
        const modal = _openModals[_openModals.length - 1] as unknown as SuggestModal<string>;
        const all = await modal.getSuggestions('');
        expect(all).toContain('Make');
        expect(all).toContain('Make/Types');
        expect(all).toContain('/');  // root folder is always loaded in the stub
        // Resolve the promise so it doesn't leak into the next test
        modal._closeWithoutChoice();
        await promise;
    });

    it('maps "/" selection back to empty string through the port contract', async () => {
        const app = new App();
        const adapter = new ObsidianDialogAdapter(app as never);
        const promise = adapter.pickFolder();
        const modal = _openModals[_openModals.length - 1] as unknown as SuggestModal<string>;
        modal._chooseSuggestion('/');
        expect(await promise).toBe('');
    });

    it('query filter is case-insensitive', async () => {
        const app = new App();
        await app.vault.createFolder('Notes');
        await app.vault.createFolder('MAKE');
        const adapter = new ObsidianDialogAdapter(app as never);
        const promise = adapter.pickFolder();
        const modal = _openModals[_openModals.length - 1] as unknown as SuggestModal<string>;
        const results = await modal.getSuggestions('make');
        expect(results).toContain('MAKE');
        modal._closeWithoutChoice();
        await promise;
    });
});
```

Ensure `SuggestModal`, `_openModals`, and `beforeEach` are imported at the top of the test file:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { App, _openModals, SuggestModal } from '../../__stubs__/obsidian.js';
```

(The existing file imports some of these already — merge, don't duplicate.)

- [ ] **Step 2: Run the tests — they should fail**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/infrastructure/obsidian/obsidian-dialog-adapter.test.ts
```

Expected: compile / runtime failures complaining that `adapter.pickFolder` is not a function (since the adapter doesn't implement it yet).

- [ ] **Step 3: Implement `FolderSuggestModal` and `pickFolder`**

In `src/infrastructure/obsidian/obsidian-dialog-adapter.ts`:

At the top, extend the imports:

```typescript
import { type App, Modal, Setting, SuggestModal, TFolder } from 'obsidian';
import type { DialogPort, ConfirmOptions, PromptOptions, PickFolderOptions } from '../../domain/shared/dialog-port.js';
```

Add the method inside the class (after `prompt`, before the closing brace of `ObsidianDialogAdapter`):

```typescript
pickFolder(opts?: PickFolderOptions): Promise<string | null> {
    return new FolderSuggestModal(this.app, opts?.title ?? 'Pick a folder').run();
}
```

Add a new class at the bottom of the file (after `PromptModal`):

```typescript
class FolderSuggestModal extends SuggestModal<string> {
    private resolver: ((v: string | null) => void) | null = null;
    private resolved = false;

    constructor(app: App, title: string) {
        super(app);
        this.setPlaceholder(title);
    }

    // `run()` is not part of Obsidian's SuggestModal API — it's a local
    // helper that wraps the base-class `open()` call in a Promise the
    // adapter can await.
    run(): Promise<string | null> {
        return new Promise((resolve) => {
            this.resolver = resolve;
            this.open();
        });
    }

    getSuggestions(query: string): string[] {
        const app = this.app as App;
        const folders = app.vault.getAllLoadedFiles()
            .filter((f): f is TFolder => f instanceof TFolder)
            .map((f) => f.path === '' ? '/' : f.path);
        const q = query.toLowerCase();
        return folders.filter((p) => p.toLowerCase().includes(q)).sort();
    }

    renderSuggestion(path: string, el: HTMLElement): void {
        el.setText(path);
    }

    onChooseSuggestion(path: string): void {
        this.resolved = true;
        this.resolver?.(path === '/' ? '' : path);
    }

    // Note: matches the ConfirmModal / PromptModal convention in this file —
    // we do NOT call super.onClose(). Real Obsidian Modal.onClose is a no-op
    // override point; the test stub's Modal likewise defines no onClose, so
    // calling super.onClose() would throw at test runtime.
    onClose(): void {
        if (!this.resolved) this.resolver?.(null);
    }
}
```

- [ ] **Step 4: Run the tests — they should pass**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/infrastructure/obsidian/obsidian-dialog-adapter.test.ts
```

Expected: all `pickFolder` cases pass + existing `confirm` / `prompt` cases still pass.

- [ ] **Step 5: Verify typecheck + lint are clean**

```bash
cd "01 - Projects/Agentonomous" && npm run typecheck && npm run lint
```

Expected: both silent / zero warnings.

- [ ] **Step 6: Commit — Chunk 1 done**

```bash
git add "01 - Projects/Agentonomous/src/domain/shared/dialog-port.ts" "01 - Projects/Agentonomous/src/infrastructure/obsidian/obsidian-dialog-adapter.ts" "01 - Projects/Agentonomous/tests/__fakes__/fake-ports.ts" "01 - Projects/Agentonomous/tests/infrastructure/obsidian/obsidian-dialog-adapter.test.ts"
git commit -m "$(cat <<'EOF'
feat(agentonomous): DialogPort.pickFolder + Obsidian SuggestModal adapter

Adds the folder-picker primitive that backs the upcoming `folder` settings
field kind. ObsidianDialogAdapter opens a SuggestModal over every TFolder
returned by Vault.getAllLoadedFiles; root folder is shown as "/" in the
suggest UI but always returned as "" through the port contract. Dismiss
resolves null.

fakeDialogs gains a pickedFolder override so consumers can pre-program
returns without caring about the modal internals.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 2: Field kind, renderer, settings-tab, Make migration

### Task 4: Add `'folder'` kind to the `SettingsField` union

**Files:**
- Modify: `src/domain/settings/settings-schema.ts`

Tiny type-only change. Downstream tasks consume it. No unit test dedicated to the union shape — compile-level safety is the proof.

- [ ] **Step 1: Add `FolderField` type**

In `src/domain/settings/settings-schema.ts`, after `NumberField` (line 51):

```typescript
export type FolderField = {
    readonly kind: 'folder';
    readonly key: string;
    readonly label: string;
    readonly description?: string;
    readonly placeholder?: string;
};
```

And extend the union:

```typescript
export type SettingsField =
    | ToggleField
    | DropdownField
    | TextField
    | NumberField
    | FolderField;
```

- [ ] **Step 2: Verify typecheck — `renderField` dispatch will now complain about missing case**

```bash
cd "01 - Projects/Agentonomous" && npm run typecheck 2>&1 | head -10
```

Expected: a narrow error in `render-settings-schema.ts` about `field.kind` not being exhaustively handled. This is the intentional signal that Task 6 is next.

- [ ] **Step 3: No commit yet**

The renderer change (Task 6) pairs with this; they commit together.

---

### Task 5: Add locale keys

**Files:**
- Modify: `src/modules/core/locales/en.json`

- [ ] **Step 1: Inspect the current file to confirm the key-style convention**

```bash
cd "01 - Projects/Agentonomous" && cat src/modules/core/locales/en.json | head -20
```

Expected: the file is a **flat dotted-key dictionary** (e.g. `"core.settings.showRibbonIcon": "Show ribbon icon"`). The folder-kind renderer reads `t('settings.folder.browse')` and `t('settings.folder.pickTitle')` — add both as flat keys.

- [ ] **Step 2: Add the two keys as flat dotted-keys (NOT nested objects)**

Append inside the existing top-level object, preserving trailing-comma discipline:

```json
"settings.folder.browse": "Browse…",
"settings.folder.pickTitle": "Pick a folder"
```

Placement: anywhere inside the object. If the file groups keys by prefix, add them next to other `settings.*` or `core.settings.*` entries. Valid JSON is the only requirement — lookup is key-exact, not structural.

- [ ] **Step 3: Validate the JSON**

```bash
cd "01 - Projects/Agentonomous" && node -e "JSON.parse(require('fs').readFileSync('src/modules/core/locales/en.json'))" && echo "valid"
```

Expected: `valid`.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Agentonomous/src/modules/core/locales/en.json"
git commit -m "$(cat <<'EOF'
i18n(agentonomous): add settings.folder.browse + pickTitle keys

Preparation for the folder field kind in the generic settings renderer.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: TDD — `renderFolder` + `options` parameter

**Files:**
- Modify: `src/infrastructure/settings/render-settings-schema.ts`
- Modify: `tests/infrastructure/settings/render-settings-schema.test.ts`

- [ ] **Step 1: Extend the stub's `Setting.addText` to expose a trigger hook**

The existing stub's `addText` returns a minimal object but doesn't expose an `onChange` hook we can call from tests. Look at `tests/__stubs__/obsidian.ts` around line 142 — the `addText` method returns a bare `txt` with no trigger. For these tests to assert typing behavior, we need a `_trigger(value)` method similar to `addToggle` / `addDropdown`.

Update `tests/__stubs__/obsidian.ts` — replace the `addText` method with:

```typescript
/** Exposed for tests: all text components created by this Setting instance. */
_texts: Array<{
    _onChange: ((value: string) => void) | null;
    _value: string;
    setValue(v: string): this;
    setPlaceholder(v: string): this;
    onChange(fn: (value: string) => void): this;
    _trigger(value: string): void;
    inputEl: { addEventListener(ev: string, fn: (e: KeyboardEvent) => void): void };
}> = [];

addText(cb: (t: Setting['_texts'][number]) => void): this {
    const txt: Setting['_texts'][number] = {
        _onChange: null,
        _value: '',
        setValue(v: string) { this._value = v; return this; },
        setPlaceholder(_v: string) { return this; },
        onChange(fn: (v: string) => void) { this._onChange = fn; return this; },
        _trigger(value: string) { this._value = value; this._onChange?.(value); },
        inputEl: { addEventListener(_ev: string, _fn: (e: KeyboardEvent) => void) {} },
    };
    cb(txt);
    this._texts.push(txt);
    return this;
}
```

- [ ] **Step 2: Run the existing suite to confirm the stub change didn't regress anything**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/infrastructure/settings/
```

Expected: existing tests still pass (they don't rely on the absence of `_texts`).

- [ ] **Step 3: Write the failing tests for `renderFolder`**

Append to `tests/infrastructure/settings/render-settings-schema.test.ts`:

```typescript
describe('renderSettingsSchema — folder kind', () => {
    it('renders a text input + Browse button when pickFolder is provided', () => {
        const container = document.createElement('div');
        const onChange = vi.fn();
        const pickFolder = vi.fn(async () => null);
        renderSettingsSchema(
            container,
            { title: 'Make', fields: [{ kind: 'folder', key: 'typesFolder', label: 'Types folder' }] },
            { typesFolder: 'Make/Types' },
            onChange,
            { pickFolder },
        );
        const settings = _settingsByContainer.get(container) ?? [];
        const folderSetting = settings.at(-1)!;
        expect(folderSetting._texts).toHaveLength(1);
        expect(folderSetting._buttons).toHaveLength(1);
    });

    it('omits the Browse button when pickFolder is not provided', () => {
        const container = document.createElement('div');
        renderSettingsSchema(
            container,
            { title: 'Make', fields: [{ kind: 'folder', key: 'typesFolder', label: 'Types folder' }] },
            { typesFolder: 'Make/Types' },
            vi.fn(),
        );
        const settings = _settingsByContainer.get(container) ?? [];
        const folderSetting = settings.at(-1)!;
        // Text input is always present; Browse button skipped when pickFolder absent.
        expect(folderSetting._texts).toHaveLength(1);
    });

    it('clicking Browse calls pickFolder and propagates the chosen path', async () => {
        const container = document.createElement('div');
        const onChange = vi.fn();
        const pickFolder = vi.fn(async () => 'Make/Types/Archive');
        renderSettingsSchema(
            container,
            { title: 'Make', fields: [{ kind: 'folder', key: 'typesFolder', label: 'Types folder' }] },
            { typesFolder: 'Make/Types' },
            onChange,
            { pickFolder },
        );
        const folderSetting = (_settingsByContainer.get(container) ?? []).at(-1)!;
        const browseBtn = folderSetting._buttons?.[0];
        if (browseBtn === undefined) throw new Error('Browse button not registered');
        await browseBtn._triggerAsync?.();  // see stub update below — addButton needs async trigger
        expect(pickFolder).toHaveBeenCalledOnce();
        expect(onChange).toHaveBeenCalledWith({ typesFolder: 'Make/Types/Archive' });
    });

    it('null from pickFolder leaves the current value unchanged (no onChange)', async () => {
        const container = document.createElement('div');
        const onChange = vi.fn();
        const pickFolder = vi.fn(async () => null);
        renderSettingsSchema(
            container,
            { title: 'Make', fields: [{ kind: 'folder', key: 'typesFolder', label: 'Types folder' }] },
            { typesFolder: 'Make/Types' },
            onChange,
            { pickFolder },
        );
        const folderSetting = (_settingsByContainer.get(container) ?? []).at(-1)!;
        const browseBtn = folderSetting._buttons?.[0];
        if (browseBtn === undefined) throw new Error('Browse button not registered');
        await browseBtn._triggerAsync?.();
        expect(pickFolder).toHaveBeenCalledOnce();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('typing a trailing-slash value normalizes on onChange', () => {
        const container = document.createElement('div');
        const onChange = vi.fn();
        renderSettingsSchema(
            container,
            { title: 'Make', fields: [{ kind: 'folder', key: 'typesFolder', label: 'Types folder' }] },
            { typesFolder: 'Make/Types' },
            onChange,
            { pickFolder: vi.fn(async () => null) },
        );
        const folderSetting = (_settingsByContainer.get(container) ?? []).at(-1)!;
        folderSetting._texts[0]!._trigger('Make/Types/Archive/');
        expect(onChange).toHaveBeenCalledWith({ typesFolder: 'Make/Types/Archive' });
    });
});
```

- [ ] **Step 4: Extend the `addButton` stub with a `_buttons` array + async trigger**

The current `addButton` in `tests/__stubs__/obsidian.ts` (around line 128) doesn't push onto an array and doesn't support an async handler. Update it to:

```typescript
/** Exposed for tests: all buttons created by this Setting instance. */
_buttons: Array<{
    _label: string;
    _clicked: boolean;
    _onClick: (() => void | Promise<void>) | null;
    setButtonText(t: string): this;
    setCta(): this;
    setWarning(): this;
    onClick(fn: () => void | Promise<void>): this;
    _trigger(): void;
    _triggerAsync(): Promise<void>;
}> = [];

addButton(cb: (b: Setting['_buttons'][number]) => void): this {
    const btn: Setting['_buttons'][number] = {
        _label: '',
        _clicked: false,
        _onClick: null,
        setButtonText(text: string) { this._label = text; return this; },
        setCta() { return this; },
        setWarning() { return this; },
        onClick(fn: () => void | Promise<void>) { this._onClick = fn; return this; },
        _trigger() { this._clicked = true; void this._onClick?.(); },
        async _triggerAsync() { this._clicked = true; await this._onClick?.(); },
    };
    cb(btn);
    this._buttons.push(btn);
    return this;
}
```

- [ ] **Step 5: Run the tests — they should fail**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/infrastructure/settings/render-settings-schema.test.ts
```

Expected: the new cases fail because `'folder'` is not handled. Existing cases still pass.

- [ ] **Step 6: Implement `renderFolder` + `options` parameter**

In `src/infrastructure/settings/render-settings-schema.ts`:

Add to the imports at the top (new import):

```typescript
import type { TranslationPort } from '../../domain/shared/translation-port.js';
```

Change the `renderSettingsSchema` signature and add `options`:

```typescript
export type RenderSettingsOptions = {
    /** Opens a folder-picker modal; used by the `folder` field kind. */
    readonly pickFolder?: () => Promise<string | null>;
    /** Translator for picker-related UI strings. Optional — falls back to English literals. */
    readonly t?: TranslationPort;
};

export function renderSettingsSchema(
    containerEl: HTMLElement,
    schema: SettingsSchema,
    current: Record<string, unknown>,
    onChange: (next: Record<string, unknown>) => void,
    options?: RenderSettingsOptions,
): void {
    const augmented = containerEl as AugmentedEl;
    augmented.createEl('h3', { text: schema.title });

    let state: Record<string, unknown> = { ...current };

    for (const field of schema.fields) {
        renderField(containerEl, field, state, (next) => {
            state = next;
            onChange(next);
        }, options);
    }
}
```

Thread `options` through `renderField`:

```typescript
function renderField(
    containerEl: HTMLElement,
    field: SettingsField,
    state: Record<string, unknown>,
    onChange: (next: Record<string, unknown>) => void,
    options?: RenderSettingsOptions,
): void {
    switch (field.kind) {
        case 'toggle':   renderToggle(containerEl, field, state, onChange); return;
        case 'dropdown': renderDropdown(containerEl, field, state, onChange); return;
        case 'text':     renderText(containerEl, field, state, onChange); return;
        case 'number':   renderNumber(containerEl, field, state, onChange); return;
        case 'folder':   renderFolder(containerEl, field, state, onChange, options); return;
    }
}
```

Add the new renderer function (after `renderNumber`, before `applyMeta`):

```typescript
function renderFolder(
    containerEl: HTMLElement,
    field: Extract<SettingsField, { kind: 'folder' }>,
    state: Record<string, unknown>,
    onChange: (next: Record<string, unknown>) => void,
    options?: RenderSettingsOptions,
): void {
    const raw = state[field.key];
    const initial = typeof raw === 'string' ? raw : '';
    const setting = applyMeta(new Setting(containerEl), field);
    const browseLabel = options?.t?.t('settings.folder.browse') ?? 'Browse…';

    let textRef: { setValue(v: string): unknown } | null = null;

    setting.addText((input) => {
        textRef = input;
        if (field.placeholder !== undefined) input.setPlaceholder(field.placeholder);
        input
            .setValue(initial)
            .onChange((value) => {
                const normalized = value.replace(/\/+$/, '');
                onChange({ ...state, [field.key]: normalized });
            });
    });

    if (options?.pickFolder !== undefined) {
        const pickFolder = options.pickFolder;
        setting.addButton((btn) => {
            btn.setButtonText(browseLabel).onClick(async () => {
                const picked = await pickFolder();
                if (picked === null) return;
                textRef?.setValue(picked);
                onChange({ ...state, [field.key]: picked });
            });
        });
    }
}
```

- [ ] **Step 7: Run the tests — they should pass**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/infrastructure/settings/render-settings-schema.test.ts
```

Expected: all cases pass (new + existing).

- [ ] **Step 8: Verify typecheck + lint**

```bash
cd "01 - Projects/Agentonomous" && npm run typecheck && npm run lint
```

Expected: both silent / zero warnings. (If lint complains about the `textRef` null check, use `textRef?.setValue(picked)` which I've already shown.)

- [ ] **Step 9: Commit**

```bash
git add "01 - Projects/Agentonomous/src/domain/settings/settings-schema.ts" "01 - Projects/Agentonomous/src/infrastructure/settings/render-settings-schema.ts" "01 - Projects/Agentonomous/tests/__stubs__/obsidian.ts" "01 - Projects/Agentonomous/tests/infrastructure/settings/render-settings-schema.test.ts"
git commit -m "$(cat <<'EOF'
feat(agentonomous): folder field kind + renderFolder with Browse-button assist

Extends SettingsField union with FolderField and adds renderFolder to the
generic renderSettingsSchema dispatcher. When consumers pass
options.pickFolder, the rendered Setting gains a Browse button that calls
the port and writes the chosen path back through onChange. Without the
option, the text input remains fully usable — lets the renderer run
outside the Obsidian settings tab in unit tests.

Test stub's Setting gains _texts and _buttons arrays + _triggerAsync to
exercise the async folder-pick path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Wire `DialogPort` through `AgentonomousSettingsTab`

**Files:**
- Modify: `src/infrastructure/settings/settings-tab.ts`
- Modify: `tests/infrastructure/settings/settings-tab.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/infrastructure/settings/settings-tab.test.ts` — the file already has an "instantiate + call display" pattern; follow it.

```typescript
describe('AgentonomousSettingsTab — folder field wiring', () => {
    it('threads DialogPort.pickFolder into renderSettingsSchema for folder kinds', async () => {
        const settingsPort = fakeSettings({ make: { typesFolder: 'Make/Types' } });
        const dialogPort = fakeDialogs({ pickedFolder: 'Make/Archive' });
        const translation = fakeTranslation();
        // defineModule gives a type-correct Module without hand-writing the
        // ports-typed init/destroy signatures that strict mode would reject
        // on bare arrow functions.
        const makeModule = defineModule<Record<string, unknown>>({
            id: 'make',
            name: 'Make',
            settingsKey: 'make',
            settingsDefaults: {},
            validateSettings: (raw) => ({ kind: 'ok', value: (raw as Record<string, unknown>) ?? {} }),
            settingsSchema: {
                title: 'Make',
                fields: [{ kind: 'folder', key: 'typesFolder', label: 'Types folder' }],
            },
            init: async () => { /* no-op for tab tests */ },
            destroy: () => Promise.resolve(),
        });
        const tab = new AgentonomousSettingsTab(
            {} as never, new Plugin(), settingsPort, translation, [makeModule], dialogPort,
        );
        tab.display();
        await new Promise(resolve => setTimeout(resolve, 0));  // flush async display()
        const settings = _settingsByContainer.get((tab as unknown as { containerEl: HTMLElement }).containerEl) ?? [];
        const folderSetting = settings.at(-1)!;
        const browseBtn = folderSetting._buttons[0];
        expect(browseBtn).toBeDefined();
        await browseBtn!._triggerAsync();
        expect(dialogPort.pickFolder).toHaveBeenCalledOnce();
        // Wait for saveSection to complete
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(settingsPort.saveSection).toHaveBeenCalledWith('make', { typesFolder: 'Make/Archive' });
    });
});
```

Check imports at the top of the existing `settings-tab.test.ts` — you will likely need to add:

```typescript
import { fakeDialogs } from '../../__fakes__/fake-ports.js';
import { _settingsByContainer, Plugin } from '../../__stubs__/obsidian.js';
import { defineModule } from '../../../src/domain/shared/module.js';
```

(Merge with existing imports rather than duplicating.) `validateSettings` is required by `defineModule` — the stub above accepts whatever comes in. Adjust if the real `defineModule` signature has drifted.

- [ ] **Step 2: Run the test — it should fail**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/infrastructure/settings/settings-tab.test.ts
```

Expected: typecheck error because `AgentonomousSettingsTab` constructor doesn't accept a 6th arg, OR runtime failure because `pickFolder` is never called.

- [ ] **Step 3: Update `AgentonomousSettingsTab` constructor + wiring**

In `src/infrastructure/settings/settings-tab.ts`:

Add import:

```typescript
import type { DialogPort } from '../../domain/shared/dialog-port.js';
```

Change the constructor (current lines 17–28):

```typescript
private readonly port: SettingsPort;
private readonly t: TranslationPort;
private readonly modules: readonly Module[];
private readonly dialogs: DialogPort;
private current: CoreSettings = CORE_SETTINGS_DEFAULTS;

constructor(
    app: App,
    plugin: Plugin,
    port: SettingsPort,
    t: TranslationPort,
    modules: readonly Module[] = [],
    dialogs?: DialogPort,
) {
    super(app, plugin);
    this.port = port;
    this.t = t;
    this.modules = modules;
    // When undefined (legacy tests), a no-op dialog port is supplied.
    // Callers that need the folder picker must pass a real DialogPort.
    this.dialogs = dialogs ?? {
        confirm:    () => Promise.resolve(false),
        prompt:     () => Promise.resolve(null),
        pickFolder: () => Promise.resolve(null),
    };
}
```

Update `renderModuleSections` (currently ends at line 143):

```typescript
private async renderModuleSections(containerEl: HTMLElement): Promise<void> {
    for (const m of this.modules) {
        if (m.settingsSchema === undefined || m.settingsKey === undefined) continue;

        const loaded = await this.port.loadSection(m.settingsKey);
        const section = isOk(loaded) && typeof loaded.value === 'object' && loaded.value !== null
            ? loaded.value as Record<string, unknown>
            : {};
        const defaults = (m.settingsDefaults ?? {}) as Record<string, unknown>;
        const initial: Record<string, unknown> = { ...defaults, ...section };

        const settingsKey = m.settingsKey;
        renderSettingsSchema(containerEl, m.settingsSchema, initial, (next) => {
            void this.persistModule(settingsKey, next);
        }, {
            pickFolder: () => this.dialogs.pickFolder({ title: this.t.t('settings.folder.pickTitle') }),
            t: this.t,
        });
    }
}
```

- [ ] **Step 4: Run the test — it should pass**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/infrastructure/settings/settings-tab.test.ts
```

Expected: all cases pass.

- [ ] **Step 5: Verify typecheck + lint**

```bash
cd "01 - Projects/Agentonomous" && npm run typecheck && npm run lint
```

Expected: both silent / zero warnings.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Agentonomous/src/infrastructure/settings/settings-tab.ts" "01 - Projects/Agentonomous/tests/infrastructure/settings/settings-tab.test.ts"
git commit -m "$(cat <<'EOF'
feat(agentonomous): AgentonomousSettingsTab threads DialogPort into renderer

Constructor accepts an optional DialogPort; when provided it's wired
through as renderSettingsSchema's options.pickFolder. Modules with folder
kinds now render a Browse button that opens the Obsidian suggest modal.

Backwards compatible — existing callers that don't pass DialogPort still
work; folder kinds simply render without the Browse button.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Pass `DialogPort` into `AgentonomousSettingsTab` from `main.ts`

**Files:**
- Modify: `src/main.ts` (line 151)

One-line DI update. The `dialogPort` instance already exists at this call site — trace it from where `ObsidianDialogAdapter` is constructed.

- [ ] **Step 1: Read the file around line 151**

```bash
cd "01 - Projects/Agentonomous" && grep -n "ObsidianDialogAdapter\|dialogPort\|dialogs\|DialogAdapter\|AgentonomousSettingsTab" src/main.ts
```

Expected: locate where the adapter is constructed (a variable like `dialogPort` or `dialogs`) and the settings-tab call on line 151.

- [ ] **Step 2: Add the DialogPort argument to the settings-tab constructor call**

```typescript
this.addSettingTab(new AgentonomousSettingsTab(
    this.app, this, settings, translationPort, this.core.registeredModules, dialogPort,
));
```

(The exact variable name — `dialogPort` vs `dialogs` vs similar — depends on what's already in scope. Use what's there.)

- [ ] **Step 3: Verify typecheck + full suite**

```bash
cd "01 - Projects/Agentonomous" && npm run typecheck && npx vitest run
```

Expected: typecheck silent. Full suite passes.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Agentonomous/src/main.ts"
git commit -m "$(cat <<'EOF'
feat(agentonomous): wire DialogPort into AgentonomousSettingsTab at DI site

Completes the wiring so folder-kind fields in any module's settingsSchema
render a Browse button backed by Obsidian's SuggestModal.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Migrate Make's three path fields `text` → `folder`

**Files:**
- Modify: `src/modules/make/make-module.ts`
- Modify: `tests/modules/make/make-module.test.ts`

- [ ] **Step 1: Update the `settingsSchema` in `make-module.ts`**

Lines 87–95 of `src/modules/make/make-module.ts`. Change:

```typescript
settingsSchema: {
    title: 'Make',
    fields: [
        { kind: 'toggle', key: 'enabled', label: 'Enable Make' },
        { kind: 'text', key: 'typesFolder', label: 'Types folder' },
        { kind: 'text', key: 'basesFolder', label: 'Bases folder' },
        { kind: 'text', key: 'defaultInstancesRoot', label: 'Default instances folder' },
    ],
},
```

to:

```typescript
settingsSchema: {
    title: 'Make',
    fields: [
        { kind: 'toggle', key: 'enabled', label: 'Enable Make' },
        { kind: 'folder', key: 'typesFolder', label: 'Types folder' },
        { kind: 'folder', key: 'basesFolder', label: 'Bases folder' },
        { kind: 'folder', key: 'defaultInstancesRoot', label: 'Default instances folder' },
    ],
},
```

- [ ] **Step 2: Update the corresponding assertion in `make-module.test.ts`**

```bash
cd "01 - Projects/Agentonomous" && grep -n "settingsSchema\|typesFolder\|basesFolder\|defaultInstancesRoot" tests/modules/make/make-module.test.ts
```

Find the assertion that enumerates the field kinds (likely something like `expect(MakeModule.settingsSchema.fields.map(f => f.kind)).toEqual(['toggle', 'text', 'text', 'text'])`). Change the expected kinds array to `['toggle', 'folder', 'folder', 'folder']`. If no such assertion exists, add one:

```typescript
it('settingsSchema marks the three path fields as folder kinds', () => {
    const kinds = MakeModule.settingsSchema!.fields.map((f) => f.kind);
    expect(kinds).toEqual(['toggle', 'folder', 'folder', 'folder']);
});
```

- [ ] **Step 3: Run the Make module tests**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/modules/make/make-module.test.ts
```

Expected: all pass, including the updated/added assertion.

- [ ] **Step 4: Verify typecheck + lint**

```bash
cd "01 - Projects/Agentonomous" && npm run typecheck && npm run lint
```

Expected: both silent / zero warnings.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Agentonomous/src/modules/make/make-module.ts" "01 - Projects/Agentonomous/tests/modules/make/make-module.test.ts"
git commit -m "$(cat <<'EOF'
feat(agentonomous): Make settings use folder field kind for path inputs

typesFolder / basesFolder / defaultInstancesRoot render with the Browse
button in the settings UI; stored values unchanged. Closes A2 from
docs/specs/2026-04-19-make-chunk-5-backlog.md for the folder-picker
portion.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Full-suite verification + manual smoke check

**Files:** none modified — verification only.

- [ ] **Step 1: Typecheck**

```bash
cd "01 - Projects/Agentonomous" && npm run typecheck
```
Expected: silent.

- [ ] **Step 2: Lint**

```bash
cd "01 - Projects/Agentonomous" && npm run lint
```
Expected: `0 errors, 0 warnings`.

- [ ] **Step 3: Typedoc**

```bash
cd "01 - Projects/Agentonomous" && npm run docs 2>&1 | tail -5
```
Expected: `Found 0 errors and 1 warnings` (the one warning is in `node_modules/obsidian/obsidian.d.ts` — out of our control).

- [ ] **Step 4: Full test suite**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run 2>&1 | tail -6
```
Expected: ≥1224 tests passing (baseline 1212 + ~12 new: 5 adapter + 5 renderer + 1 tab wiring + 1 make-module kind assertion), ≥135 files (no new test files were added; existing ones gained cases). All green.

- [ ] **Step 5: Manual smoke test (optional, if test vault is configured)**

```bash
cd "01 - Projects/Agentonomous" && npm run build:deploy
```

In Obsidian, open the plugin settings → Make section. Confirm:
- Three path fields render with a "Browse…" button.
- Clicking Browse opens Obsidian's SuggestModal with the vault's folder list.
- Picking a folder fills the text input and persists across Obsidian restart.
- Typing a path like `Make/Instances/Archive` that doesn't exist yet still saves correctly.

- [ ] **Step 6: No commit for verification-only task**

If Step 5 uncovers an issue, file a follow-up task — the implementation plan itself is complete.

---

## Success criteria

- All 10 tasks complete, each committed on its own or paired per the plan's commit boundaries (≤9 commits total).
- `npm run typecheck`, `npm run lint`, `npm run docs` all clean.
- `npx vitest run` passes with ≥12 new tests (folder-kind rendering + adapter + tab wiring + make-module migration).
- No behavior change for existing text / toggle / dropdown / number kinds.
- Backwards compatible: existing callers of `renderSettingsSchema` that don't pass `options` continue to work.
- Backwards compatible: existing callers of `AgentonomousSettingsTab` that don't pass a `DialogPort` continue to work (folder kind just loses its Browse button).

## Out of scope (reaffirmed from spec)

- Vue settings panels.
- Render-time validation / per-field validators.
- Create-new-folder affordance inside the modal.
- Other modules adopting `folder` kind.
- `DialogPort.pickFromList<T>` generic picker (deferred until the A3-leftover command lands).
- Favorites management UI.

## Backlog follow-up after this plan ships

Update `project_make_status.md` and `docs/specs/2026-04-19-make-chunk-5-backlog.md`:
- Strike A2 (partially closed — path-picker ergonomics shipped; favorites + enabled deferred indefinitely).
- A4 (locale audit) is now the next Chunk 5 slice.
