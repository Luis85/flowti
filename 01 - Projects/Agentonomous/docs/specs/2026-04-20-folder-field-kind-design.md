# `folder` field kind + Make settings autocomplete — design

**Status:** Draft
**Date:** 2026-04-20
**Chunk:** Make Chunk 5 (continuation) — A2 from `2026-04-19-make-chunk-5-backlog.md`
**Scope:** Framework-level field kind + Make adoption
**Module:** `core` (framework) + `make`

## Motivation

Make's three folder settings — `typesFolder`, `basesFolder`, `defaultInstancesRoot` — render today as plain text inputs via the generic `renderSettingsSchema` renderer. Users hand-type vault paths, and a typo like `Make/type` vs `Make/Types` silently reshapes the module (Make/Types goes ignored on the next load, Make/type gets re-created empty). The actual failure surface is the `ensureFolder` fix we just shipped, which now creates the mistyped folder and hides the error even better.

The backlog entry A2 framed this as "build `MakeSettings.vue` with Vue-based path pickers." Investigation revealed the Agentonomous settings tab is 100% Obsidian DOM API with a capable generic renderer (`renderSettingsSchema`) that already handles `toggle`, `dropdown`, `text`, `number` kinds for every module's `settingsSchema`. Adding Vue to this surface would open a new architectural seam for a single input widget.

The pragmatic path is to extend the generic renderer with a `folder` field kind that adds vault-folder autocomplete via Obsidian's native `SuggestModal`, sitting behind a new `DialogPort.pickFolder` method. Every module with folder fields benefits immediately; no module acquires a bespoke settings panel.

## Decisions (locked in during brainstorming)

| # | Decision | Rationale |
|---|---|---|
| 1 | **Delivery model:** extend generic renderer, not a per-module Vue panel (Q1 option C — hybrid) | The generic renderer already handles Make's settings shape. The pain is user input ergonomics, not UX that the schema can't express. A Vue escape hatch (Q1 option B) can be revisited when a concrete module needs it. |
| 2 | **Picker mechanism:** Obsidian `SuggestModal` behind a "Browse…" button (Q2 option B) | Native fuzzy-match over existing vault folders; feels like Obsidian. HTML `<datalist>` (A) would have worked but the settings tab already uses Obsidian's `Setting` builder — a button-triggered modal sits naturally in that chain. A hybrid inline popover (C) is overkill for one field. |
| 3 | **Port placement:** `DialogPort.pickFolder` (Q3 option A) | Fits the existing `confirm` / `prompt` "modal returns a value" pattern. The adapter owns all Obsidian specifics. Splitting into `VaultPort.listFolders` + `DialogPort.pickFromList` (B) is appealing for the A3-leftover fuzzy type picker but that feature picks from a typed dynamic list, not vault folders — `pickFromList` can land later when it has a second caller. A dedicated `FolderPickerPort` (C) is single-method overkill. |
| 4 | **Free-text always allowed** | The text input stays editable. Browse is an assist; users who want `Make/Instances/Books` before that folder exists type it directly. Make's services already `ensureFolder` on first write, so not-yet-created paths are valid. |
| 5 | **Normalization scope:** trailing-slash strip at the renderer's `onChange` seam; leading slash preserved | Downstream modules already strip trailing slashes at consumption (`basesFolder.replace(/\/$/, '')`). Centralizing the strip in the renderer means modules can drop their local normalization over time; this slice does not touch those sites. Leading slash untouched so typing `/` to mean root stays intact. |
| 6 | **Root folder (`""`) in the suggest list:** shown as `"/"` | Include for completeness. Make's defaults are always nested so users won't pick it, but future modules may want a root-level folder. |
| 7 | **Validation at render time:** none in this slice | Module-level `validateSettings` already runs at save time (unchanged). Per-render validation is a broader change that would touch every field kind, not just `folder`. |
| 8 | **Favorites management UI in settings:** not in scope | Already managed via the ⭐ button on type pages. Adding a read-only list in settings is low-value. |
| 9 | **Other modules adopting `folder` kind:** incremental, not this slice | File Detail, Event Inspector, Health Monitor have folder-shaped fields today. They opt in as follow-up; this slice only migrates Make's three fields. |

