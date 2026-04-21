# Make — Chunk 5 + Outstanding Backlog

> **Scope:** consolidates every open item for the Make module after the 2026-04-19 Polish pass merge (`5af5121b`). Each entry is sized to be a self-contained slice — either shipped as-is, rolled into a Chunk 5 spec, or promoted to its own chunk.
>
> **Status date:** 2026-04-19. Test baseline at start: 1010 tests / 104 files / 0 lint errors (on `master` at `5af5121b`).
>
> **How to use this doc:** when picking up new work, pull an entry, promote it to its own `docs/specs/<date>-make-<topic>-design.md`, write a plan under `docs/plans/`, ship, then strike the entry here (edit doc, don't delete — history matters).

---

## A. Chunk 5 — User-facing polish

**Goal:** make the Make module feel complete for end users. Chunks 1–4 built the data model and CRUD; this chunk adds the presentation, discovery, and settings surfaces that turn a working module into a shippable feature.

**Success criteria (top of funnel → bottom):**
1. A user opening the plugin for the first time sees a meaningful MakeHome (KPIs + recent activity) — not an empty page with a list of type names.
2. A user can configure Make from inside the plugin settings without editing JSON.
3. A user can reach the "create type" flow from two native Obsidian affordances (ribbon, command palette).
4. All user-visible strings are in the locale file and audited for tone.

### A1. MakeHome KPIs + recently-created list

**What:** replace the current minimal `MakeHome.vue` with a dashboard layout that shows:
- Types count + instances count (large numeric KPIs)
- "Created this week" (distinct from total — motivates repeat visits)
- Per-type instance counts (already computed in `store.instanceCountByTypeId` — surface them)
- "Recently created" list — N most recent instances across all types, sorted by `createdAt desc`, clickable → opens in Obsidian

**Why:** the parent Make spec (`docs/specs/2026-04-18-make-design.md`) always envisioned MakeHome as a dashboard. Chunks 1–4 deferred it to ship CRUD first. Without this, the plugin's landing page feels empty.

**Service additions needed:**
- `MakeService.getKpis()` already exists in the interface (`KpiSnapshot` type) but is stubbed — implement it. Walk `listTypes()` + `listInstances()` once, reduce into `{ typesCount, instancesCount, createdThisWeek, perType, recentlyCreated }`. Cache behind a single Pinia computed that invalidates on `make:instance-created` / `make:instances-deleted-batch` / `make:type-deleted`.
- Consider: cache stale-for (e.g., 60s TTL) vs recompute on every event. Event-driven recompute is simpler and bulk-select already emits one event per batch so it won't thrash.

**UI additions:**
- `src/ui/pages/make/MakeHomeDashboard.vue` (or restructure `MakeHome.vue` in place)
- `src/ui/components/make/KpiCard.vue` — reusable tile (number + label + optional delta)
- `src/ui/components/make/RecentInstancesList.vue` — list of recent instances with type-name chip + title + `createdAt` formatted

**Existing hooks to leverage:**
- `store.instanceCountByTypeId` (Chunk 2)
- `favoriteTypes` computed (Chunk 3) — could promote to MakeHome
- `onInstanceCreated` / `onInstancesDeletedBatch` subscriptions (already in store)

**Effort:** M. The computation is trivial, the presentation is where the design taste matters.

---

### A2. `MakeSettings.vue` — module settings UI **[PARTIALLY SHIPPED 2026-04-21]**

**Original scope:** a Vue panel inside the generic plugin settings that surfaces Make's `MakeSettings` shape for editing:
- ~~`typesFolder` — path picker~~ ✅ shipped
- ~~`basesFolder` — path picker~~ ✅ shipped
- ~~`defaultInstancesRoot` — path picker~~ ✅ shipped
- `favorites` — read-only list (shown for transparency, managed via the star UI) — **deferred indefinitely**
- `enabled` — toggle (currently only in framework-level settings) — **deferred indefinitely**

**What shipped:** instead of a custom Vue panel, we chose to enrich the generic `settingsSchema` renderer with a new `folder` field kind backed by `DialogPort.pickFolder` (Obsidian `SuggestModal` over vault folders). Make's three path fields now use `kind: 'folder'` and render a Browse button next to the text input. Spec: `docs/specs/2026-04-20-folder-field-kind-design.md`. Plan: `docs/plans/2026-04-21-folder-field-kind.md`. Shipped commits `db5a7933..3938a4ac` on `master`.

**Design choice made:** generic-renderer enrichment, not a custom Vue panel. Reasoning: the path-picker UX was the only non-trivial affordance; `favorites` is already manageable via the star UI on type cards (adding a read-only mirror in settings is cosmetic); `enabled` is a framework-level concern, not Make-specific. The generic folder kind is now reusable by any module.

**Deferred items (no longer blocking Chunk 5):**
- `favorites` read-only mirror — deferred indefinitely; the star UI is the source of truth
- `enabled` per-module toggle — deferred; framework settings already expose this at the core level

**Effort consumed:** S (generic renderer + port + migration). The original M estimate reflected a custom Vue panel; the chosen approach was lighter.

---

### A3. Ribbon + command-palette entries

**What:**
- Ribbon icon: "Open Make" (already exists — verify), plus a second ribbon "New Make type" that deep-links to `/make/types/new`
- Command palette entries:
  - `Make: open` (exists)
  - `Make: create new type` (deferred from Chunk 3 — add now, navigates to `/make/types/new`)
  - `Make: open instances of type…` (new — quickswitcher-style fuzzy picker of types, reveals the type's Instances tab)

**Why:** plugin discoverability. Users who don't click into the side panel never find Make. The Chunk 3 plan explicitly deferred `make-create-type`.

**Implementation notes:**
- `CommandPort.register({ id, name, callback })` — already used by `Make: open`.
- Commands are declared in `defineModule({ commands: [...] })`. Adding them is a config-level change — no service work.
- The fuzzy type picker could use Obsidian's native `SuggestModal` — would need a port addition (`WorkspacePort.pickFromList<T>(options) => T | null`), or it could render a Vue panel. Picker-via-port is cleaner; defer the port addition if the simpler "list all types and navigate" command works.

**Effort:** S for the two declarative commands; M if we add a fuzzy picker port.

---

### A4. Locale finalisation

**What:**
- Audit every `t('make.…')` call site — confirm all keys exist in `en.json`, no hardcoded strings
- Review tone and clarity — errors should guide, labels should be concise
- Consider: adding a second locale (e.g., `es.json`) to validate the i18n plumbing actually works end-to-end. Not required for Chunk 5 to ship; flag as stretch goal.

**Why:** Chunk 3 plan notes "locale finalisation" as Chunk 5 scope. Chunks 3–4 added ~65 keys; Polish added more (14 for bulk-select). Nothing has audited the full set.

**Effort:** S–M depending on whether we add a second locale.

---

### Chunk 5 open questions

1. **Scope size.** A1+A2+A3+A4 is ambitious for one chunk. Split as A1+A3 first (visible user value), then A2+A4 as Chunk 5.5? Or ship all four in one larger slice?
2. **Design quality bar.** MakeHome KPI cards and path-picker are design-taste items. Consider pulling in frontend-design skill for the visual layer.
3. **KPI freshness.** Event-driven recompute vs TTL cache. Start with event-driven (simpler, no stale-UI risk with our event coverage).

---

## B. Schema-migration story

**Status:** PO-flagged blocker in the 2026-04-19 multi-perspective review. Bulk-select (Polish P1 #13) was explicitly named as its prerequisite. Now unblocked. **Needs a dedicated spec before any code.**

**The problem:** today, when a user edits a type schema (add/remove/rename/retype a field), existing instance frontmatter is not migrated. Instance files become silently stale: the UI renders them using the new schema, but their frontmatter still has old field names/types, and the base file's YAML view may show missing or invalid columns.

**The questions to answer in the spec:**
1. **When to migrate?** On save (user opts in via the existing rename-warning dialog, which is already the UX pattern), lazily on access, or batched on-demand via a command?
2. **What to migrate?**
   - Field rename → rename frontmatter key across N instances (already have bulk-select as the infrastructure: emit a batch event, refresh once)
   - Field add → default value (from field kind) written into each instance's frontmatter
   - Field remove → keep the key in frontmatter (safe — data preserved) or strip it (destructive — data loss)
   - Field kind change (e.g., `text` → `number`) → validate each instance; those that don't parse get a warning, no rewrite
3. **Migration transaction model?** Partial-migration report (mirrors `BulkDeleteReport`): `{ migratedPaths, failures: { path, cause }[] }`. Use the existing partial-result dialog pattern from Polish P0 #3.
4. **Opt-in vs automatic?** Current `field-rename-warning` is opt-in (`acknowledgeRenames: true`). Schema migration should follow the same pattern — never silent.
5. **Cascading updates?** Field rename must also update the `.base` YAML view (field names are column keys).
6. **Concurrency?** The per-type queue (Polish P1 #9+#13) already serializes updates; migration is just another op that enters the queue.

**Dependencies already in place:**
- Per-type queue for serialization
- `BulkDeleteReport` / batch event pattern
- `ConfirmDialog` partial-result dialog
- `make-store` single-flight guards (`bulkDeleting`, extensible to `migrating`)

**Effort:** L. This is a full chunk-sized feature (design + spec + implementation + test). Likely becomes **Make Chunk 6** not Chunk 5.

---

## C. Chunk 3.5 §12 outbox remnants

Niche robustness items deferred from the hardening pass. Each is independently shippable — pick one per low-activity session.

| # | Item | Effort | Notes |
|---|------|--------|-------|
| C1 | Optimistic concurrency via `stat.mtime` on `updateType` / `deleteType` | M | Adds `MakeError { kind: 'stale-write', expected: string, actual: string }`. Non-trivial: requires `mtime` round-trip through `loadType` / the store. Unblocks multi-pane Obsidian safety. |
| C2 | Save-time notices for field-kind changes | S | e.g., changing `number` → `text` invalidates existing numeric-validated frontmatter. Show a warning dialog similar to `field-rename-warning`. Pairs well with B. |
| C3 | Save-time notices for `titleFieldName` changes | S | Similar: changing the title field orphans the old filename convention. Warning dialog. |
| C4 | Persistent post-save orphan banner after `instancesFolder` rename | S | When user moves a type's folder without `moveInstances: true`, old-folder files become invisible. Show a dismissable banner on `MakeType` page with a "retry move" affordance (the service method already exists). |
| C5 | Relative `baseFile.path` storage | S | Currently absolute — vault relocation breaks it. One-line fix + migration for existing vaults. |
| C6 | Granular per-field rename count | XS | Chunk 3 reports single aggregate. `FieldRename[]` already has per-field data; UI just needs to display it. |
| C7 | `VaultPort` atomic-write guarantee formalized in JSDoc | XS | Documentation only. |
| C8 | Canonical-form base-file divergence check (byte-compare → structural) | M | Currently a byte-compare for "user-edited" detection. Structural compare (YAML parse + normalize) would reduce false positives on whitespace/ordering. |
| C9 | External-update-during-dirty-draft recovery dialog | M | User edits type in Make; external process (sync) updates the file. Currently silent last-write-wins. Add a conflict dialog. |
| C10 | External-delete-during-edit recovery (offer draft-to-JSON download) | M | Type deleted externally while user edits; offer to save their in-progress draft as JSON. |
| C11 | Favorite multi-session sync recovery | S | Favorites stored in settings; no conflict resolution when settings change mid-edit from another session. |

**Batch suggestion:** C2+C3+C6 ship together as "schema change warnings." C1 pairs with B (schema-migration) because both touch `updateType` concurrency. The rest are individually small.

---

## D. Framework-level items surfaced by Make Chunk 4 Polish

These are cross-module — they were learned during Make Polish but apply to the framework, so they're captured here for whoever writes the next framework chunk.

| # | Item | Notes |
|---|------|-------|
| D1 | Generalize per-type-queue into a shared `PerKeyQueue<K>` util | `src/modules/make/per-type-queue.ts` is Make-specific (typeId). Other modules (e.g., future journals, tasks) will want the same pattern. Promote to `src/domain/shared/per-key-queue.ts`. Migration is one import change per consumer. |
| D2 | Framework-level `busy` error variant | Polish P1 #13 added `'busy'` to `MakeError`. If other modules adopt single-flight guards, `BusyError` should be a shared type. |
| D3 | `expectTypeOf` vs runtime type tests | `tests/domain/make/types.test.ts` uses `expectTypeOf` for structural type assertions. ESLint/tsc catches missing exports only via the lint `tsconfig.lint.json` — main `tsconfig.json` excludes tests. Either document this gotcha or add a tsc-on-tests CI step. |
| D4 | Reusable partial-result ConfirmDialog pattern | Polish P0 #3 + P1 #13 both use `ConfirmDialog` for success-with-failures flows (move/bulk-delete). The body-text composition (`{ok} of {total}, {fail} remain: {paths}` with "+N more" truncation) should be a reusable helper component. |

---

## E. How to pick what's next

**If the user is "where do we go from here":** A (Chunk 5 — user polish) is the most visible win, schema-migration (B) is the biggest architectural gap. Both are substantial.

**Recommended sequence:**
1. **Chunk 5 = A1 + A3** ✅ shipped (MakeHome KPIs + ribbon/command)
2. **Chunk 5.5 = A2 (path-pickers)** ✅ shipped 2026-04-21 via folder-field-kind; favorites + enabled deferred
3. **Chunk 5.6 = A4** (locale audit — now the next Chunk 5 slice)
4. **Chunk 6 = B** (schema-migration — full architectural feature; write spec first)
5. **Interleave C and D as low-activity sessions allow**

**If the user wants to ship something small to stay sharp:** any C item (especially C6 or C7 — XS effort).

**If the user wants a big milestone:** B. But commit to the spec-first discipline; this one will break things if rushed.
