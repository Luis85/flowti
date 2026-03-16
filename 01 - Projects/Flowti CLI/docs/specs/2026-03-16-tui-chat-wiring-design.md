# TUI Chat Wiring — Design Spec

**Date**: 2026-03-16
**Branch**: `feat/iter-5/tui-ux-overhaul`
**Status**: Approved
**Scope**: Wire ChatShell into the TUI so agent chat actually works end-to-end

---

## Problem

The TUI chat page renders all the right components (HeaderBar, MessageArea, InputArea, etc.) but has no backend orchestration. Users can type messages but nothing happens — `useChatSession` has the push API but no ChatShell is connected. The chat must work for the iteration increment to be accepted.

## Design Goals

| Priority | Goal |
|----------|------|
| P0 | User types a message in the TUI chat → message reaches Claude CLI → streaming response appears |
| P0 | Graceful fallback when `claude` binary is not installed |
| P1 | Conversation history persisted and loaded on re-entry |
| P1 | Slash commands (/done, /back, /new, /history) work |

---

## Architecture

### Dependency Wiring

The TUI context (`LoaderDeps`) has `disk`, `paths`, `clock`, `shell`, `log`. ChatShell needs one additional dep: `processRunner: IAgentProcessRunner`.

**Changes:**
- `TuiContextValue` gets `readonly processRunner: IAgentProcessRunner` as a top-level field (NOT inside `deps`/`LoaderDeps` — most pages don't need it, and widening LoaderDeps would affect all loaders)
- `tui-entry.ts` creates the runner via `createProcessRunner({ disk, paths, clock, shell, log }, cliConfig.agents)` and passes it into context
- `agents-chat-page.tsx` accesses it via `useTuiContext().processRunner` (not `useLoaderContext`)

`LoaderDeps` is NOT modified — it stays as the narrow ISP subset for loaders. The process runner is only used by the chat page.

No new singletons. The process runner is a thin wrapper around `shell.spawnBackground()`.

### TuiChatRenderer — IChatRenderer Adapter

ChatShell expects an `IChatRenderer` object. `useChatSession` is a React hook returning `ChatSessionState`. A thin adapter class bridges the two:

```typescript
class TuiChatRenderer implements IChatRenderer {
  constructor(private session: ChatSessionState) {}

  async mount(_config: ChatConfig): Promise<void> { /* no-op — TUI page already rendered */ }
  async unmount(): Promise<MenuResult> { return "main"; }

  pushMessage(msg: ChatMessage): void { this.session.pushMessage(msg); }
  pushStreamEvent(event: AgentStreamEvent): void { this.session.pushStreamEvent(event); }
  updateStatus(status: ChatViewStatus): void { this.session.updateStatus(status); }
  updateMode(mode: "conversation" | "task"): void { this.session.updateMode(mode); }
  showHistory(summary: string, turns: readonly ChatTurn[]): void { this.session.showHistory(summary, turns); }

  onUserInput(callback: (text: string) => void): void { this.session.onUserInput(callback); }
  onCommand(callback: (cmd: ChatCommand) => void): void { this.session.onCommandHandler(callback); }
}
```

Lives at `src/tui/chat/tui-chat-renderer.ts`. Pure glue — ~45 LOC.

### Chat Page Orchestration

`agents-chat-page.tsx` gains a `useEffect` that orchestrates the full lifecycle:

1. **Resolve agent** — `findAgent(deps, vaultRoot, agentName, agentsConfig)` using TUI context
2. **Check Claude CLI** — `deps.shell.check("claude --version")` (existing pattern from `agents-run-menu.ts`). If missing, set `connectionError` state with message: "Claude CLI not found. Install Claude Code or add it to PATH."
3. **Create ChatShell** — `new ChatShell(renderer, agent, chatDeps, vaultRoot, projectPath)`
4. **Call `shell.start()`** — mounts renderer, registers input/command callbacks, loads conversation history. The returned Promise resolves when ChatShell exits (via `/done` or `/back`). On resolution, call `goBack()` to navigate away from the chat page.
5. **Cleanup on unmount** — store shell ref. If user navigates away via Escape/Tab before ChatShell exits, the shell's exit promise is abandoned (no await). The process runner handles its own cleanup.

**Connection states:**
- `connecting` — resolving agent + checking CLI (brief, ~100ms)
- `connected` — ChatShell started, input enabled, ready for messages
- `error` — Claude CLI missing or agent not found, input disabled with explanation

**InputArea disabled when:** focus not on content (`!enabled`) OR agent thinking/working OR `connectionError` is set.

**MessageArea empty state:** Shows connection status — "Connecting...", the error message, or the normal "Type a message to start chatting" prompt.

### Graceful Fallback

When `claude` binary is not available:
- Chat page renders normally (header, empty message area, status bar)
- MessageArea shows: "Claude CLI not found. Install Claude Code or add it to PATH."
- InputArea shows disabled state (`...`)
- No crash, no fake responses — honest about what's missing

No API key needed. The `claude` binary handles its own authentication.

---

## Data Flow

```
User types "hello" in InputArea
    → InputArea calls session.submit("hello")
    → submitRef.current("hello")  [registered by ChatShell via renderer.onUserInput]
    → ChatShell.handleUserInput("hello")
        → Appends user turn to conversation file
        → Builds prompt with history + character traits
        → processRunner.spawn(agent, prompt)
        → Stream events flow back:
            thinking → renderer.pushStreamEvent → useChatSession state → MessageArea re-renders
            text     → renderer.pushStreamEvent → useChatSession state → MessageArea re-renders
            done     → ChatShell parses response → renderer.pushMessage → final message in UI
        → renderer.updateStatus("idle")
```

---

## File Inventory

| File | Change | LOC |
|------|--------|-----|
| `src/tui/context.tsx` | Add `processRunner` to TuiContextValue (top-level, not in LoaderDeps) | +3 |
| `src/tui/tui-entry.ts` | Import createProcessRunner, create with `(deps, cliConfig.agents)`, pass to context | +6 |
| `src/tui/chat/tui-chat-renderer.ts` | **New** — IChatRenderer adapter | ~45 |
| `src/tui/pages/agents-chat-page.tsx` | ChatShell orchestration useEffect, connection states | +50 ~-10 |
| `tests/tui/chat/tui-chat-renderer.test.ts` | **New** — adapter delegates all methods | ~80 |
| `tests/tui/pages/agents-chat-page.test.ts` | Update for connection states | +30 |
| **Total** | | ~220 |

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| ChatShell expects sync `mount()` lifecycle but TUI page is already rendered | Low | `mount()` is a no-op in adapter — TUI page manages its own render |
| ChatShell `start()` blocks on exit Promise — could prevent page unmount | Medium | Store shell ref, handle navigation away by not awaiting the exit promise |
| `processRunner.spawn()` fails silently if Claude CLI crashes | Low | ChatShell already handles error events and updates status to "error" |
| Multiple ChatShell instances if user rapidly navigates | Low | Guard with ref — skip if shell already exists, cleanup on unmount |

---

## Test Strategy

**Unit tests:**
- `tui-chat-renderer.test.ts` — verify all 9 IChatRenderer methods delegate correctly (~9 tests)
- `agents-chat-page.test.ts` — connection states (connecting, connected, error)

**Integration (mocked):**
- Mock `processRunner.spawn()` to return fake AgentProcess with controlled stream events
- Verify: user message → ChatShell → stream events → useChatSession state → correct render

**Manual verification:**
- Launch TUI → navigate to Agents → select agent → open chat → type message → see streaming response
- Test with Claude CLI not installed — verify graceful error
- Test /done, /back, /new, /history commands
