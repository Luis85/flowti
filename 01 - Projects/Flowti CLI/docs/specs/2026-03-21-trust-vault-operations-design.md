# Trust & Vault Operations — Design Spec

**Date:** 2026-03-21
**Status:** Approved
**Phase:** B of Task & Economy Engine
**Depends on:** Phase A (task engine, economy ledger, leveling, trust types) — completed

## Overview

Phase B wires the trust system, vault operations, staging area, standing order evaluator, and vault context into a working pipeline. Agents execute real file operations against the vault, gated by per-operation trust levels. The CLI owns the full pipeline — trust check, file execution, staging, rewards — all with Node.js built-ins (headless, no Obsidian required).

### What This Unlocks

- Agents perform real vault work (read, tag, create, edit, move, search, link)
- Trust gates every operation — auto, review, or manual per agent per operation
- Review-tier outputs stage for Director approval before landing in vault
- Standing orders trigger vault operations in response to file events
- Agents see only what their scope allows

## 1. Domain Structure

```
src/domain/vault-ops/
├── vault-ops-types.ts              # Request/result types for all 7 operations
├── vault-ops.ts                    # 7 pure operation functions
├── vault-executor.ts               # Pipeline: validate → trust → execute/stage → record → reward
├── vault-context.ts                # Agent vault awareness (folder map, tag index, scope)
└── standing-order-evaluator.ts     # Event → matched orders → dispatch to executor

src/controller/
├── trust.controller.ts             # profile, promote, demote, reset
├── staging.controller.ts           # list, review, approve, reject
└── vault.controller.ts             # exec, context

src/ui/displays/
├── trust-display.ts                # Trust profile rendering (extend existing)
├── staging-display.ts              # Staging list/review rendering (new)
└── vault-display.ts                # Vault context + operation result rendering (new)
```

## 2. Types & Interfaces

### 2.1 Vault Operation Requests

Every operation uses a common request envelope. Each operation type extends it with specific parameters.

```typescript
interface VaultOpRequest {
	readonly agentName: string;
	readonly operation: VaultOperation;   // reuse from trust-types
	readonly taskId?: string;             // links to task for reward
}

interface VaultReadRequest extends VaultOpRequest {
	readonly operation: "vault-read";
	readonly path: string;
}

interface VaultSearchRequest extends VaultOpRequest {
	readonly operation: "vault-search";
	readonly query: { tags?: string[]; folder?: string; pattern?: string };
}

interface VaultTagRequest extends VaultOpRequest {
	readonly operation: "vault-tag";
	readonly path: string;
	readonly addTags?: string[];
	readonly removeTags?: string[];
}

interface VaultCreateRequest extends VaultOpRequest {
	readonly operation: "vault-create";
	readonly path: string;
	readonly frontmatter?: Record<string, unknown>;
	readonly body?: string;
}

interface VaultEditRequest extends VaultOpRequest {
	readonly operation: "vault-edit";
	readonly path: string;
	readonly content: string;            // full replacement content
}

interface VaultMoveRequest extends VaultOpRequest {
	readonly operation: "vault-move";
	readonly fromPath: string;
	readonly toPath: string;
}

interface VaultLinkRequest extends VaultOpRequest {
	readonly operation: "vault-link";
	readonly path: string;
	readonly addLinks?: string[];
	readonly removeLinks?: string[];
}

type AnyVaultOpRequest =
	| VaultReadRequest
	| VaultSearchRequest
	| VaultTagRequest
	| VaultCreateRequest
	| VaultEditRequest
	| VaultMoveRequest
	| VaultLinkRequest;
```

### 2.2 Executor Result

```typescript
type VaultOpOutcome = "executed" | "staged" | "queued" | "denied" | "failed";

interface VaultOpResult {
	readonly outcome: VaultOpOutcome;
	readonly operation: VaultOperation;
	readonly agentName: string;
	readonly taskId?: string;
	readonly data?: unknown;
	readonly stagingId?: string;         // set when outcome = "staged"
	readonly reason?: string;            // set when outcome = "denied" or "failed"
}
```

The `failed` outcome covers operation-level errors (file not found, target already exists, path traversal). The `denied` outcome is reserved for trust/scope denial. Operations throw on invalid input; the executor catches and maps to `{ outcome: "failed", reason }`.

### 2.3 Executor Deps (ISP subset)

