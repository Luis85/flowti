# World State Model — ECS-Compatible Agent Environment

**Date**: 2026-03-15
**Status**: Approved
**Scope**: Unified world state file with ECS entities, agent actions, permission tracking, and activity log

## Problem

Agent state is scattered across individual `data-*.json` files per agent. There is no unified view of the environment. Visualizations (terminal, dashboard, 2D game) need a single source of truth that captures what every agent is doing, what tools they're using, what permissions they need, and what the project landscape looks like. The current model treats agents as CLI processes, not as actors in an observable world.

## Decision

### World State File

A single `world-state.json` in `.flowti/var/` captures the complete environment. Updated on every state change with 1-second debounce.

```typescript
interface WorldState {
	readonly version: 1;
	readonly updatedAt: string;
	readonly entities: Record<string, Entity>;
	readonly permissions: Record<string, PermissionEntry[]>;
	readonly activityLog: ActivityEntry[];
}
```

### ECS-Style Entities

Entities use string IDs (agent names, project names) and store components as a typed map. This gives ECS lookup semantics while remaining human-readable.

```typescript
interface Entity {
	readonly id: string;
	readonly type: "agent" | "project" | "iteration";
	readonly components: Record<string, unknown>;
}
```

**Agent entity example:**
```json
{
  "id": "Bob",
  "type": "agent",
  "components": {
    "identity": { "agentType": "ai", "description": "...", "persona": "Bobby", "domain": "general" },
    "attributes": { "str": 8, "int": 14, "wis": 12, "cha": 16, "dex": 10, "con": 10 },
    "status": { "state": "busy", "currentAction": "using-tool", "toolName": "Edit" },
    "tasks": { "items": [{ "name": "Fix bug", "status": "pending" }] },
    "ai-config": { "provider": "anthropic", "outputFormat": "stream-json" },
    "relationships": [{ "target": "Alice", "type": "collaborates" }],
    "personality": { "mood": "cheerful", "traits": ["helpful", "curious"] },
    "experience": { "xp": 150 }
  }
}
```

**Project entity example:**
```json
{
  "id": "Flowti CLI",
  "type": "project",
  "components": {
    "iteration": { "name": "Sprint 5", "number": 5, "status": "in-progress", "goal": "Agents become autonomous" },
    "roster": { "agents": ["Bob", "Alice", "Product Owner"] },
    "health": { "coverage": 80, "tests": 6567, "lintErrors": 0 }
  }
}
```

### Agent Actions

Every observable agent behavior is an `AgentAction`. Actions are the primitive events that drive entity state and are consumed by any visualization — terminal, 2D game, dashboard.

```typescript
interface AgentAction {
	readonly id: string;
	readonly agentName: string;
	readonly timestamp: string;
	readonly type: AgentActionType;
	readonly data: Record<string, unknown>;
}

type AgentActionType =
	| "thinking"
	| "speaking"
	| "asking"
	| "using-tool"
	| "tool-complete"
	| "requesting-permission"
	| "permission-granted"
	| "permission-denied"
	| "task-started"
	| "task-completed"
	| "idle"
	| "error";
```

**Visualization mapping:**

| Action | Terminal | 2D Game |
|--------|---------|---------|
| `thinking` | dim "thinking..." indicator | thought bubble animation |
| `speaking` | formatted message display | speech bubble |
| `asking` | status bar notification | speech bubble + question mark |
| `using-tool` | "Using tool: Edit" line | agent avatar with tool icon |
| `tool-complete` | "done" indicator | tool icon fades |
| `requesting-permission` | permission prompt (Allow/Deny) | lock icon on agent |
| `permission-granted` | "Granted" confirmation | lock opens animation |
| `permission-denied` | "Denied" message | lock stays, agent redirects |
| `task-started` | "Working on: X" | agent moves to task area |
| `task-completed` | "Done: X" | checkmark animation |
| `idle` | not shown | agent idles/rests |
| `error` | red error message | alert icon |

### Permissions

Permission entries are per-agent, stored in the world state:

```typescript
interface PermissionEntry {
	readonly tool: string;
	readonly scope: "once" | "always";
	readonly grantedAt: string;
	readonly context?: string;
}
```

**Permission flow:**