## Architecture

```
src/domain/shared/dialog-port.ts
   + pickFolder(opts?: { title?: string }): Promise<string | null>
          ↓ implemented by
src/infrastructure/obsidian/obsidian-dialog-adapter.ts
   + class FolderSuggestModal extends SuggestModal<string>
   + pickFolder(opts) — wraps the modal in a Promise<string | null>
          ↓ resolves on
            ├─ onChooseSuggestion(path) → path
            └─ onClose without choice  → null

src/domain/settings/settings-schema.ts
   + kind: 'folder'  (FieldKind union)

src/infrastructure/settings/render-settings-schema.ts
   + renderFolder(setting, field, current, commit, options)
        composes setting.addText(...) .addButton(Browse…)
        button visible only when options.pickFolder provided
   + options parameter: { pickFolder?: () => Promise<string | null> }

src/infrastructure/settings/settings-tab.ts
   (Δ) constructor receives DialogPort
   (Δ) passes { pickFolder: () => this.dialogs.pickFolder({ title }) }
       through to renderSettingsSchema

src/modules/make/make-module.ts
   (Δ) settingsSchema: three path fields change 'text' → 'folder'

src/modules/core/locales/en.json
   + settings.folder.browse      = "Browse…"
   + settings.folder.pickTitle   = "Pick a folder"
```

### Data flow — picking a folder end-to-end

1. User opens plugin settings → `AgentonomousSettingsTab.display()`.
2. Tab iterates modules, calls `renderSettingsSchema(container, module.settingsSchema, initial, onChange, { pickFolder })`.
3. Renderer dispatches on kind; `folder` renders a text input + Browse button.
4. User clicks Browse → the wired callback invokes `dialogs.pickFolder({ title })`.
5. Obsidian adapter opens `FolderSuggestModal`; `getSuggestions(query)` returns filtered folder paths from `app.vault.getAllLoadedFiles().filter(f => f instanceof TFolder).map(f => f.path || '/').sort()`.
6. User selects → `onChooseSuggestion(path)` resolves the promise with the path (`'/'` mapped back to `''`).
7. Renderer's button handler receives the path, calls `textComp.setValue(path)` (visual update) and `commit({ ...current, [key]: path })` (data update).
8. `commit` is the `onChange` callback wired by `settings-tab.ts` → `port.saveSection(sectionKey, next)`.
9. Settings port broadcasts → `PluginCore.dispatchSettingsChanges` diffs sections → `MakeModule.onSettingsChange(settings)` fires.
10. Make's existing `onSettingsChange` handler detects folder change → destroy + re-init (unchanged behavior).

### Data flow — no-op path when user cancels

Steps 4–6: user dismisses modal → promise resolves `null` → button handler short-circuits (no `setValue`, no `commit`). Existing value preserved.

### Data flow — free-text entry (path that doesn't exist yet)

User types `Make/Instances/Archive` directly into the text input. `onChange` fires per the existing text-input path → normalize (strip trailing slash) → `commit`. Same as today; the Browse button is purely additive.

## Public API changes

### `DialogPort` (`src/domain/shared/dialog-port.ts`)

```typescript
export interface DialogPort {
  confirm(opts: { title: string; body: string }): Promise<boolean>;
  prompt(opts: { title: string; body: string }): Promise<string | null>;
  // NEW:
  pickFolder(opts?: { title?: string }): Promise<string | null>;
}
```

- Returns the chosen folder path, or `null` if dismissed.
- Path has no trailing slash (adapter strips before returning).
- Root folder returned as `""` (empty string), not `"/"`.
- `opts.title` defaults (at the adapter) to the localized `settings.folder.pickTitle` string.