```typescript
interface VaultOpsDeps {
	readonly disk: IFileSystem;
	readonly clock: IClock;
	readonly paths: IPaths;
	readonly vaultRoot: string;
}
```

Includes `paths` for safe path joining (consistent with other ISP subsets like `ReportDeps`). The executor also takes trust profile, trust config, and economy ledger as explicit parameters (not deps) for testability.

### 2.4 Vault Context

```typescript
interface VaultContext {
	readonly folderMap: readonly FolderEntry[];
	readonly tagIndex: readonly TagEntry[];
	readonly recentChanges: readonly RecentChange[];
}

interface FolderEntry {
	readonly path: string;
	readonly noteCount: number;
}

interface TagEntry {
	readonly tag: string;
	readonly count: number;
}

interface RecentChange {
	readonly path: string;
	readonly action: "created" | "modified" | "deleted" | "moved";
	readonly at: string;
}

interface VaultScope {
	readonly folders?: readonly string[];
	readonly tags?: readonly string[];
}
```

### 2.5 Standing Order Event

```typescript
interface VaultEvent {
	readonly folder: string;
	readonly type: string;              // matches matchEvent() field name ("file-created", etc.)
	readonly path: string;
	readonly at: string;
}
```

Note: Uses `type` (not `event`) to match the existing `matchEvent()` contract in `standing-order-index.ts`.

## 3. Vault Operations (7 functions)

Each operation is a pure function in `vault-ops.ts`. They receive a typed request + `VaultOpsDeps` and return operation-specific data. They do not know about trust or staging — that is the executor's concern.

All paths are relative to vault root. The function resolves to absolute using `deps.vaultRoot`.

### 3.1 vault-read

Reads a file, splits YAML frontmatter from body, returns both.

**Input:** `VaultReadRequest` (path)
**Output:** `{ content: string; frontmatter: Record<string, unknown> }`

### 3.2 vault-search

Walks folders, parses frontmatter for tag matching, glob for pattern matching.

**Input:** `VaultSearchRequest` (query with tags, folder, pattern)
**Output:** `{ matches: Array<{ path: string; tags: string[] }> }`

### 3.3 vault-tag

Parses existing frontmatter, adds/removes tags, writes back. Uses the frontmatter serializer (Section 3.8) to rebuild YAML while preserving body.

**Input:** `VaultTagRequest` (path, addTags, removeTags)
**Output:** `{ path: string; tags: string[] }`
**Fails if:** file does not exist

### 3.4 vault-create

Builds markdown with YAML frontmatter using the frontmatter serializer (Section 3.8), writes via `deps.disk.writeFileSync()`. Creates parent directory if needed via `deps.disk.mkdirSync()`.

**Input:** `VaultCreateRequest` (path, frontmatter, body)
**Output:** `{ path: string }`
**Fails if:** file already exists (no silent overwrite)

### 3.5 vault-edit

Reads existing frontmatter via the parser (Section 3.8), replaces body content, serializes back. Preserves frontmatter — only body changes (full replacement).

**Input:** `VaultEditRequest` (path, content)
**Output:** `{ path: string }`
**Fails if:** file does not exist

### 3.6 vault-move

Renames/moves file, creates target directory if needed.

**Input:** `VaultMoveRequest` (fromPath, toPath)
**Output:** `{ fromPath: string; toPath: string }`
**Fails if:** source does not exist, target already exists

### 3.7 vault-link

Reads file, appends `[[wikilinks]]` to a "Related" section (creates section if missing). For removeLinks, strips matching `[[target]]` patterns from content.

**Input:** `VaultLinkRequest` (path, addLinks, removeLinks)
**Output:** `{ path: string; links: string[] }`
**Fails if:** file does not exist

### 3.8 Frontmatter Parsing & Serialization

A domain-level frontmatter utility (no infrastructure imports). Two functions:

- **`parseFrontmatter(content: string)`** → `{ frontmatter: Record<string, unknown>; body: string }` — splits on `---` delimiters, parses YAML key-value pairs
- **`serializeFrontmatter(frontmatter: Record<string, unknown>, body: string)`** → `string` — renders `---\nkey: value\n---\nbody`

This avoids importing the infrastructure `Document` class from domain code (which would violate the layer direction rule). The `Document` class remains available for controllers and infrastructure code. Shared by vault-read, vault-tag, vault-edit, vault-link, and vault-create.

## 4. Vault Executor Pipeline