1. Agent's stream output contains `tool_use` event (tool-start) followed by no `tool_end` and process exits or stalls
2. Stream parser detects the stalled tool pattern → emits `requesting-permission` action
3. CLI surfaces as: `⚡ Bobby needs permission: Edit src/main.ts  [a]llow once / [A]lways / [n]o`
4. **Allow once** — adds tool to session-only allowed list, respawns agent with expanded `--allowedTools`
5. **Allow always** — persists `PermissionEntry` to world state, updates agent's AI config `allowedTools`
6. **No** — emits `permission-denied` action, drops to agent conversation for redirect

**Detection heuristic:** Process exits (non-zero or zero) AND stream contained a `tool-start` event with no matching `tool-end`. The last tool name is the one needing permission.

### Activity Log

Rolling log of recent actions, capped at 100 entries:

```typescript
interface ActivityEntry {
	readonly id: string;
	readonly agentName: string;
	readonly timestamp: string;
	readonly type: AgentActionType;
	readonly summary: string;
}
```

The activity log is a compressed view — it stores a summary string, not the full action data. Used for "what happened recently" queries and timeline visualizations.

### Smart vs Non-Smart Agents

The action model is agent-agnostic:

- **LLM-backed agents** (`ai` config present): Actions produced by stream-json parser → `mapStreamEventToAction()`. Thinking, speaking, tool use come from Claude CLI output.
- **Pattern-backed agents** (no `ai` config, future): Actions produced by decision tree or behavior tree execution engine. Same `AgentAction` types — `thinking` becomes "evaluating", `using-tool` becomes "executing step".
- **Human agents**: Actions recorded manually via CLI interactions. "task-started" when assigned, "task-completed" when marked done.

All three produce the same action stream. Visualizations don't care about the source.

## Internal Architecture

### State Manager

A singleton in infrastructure that owns the in-memory world state:

```
WorldStateManager {
  state: WorldState (in-memory)

  emitAction(action: AgentAction): void
    → update entity status component from action
    → append to activity log (cap at 100)
    → schedule debounced write

  updateEntity(id, type, components): void
    → merge components into entity
    → schedule debounced write

  getState(): WorldState
    → return current in-memory state

  getEntity(id): Entity | null

  flush(): void
    → write immediately (for shutdown)
}
```

**Debounce:** 1-second window. Multiple actions within 1 second batch into a single file write. On CLI exit, `flush()` is called to ensure final state is persisted.

### Stream-to-Action Mapping

```typescript
function mapStreamEventToAction(agentName: string, event: AgentStreamEvent, clock: IClock): AgentAction | null {
  switch (event.kind) {
    case "thinking": return { type: "thinking", ... };
    case "text":     return { type: "speaking", data: { text: event.text } };
    case "tool-start": return { type: "using-tool", data: { tool: event.name, id: event.id } };
    case "tool-end":   return { type: "tool-complete", data: { id: event.id } };
    case "error":    return { type: "error", data: { message: event.message } };
    case "done":     return null; // completion handled by dispatch handler
    default: return null;
  }
}
```

### Integration with Agent Shell

The shell's `proc.onOutput` handler already parses stream events. Add one line to feed each event to the state manager:

```
proc.onOutput → parseStreamLine → AgentStreamEvent
                                      ↓ (existing)
                              emit to subscribers
                                      ↓ (new)
                              mapToAction → stateManager.emitAction()
```

The dispatch completion handler emits `task-completed` or `asking` actions based on response status.

### CLI Query Command

`flowti state` reads `world-state.json` and renders:

```
World State (updated 2s ago)

Agents (3)
  Bobby [ai] — using tool: Edit src/main.ts
  Alice [ai] — idle
  Product Owner [human] — task: Review PR

Projects (1)
  Flowti CLI — Sprint 5 [in-progress] — 3 agents

Recent Activity
  15:42:01  Bobby    using-tool    Edit src/main.ts
  15:41:58  Bobby    thinking      ...
  15:41:55  Alice    task-completed Fix tests
  15:41:30  Bobby    task-started  Implement feature
```

Flags:
- `flowti state --agent=Bob` — show one agent's full component map
- `flowti state --json` — raw JSON output
- `flowti state --log` — full activity log (last 100)

### Dashboard Integration

The existing `exportAgentDashboardData()` in `agent-export.ts` is refactored to transform `WorldState` → `DashboardData`. Instead of scanning individual files and stores, it reads the world state directly. The dashboard (ExcaliburJS) can also read `world-state.json` directly via the static server.

