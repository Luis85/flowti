# Agent Chat View v2 — Design Spec

**Date:** 2026-03-15
**Status:** Approved
**Scope:** Agent Chat interface only (existing sitemap/menus unchanged)

## Problem

The current agent chat view (`agents-interact-menu.ts`) is a 413-line monolith handling spinner animation, stream event rendering, conversation persistence, response parsing, and input management in one file. It provides minimal feedback during agent work, no visibility into autonomous task progress, no conversation history display, and suffers from readline contention that garbles output. Compared to modern AI chat interfaces, it is brittle and unpleasant to use.

## Goals

1. A rich, stable agent conversation interface with streaming responses, visible tool activity, and conversation history
2. A task mode for monitoring autonomous agent work with live progress feedback
3. Clean integration with the existing sitemap-driven navigation
4. The TUI library (ink) contained behind a service interface so the rest of the CLI stays zero-dep

## Non-Goals

- Redesigning the menu system, navigation, or other CLI pages
- Replacing the non-interactive CLI command interface
- Building a general-purpose terminal UI framework

## Architecture

### Service Boundary

```
Sitemap Router (existing)
    │
    ▼  navigate to "agents-chat"
ChatShell (new, UI layer)
    │
    ▼  uses
IChatRenderer (interface, infrastructure)
    │
    ▼  implemented by
InkChatRenderer (infrastructure — ink lives here only)
```

**ChatShell** is the UI-layer orchestrator. It knows about agents, conversations, and domain types. It decides what to show and when. It calls `IChatRenderer` methods to update the display.

**InkChatRenderer** is the infrastructure implementation. It owns React components, ink lifecycle, and terminal rendering. It never touches domain logic or persistence.

**The handoff:** When the sitemap router navigates to `agents-chat`, a `ViewHandler` suspends the normal menu loop, launches `ChatShell` via `IChatRenderer`, and the chat shell owns the terminal until the user exits. On exit, it returns a `MenuResult` and the sitemap router resumes.

### IChatRenderer Interface

```typescript
interface IChatRenderer {
  // Lifecycle
  mount(config: ChatConfig): Promise<void>;
  unmount(): Promise<MenuResult>;

  // Content
  pushMessage(message: ChatMessage): void;
  pushStreamEvent(event: AgentStreamEvent): void;
  updateStatus(status: ChatViewStatus): void;
  showHistory(summary: string, recentTurns: ChatTurn[]): void;

  // Input (renderer calls back when user submits)
  onUserInput(callback: (text: string) => void): void;
  onCommand(callback: (cmd: ChatCommand) => void): void;
}
```

### Chat View Types

These types define the contract between ChatShell and InkChatRenderer. They live in `chat-renderer-types.ts`.

```typescript
/** Derived from WorkerState with "error" added for chat-specific error display. */
type ChatViewStatus = "idle" | "thinking" | "working" | "waiting" | "error";

/** Configuration passed to the renderer on mount. */
interface ChatConfig {
  agentName: string;
  persona?: string;         // display name / role from agent definition
  topicName?: string;       // active conversation topic (thread ID label)
  mode: "conversation" | "task";
  taskBrief?: string;       // shown in task mode header
}

/** A completed message in the conversation (either role). */
interface ChatMessage {
  role: "user" | "agent";
  content: string;
  timestamp: string;        // ISO 8601
  tools?: ChatToolCall[];   // tool calls within this message (agent only)
}

/** A tool call summary for the collapsed/expandable tool panel. */
interface ChatToolCall {
  name: string;             // e.g. "Read", "Edit"
  target?: string;          // e.g. "auth.ts"
  input?: string;           // truncated JSON input (for expanded view)
  output?: string;          // truncated output (for expanded view)
  status: "done" | "active" | "error";
  durationMs?: number;
}

/**
 * A conversation turn for history display.
 * Maps from the existing ConversationTurn in agent-conversation-store.ts,
 * projected to only the fields the renderer needs.
 */
interface ChatTurn {
  role: "user" | "agent";
  content: string;
  timestamp: string;
  thinking?: string;        // optional thinking text (for expandable display)
}

/** Discriminated union of slash commands parsed from user input. */
type ChatCommand =
  | { type: "new" }
  | { type: "done" }
  | { type: "back" }
  | { type: "let-go" }
  | { type: "history" }
  | { type: "topics" }
  | { type: "pick"; name: string }
  | { type: "clear" }
  | { type: "focus" }
  | { type: "talk" };
```

