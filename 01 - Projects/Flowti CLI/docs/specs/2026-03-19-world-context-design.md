# WorldContext — Design Spec

**Date:** 2026-03-19
**Status:** Draft
**Scope:** A plugin-level context service that aggregates workspace state and injects it into agent prompts — full snapshot on first message, incremental deltas after.

## Problem

Agent prompts currently include only the active file path and a content snippet. Agents have no awareness of the broader workspace: which files are open, what canvas is being viewed, what project/iteration is active, what other agents are doing. This limits the quality and relevance of agent responses.

## Solution

A `WorldContext` service that maintains a live, event-driven picture of the user's workspace and serializes it into compact markdown for prompt injection. First message to an agent includes a protocol instruction + full snapshot. Subsequent messages include only what changed (deltas). Agents are instructed to keep responses short and ask before going deep.

## Architecture

### WorldContext Service

**Location:** `src/infrastructure/world-context.ts`

Created once during plugin startup in `agent-setup.ts`. Lives for the entire plugin lifecycle — not tied to the game view. Consumed by both the Agent World game and the agent sidepanel.

```typescript
interface WorldContext {
  // ── Live state (read-only) ──────────────────────────
  readonly activeFile: { path: string; contentSnippet: string; type: string } | null;
  readonly openFiles: readonly { path: string; type: string }[];
  readonly activeCanvas: { path: string; summary: string } | null;
  readonly projectInfo: { name: string; path: string; domains: string[] } | null;
  readonly currentIteration: { name: string; phase: string; scopeDone: number; scopeTotal: number } | null;
  readonly agentRoster: readonly { name: string; domain: string; status: string; currentTask?: string }[];
  readonly recentActivity: readonly { agent: string; action: string; timeAgo: string }[];

  // ── Serialization ───────────────────────────────────
  serialize(): string;                              // full snapshot (~200-500 tokens)
  serializeDelta(agentName: string): string | null; // changes since agent's last seen, null if unchanged
  markSeen(agentName: string): void;                // advance agent's version pointer

  // ── Protocol ────────────────────────────────────────
  getProtocolInstruction(agentName: string, domain: string): string;

  // ── Subscription ────────────────────────────────────
  onChange(cb: () => void): () => void;

  // ── Lifecycle ───────────────────────────────────────
  dispose(): void;
}
```

### Constructor Dependencies

```typescript
interface WorldContextDeps {
  contextProvider: ObsidianContextProvider;  // existing — wraps active file tracking
  workspace: Workspace;                      // Obsidian workspace API
  vaultAdapter: { exists(p: string): Promise<boolean>; read(p: string): Promise<string> };
  eventBus: IEventBus;
}
```

### Data Sources

| Section | Source | Update Trigger |
|---------|--------|---------------|
| `activeFile` | `ObsidianContextProvider` (existing) | `onFileChanged()` callback |
| `openFiles` | `workspace.iterateAllLeaves()` | `layout-change` workspace event |
| `activeCanvas` | Vault adapter + `CanvasParser` (existing) | `file-open` event when `.canvas` file is active |
| `projectInfo` | Read `configs/flowti.config.json` from vault | Once on startup, refresh on file-modify event |
| `currentIteration` | Read active iteration from `.flowti/var/` | Once on startup, refresh on file-modify event |
| `agentRoster` | Read `agent-dashboard.json` | Once on startup, refresh when EventBus emits agent events |
| `recentActivity` | Read `world-state.json` activity log | Once on startup, updated via EventBus events |

**Update strategy:** Event-driven for fast-changing sections (active file, open files, canvas). Cached reads with 60s refresh interval for slow-changing sections (project info, iteration, roster).

### Version Tracking

WorldContext maintains a monotonic version counter that increments on every state change. Each agent has a last-seen version tracked via `markSeen(agentName)`.

`serializeDelta(agentName)` compares the current version against the agent's last-seen version. It collects all changes between those versions into a compact change list. If the delta would be larger than the full snapshot (many changes accumulated), it falls back to a full snapshot.

## Prompt Injection Protocol

### First Message to an Agent

Three blocks injected before the user's message:

**1. Protocol instruction (~150 tokens, once per conversation):**

```
[Agent Protocol]
You are {agentName}, a {domain} specialist on the Flowti team.
You receive live context updates about the user's workspace between messages.
Keep responses short and conversational (1-3 sentences).
If a question requires deep analysis, ask the user: "Want me to think deeper on this?"
Do not explain your reasoning unless asked. Act, don't narrate.
Context updates look like [Context Update] blocks — absorb them silently, don't acknowledge them.
```

**2. Full world context snapshot (~200-500 tokens):**