### `FieldKind` union (`src/domain/settings/settings-schema.ts`)

```typescript
export type FieldKind =
  | { kind: 'toggle';   key: string; label: string; description?: string }
  | { kind: 'dropdown'; key: string; label: string; options: readonly { value: string; label: string }[]; description?: string }
  | { kind: 'text';     key: string; label: string; placeholder?: string; description?: string }
  | { kind: 'number';   key: string; label: string; min?: number; max?: number; step?: number; description?: string }
  // NEW:
  | { kind: 'folder';   key: string; label: string; description?: string; placeholder?: string };
```

### `renderSettingsSchema` signature

```typescript
export function renderSettingsSchema(
  containerEl: HTMLElement,
  schema: SettingsSchema,
  initial: Record<string, unknown>,
  onChange: (next: Record<string, unknown>) => void,
  options?: { pickFolder?: () => Promise<string | null> },
): void
```

Backwards compatible — `options` is optional; existing kinds unaffected.

### `AgentonomousSettingsTab` constructor

Gains a `DialogPort` parameter (ordered after existing ports). The tab itself doesn't expose new public methods.

## Components

### `FolderSuggestModal` (new, infrastructure)

```typescript
class FolderSuggestModal extends SuggestModal<string> {
  private resolver: ((v: string | null) => void) | null = null;
  private resolved = false;
  constructor(app: App, title: string) {
    super(app);
    this.setPlaceholder(title);
  }
  run(): Promise<string | null> {
    return new Promise((resolve) => {
      this.resolver = resolve;
      this.open();
    });
  }
  getSuggestions(query: string): string[] {
    const folders = this.app.vault.getAllLoadedFiles()
      .filter((f): f is TFolder => f instanceof TFolder)
      .map((f) => f.path === '' ? '/' : f.path);
    const q = query.toLowerCase();
    return folders.filter((p) => p.toLowerCase().includes(q)).sort();
  }
  renderSuggestion(path: string, el: HTMLElement): void { el.setText(path); }
  onChooseSuggestion(path: string): void {
    this.resolved = true;
    this.resolver?.(path === '/' ? '' : path);
  }
  onClose(): void {
    super.onClose();
    if (!this.resolved) this.resolver?.(null);
  }
}
```

`ObsidianDialogAdapter.pickFolder` is a one-line wrapper: `return new FolderSuggestModal(this.app, opts?.title ?? 'Pick a folder').run();`.

### `renderFolder` (new, infrastructure)

Sits next to the existing `renderText` / `renderToggle` / etc. functions in `render-settings-schema.ts`. Uses Obsidian's `Setting` builder's chained `.addText(...).addButton(...)` pattern.

## Error handling

- `pickFolder` cannot fail in any user-facing way — modal either resolves a path or `null`. No exceptions bubble from the adapter.
- `renderFolder` gracefully degrades when `options.pickFolder` is absent: the Browse button is not attached; the text input remains fully usable. This keeps the renderer usable outside the Obsidian settings tab (e.g., in unit tests that stub neither the DialogPort nor the rendering harness).
- Invalid text input (e.g., `../escape`): no special handling in this slice. Module-level `validateSettings` runs at save time and is the right place to reject — out of scope here but tracked by the existing hardening backlog (C-series items).

## Testing strategy