### Dependency Containment

Ink and React are runtime dependencies, but contained to exactly two files:

- `src/infrastructure/ink-chat-renderer.ts` — the only file that imports ink/react
- `src/infrastructure/chat-renderer-types.ts` — `IChatRenderer` interface (no ink imports)

**Lazy loading via dynamic import:**

```typescript
// In deps.ts — ink is only loaded when chat is opened
chatRenderer: {
  create: async () => {
    const { InkChatRenderer } = await import("./ink-chat-renderer.js");
    return new InkChatRenderer();
  }
}
```

Ink's module graph (React, Yoga WASM) is never loaded during normal CLI usage. Startup time is unaffected.

### New Dependencies

```
ink              → runtime dep
react            → peer dep of ink
@inkjs/ui        → spinner, text-input components
yoga-layout      → transitive (ink's flexbox engine, WASM)
```

All other CLI files continue to work with `IChatRenderer` — the interface. The rest of the CLI stays zero-dep.

## Chat View Layout

The chat view is a full-screen takeover with persistent chrome (header/footer). Five regions compose the view:

### 1. Header Bar

Always visible, single line. Shows:
- Agent name and persona role
- Status indicator (● idle / ● thinking / ● working / ● waiting)
- Active conversation topic name
- Keyboard shortcut hints (Esc exit, / commands)

### 2. Message Area (scrollable)

The main content region, `flexGrow=1`. Contains:
- **History summary** — AI-generated summary of older turns, displayed as an italic block quote with turn count. Loaded from cache or generated on mount.
- **Divider** — visual separator between summary and recent messages
- **Recent turns** — full message bubbles with role (You / Agent name), relative timestamp, and content
- **Streaming message** — active response appending in real-time with thinking indicator
- Virtual scroll for long conversations

### 3. Tool Activity Panel (inline)

Embedded within agent messages. Collapsed by default:
```
▶ 3 tool calls — Read auth.ts · Edit auth.ts · Read config.ts
```
Expandable via Tab key to show per-tool inputs and outputs. In task mode, the activity feed replaces this with a live vertical list of all tool calls with completion status.

### 4. Activity Bar

Between message area and input. Shows real-time agent status:
- Current activity: Thinking / Using tool: X / Idle
- Elapsed time since last user message
- Token usage (input/output counts)

### 5. Input Area

Bottom of screen. Prompt with `❯` prefix. Supports:
- Regular text input → sent as conversation message
- Slash commands → parsed and handled by ChatShell
- Multi-line input (future consideration)

## Hybrid Mode: Conversation & Task

### Conversation Mode

Standard back-and-forth chat. User types, agent responds with streaming text. Tool calls appear inline within messages, collapsed by default.

### Task Mode

When the agent is working autonomously. The view shifts to show:
- **Task brief** at the top — what the agent is working on
- **Activity feed** — live vertical list of tool calls with status (✓ done, ⟳ active, ○ pending)
- **Progress footer** — counts (done/active), elapsed time, keyboard shortcuts

### Mode Switching

Three mechanisms:
1. **Automatic** — ChatShell watches stream event patterns:
   - `thinking → text → done` = conversation response (stay in chat mode)
   - `thinking → tool-start → tool-start → ...` = autonomous work (switch to task mode)
   - `error` at any point = stay in current mode, display error inline. If the error terminates the stream (followed by `done`), ChatShell updates status to `"error"` and shows a recoverable error message with option to retry.
2. **Manual** — `/talk` forces conversation mode, `/focus` forces task mode.
3. **Detach & Return** — `/let go` or Ctrl+D exits the view while the agent keeps working. Returning later restores the view with full context.

## Data Flow

