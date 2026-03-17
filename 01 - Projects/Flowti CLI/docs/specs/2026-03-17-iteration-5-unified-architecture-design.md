# Iteration 5 — Unified CLI-Plugin Architecture Design Spec

**Date:** 2026-03-17
**Status:** Draft
**Iteration:** 5 — Agent World
**Runway:** 2026-03-14 → 2026-03-28

## 1. Vision

The Flowti CLI is the orchestrator. The Flowti Plugin is the user interface on top of it. The CLI provides all features; the Plugin provides the visual experience. The CLI is bundled with the Plugin at build time — no external installation required. Communication happens over HTTP+SSE via `flowti serve`.

The user never leaves Obsidian. A persistent LLM companion sidepanel watches what's active in the main leaf, agents can be launched and monitored from hub views, skills execute through bidirectional streaming, and the RPG world brings agents to life with personality-driven behavior.

## 2. Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CLI-Plugin communication | HTTP+SSE via `flowti serve` | Already built, supports agent lifecycle, SSE for real-time updates |
| CLI bundling | Copy `main.mjs` into plugin at build time | Self-contained, version-locked, no "CLI not found" errors |
| Raw terminal | Command input + output pane (REPL-style) | Lightweight, integrates with HTTP API, avoids xterm.js complexity |
| Skill conversation UI | Hybrid markdown + input blocks | Best readability for code-heavy skill output |
| Sitemap → Storybook | Right-click any sitemap JSON file | Most flexible, opt-in, no project-specific config |
| RPG small talk | Template-driven with personality variables | No LLM cost, infinite combinatorics, easy to extend |
| Canvas context | File watcher + incremental diffs | Uses Obsidian vault events, keeps context window small |

## 3. Phase C0: Plugin View Crash Fix (BLOCKER)

### Problem

After migrating the Plugin to be managed by the CLI, all views crash on open:

```
TypeError: Cannot read properties of undefined (reading 'type')
    at nu.getViewType (plugin:flowti-ibde:533:50675)
```

The crash occurs during view construction. `getViewType()` reads a property that is undefined at construction time.

### Root Cause (Suspected)

Sitemap-driven views (`SitemapHubView`, `SitemapLeafView`) receive their view type from the sitemap config passed at registration. The iteration 5 refactoring extracted journey wiring, workspace navigation, train wiring, and settings tab into separate files. This likely broke the constructor chain — the view definition object (with its `type` field) is not being passed through correctly, or the initialization order changed.

### Fix Approach

1. Trace the registration path: `sitemap-bootstrap.ts` → `registerView()` → `app.workspace.registerView()` → constructor
2. Verify the view definition (with `type` field) is passed through the entire constructor chain
3. Verify extracted setup files did not change initialization order (phase 3 registration before phase 5 layout-ready)
4. Test: all 6 hub views and all leaf views open without error

### Acceptance Criteria

- All existing Plugin views open without errors
- No `TypeError` in console on view construction
- Hub views render their tabs and content correctly

## 4. Phase C1: TUI Ink Migration Regression Fix

### Problem

The CLI migrated from the legacy SitemapRouter TUI to Ink. Several features are missing from the Ink TUI:
- Project management features not ported
- Agent launch (`agent:run`, `agent:run-brief`) not wired
- Storybook launch not wired

Non-interactive CLI commands still work — the gap is only in the interactive Ink TUI layer.

### Fix Approach

1. Audit `src/main.ts` Ink entry point — compare registered Ink views/actions against the legacy SitemapRouter sitemap actions
2. Port missing menu items and actions to Ink components, referencing existing controller handlers
3. The `--legacy` flag provides the old SitemapRouter as a reference implementation

### Acceptance Criteria

- All project management features accessible from Ink TUI
- Agent launch and monitoring works from Ink TUI
- Storybook commands accessible from Ink TUI
- Feature parity with legacy SitemapRouter (minus visual differences from Ink)

## 5. Phase C2: CLI Bundling

### Build-Time Bundling

Plugin's `esbuild.config.mjs` gains a post-build step:
1. Copies `.flowti/bin/main.mjs` into plugin output: `.obsidian/plugins/flowti-ibde/cli/main.mjs`
2. Writes `cli-version.json` alongside it with CLI build timestamp and git hash (stale bundle detection)
3. Plugin's `package.json` build script chains: `npm run build:cli && npm run build:plugin`

### Server Lifecycle (Managed by Plugin)

1. On plugin load (phase 3), Plugin spawns `node cli/main.mjs serve --port=0 --json` as a background child process
2. CLI picks an available port, writes it to stdout as JSON: `{"port": 47832}`
3. Plugin reads the port, stores it, connects EventSource to `http://localhost:{port}/events`
4. On plugin unload, Plugin sends `POST /api/shutdown` or kills the child process
5. On SSE disconnect, Plugin detects and auto-restarts the server