The executor is the single orchestrator. Every vault operation flows through this pipeline. Controllers, standing order evaluator, and future integrations all call the same function.

### 4.1 Pipeline Steps

```
validateRequest() → checkTrust() → executeOrStage() → recordResult() → awardReward()
```

Each step is a pure function. The orchestrator chains them, short-circuiting on failure.

**Step 1 — validateRequest:** Checks request is well-formed. Path not empty, no path traversal (`../`), file exists for operations that require it, scope enforcement (path within allowed folders).

**Step 2 — checkTrust:** Delegates to existing `trust-manager.canPerform()`. Returns the trust level for this agent + operation: `auto`, `review`, or `manual`.

**Step 3 — executeOrStage:**
- `auto` → calls vault-ops function directly, returns `{ outcome: "executed", data }`
- `review` → runs vault-ops targeting `staging/{taskId}/preview/`, creates manifest via existing `staging.ts`, returns `{ outcome: "staged", stagingId }`
- `manual` → returns `{ outcome: "queued" }` (task stays assigned, Director must trigger)

**Step 4 — recordResult:** On `executed` outcome, calls `trust-manager.recordSuccess(profile, operation, agentLevel, config)` — the `agentLevel` is derived from the ledger via `getAccount(ledger, agentName).level`. Checks auto-promotion. On `staged`, deferred until Director approves. On `queued`/`denied`/`failed`, no recording.

**Step 5 — awardReward:** On `executed` outcome with a linked taskId, uses `economy-rules.calculateReward()` with trust multiplier and credits via `economy-ledger.creditReward()`. On `staged`, deferred until approval.

### 4.2 Main Orchestrator Signature

```typescript
executeVaultOp(
	req: AnyVaultOpRequest,
	deps: VaultOpsDeps,
	profile: AgentTrustProfile,
	config: TrustConfig,
	ledger: EconomyLedger
) → {
	result: VaultOpResult;
	profile: AgentTrustProfile;
	ledger: EconomyLedger;
}
```

Returns updated profile + ledger. The caller persists. The executor never writes to disk itself.

### 4.3 Staging Approval Flow

When Director approves a staged operation:

1. `staging.approveStaged()` copies preview files to real vault paths
2. `recordResult()` runs — trust success recorded, auto-promotion checked
3. `awardReward()` runs — XP/Coin credited
4. Task status transitions to `completed`
5. Approved staging directory is kept as an audit trail (manifest status = "approved")

When Director rejects:

1. `staging.rejectStaged()` deletes staging directory
2. Task status returns to `pending` for reassignment
3. No reward, no trust recording

**Staging cleanup:** Approved staging directories accumulate as an audit record. A future `staging:clean --before=<date>` command can prune old records, but is not part of this phase.

### 4.4 Queued Operations (Manual Trust Tier)

When an operation has `manual` trust level, the executor returns `{ outcome: "queued" }`. The task stays in `assigned` status. The Director triggers execution by running `flowti vault:exec --agent=<name> --op=<op> [flags]` — this bypasses the trust check for that single invocation (the Director is explicitly authorizing it). The executor still records success and awards reward as normal.

## 5. Vault Context & Scope

### 5.1 Building Context (Cached)

The vault has ~60k files — a full walk + frontmatter parse on every work cycle is not viable. Vault context uses a **build-once, invalidate-on-change** cache persisted at `.flowti/var/vault-context-cache.json`.

**Cache structure:**

```typescript
interface VaultContextCache {
	readonly version: number;                    // cache format version
	readonly builtAt: string;                    // ISO timestamp of last full build
	readonly folderMap: readonly FolderEntry[];   // directory tree with note counts
	readonly tagIndex: readonly TagEntry[];       // all tags with frequencies
	readonly fileIndex: readonly FileIndexEntry[]; // per-file metadata for incremental updates
}

interface FileIndexEntry {
	readonly path: string;
	readonly mtimeMs: number;
	readonly tags: readonly string[];
}
```

**Build strategy:**

1. **Cold start** (no cache file): Full vault walk + frontmatter parse. Writes cache to disk. Expected to take seconds for 60k files — acceptable as a one-time cost.
2. **Warm start** (cache exists): Read cache, then do a **fast mtime scan** — walk the directory tree collecting only paths + mtimes. Compare against `fileIndex`:
   - **New files** (path not in index): parse frontmatter, add to index
   - **Modified files** (mtime changed): re-parse frontmatter, update index
   - **Deleted files** (in index but not on disk): remove from index
   - Rebuild `folderMap` and `tagIndex` from updated `fileIndex`