```
ProcessRunner.spawn(agent, prompt)
    │
    ▼  AgentStreamEvent (thinking | text | tool-start | tool-input | tool-end | error | usage | done)
ChatShell (UI orchestrator)
    │
    ├── maps events to ChatMessage updates
    ├── tracks mode (conversation vs task) based on event patterns
    ├── manages conversation state (turns, history, summary)
    │
    ▼  calls IChatRenderer methods
InkChatRenderer
    │
    ├── pushStreamEvent() → updates React state → Ink re-renders diff
    ├── updateStatus() → activity bar re-renders
    └── pushMessage() → appends to message list → auto-scroll
```

### Stream Event Batching

Ink re-renders on every React state change. Raw stream events can fire dozens of times per second. The renderer batches events with a 50ms throttle: collect events, flush to state, single re-render. This prevents the Windows ConPTY performance issue documented in Claude Code's GitHub.

### Windows Throttling

```typescript
const RENDER_INTERVAL = process.platform === "win32" ? 80 : 16; // ms
```

### Conversation State

ChatShell calls the existing `agent-conversation-store` for persistence. The renderer never touches storage. On mount, ChatShell loads history, generates or retrieves a cached summary, and feeds recent turns to the renderer via `showHistory()`.

### Input Routing

User types in the input area. InkChatRenderer fires `onUserInput(text)` or `onCommand(cmd)` callbacks. ChatShell handles:
- Regular text → build prompt → `processRunner.spawn()` → stream events back to renderer
- Slash commands → parsed and dispatched (see Commands section)

## Notification System

### Layer 1: Inline Notifications

Extends existing patterns to provide agent awareness on any CLI page:

**`agents:status` data source** — registered on the `start` and `ai-tools` pages (added to their `dataSources` arrays in sitemap.json). Emits actionable menu entries when agents have noteworthy state changes:
- "Atlas completed task 'auth-tests' — 2m ago" → navigate to results
- "Maven is waiting for permission: Edit file.ts" → approve/deny inline
- "Scout encountered an error" → navigate to chat

This supplements (does not replace) the existing `inbox:agent-notes` data source on the start page. `inbox:agent-notes` shows unread messages from agents; `agents:status` shows real-time worker state changes. The existing `renderBusyAgents` function in `register-handlers.ts` is replaced by the enriched banner below.

**Enriched `start:banner`** — the existing beforeRender handler shows busy agents with richer detail (replaces current `renderBusyAgents`):
```
┌ Agents ──────────────────────────────────────┐
│ Atlas ● working on "auth-tests" (2m)         │
│ Maven ● waiting — permission request         │
│ Scout ● idle                                 │
└──────────────────────────────────────────────┘
```

### Layer 2: Agent Dashboard

New sitemap page `agents-dashboard` showing all agents at a glance:
- Agent name, current state, active task, elapsed time
- Quick actions: jump into chat, approve permissions, view results
- Auto-refresh on timer (polls worker manager state)
- Accessible from start page and agent menu

Implemented as a dynamic `ViewHandler` reading from `workerManager.listWorkers()` and agent state files.

## Chat Commands

### Slash Commands

| Command | Action |
|---------|--------|
| `/new` | Start a fresh conversation |
| `/done` | Leave the chat |
| `/back` | Go back to the agent menu |
| `/let go` | Step away — agent keeps working |
| `/history` | Show the full conversation |
| `/topics` | List all conversation topics |
| `/pick <name>` | Switch to a different topic |
| `/clear` | Clear the screen |
| `/focus` | Switch to task view |
| `/talk` | Switch to conversation view |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Esc | Leave the chat (same as `/done`) |
| Ctrl+C | Interrupt agent if working, leave if idle |
| Ctrl+D | Step away, agent keeps working (same as `/let go`) |
| Up/Down | Scroll messages |
| Tab | Expand/collapse tool details |

## Sitemap Changes

### New Pages

**`agents-chat`** — the chat view:
```json
{
  "kind": "page",
  "label": "Chat — {{agent.name}}",
  "icon": "chat",
  "domain": "agents",
  "status": "active",
  "description": "Interactive agent chat with conversation and task modes.",
  "route": { "path": "/agents/chat/:agentName", "pathMatch": "full" },
  "actions": []
}
```

No actions array — this page is a full ViewHandler that hands off to ChatShell.

