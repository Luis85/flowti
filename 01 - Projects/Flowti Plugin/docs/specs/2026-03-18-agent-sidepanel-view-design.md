# Agent Sidepanel View — Design Spec

**Date:** 2026-03-18
**Status:** Draft
**Iteration:** 5 — Agent World (C4)
**Project:** Flowti Plugin

## Problem

The Flowti Plugin has no way to interact with AI agents directly from Obsidian. The CLI manages agents and LLM providers, but users must leave the vault to talk to them. We need a persistent sidepanel that shows the agent roster, supports conversations in multiple view modes, and integrates with Obsidian's native canvas for spatial thinking.

## Goals

1. **Persistent agent sidepanel** in Obsidian's right pane — always accessible
2. **Agent roster** with RPG character cards showing live status (idle/thinking/speaking/using-tool)
3. **Three conversation modes** — document, conversational, canvas — all viewing the same session data
4. **Solo + team mode** — each agent has independent conversation history; team mode shares a thread
5. **Context awareness** — sidepanel tracks the active file and sends incremental diffs to the agent
6. **Decoupled data layer** — `IAgentService` interface stubbed now, swapped for HTTP+SSE when C2 lands

## Non-Goals

- Direct LLM API calls from the Plugin (goes through CLI server)
- Agent creation/editing (that's CLI domain)
- Plugin-side prompt engineering (prompts built by CLI)
- Real-time collaboration between multiple Obsidian users

## Architecture

### Two-Layer Design

**Layer 1 — Obsidian shell:** `AgentSidepanelView extends ItemView` in `src/ui/agents/`. Registered with `ViewRegistry`. Handles Obsidian lifecycle (`onOpen`/`onClose`), creates a container, and delegates to a handler that mounts the root Lit component.

**Layer 2 — Lit component tree:** All UI lives in `src/components/agents/`. Components extend `FlowtiElement`, use `static properties` (no decorators), override `renderContent()`, and compose `static styles` from `tokens` + shared styles + component-specific CSS.

**Data bridge:** Handler in `src/infrastructure/handlers/agent-handlers.ts` creates Lit elements, sets props via `setProps()`, listens for custom events (`bubbles: true, composed: true`), and forwards to `EventBus`. Components never import EventBus directly. The handler's mount function returns a `dispose: () => void` callback that unsubscribes all EventBus listeners. `AgentSidepanelView` stores this in `onOpen()` and calls it in `onClose()` to prevent subscription leaks across view reopens.

### Component Tree

```
<flowti-agent-sidepanel>              ← root (layout shell, state orchestration)
  <flowti-agent-roster>               ← character cards, agent switcher, team toggle
  <flowti-mode-bar>                   ← document / conversational / canvas tab strip
  <flowti-document-mode>              ← rich markdown, code blocks
  <flowti-conversational-mode>        ← chat bubbles, turn-by-turn
  <flowti-canvas-mode>                ← Obsidian canvas file manager + sync
  <flowti-input-bar>                  ← text input + send/stop
```

### Data Flow

```
User types in flowti-input-bar
  → dispatches "agent-send" CustomEvent (bubbles + composed)
  → handler catches event, calls IAgentService.sendMessage()
  → service emits agent.message.sent via EventBus
  → service contacts LLM (stub: simulated / real: HTTP POST to CLI server)
  → LLM streams back → service emits agent.thinking, agent.message.received
  → handler receives EventBus events, updates Lit element props via setProps()
  → active mode component re-renders with new turn
  → roster updates agent activity state
```

## Agent Roster

### `<flowti-agent-roster>` Component

Horizontal scrollable strip of character cards. Each agent card shows:

- **Avatar area** — first letter of persona name with colored status ring
- **Name** — persona name primary, agent slug secondary (dimmed)
- **Mood** — small text below name
- **Key stats** — INT and CHA as small badges
- **Activity indicator** — idle (grey), thinking (pulse animation), speaking (green), using-tool (orange)

**Active agent** has a highlighted border. Clicking a card fires `agent-selected` custom event.

### Team Toggle

Small switch below the roster strip. Fires `team-toggled` custom event.

- **On:** All cards show a team badge, conversation shows shared thread, input sends to all agents
- **Off:** Reverts to active agent's solo session

### Properties

```typescript
static properties = {
  ...FlowtiElement.properties,
  agents: { type: Array },
  activeAgent: { type: String },
  teamMode: { type: Boolean },
};
```

### Custom Events

| Event | Detail | When |
|-------|--------|------|
| `agent-selected` | `{ agent: string }` | User clicks a card |
| `team-toggled` | `{ enabled: boolean }` | User toggles team switch |

## Conversation Modes

All three modes share the same session data. Switching modes is a view change, not a data change. Each turn is tagged with the mode that created it.

### Shared Data Model

```typescript
interface ConversationTurn {
  id: string;
  role: "user" | "agent";
  agentName?: string;
  persona?: string;
  content: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  timestamp: string;
  mode: ConversationMode;
}

interface ToolCall {
  id: string;
  name: string;
  status: "started" | "completed";
}

type ConversationMode = "document" | "conversational" | "canvas";
```

### Mode Bar — `<flowti-mode-bar>`

Three icon buttons in a tab strip. Active mode highlighted. Fires `mode-changed` custom event with `{ mode: ConversationMode }`.

```typescript
static properties = {
  ...FlowtiElement.properties,
  activeMode: { type: String },
};
```

### Document Mode — `<flowti-document-mode>`

- Renders turns as continuous document flow
- Agent responses as rich markdown (headers, code blocks, lists)
- User messages as inline highlighted sections
- Tool calls as collapsed `<details>` elements
- Thinking content behind an expand toggle

```typescript
static properties = {
  ...FlowtiElement.properties,
  turns: { type: Array },
  agentName: { type: String },
};
```

### Conversational Mode — `<flowti-conversational-mode>`

- Classic chat layout — user right-aligned, agent left-aligned
- Agent messages show persona avatar + name
- Thinking as dimmed "thought bubble" above response
- Tool calls as compact inline status badges
- Auto-scroll to latest message

```typescript
static properties = {
  ...FlowtiElement.properties,
  turns: { type: Array },
  agentName: { type: String },
  persona: { type: String },
};
```

### Canvas Mode — `<flowti-canvas-mode>`

Uses **Obsidian's native canvas** — does not render its own graph.

- **Creates a `.canvas` file** per conversation (e.g., `.flowti/canvas/agent-atlas-session-1.canvas`)
- **Opens it in a split pane** alongside the sidepanel
- **Syncs turns as canvas nodes** — each turn becomes a text node
- **Edges connect** reply chains (user → agent → user)
- **Node colors** differentiate roles: user, agent, tool-call
- **New messages** from the input bar get added as nodes connected to the last node
- **Reads back** — detects canvas edits via vault events and feeds changes into the conversation

**Key operations:**
- `openOrCreateCanvas(agentName, sessionId)` — creates `.canvas` file, opens in workspace
- `addNode(turn)` — appends a node to the canvas JSON
- `connectNodes(fromId, toId)` — adds an edge
- `onCanvasChanged(callback)` — watches for external edits via vault events

```typescript
static properties = {
  ...FlowtiElement.properties,
  turns: { type: Array },
  agentName: { type: String },
  canvasPath: { type: String },
};
```

Custom events: `canvas-open-requested` (with `{ agentName, sessionId }`), `canvas-node-added`.

## Input Bar

### `<flowti-input-bar>` Component

- **Auto-growing text area** — supports multiline. Enter sends, Shift+Enter for newline.
- **Send button** — right side, disabled when empty or agent is processing
- **Stop button** — replaces send during agent processing
- **Agent indicator** — label above input: "Talking to Alice" (solo) or "Talking to team" (team mode)
- **Processing state** — thinking indicator while agent responds

```typescript
static properties = {
  ...FlowtiElement.properties,
  agentLabel: { type: String },
  processing: { type: Boolean },
  disabled: { type: Boolean },
};
```

Custom events: `agent-send` (with `{ message: string }`), `agent-stop`.

## Context Awareness

Background concern — no UI. The handler wires this.

### `IContextProvider` Interface

```typescript
interface IContextProvider {
  getActiveFileContext(): FileContext | null;
  getDiff(sinceHash: string): FileDiff | null;
  onFileChanged(callback: (ctx: FileContext) => void): () => void;
}

interface FileContext {
  path: string;
  contentHash: string;
  content: string;
}

interface FileDiff {
  path: string;
  previousHash: string;
  currentHash: string;
  diff: string;
}
```

- **Debounced at 2-3 seconds** — file change events are debounced before sending to the agent service
- **Periodic resync** — every N turns or on mode switch, a full hash comparison ensures context hasn't drifted
- **The agent service** includes the diff as part of the next prompt to the CLI server

## Data Layer

### `IAgentService` Interface

```typescript
interface IAgentService {
  listAgents(): AgentCard[];
  getAgent(name: string): AgentCard | undefined;
  sendMessage(agent: string, message: string, mode: ConversationMode, signal?: AbortSignal): Promise<void>;
  stopGeneration(agent: string): Promise<void>;
  getConversation(agent: string): ConversationTurn[];
  getTeamConversation(): ConversationTurn[];
  onEvent(callback: (event: AgentServiceEvent) => void): () => void;
}
```

### `AgentCard` Type

```typescript
interface AgentCard {
  name: string;
  persona?: string;
  mood?: string;
  intStat?: number;
  chaStat?: number;
  activity: "idle" | "thinking" | "speaking" | "using-tool";
}
```

### `AgentServiceEvent` Union

```typescript
type AgentServiceEvent =
  | { kind: "status-changed"; agent: string; activity: AgentCard["activity"] }
  | { kind: "message-received"; agent: string; turn: ConversationTurn }
  | { kind: "thinking"; agent: string; text: string }
  | { kind: "tool-started"; agent: string; tool: string; id: string }
  | { kind: "tool-completed"; agent: string; id: string };
```

### Stub Implementation

`StubAgentService` in `src/infrastructure/agents/stub-agent-service.ts`:
- Returns hardcoded agent roster
- Stores conversations in memory
- Simulates delayed LLM responses (thinking → text → done)
- Replaced by `HttpAgentService` when C2 lands

## Event System

New `AgentEventMap` added to the Plugin's composite event map in `src/domain/agents/events.ts`:

| Event | Payload | When |
|-------|---------|------|
| `agent.status.changed` | `{ agent, activity }` | Agent starts/stops thinking/speaking |
| `agent.message.received` | `{ agent, turn }` | New response from LLM |
| `agent.message.sent` | `{ agent, turn }` | User sent a message |
| `agent.thinking` | `{ agent, text }` | Streaming thinking content |
| `agent.tool.started` | `{ agent, tool, id }` | Agent started using a tool |
| `agent.tool.completed` | `{ agent, id }` | Tool call finished |
| `agent.mode.switched` | `{ mode }` | User changed view mode |
| `agent.team.toggled` | `{ enabled }` | Team mode on/off |
| `agent.canvas.synced` | `{ canvasPath, nodeCount }` | Canvas file updated (lives in AgentEventMap, not CanvasEventMap — this is an agent-session concern, not a canvas-domain concern. The canvas domain owns `canvas.session.*` events for generic canvas monitoring; agent canvas sync is specific to the LLM conversation-to-canvas pipeline) |

## File Layout

```
src/domain/agents/
  types.ts                              # AgentCard, ConversationTurn, ConversationMode,
                                        # IAgentService, IContextProvider, AgentServiceEvent
  events.ts                             # AgentEventMap

src/infrastructure/agents/
  stub-agent-service.ts                 # StubAgentService (in-memory, simulated)

src/infrastructure/handlers/
  agent-handlers.ts                     # Creates Lit elements, wires props ↔ EventBus

src/ui/agents/
  AgentSidepanelView.ts                 # ItemView shell — onOpen mounts root Lit element

src/components/agents/
  flowti-agent-sidepanel.ts             # Root component (layout, state, child composition)
  flowti-agent-roster.ts                # Character cards, switcher, team toggle
  flowti-mode-bar.ts                    # Mode tab strip
  flowti-document-mode.ts               # Rich markdown document view
  flowti-conversational-mode.ts         # Chat bubble layout
  flowti-canvas-mode.ts                 # Obsidian canvas file sync manager
  flowti-input-bar.ts                   # Text input + send/stop

tests/components/agents/
  flowti-agent-sidepanel.test.ts
  flowti-agent-roster.test.ts
  flowti-mode-bar.test.ts
  flowti-document-mode.test.ts
  flowti-conversational-mode.test.ts
  flowti-canvas-mode.test.ts
  flowti-input-bar.test.ts

tests/domain/agents/
  types.test.ts                         # Type assertion tests

tests/infrastructure/agents/
  stub-agent-service.test.ts            # Service behavior tests
```

## Registration

- **View type constant:** `VIEW_TYPE_AGENT_SIDEBAR = "flowti-agent-sidebar"`
- **Bootstrap pattern:** Follows `SessionSetup`/`dataExchangeSetup` — a dedicated `AgentSetup` class in `src/bootstrap/agent-setup.ts` that calls `safeRegisterView(VIEW_TYPE_AGENT_SIDEBAR, (leaf) => new AgentSidepanelView(leaf, deps))` during plugin initialization. Does NOT use `ViewRegistry.register()` (that path is metadata-only and does not bind to Obsidian's `this.registerView()`).
- **Activated** via ribbon icon or command palette: "Flowti: Open Agent Panel"

## Styling

All styles co-located in component `.ts` files via `static styles` arrays. Three-layer composition:

1. **`...FlowtiElement.styles`** — inherits tokens + utilities + base component CSS (loading/error/empty states). Note: `--flowti-error` is declared inside `FlowtiElement`'s styles, not in `tokens.ts`. For explicit color references in child components, use `--flowti-color-error` from `tokens.ts`.
2. **Named shared styles** — imported individually from `shared-styles.ts` (e.g., `statusBadge`, `masterDetailLayout`). These are NOT included via `FlowtiElement.styles` — each component imports what it needs.
3. **Component-specific CSS** — inline `css` template literal.

Example for the roster component:

```typescript
import { statusBadge } from "../shared-styles.js";

static styles = [
  ...FlowtiElement.styles,    // tokens + utilities + base states
  statusBadge,                 // shared badge styles (from shared-styles.ts)
  css`
    :host { display: flex; flex-direction: column; }
    .agent-card { /* character card layout */ }
    .activity-pulse { animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  `,
];
```

- Design tokens from `tokens.ts` inherit Obsidian theme variables automatically
- Activity indicator animations defined in `flowti-agent-roster.ts`
- Chat bubble styles in `flowti-conversational-mode.ts`
- No external CSS file — shadow DOM encapsulates everything

## Testing Strategy

- **Component tests:** happy-dom environment. `document.createElement(tag)` → set properties → `await updateComplete` → query `shadowRoot`. Factory functions for test data (`makeAgent()`, `makeTurn()`).
- **Custom event tests:** `el.addEventListener(eventName, handler)` → trigger interaction → assert detail payload.
- **Service tests:** Pure unit tests for `StubAgentService` — conversation management, message ordering, event emission.
- **Handler tests:** Mock EventBus + mock service, verify handler wires props and forwards events correctly.
- **Canvas sync tests:** Mock vault file operations, verify `.canvas` JSON structure after `addNode()` / `connectNodes()`.

## Error Handling

- **Agent service unavailable:** Root component shows `FlowtiElement`'s built-in error state with message
- **No agents in roster:** Shows empty state via `FlowtiElement`'s `isEmpty` + `emptyMessage`
- **Canvas file errors:** Canvas mode falls back to conversational mode with a warning
- **LLM timeout:** Input bar shows timeout message, re-enables send button
- **Event listener cleanup:** Handler's `mount()` returns a `dispose()` callback. `AgentSidepanelView` stores it in `onOpen()` and calls it in `onClose()`. This ensures all EventBus subscriptions created by the handler are cleaned up when the view closes (follows existing sidebar pattern where `unsubscribes[]` are collected and drained).

## Backward Compatibility

- New domain (`src/domain/agents/`) — no existing code affected
- New components (`src/components/agents/`) — self-register, no conflicts
- New handler (`agent-handlers.ts`) — registered alongside existing handlers
- `AgentEventMap` added to composite event map — additive only
- View registered with new type constant — no collision with existing views