```
[World Context — Snapshot]
Active: src/game/engine.ts (TypeScript)
Open: engine.ts, agent-actor.ts, dashboard-store.ts, 18-misc.css
Canvas: "App Overview" — 4 groups (Frontend, Backend, Data, Infra), 12 nodes, 8 edges. Key flows: Auth → API [validates], Router → Views [navigate]
Project: Flowti Plugin — domains: agents, canvas, session, analytics
Iteration: "Agent World" Phase B — 7/10 done
Team: Atlas (orchestration, idle), Bob (engineering, busy: "Fix parser"), Iris (quality, idle)
Recent: Bob started "Fix parser" 3m ago, Atlas completed "Alignment" 12m ago
```

**3. The user's actual message**

### Subsequent Messages

```
[Context Update]
Active changed: engine.ts → plugin-provider.ts
File opened: plugin-provider.ts
Bob completed "Fix parser", now idle

{user's message}
```

If nothing changed since the last message, only the user's message is sent (no context block).

## Canvas Summarization

When the user has a `.canvas` file open, the WorldContext uses the existing `CanvasParser` to produce a structured summary.

```typescript
function summarizeCanvas(parsed: CanvasParsedResult): string
```

**Output format:**
```
"App Overview" — 4 groups, 12 nodes, 8 edges
Groups: Frontend (Auth, Router, Views), Backend (API, Workers, Queue), Data (Vault, State), Infra (CI, Deploy)
Key flows: Auth → API [validates], Router → Views [navigate], API → Queue [async]
```

**Rules:**
- Groups listed with their children (max 5 children shown, then "+N more")
- Edges summarized as flows with labels
- Nodes without a group listed as "Ungrouped: ..."
- Total output capped at ~200 tokens
- If no canvas is open, section is omitted from serialization

Uses existing `CanvasParser.buildCanvasItems()` and `buildRelations()` — no new parsing logic, just a text serializer on top.

## Wiring

### In `agent-setup.ts`

```typescript
const worldContext = new WorldContext({
  contextProvider,
  workspace: deps.app.workspace,
  vaultAdapter: deps.app.vault.adapter,
  eventBus: deps.eventBus,
});
```

Passed to both `AgentWorldViewDeps` and `AgentSidepanelDeps`.

### In `DashboardStore.sendMessage()`

```typescript
async sendMessage(agentName: string, message: string): Promise<ApiResult> {
  const isFirstMessage = !this.conversations.has(agentName);
  let contextBlock: string;

  if (isFirstMessage) {
    const protocol = this.worldContext.getProtocolInstruction(agentName, agentDomain);
    const snapshot = this.worldContext.serialize();
    contextBlock = `${protocol}\n\n${snapshot}`;
  } else {
    const delta = this.worldContext.serializeDelta(agentName);
    contextBlock = delta ?? "";
  }

  this.worldContext.markSeen(agentName);
  // ... send contextBlock + message to server
}
```

### In the server

The server receives `{ agentName, message, context }` where `context` is the serialized WorldContext string. It prepends `context` to the LLM prompt as before — same shape, richer content.

## What Gets Replaced

| Current | Replaced by |
|---------|------------|
| `DashboardStore.userContext` | `WorldContext.activeFile` |
| `DashboardStore.setUserContext()` | WorldContext event-driven updates |
| Manual context enrichment in `sendMessage()` | `WorldContext.serialize()` / `serializeDelta()` |
| `contextProvider` field on `AgentWorldViewDeps` | `worldContext` field (wraps contextProvider) |

## What Stays

| Component | Reason |
|-----------|--------|
| `ObsidianContextProvider` | Wrapped by WorldContext, still used for active file tracking |
| `CanvasParser` | Used by WorldContext for canvas summarization |
| Server-side prompt prepend | Same shape, receives richer context string |
| Debug panel | Shows the full serialized context (snapshot or delta) |

## Testing

| Area | Approach |
|------|----------|
| `WorldContext` | Mock workspace, vault adapter, context provider, EventBus. Test `serialize()` output format, `serializeDelta()` change detection, `markSeen()` version advancement |
| Canvas summarizer | Pass sample `CanvasParsedResult`, verify compact text output |
| Protocol instruction | Verify agent name/domain interpolation |
| Delta tracking | Verify null when nothing changed, correct diff when state changes, fallback to full snapshot when delta exceeds threshold |
| Integration | Verify `sendMessage` injects protocol + snapshot on first call, delta on subsequent calls |

**Coverage target:** 80% statements, 80% lines (plugin convention).

## Size Impact

| Metric | Change |
|--------|--------|
| New files | `src/infrastructure/world-context.ts` (~200-300 lines), `tests/infrastructure/world-context.test.ts` |
| Modified files | `agent-setup.ts`, `dashboard-store.ts`, `agent-world-view.ts`, `agent-sidepanel-view.ts` |
| Deleted code | `DashboardStore.userContext`, manual context enrichment in `sendMessage()` |