### New CLI Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/command` | POST | Execute any CLI command, return JSON result |
| `/api/skill/start` | POST | Start a skill session (returns session ID) |
| `/api/skill/respond` | POST | Send user response to active skill session |
| `/api/skill/context` | POST | Send incremental context update from active leaf |
| `/api/skill/switch-agent` | POST | Switch active agent mid-session |
| `/api/shutdown` | POST | Graceful server shutdown |

Existing endpoints remain: `/api/world-state`, `/api/agent/send`, `/api/agent/task`, `/api/agent/permission`, `/api/agent/wake`, `/events`.

### Acceptance Criteria

- Plugin build produces a self-contained bundle with embedded CLI
- Plugin spawns CLI server on load, connects via SSE
- `cli-version.json` written with build metadata
- Server auto-restarts on disconnect
- All new endpoints functional and returning JSON

## 6. Phase C3: Flowti CLI View (Hub Architecture)

### View Registration

New hub view type `flowti-cli-hub` registered in Plugin's `configs/sitemap.json`. Extends existing `SitemapHubView` / `BaseHubView` pattern. Ribbon icon for quick access.

### Tab: CLI Hub (Default)

Dashboard-style landing page:
- At-a-glance status: managed projects (build/test/health), active agents, server uptime
- Quick-action buttons: Run Tests, Build, Generate Reports, Health Check
- Each action fires `POST /api/command` and streams output
- Uses existing `DataSourceHandler` pattern for dynamic data

### Tab: Raw Terminal

REPL-style command interface:
- Text input at the bottom with command history (up/down arrows)
- Output pane above showing rendered CLI responses (markdown/ANSI → HTML)
- Commands sent via `POST /api/command`, output rendered as JSON or formatted text
- Scrollback buffer with clear button
- No shell — purely CLI commands routed through HTTP API

### Tab: Agents Hub

Agent management interface:
- Lists all agents from roster with current state (idle, working, thinking, waiting)
- Click agent → detail pane (info, current task, session history)
- Action buttons: Run, Assign Task, Wake → map to existing `/api/agent/*` endpoints
- Live updates via SSE `agent-action` and `entity-update` events
- Link to RPG world view for visual interaction

### Tab: Projects Hub

Project management interface:
- Lists managed projects from `flowti.config.json`
- Per-project actions: Build, Test, Lint, Reports, Health, Storybook
- Status indicators: last build result, test count, coverage, health score
- Commands route through `POST /api/command` with `--project` flag

### Acceptance Criteria

- CLI Hub view opens from ribbon icon
- All four tabs render and are functional
- Quick actions execute and display output
- Raw terminal accepts commands and renders responses
- Agents Hub shows live agent state via SSE
- Projects Hub lists projects with working action buttons

## 7. Phase C4: Skill Execution System

### Architecture: Sidepanel + Main Leaf

The LLM conversation lives in a **persistent sidepanel** (right pane). The main editor leaf shows whatever the user is working on. The sidepanel is always aware of what's active in the main leaf.

### Sidepanel (LLM Companion)

- Always-visible right pane with the active session conversation
- **Agent switcher** at top — dropdown to switch between available agents
- **Skill launcher** — button to pick and execute a skill from the current agent's skill map
- **Mode switcher** — toggle the main leaf between canvas / document / conversational view
- **Input bar** at bottom — user types here, LLM responds in conversation stream
- Shows LLM state: idle, thinking, responding, waiting for input

### Three Conversation Modes (Togglable)

All modes share the same session, same input bar, same data — just different rendering. Mode preference persisted per-session.

**Document mode:**
- Rich markdown rendering: syntax-highlighted code blocks, headings, lists, collapsible sections
- Content flows as a continuous document
- Best for skill output that produces artifacts (specs, plans, code)
- LLM can edit the document inline

**Conversational mode:**
- Chat-style layout with distinct message blocks
- User and LLM responses visually separated
- Best for back-and-forth dialogue, quick questions, clarifications

**Creative mode (Canvas):**
- Opens the session on an Obsidian Canvas
- LLM responses, user inputs, and artifacts become canvas nodes
- Nodes can be spatially arranged, grouped, connected with edges
- LLM can add/edit/connect nodes via structured commands (`add-node`, `connect-nodes`, `move-node`, `update-node-content`)
- New LLM responses land as nodes connected to the conversation thread
- User can rearrange freely, create branches, add their own notes alongside LLM output

### Context Awareness (Incremental)