### Migration from data-*.json

On first startup after the feature is deployed:
1. `WorldStateManager.initialize()` checks if `world-state.json` exists
2. If not, scans `data-*.json` files and builds initial entity set
3. Populates project entities from `agent-export.ts`'s `buildProjectEnvironment()`
4. Writes the initial `world-state.json`
5. Existing `data-*.json` files are kept for backward compatibility but no longer written to

After migration, all state reads/writes go through the state manager. The individual `data-*.json` files become obsolete.

## Design Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State file | Single `world-state.json` | One source of truth, atomic reads, dashboard-friendly |
| Entity IDs | String names | Human-readable, maps to agent/project names naturally |
| Component storage | `Record<string, unknown>` map | ECS-like lookup by component type, extensible |
| Actions | Typed discriminated union | Renders differently per visualization, maps cleanly to game events |
| Permissions | Stored in world state | Visible to dashboard, queryable via CLI, persists across sessions |
| Write strategy | Debounce 1s | Near-realtime without I/O thrashing |
| Activity log cap | 100 entries | Enough for recent context, bounded memory |
| Migration | Read old files once, write new format | No breaking change, gradual transition |

## Files

### New (5)

| File | Responsibility |
|------|---------------|
| `src/domain/agents/world-state-types.ts` | `WorldState`, `Entity`, `AgentAction`, `AgentActionType`, `PermissionEntry`, `ActivityEntry` |
| `src/infrastructure/world-state-manager.ts` | Singleton: in-memory state, `emitAction()`, debounced persistence, `getState()`, `flush()`, migration |
| `src/domain/agents/action-mapper.ts` | `mapStreamEventToAction()` — pure function, `AgentStreamEvent` → `AgentAction` |
| `src/controller/state.controller.ts` | `flowti state` command handler |
| `src/ui/displays/state-display.ts` | Render world state summary for terminal |

### Modified (5)

| File | Change |
|------|--------|
| `src/infrastructure/agent-shell.ts` | Feed stream events through action mapper to state manager |
| `src/infrastructure/deps.ts` | Add `worldState: WorldStateManager` to `CliDeps` |
| `src/main.ts` | Initialize world state manager, call `flush()` on exit |
| `src/domain/agents/agent-export.ts` | Refactor to read from `WorldState` instead of scanning individual files |
| `src/infrastructure/command-registry` / `main.ts` | Register `state` command |

### Eventually Obsolete

| File | Status |
|------|--------|
| `src/domain/agents/agent-state.ts` | Pure functions still useful during migration. Eventually replaced by state manager operations. |
| `.flowti/var/data-*.json` | Kept for backward compat. No longer written after migration. |

## Edge Cases

- **Concurrent writes:** Only one CLI process should write world-state.json. The debounce ensures serial writes. Multiple CLI sessions reading is fine (read is atomic for JSON).
- **Corrupt world-state.json:** On parse error, rebuild from `data-*.json` files (migration path).
- **Agent name collision with project name:** Entity type field disambiguates. Queries always specify type.
- **Very active agent (rapid actions):** Debounce batches. Activity log cap prevents unbounded growth. Status component always reflects latest action.
- **CLI crash during debounce:** Up to 1 second of actions lost. Next startup rebuilds from last persisted state + `data-*.json` fallback.
- **Dashboard reads during write:** JSON files are written atomically via `writeFileSync`. Reader gets either old or new state, never partial.

## Testing

### world-state-manager.test.ts
- `emitAction` updates entity status component
- `emitAction` appends to activity log
- Activity log caps at 100 entries
- Debounced write fires after 1s (fake timers)
- `flush()` writes immediately
- `getEntity()` returns null for missing entity
- Migration reads existing `data-*.json` files
- Migration creates project entities from environment

### action-mapper.test.ts
- Maps each AgentStreamEvent kind to correct AgentActionType
- Returns null for "done" and "usage" events
- Includes agent name and timestamp in output

### state-display.test.ts
- Renders agent summary with current action
- Renders project summary with iteration
- Renders activity log entries
- Handles empty state gracefully

### state.controller.test.ts
- `flowti state` renders summary
- `flowti state --agent=Bob` shows single agent
- `flowti state --json` outputs raw JSON