3. **Forced rebuild**: `flowti vault:context --rebuild` triggers a cold start

**Performance target:** Warm start should complete in <500ms for 60k files (mtime scan is fast — no file reads for unchanged files).

**Cache invalidation:** The cache is invalidated (warm start triggered) whenever:
- An agent work cycle begins
- A vault operation completes (the executor calls `invalidateContextCache()` after any write operation)

`buildVaultContext(deps, scope?, cache?)` produces a `VaultContext` snapshot:

1. Load or build cache (cold/warm start as above)
2. Derive `folderMap` and `tagIndex` from `fileIndex`
3. Build `recentChanges` from the 50 most recently modified files (sorted by mtime desc)
4. If scope provided, filter folders and tags to allowed prefixes only
5. Return `VaultContext` (cache is a build detail — callers see the same interface)

### 5.2 Scope Enforcement (Two Layers)

**Layer 1 — Context filtering:** `buildVaultContext()` only returns folders/tags within scope. Agent cannot see out-of-scope content.

**Layer 2 — Operation gating:** The executor's `validateRequest()` checks scope before executing:
- `vault-read/tag/edit/link` → `req.path` must start with an allowed folder prefix
- `vault-create` → target folder must be in scope
- `vault-move` → both `fromPath` and `toPath` must be in scope
- `vault-search` → results filtered to scoped folders/tags only

### 5.3 Scope Definition

Lives on the agent's definition file (`docs/agents/*.md`) as frontmatter:

```yaml
vaultScope:
  folders:
    - "00 - Inbox"
    - "01 - Projects"
  tags:
    - "needs-triage"
    - "project"
```

No scope defined = full vault access (default for trusted agents).

## 6. Standing Order Evaluator

### 6.1 Evaluation Flow

```
VaultEvent received
  → evaluateEvent() builds index from tasks (reuse buildIndex())
    → matchEvent() finds matching standing orders
      → evaluateRules() checks file against rule conditions
        → Builds VaultOpRequest (e.g. vault-tag with addTags)
          → Returns list of requests for the executor
```

### 6.2 Functions

**evaluateEvent(event, tasks, deps) → VaultOpRequest[]**
Builds standing order index from tasks, matches event, evaluates rules against the affected file, returns operation requests ready for the executor.

**evaluateRules(rules, filePath, deps) → { action, value } | null**
Reads the file, parses frontmatter, checks rule conditions (tags.missing, folder match, name pattern). Returns first matching rule's action + value, or null.

**recordStandingOrderRun(taskId, deps) → StandingOrderPayload**
Returns an updated payload with incremented `runCount` and new `lastRun` timestamp. The caller (controller) persists the update via `task-store.updateField()` — the evaluator itself does not write to disk.

### 6.3 Trigger Mechanism

The CLI is non-interactive — no persistent event loop. Evaluation is triggered by:

- `flowti task:evaluate --event=file-created --path="00 - Inbox/new-note.md"` — explicit CLI command
- Future: Plugin SSE bridge, file watcher hook

## 7. CLI Controllers

### 7.1 Trust Controller

Extends the existing `trust.controller.ts` which already has `trust:show`, `trust:promote`, `trust:demote`, and `trust:history`. We keep existing command names and add `trust:reset`.

| Command | Status | Purpose |
|---------|--------|---------|
| `flowti trust:show --agent=<name>` | Existing (enhance) | Show tier, operation levels, success counts, promotion log |
| `flowti trust:promote --agent=<name> --op=<op> --to=<level>` | Existing | Manual promotion (no skipping levels) |
| `flowti trust:demote --agent=<name> --op=<op> --to=<level> --reason="..."` | Existing | Demote with required reason |
| `flowti trust:history --agent=<name>` | Existing | Show promotion/demotion log |
| `flowti trust:reset --agent=<name>` | **New** | Reset operations to defaults, clear counts, keep log |

### 7.2 Staging Controller

A new controller for review-gated vault operations. Distinct from the existing `task:approve`/`task:reject` commands — those operate on task status only. `staging:approve` operates on vault file staging AND transitions the task, handling the full reward/trust recording flow.

When a task has a staging area, `task:approve` delegates to `staging:approve` internally. When a task has no staging area (e.g. non-vault tasks), `task:approve` works as before.