- Plugin watches the active file via Obsidian's `vault.on('modify', ...)` event (already in EventBridge)
- On modify event matching the active session's file, Plugin computes an incremental diff
- **First attach:** full snapshot of the file content (canvas JSON or markdown)
- **Subsequent changes:** delta only — nodes added/removed/modified, edges changed (canvas); line-level diffs (documents)
- Diff format: `{ added: [...], removed: [...], modified: [{ id, changes }] }`
- Debounced at 2-3 seconds to avoid flooding
- CLI-side maintains a running context model per session, applies deltas incrementally
- LLM receives compact change summaries, not full state
- Periodic full resync available (every ~20 updates or on request) if context model drifts
- Self-edit detection: Plugin sets a flag before writing LLM edits, clears after, to prevent echo loops

### Session Integration

- Plugin creates a Session via existing session domain when a skill starts
- Session lifecycle governs: `initializing → active → paused → completing → completed → archived`
- Pausing the session pauses the skill; resuming re-attaches SSE stream
- Session appears in User Hub → Sessions tab alongside other sessions
- Switching agents mid-session starts a new session linked to the new agent
- Context snapshots stored with session for replay/audit

### CLI-Side

New domain: `src/domain/skill-session/`
- Manages active skill sessions (ID, state, LLM connection, transcript)
- Mirrors Plugin session lifecycle
- SSE event types:
  - `skill-output { sessionId, type: "text"|"thinking"|"code"|"question", content }`
  - `skill-question { sessionId, prompt }` — LLM is waiting for user input
  - `skill-canvas-edit { sessionId, operations: [...] }` — LLM wants to edit canvas
  - `skill-document-edit { sessionId, edits: [...] }` — LLM wants to edit document

### Persistence

- Session transcript saved via Plugin's session store (not a parallel file)
- Canvas layout saved as `.canvas` file linked to session
- Artifacts (specs, plans, code) written to project docs and linked to session
- Mode preference + canvas positions persisted with session metadata
- Agent switches and mode changes logged in session history

### Acceptance Criteria

- Sidepanel opens with agent switcher, skill launcher, mode switcher, input bar
- Skill picker lists skills from agent's skill map
- Skill execution streams LLM output to sidepanel
- LLM questions pause execution and activate input bar
- User responses resume execution
- All three modes work and switching preserves conversation
- Canvas mode: LLM can add/edit nodes, user can rearrange
- Context diffs sent incrementally (not full state)
- Self-edit echo loop prevented
- Sessions appear in User Hub → Sessions tab

## 8. Phase C5: Storybook Integration (Reworked)

### Trigger

- Right-click any `.json` file in vault → "Generate Component Library" (Plugin checks for sitemap structure: `pages` or `views` keys)
- Also accessible from CLI Hub → Projects Hub → per-project action

### Flow

