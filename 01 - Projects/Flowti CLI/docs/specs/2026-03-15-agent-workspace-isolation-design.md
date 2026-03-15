# Agent Workspace Isolation — Design Spec

**Date:** 2026-03-15
**Status:** Approved (spec review passed)
**Author:** Claude + Lum

## Problem Statement

Flowti's 26 AI agents and ad-hoc Claude sessions currently share a single working directory. This means:

- An agent editing files can conflict with the user's active work
- Two agents dispatched in parallel can corrupt each other's changes
- There's no clean feature-branch workflow per agent — branches are managed manually
- Runtime state in `.flowti/var/` can race when multiple agents write concurrently

We need isolated workspaces that let agents work on feature branches independently, without intervening with the main development vault or each other.

## Goals

1. **Zero-interference parallel work** — agents work in isolated filesystem copies
2. **Feature-branch-native** — each agent dispatch creates/uses a dedicated branch
3. **Unified dispatch** — one interface (`IAgentShell`) for roster agents and ad-hoc sessions
4. **State coherence** — agent identity stays centralized; runtime state is local during execution, collected back on completion
5. **Crash-safe** — orphaned workspaces are detected and recoverable
6. **Configurable** — workspace location, retention, concurrency limits, all in `.flowti/config.json`

## Non-Goals

- Real-time state sync between workspaces (too complex, unnecessary)
- Workspace networking / inter-agent communication during execution
- Container-level isolation (OS sandbox, separate Node versions)
- Automatic PR creation (can be built on top via events, not in this spec)

---

## Architecture Overview

```
IAgentShell.dispatch(request)
       │
       ├── WorkspaceProvisioner.provision()
       │       ├── git worktree add (default)
       │       └── git clone (fallback)
       │
       ├── StateSplitter.inject()
       │       ├── Copy identity (agent def, CLAUDE.md, .claude/)
       │       └── Stub runtime (.flowti/var/ with snapshots)
       │
       ├── ProcessRunner.spawn({ cwd: workspace.path })
       │       └── Existing stream-json agent process
       │
       ├── WorkspaceRegistry.register()
       │       └── Track in .flowti/var/workspace-registry.json
       │
       └── On process exit:
               ├── StateCollector.collect()
               ├── WorkspaceRegistry.transition()
               └── Dispose or retain workspace
```

### Layer Placement

| Component | Layer | Rationale |
|-----------|-------|-----------|
| `AgentWorkspace` (entity) | Domain | Pure data, lifecycle states |
| `WorkspaceProvisioner` | Infrastructure | Shell commands (git), filesystem |
| `StateSplitter` | Infrastructure | File copy operations |
| `StateCollector` | Infrastructure | File read/merge operations |
| `WorkspaceRegistry` | Infrastructure | JSON persistence (in-memory + flush-on-mutate) |
| `IAgentShell` | Domain (interface) | Contract; impl in infrastructure |
| `AgentShell` (impl) | Infrastructure | Composes all above |
| CLI commands | Controller | Parse flags, call domain, return `CliResponse` |
| Workspace menus | UI | Sitemap-driven interactive pages |

---

## Domain Model

### AgentWorkspace Entity

```ts
type WorkspaceState =
  | 'provision'
  | 'ready'
  | 'active'
  | 'collecting'
  | 'disposed'
  | 'retained';

interface AgentWorkspace {
  id: string;                     // "ws-bob-feat-auth-a3f2"
  agentSlug: string;              // "bob" or "adhoc"
  branch: string;                 // "agent/bob/auth-middleware"
  baseBranch: string;             // "master"
  method: 'worktree' | 'clone';
  state: WorkspaceState;
  path: string;                   // absolute path to workspace root
  pid?: number;                   // agent process ID when active
  processName?: string;            // process binary name (for PID reuse detection on Windows)
  retain: boolean;
  createdAt: string;              // ISO 8601
  completedAt?: string;
  collectResult: CollectResult | null;   // null until collection runs; sentinel value on collectSkipped
}
```

### Lifecycle State Machine

```
provision → ready → active → collecting ─┬→ disposed
                                          └→ retained
```