**`agents-dashboard`** — the dashboard:
```json
{
  "kind": "page",
  "label": "Agent Dashboard",
  "icon": "dashboard",
  "domain": "agents",
  "status": "active",
  "description": "Overview of all agent activity, tasks, and status.",
  "route": { "path": "/agents/dashboard", "pathMatch": "full" },
  "actions": [
    { "name": "onRefreshDashboard", "label": "Refresh", "type": "handler", "target": "agents:refresh-dashboard", "key": "r", "group": "actions" }
  ]
}
```

### Modified Pages

**`agent-detail`** — the existing `onTalk` action (target `agents:talk`) is rewired from handler to navigation:
```json
{
  "name": "onTalk",
  "label": "Talk to {{agent.name}}",
  "type": "navigate",
  "target": "agents-chat",
  "key": "t",
  "group": "interact",
  "params": { "agentName": "{{agent.name}}" }
}
```

**`start`** and **`ai-tools`** — add navigation action to `agents-dashboard`. Add `{ "id": "agents:status" }` to their `dataSources` arrays.

**`ai-tools`** — add chat shortcut that navigates to `agents-chat` with agent params (via the agent list data source).

### Deprecation (not removal)

- `agents-interact-menu.ts` → `talkToAgentInteractive()` — replaced by ChatShell, kept as fallback
- `agents-run-menu.ts` → background dispatch — task mode replaces this, kept for non-interactive CLI

## React Component Tree

Internal to `InkChatRenderer` (private implementation detail):

```
<ChatApp>
├── <HeaderBar agent status thread />
├── <MessageArea>                       ← flexGrow=1
│   ├── <HistorySummary text />
│   ├── <MessageList>
│   │   ├── <Message role content timestamp />
│   │   │   └── <ToolPanel tools collapsed />
│   │   └── <StreamingMessage>          ← active response
│   │       └── <ThinkingIndicator />
│   └── (virtual scroll logic)
├── <ActivityBar status elapsed tokens />
└── <InputArea onSubmit onCommand />
```

These components are not reusable UI components — they are the private implementation of `IChatRenderer`.

## Testing Strategy

- **ChatShell** (UI layer) — tested with a mock `IChatRenderer`. No ink, no React. Verifies event-to-renderer mapping, command handling, conversation state management.
- **InkChatRenderer** — tested with `ink-testing-library` (ink's built-in test renderer). Verifies components render correctly given props.
- **Integration** — extends existing `agents-interact-menu.test.ts` pattern: mock `processRunner`, verify full flow from user input to response display.

## New Files

| File | Layer | Purpose |
|------|-------|---------|
| `src/infrastructure/chat-renderer-types.ts` | Infrastructure | `IChatRenderer` interface, `ChatConfig`, `ChatMessage`, `ChatTurn`, `ChatCommand` types |
| `src/infrastructure/ink-chat-renderer.ts` | Infrastructure | Ink/React implementation of `IChatRenderer` |
| `src/ui/menus/chat-shell.ts` | UI | Orchestrator wiring renderer to domain |
| `src/ui/handlers/chat-handlers.ts` | UI/Handlers | ViewHandler for `agents-chat`, dashboard handler |
| `src/ui/displays/dashboard-display.ts` | UI/Displays | Pure renderer for agent dashboard |
| `tests/infrastructure/ink-chat-renderer.test.ts` | Test | Ink component tests |
| `tests/ui/menus/chat-shell.test.ts` | Test | ChatShell orchestration tests |
| `tests/ui/handlers/chat-handlers.test.ts` | Test | Handler registration and routing tests |

## Modified Files

| File | Change |
|------|--------|
| `src/infrastructure/deps.ts` | Add `chatRenderer` lazy factory to `CliDeps` |
| `src/ui/handlers/register-handlers.ts` | Register chat view handler, dashboard view handler, `agents:status` data source |
| `configs/sitemap.json` | Add `agents-chat` and `agents-dashboard` pages, rewire `onTalk` action in `agent-detail`, add `agents:status` data source to `start` and `ai-tools` |
| `package.json` | Add `ink`, `react`, `@inkjs/ui` to dependencies |