1. User right-clicks sitemap → selects "Generate Component Library"
2. Plugin opens framework picker modal: CLI App, HTML (Lit), Vue, Angular, React
3. Plugin sends `POST /api/command { command: "storybook:scaffold", args: { sitemap, framework } }`
4. CLI reads the sitemap, generates:
   - `.storybook/` directory with framework-appropriate config
   - One story file per page/component in the sitemap
   - Component stubs matching sitemap structure (if they don't exist)
   - `package.json` with appropriate Storybook + framework devDeps
5. Output streamed to CLI Hub output pane
6. Storybook launchable from CLI Hub or Projects Hub

### Template Architecture

Templates live in CLI: `src/domain/make/templates/storybook/`

Each framework template defines:
- Storybook config shape
- Story file pattern
- Component stub pattern
- `package.json` dependencies

Sitemap-to-story mapping:
- Each page becomes a story
- Actions become interaction tests
- Data sources become mock data

### Opt-In Philosophy

- Zero config required — just a sitemap file
- No scripts or generators in project config
- Framework templates handle all wiring
- Projects customize after generation; baseline is complete

### Acceptance Criteria

- Right-click context menu appears on sitemap JSON files
- Framework picker modal lists all 5 options
- Generated Storybook runs out of the box for each framework
- Stories map to sitemap pages
- No project-specific config required
- Storybook launchable from CLI Hub

## 9. RPG Agent Improvements — Interactive Waiting & Talk Engine

### Domain-Driven Template Architecture

```
dashboard/src/talk/
├── talk-engine.ts              — resolver, timer, variable interpolation
├── talk-types.ts               — template interfaces, variable types
├── templates/
│   ├── core.ts                 — universal (filler, greetings, generic thinking)
│   ├── engineering.ts          — engineering domain templates
│   ├── design.ts               — design domain templates
│   ├── product.ts              — product/management domain templates
│   ├── social.ts               — cross-agent social templates
│   └── index.ts                — registry, collects and exports all template sets
```

### Template Contract

Each template file exports a `TemplateSet`:

```typescript
interface TemplateSet {
  domain: string;
  categories: Record<string, WeightedTemplate[]>;
}

interface WeightedTemplate {
  template: string;
  weight: number;
  category: "thinking" | "social" | "personality" | "filler";
}
```

### Variable Sources

| Variable | Source |
|----------|--------|
| `{task}` | Current assigned task (truncated) |
| `{mood_adj}` | Derived from agent mood field |
| `{role}` | Agent's primary role |
| `{domain}` | Agent's domain |
| `{domain_opinion}` | Pool of domain-specific quips |
| `{domain_fact}` | Pool of domain-specific observations |
| `{idle_action}` | Personality-driven idle actions |
| `{persona_quirk}` | From agent persona/personality traits |
| `{nearby_agent}` | Name of nearest agent (if any) |

### Wait-State Integration

- When agent enters `waiting` state (LLM generating), brain system activates talk engine on a timer
- Interval: randomized 3-8 seconds (natural, not metronomic)
- Each line triggers a speech bubble via existing bubble system
- Templates selected based on agent personality type
- When LLM response arrives (SSE `agent-action`), talk timer stops, current bubble finishes gracefully, real response presented

### Template Categories & Weights

- `thinking` — agent reflects on the task
- `social` — agent addresses nearby agents or user
- `personality` — agent expresses their persona
- `filler` — natural wait sounds

Category weights vary by personality type: focused engineer → more `thinking`, social designer → more `social`.

### Resolution Order

1. Agent's own domain templates (highest weight)
2. Social templates (if nearby agents exist)
3. Core templates (fallback)

### Expansion Pattern

1. Add a new `.ts` file in `templates/` exporting a `TemplateSet`
2. Add one import line to `templates/index.ts`
3. Talk engine auto-discovers all registered template sets
4. Template sets can overlap categories — engine merges, weighting by agent domain affinity

### Acceptance Criteria

- Agents produce small talk bubbles during LLM wait states
- Small talk is personality-driven (different agents sound different)
- Talk stops gracefully when LLM response arrives
- Template files are domain-organized (not monolithic)
- Adding a new domain is a single-file change
- No LLM cost for small talk generation

## 10. Phase A: Test Consolidation

Phase A (autonomous agent execution) was delivered but rejected — work from the last test was not consolidated.

### Fix Approach

- Review the agent runner, session store, and process infrastructure test suites
- Consolidate outstanding test work that was started but not completed
- Ensure all Phase A acceptance criteria pass with tests green

### Acceptance Criteria

- All Phase A test suites pass
- No outstanding test TODOs from prior review
- Agent runner, session store, process infrastructure fully tested

## 11. Phase B: RPG World Polish

Phase B (ExcaliburJS RPG World) was rejected as too barebones and buggy.

### Remaining Gaps

- Data export: DashboardAgent missing `goals`, `behaviors`, `project`, `iteration`, `phase`
- World state reconciliation: `onStateDiff` handler is a stub
- Task execution: visual-only, no actual CLI runner integration
- Game feel: no particles, emotes, workstation glow
- Social interaction: facing only, no proximity conversations

### Fix Approach

- Bug fixes first: identify and fix known bugs
- Data export: pipe missing fields through `agent-dashboard.json`
- Stub implementations: complete `onStateDiff`, add basic task→runner integration
- Polish: particles, emotes, workstation glow as time allows

### Acceptance Criteria

- No known bugs in RPG world
- DashboardAgent has complete data export
- `onStateDiff` handles state changes
- Game feel improvements visible

## 12. Execution Priority

| Order | Phase | Blocks | Effort |
|-------|-------|--------|--------|
| 1 | C0: Plugin crash fix | Everything | Small |
| 2 | C1: TUI regression fix | CLI usability | Medium |
| 3 | C2: CLI bundling + server lifecycle | C3, C4, C5 | Medium |
| 4 | A: Test consolidation | — | Small |
| 5 | C3: CLI View (4-tab hub) | — | Large |
| 6 | C4: Skill execution (sidepanel + 3 modes) | — | Large |
| 7 | B+: RPG talk engine + polish | — | Medium |
| 8 | C5: Storybook rework | — | Medium |

C0 → C1 → C2 is the critical path. Once the server lifecycle is up, C3/C4/C5 can be worked in parallel by different agents.

## 13. Risks

| Risk | Mitigation |
|------|------------|
| Canvas JSON format changes between Obsidian versions | Defensive parsing, schema validation on canvas read |
| Context diffs grow stale or drift | Periodic full resync (every ~20 updates) |
| HTTP server port conflicts | `--port=0` auto-selects available port |
| CLI bundle size grows past acceptable threshold | Monitor bundle size in build, tree-shake aggressively |
| Sidepanel + main leaf coordination complexity | Clear event contracts between sidepanel and leaf views |
| Template-driven talk feels repetitive | Large template pools, weighted randomization, domain expansion |
| LLM echo loop on canvas/document edits | Self-edit flag set before write, cleared after |