| State | Entry condition | Exit condition |
|-------|----------------|----------------|
| `provision` | `dispatch()` called | Filesystem + identity ready |
| `ready` | Provisioning complete | Process spawned |
| `active` | Process running (PID set) | Process exits (any reason) |
| `collecting` | Process exit detected | State collection complete |
| `disposed` | Collection done, `retain=false` | Terminal |
| `retained` | Collection done, `retain=true` | Manual dispose or prune |

---

## IAgentShell Interface

```ts
interface IAgentShell {
  dispatch(request: DispatchRequest): Promise<DispatchResult>;
  list(): AgentWorkspace[];
  collect(workspaceId: string): Promise<CollectResult>;  // see collect() semantics below
  dispose(workspaceId: string): Promise<void>;
  prune(options?: PruneOptions): Promise<PruneSummary>;
}

// collect() on a disposed workspace is a no-op — returns the stored collectResult.
//   If collectResult is null (collectSkipped), returns a sentinel:
//   { commits: [], filesChanged: 0, conversationTurns: 0, runtimeState: {}, errors: ['collectSkipped'] }
// collect() on a retained workspace re-runs collection (idempotent).
// collect() on a workspace in any state before 'collecting' throws.

interface DispatchRequest {
  agent: string;                          // slug or "adhoc"
  task: string;                           // prompt / task description
  branch?: string;                        // auto: "agent/{slug}/{task-slug}"
  baseBranch?: string;                    // default: current HEAD branch
  retain?: boolean;                       // override config default
  allowedTools?: string[];                // permission scope
  timeout?: number;                       // ms override
  provider?: 'anthropic' | 'cursor';      // provider override
}

// Reuses existing AgentProcess from worker-types.ts
// AgentProcess.result resolves to { text, thinking, exitCode }
interface DispatchResult {
  workspace: AgentWorkspace;
  process: AgentProcess;                  // existing ProcessRunner handle
  branch: string;
  output: Promise<AgentProcessResult>;    // resolves on process exit
}

// Mirrors AgentProcess['result'] — the resolved value of the process promise
interface AgentProcessResult {
  text: string;
  thinking: string;
  exitCode: number;
}

interface CollectResult {
  commits: string[];
  filesChanged: number;
  conversationTurns: number;
  runtimeState: Record<string, unknown>;  // merged agent data-{slug}.json fields
  errors: string[];
}

interface PruneOptions {
  olderThan?: number;                     // ms age threshold
  state?: 'retained' | 'disposed';
  dryRun?: boolean;
}

interface PruneSummary {
  removed: number;
  freed: string;                          // human-readable disk space
  skipped: number;
  errors: string[];
}
```

### Dispatch Flow (Internal)

1. Resolve agent identity from `03 - Resources/Agents/{slug}.*`
2. Generate branch name if not provided: `agent/{slug}/{task-slug-8chars}`
3. Check `maxConcurrent` — reject if at limit
4. Call `WorkspaceProvisioner.provision()` → worktree or clone
5. Call `StateSplitter.inject()` → copy identity, stub runtime
6. Spawn process via `ProcessRunner` with `cwd: workspace.path`
7. Register in `WorkspaceRegistry`, emit `workspace:active`
8. On process exit → `collecting` → `StateCollector.collect()` → `disposed` or `retained`

---

## Workspace Provisioning

### Configuration

Added to `.flowti/config.json` under a new `workspaces` key:

```json
{
  "workspaces": {
    "baseDir": "C:/Projects/flowti-agents",
    "defaultRetain": false,
    "retentionMaxAge": 604800000,
    "maxConcurrent": 5,
    "branchPrefix": "agent/"
  }
}
```

**TypeScript type** — added to `FlowtiCliConfig` in `src/infrastructure/types-config.ts`:

```ts
interface WorkspacesConfig {
  baseDir: string;
  defaultRetain: boolean;
  retentionMaxAge: number;
  maxConcurrent: number;
  branchPrefix: string;
}

// Added to FlowtiCliConfig:
workspaces?: WorkspacesConfig;
```

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `baseDir` | string | `../flowti-agents` (sibling of vault) | Root directory for all workspaces |
| `defaultRetain` | boolean | `false` | Keep workspaces after completion |
| `retentionMaxAge` | number | `604800000` (7 days) | Max age for retained workspaces |
| `maxConcurrent` | number | `5` | Max simultaneous workspaces |
| `branchPrefix` | string | `"agent/"` | Prefix for auto-generated branch names |

### Provisioning Logic