| Test file | New/Updated | Cases |
|---|---|---|
| `tests/infrastructure/obsidian/obsidian-dialog-adapter.test.ts` | new if absent, else updated | (+) `pickFolder` resolves the chosen path; (+) resolves `null` when modal closes without choosing; (+) suggest list filtered to `TFolder` instances from `vault.getAllLoadedFiles`; (+) root folder mapped `''` ↔ `'/'`; (+) query filter case-insensitive. |
| `tests/infrastructure/settings/render-settings-schema.test.ts` | updated | (+) `folder` kind renders text input + Browse button when `pickFolder` provided; (+) Browse button omitted when `pickFolder` absent; (+) clicking Browse → `pickFolder()` called → text updated + `onChange` fired with chosen path; (+) `null` from `pickFolder` leaves value unchanged (no `onChange`); (+) typing with trailing slash normalizes on `onChange`. |
| `tests/infrastructure/settings/settings-tab.test.ts` | updated | (+) tab constructor accepts `DialogPort`; (+) tab wires `pickFolder` through to `renderSettingsSchema` options; (+) end-to-end: folder selection persists through `SettingsPort.saveSection`. |
| `tests/modules/make/make-module.test.ts` | updated | (Δ) assertion that the three path fields have `kind: 'folder'`. |
| `tests/__fakes__/fake-ports.ts` | updated | `fakeDialogs({ pickedFolder? })` — pre-programmed return value for `pickFolder`. Default `null`. |
| `tests/__stubs__/obsidian.ts` | updated | Lightweight `SuggestModal` stub: `open()` no-op, `onChooseSuggestion` / `onClose` trigger-methods so adapter tests can exercise both code paths. Also ensure `Vault.getAllLoadedFiles` is present (may be — verify during implementation). |

Coverage targets unchanged.

## Files touched (estimate)

**Source (8):**
1. `src/domain/shared/dialog-port.ts` — +1 method on interface
2. `src/domain/settings/settings-schema.ts` — +1 kind in union
3. `src/infrastructure/obsidian/obsidian-dialog-adapter.ts` — new `FolderSuggestModal` class + `pickFolder` method
4. `src/infrastructure/settings/render-settings-schema.ts` — new `renderFolder` + options parameter
5. `src/infrastructure/settings/settings-tab.ts` — constructor takes `DialogPort`, threads `pickFolder` through
6. `src/modules/make/make-module.ts` — 3 kind changes in `settingsSchema`
7. `src/modules/core/locales/en.json` — 2 new i18n keys
8. `src/main.ts` or wherever `AgentonomousSettingsTab` is constructed — pass the new `DialogPort` arg (one-line DI update)

**Tests (5):**
9. `tests/__fakes__/fake-ports.ts` — extend `fakeDialogs`
10. `tests/__stubs__/obsidian.ts` — add `SuggestModal` stub
11. `tests/infrastructure/obsidian/obsidian-dialog-adapter.test.ts` — new/updated
12. `tests/infrastructure/settings/render-settings-schema.test.ts` — updated
13. `tests/infrastructure/settings/settings-tab.test.ts` — updated
14. `tests/modules/make/make-module.test.ts` — updated

New code weight ~150 lines source + ~120 lines tests.

## Open questions

None — all choices were resolved in the brainstorming dialog.

## Out of scope

- **Create-new-folder affordance inside the suggest modal.** Users type free text for paths that don't exist; Make's services already `ensureFolder` on first write.
- **Render-time validation / warnings.** Per-field validators would need to cross every kind, not just `folder`.
- **Vue settings panel escape hatch.** Revisit when a module has concrete needs the generic renderer cannot express.
- **Other modules adopting `folder` kind.** Incremental follow-up; each module opts in when convenient.
- **`DialogPort.pickFromList<T>` generic picker.** When the A3-leftover "open instances of type…" fuzzy command lands, that feature introduces the generic picker; `pickFolder` stays as the folder-specific intent alongside it.
- **Favorites management UI in settings.** Already handled by the ⭐ button on type pages.
- **Settings-tab test harness adopting `mountWithI18n`.** Current tests use direct instantiation + Obsidian stub triggers — that pattern is kept.

## Backlog linkage

- Closes: **A2** in `docs/specs/2026-04-19-make-chunk-5-backlog.md`.
- Does not close: A4 (locale audit) — remains pending as the next Chunk 5 slice.
- Does not affect: B (schema migration), C-series (§12 outbox remnants), D-series (framework-level).