| Command | Purpose |
|---------|---------|
| `flowti staging:list [--agent=<name>]` | All pending staged operations |
| `flowti staging:review --id=<task-id>` | Show manifest, preview content, diff output |
| `flowti staging:approve --id=<task-id>` | Copy to vault, record success, award reward, complete task |
| `flowti staging:reject --id=<task-id> --reason="..."` | Delete staging, return task to pending |

### 7.3 Vault Controller

| Command | Purpose |
|---------|---------|
| `flowti vault:exec --agent=<name> --op=<op> [flags]` | Run single vault operation through executor pipeline |
| `flowti vault:context --agent=<name> [--rebuild]` | Show agent's vault context (filtered by scope); `--rebuild` forces cold start |
| `flowti task:evaluate --event=<event> --path=<path>` | Trigger standing order evaluation |

### 7.4 Renderers

Each controller gets a matching display file:
- `trust-display.ts` — trust profile table, promotion log
- `staging-display.ts` — pending reviews table, manifest detail, diff output
- `vault-display.ts` — context tree, operation results

Status colors follow existing conventions: GREEN=completed, YELLOW=review, CYAN=assigned, RED=failed, DIM=pending.

## 8. Persistence

All files use existing patterns. No new persistence infrastructure needed.

| File | Content | Written by |
|------|---------|-----------|
| `.flowti/var/trust-{agent}.json` | Trust profile (operations, counts, log) | Trust controller / executor |
| `.flowti/var/staging/{task-id}/manifest.json` | Staged operation manifest | Executor (review tier) |
| `.flowti/var/staging/{task-id}/preview/*` | Preview copies of affected files | Executor (review tier) |
| `.flowti/var/vault-context-cache.json` | Cached folder map, tag index, file index | vault-context (build/invalidate) |
| `.flowti/var/economy.json` | Updated balances after rewards | Executor (via caller) |
| `.flowti/var/economy-log.jsonl` | Transaction log entries | Executor (via caller) |
| `docs/tasks/{task-id}.md` | Task status updates | Controller |

## 9. Dependencies on Existing Code

| Module | What we reuse | Notes |
|--------|--------------|-------|
| `trust-manager.ts` | `canPerform()`, `recordSuccess(profile, op, agentLevel, config)`, `promote()`, `demote()`, `deriveTier()` | `recordSuccess` requires `agentLevel` param — derived from ledger |
| `trust-types.ts` | `TrustLevel`, `VaultOperation`, `AgentTrustProfile`, `TrustConfig`, defaults | |
| `staging.ts` | `createStagingArea()`, `readManifest()`, `approveStaged()`, `rejectStaged()`, `listPendingReviews()` | `approveStaged` keeps staging dir as audit |
| `economy-ledger.ts` | `creditReward()`, `appendTransaction()`, `getAccount()` | `getAccount` used to derive agent level |
| `economy-rules.ts` | `calculateReward()` with trust multiplier | |
| `leveling.ts` | `isEligible()` for trust promotion level checks | |
| `standing-order-index.ts` | `buildIndex()`, `matchEvent(index, { folder, type })` | `matchEvent` uses `type` field, not `event` |
| `task-store.ts` | `list()`, `read()`, `updateField()` | |
| `task-lifecycle.ts` | `transition()` for status updates | |

Note: Vault operations use a domain-level frontmatter parser/serializer (Section 3.8) instead of importing the infrastructure `Document` class, preserving layer direction.

## 10. Test Strategy

Tests mirror source structure: `tests/domain/vault-ops/*.test.ts`

| Test file | Scope |
|-----------|-------|
| `vault-ops-types.test.ts` | Type validation for all request/result types |
| `vault-ops.test.ts` | Each of 7 operations: happy path, edge cases, failures |
| `vault-executor.test.ts` | Pipeline flow: auto/review/manual/failed paths, short-circuits, reward wiring |
| `vault-context.test.ts` | Folder walking, tag indexing, scope filtering |
| `standing-order-evaluator.test.ts` | Event matching, rule evaluation, request building |
| `trust.controller.test.ts` | Existing (extend with `trust:reset` tests) |
| `staging.controller.test.ts` | Approve/reject flows with mocked staging + executor |
| `vault.controller.test.ts` | `vault:exec` and `vault:context` commands with mocked domain |

All domain tests mock `IFileSystem` and `IClock` via deps injection. No real filesystem access in tests.