**Windows path safety:** All git commands must quote path arguments. `WorkspaceProvisioner` validates that `baseDir` is safe for shell execution — paths with special characters are escaped. This mirrors the existing quoting pattern in `agent-process-runner.ts`.

```
WorkspaceProvisioner.provision(agentSlug, branch, baseBranch)
  │
  ├─ Is branch already checked out in another worktree?
  │    ├─ No  → git worktree add <baseDir>/<workspace-id> -b <branch> <baseBranch>
  │    └─ Yes → Resolve baseBranch SHA: git rev-parse <baseBranch>
  │             git clone <vault-root> <baseDir>/<workspace-id>
  │             git checkout -b <branch> <baseBranch-SHA>
  │
  ├─ Workspace ID format: ws-{agentSlug}-{branchSuffix}-{4-char-hex}
  │
  └─ Return { path, method, branch }
```

### Worktree vs Clone Decision

| Condition | Method |
|-----------|--------|
| Branch not checked out anywhere | `worktree` |
| Branch already in use by another worktree | `clone` |
| `baseDir` on different filesystem than vault | `clone` |
| Explicit `method: 'clone'` in dispatch request | `clone` |

### Clone Post-Provision

**For worktrees:** `node_modules/` is untracked and not present in a fresh worktree checkout. A post-provision step runs `npm install` (or symlinks) inside the project subdirectory — e.g., `<workspace>/01 - Projects/Flowti CLI/node_modules`.

**For clones:** Same situation — `node_modules/` not present. Options (in order of preference):

1. Symlink from source project dir: `<vault-root>/01 - Projects/Flowti CLI/node_modules` → `<workspace>/01 - Projects/Flowti CLI/node_modules`
2. Run `npm install` inside `<workspace>/01 - Projects/Flowti CLI/` (slower but fully independent)

Default: symlink. Configurable per-project via `fullIsolation: true` in dispatch options if full `npm install` is needed.

---

## State Split & Collection

### Split (at provision time)

| Asset | Source | Workspace destination | Mode |
|-------|--------|----------------------|------|
| Agent definition | `03 - Resources/Agents/{slug}.*` | Same relative path | Read-only copy |
| CLAUDE.md | Vault root | Workspace root | Read-only copy |
| `.claude/` (rules, skills) | Vault root | Workspace `.claude/` | Read-only copy |
| `.flowti/config.json` | Vault root | Workspace `.flowti/config.json` | Copy (adjusted paths) |
| Agent runtime state | `.flowti/var/data-{slug}.json` | Workspace `.flowti/var/data-{slug}.json` | Snapshot copy |
| Conversations | `.flowti/var/conversations/{slug}.json` | Not copied | Fresh empty stub |
| World state | `.flowti/var/world-state.json` | Workspace `.flowti/var/world-state.json` | Point-in-time snapshot |

### Collection (on process exit)

```ts
interface StateCollector {
  collect(workspace: AgentWorkspace): Promise<CollectResult>;
}
```

Collection steps:

1. **Runtime state merge** — Read workspace `.flowti/var/data-{slug}.json`, merge into central copy
   - Field-level last-writer-wins (workspace version takes precedence)
   - Central-only fields preserved if not touched by workspace
2. **Conversation append** — Read workspace conversation file, append as new thread to central file
3. **Git scan** — `git log baseBranch..branch` to enumerate new commits
4. **Emit** `workspace:collecting` event with `CollectResult`
5. **Transition** to `disposed` or `retained`

### Merge Strategy

Field-level last-writer-wins. Since each workspace is scoped to one agent, and agents don't share runtime files, there are no cross-agent conflicts. The only shared file is `workspace-registry.json`, which uses append-only semantics.

---

## CLI Commands

### New `workspace:` Namespace

The CLI uses "workspace" (not "worktree") because the underlying mechanism may be either a git worktree or a clone. The domain model is `AgentWorkspace`, the events are `workspace:*`, and the CLI surface matches.

| Command | Flags | Purpose |
|---------|-------|---------|
| `flowti workspace:list` | `--format=json\|table` | List all workspaces with state, agent, branch, age, method |
| `flowti workspace:provision` | `--agent=<slug> --branch=<name> [--base=<branch>]` | Manually provision without dispatching |
| `flowti workspace:collect <id>` | | Manually trigger state collection |
| `flowti workspace:dispose <id>` | `[--force]` | Delete workspace from disk |
| `flowti workspace:prune` | `[--older-than=7d] [--dry-run] [--force]` | Bulk cleanup |
| `flowti workspace:inspect <id>` | `--format=json\|table` | Workspace details — commits, changes, state |

### Extended `agent:dispatch`

```bash
flowti agent:dispatch --agent=bob --task="Add auth middleware" --isolated
flowti agent:dispatch --agent=adhoc --task="Refactor tests" --branch=feat/test-cleanup --isolated
```

The `--isolated` flag triggers workspace provisioning. Without it, existing behavior (run in current directory) is preserved.

### Interactive UI

New **Workspaces** page added to `configs/sitemap.json`:

```
Agents Menu → Workspaces
  ├── List active workspaces
  ├── Inspect workspace
  ├── Collect workspace state
  ├── Dispose workspace
  └── Prune old workspaces
```

The existing agent interaction menu gains a workspace option:

```
Agents → Select Agent → Run Task →
  "Where should this agent work?"
    (a) Here (current workspace)
    (b) Isolated workspace
```

---

## Event Integration

| Event | Payload | Emitted when |
|-------|---------|-------------|
| `workspace:provisioned` | `{ workspace, method }` | Worktree/clone created |
| `workspace:ready` | `{ workspace }` | Identity injected, ready to launch |
| `workspace:active` | `{ workspace, pid }` | Agent process started |
| `workspace:collecting` | `{ workspace, collectResult }` | Process exited, state merging |
| `workspace:disposed` | `{ workspace, summary }` | Workspace removed from disk |
| `workspace:retained` | `{ workspace }` | Workspace kept for review |
| `workspace:orphaned` | `{ workspace }` | Active state but no running process |
| `workspace:error` | `{ workspace, error: string }` | Provisioning or collection failure |

These events require extending `CliEventMap` in `cli-events.ts` with a `WorkspaceEventMap` intersection type.

These integrate with the existing EventBus pattern. Consumers can react — e.g., auto-create a PR on `workspace:collecting` if commits exist, update the agent dashboard on state changes, or notify the user on `workspace:orphaned`.

---

## Error Handling

### Provisioning Failures

| Scenario | Handling |
|----------|----------|
| `git worktree add` fails (branch collision) | Automatic fallback to clone |
| Clone fails (disk space, permissions) | Fail fast, emit `workspace:error`, return error |
| `maxConcurrent` reached | Reject with message: "N/N workspaces active — dispose or increase limit" |
| `baseDir` doesn't exist | Auto-create on first provision |
| `baseDir` on different filesystem | Detect and force clone method |

### Runtime Failures

| Scenario | Handling |
|----------|----------|
| Agent process crashes | Workspace stays `active`; `prune` detects orphan via stale PID |
| Agent exceeds timeout | `ProcessRunner` kills process → normal `collecting` transition |
| Agent corrupts workspace git state | Collection skips git scan, logs warning, still collects runtime state |
| Two dispatches to same branch name | Second gets auto-suffix: `agent/bob/auth` → `agent/bob/auth-2` |

### Collection Failures

| Scenario | Handling |
|----------|----------|
| Central `.flowti/var/` locked | Retry 3x with backoff, leave in `collecting` for manual resolution |
| Merge conflict at same field | Workspace version wins (fresher) |
| Workspace deleted before collection | Mark `disposed` with `collectSkipped: true` warning |
| `collect()` on disposed workspace | No-op — returns stored `collectResult` from registry |
| `collect()` on workspace before `collecting` state | Throws — cannot collect while still active or provisioning |

### Crash Recovery (CLI Restart)

**PID reuse safety (Windows):** PIDs are reused quickly on Windows. To avoid false-active detection, the registry stores `processName` alongside `pid` at spawn time. Recovery checks both PID existence AND process name match using `tasklist /FI "PID eq <pid>"`. A PID match with wrong process name is treated as orphaned.

```
CLI starts → load WorkspaceRegistry
  │
  ├─ 'active' workspaces: check PID running + process name match
  │    ├─ Both match → leave as active
  │    └─ Mismatch or not running → mark orphaned, surface to user
  │
  ├─ 'collecting' workspaces: re-attempt collection (idempotent)
  │
  └─ 'retained' workspaces: check age, flag for prune if expired
```

Nothing silent or destructive. Orphans surface to the user. Collection retries are idempotent. Prune requires confirmation or `--force`.

---

## Directory Layout Example

```
C:\Projects\
├── flowti\                              # Main vault (user works here)
│   ├── .git\
│   ├── .flowti\
│   │   └── var\
│   │       ├── workspace-registry.json  # Central registry
│   │       ├── data-bob.json            # Central agent state
│   │       └── conversations\
│   │           └── bob.json             # Central conversations
│   ├── 01 - Projects\Flowti CLI\
│   ├── 03 - Resources\Agents\
│   └── CLAUDE.md
│
└── flowti-agents\                       # Workspace base dir (configurable)
    ├── ws-bob-feat-auth-a3f2\           # Bob's isolated workspace
    │   ├── .flowti\var\                 # Local runtime state
    │   ├── .claude\                     # Copied skills/rules
    │   ├── CLAUDE.md                    # Copied
    │   └── (full repo via worktree)
    │
    └── ws-alice-feat-tests-b7c1\        # Alice's isolated workspace
        ├── .flowti\var\
        ├── .claude\
        ├── CLAUDE.md
        └── (full repo via worktree)
```

---

## Dependencies & Integration Points

### Existing Components Modified

| Component | Change |
|-----------|--------|
| `IAgentProcessRunner` | Add optional `cwd?: string` to spawn options — **breaking interface change** (existing caller: `WorkerManager`) |
| `WorkerManager` | Call `IAgentShell.dispatch()` instead of direct `ProcessRunner` when `--isolated` |
| `.flowti/config.json` | New `workspaces` configuration block |
| `configs/sitemap.json` | New Workspaces page |
| Agent interaction menus | "Where to work?" prompt before dispatch |

### New Components

| Component | Layer | File |
|-----------|-------|------|
| `AgentWorkspace` type | Domain | `src/domain/agents/agent-workspace.ts` |
| `IAgentShell` interface | Domain | `src/domain/agents/agent-shell.ts` |
| `AgentShell` impl | Infrastructure | `src/infrastructure/agent-shell.ts` |
| `WorkspaceProvisioner` | Infrastructure | `src/infrastructure/workspace-provisioner.ts` |
| `StateSplitter` | Infrastructure | `src/infrastructure/state-splitter.ts` |
| `StateCollector` | Infrastructure | `src/infrastructure/state-collector.ts` |
| `WorkspaceRegistry` | Infrastructure | `src/infrastructure/workspace-registry.ts` — loads from disk on construction, maintains in-memory copy, flushes to `.flowti/var/workspace-registry.json` on every mutation (mirrors `WorldStateManager` debounced-write pattern) |
| `workspace:*` controllers | Controller | `src/controllers/workspace-controller.ts` |
| Workspace renderers | UI | `src/ui/renderers/workspace-renderers.ts` |
| Workspace menu handlers | UI | `src/ui/handlers/workspace-handlers.ts` |

---

## Testing Strategy

| Level | What | How |
|-------|------|-----|
| Unit | `AgentWorkspace` state transitions | Pure function tests, no mocks |
| Unit | `WorkspaceProvisioner` | Mock `git` commands via DI'd shell |
| Unit | `StateSplitter` / `StateCollector` | Mock filesystem via DI'd disk |
| Unit | `WorkspaceRegistry` CRUD | In-memory store |
| Unit | `IAgentShell.dispatch()` flow | Mock all infra deps |
| Integration | Provision → spawn → collect round-trip | Real git worktree on temp dir |
| Integration | Clone fallback on branch collision | Two provisions on same branch |
| Integration | Crash recovery | Kill process, restart CLI, verify orphan detection |
| CLI | `workspace:list`, `workspace:prune` | Snapshot tests on rendered output |

---

## Open Questions

1. **Should `node_modules` symlink be the default for clones, or should we always `npm install` for full isolation?** — Recommendation: symlink default, `fullIsolation: true` flag for when needed.
2. **Should the workspace inherit the parent's `.env` / environment variables, or start clean?** — Recommendation: inherit by default, with an `env` override map in `DispatchRequest`.
3. **Should workspaces get their own `.flowti/config.json` or share the vault's?** — Decision: copy with adjusted `baseDir` path so workspace doesn't recurse.
