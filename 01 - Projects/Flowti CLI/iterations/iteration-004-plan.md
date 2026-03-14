---
type: IterationPlan
name: Flowti CLI gets a visual presence
number: 4
status: in-progress
startDate: 2026-03-14
endDate: 2026-03-28
goal: Agents become visible — project-level agent roster, a built-in static server, and an ExcaliburJS agent dashboard as the first served scene
description: "The CLI gains a visual layer. Agents move from vault-only entities to project team members. A zero-dep HTTP server serves a static site from the vault. The first scene: an ExcaliburJS 2D dashboard rendering vault agents as animated entities with idle/busy state based on active tasks. This is the foundation for all future CLI visualization (project maps, iteration timelines, dependency graphs)."
---

# #4 — Flowti CLI gets a visual presence

Iterations 1-3 built the agent data model, CRUD, orchestration bindings, and brief generation. But agents are invisible — they exist only as markdown files and CLI menus. There's no way to see at a glance who's working on what, which agents are idle, or how agents relate to projects.

This iteration makes agents visible. Three workstreams converge: agents get assigned to projects (not just vaults), the CLI gains a static file server, and the first ExcaliburJS scene renders agents as animated 2D entities.

**Deliverables:**
1. **Project Agent Roster** — `management.agents` in `flowti.config.json` declares which vault agents belong to a project. Iteration agent picker filters to project roster only.
2. **`flowti serve`** — Zero-dependency HTTP server (Node `http` + `fs`) serves static files from a known directory. Opens in browser, or via Obsidian URI if available.
3. **Agent Dashboard Scene** — ExcaliburJS TypeScript project that renders vault agents as 2D sprites with idle/busy status. CLI generates a JSON data file before serving. Read-only MVP.
4. **Full-Iteration Tasking** — Agents can be tasked to execute an entire iteration (single "do it all" brief), not just individual phases.

**Deferred to future iterations:**
- Interactive dashboard (drag agents onto projects, reassign)
- Additional scenes (project dependency graph, iteration timeline, health heatmap)
- Live WebSocket updates (agent status changes push to browser)
- Multi-agent handoff chains (PO → Architect → Developer auto-pipeline)
- Agent work history visualization (timeline of briefs and outputs)

## Goal

Agents become visible — project-level agent roster, a built-in static server, and an ExcaliburJS agent dashboard as the first served scene

## Resources

<!-- Add team members and their allocation. -->


## Capacities

<!-- Define capacity constraints (story points, hours, etc). -->


## Agents

<!-- Attach agent files from the agents folder. -->


## Scope Items







- [x] Flag blockers early
- [x] Track progress daily
- [x] Push the Plan to Git
- [x] Kick-off communication
- [x] Verify all prerequisites are met
- [x] Push the Plan to Git
- [x] Assign resources and capacity
- [x] Break scope into actionable tasks
### Phase 1: Project Agent Roster — DONE

- [x] Add `AgentsConfig.roster?: string[]` to types — project-level agent roster field
- [x] Add config schema validation for `management.agents.roster` — array of non-empty strings, optional
- [x] Add `getProjectAgents(deps, vaultRoot, vaultConfig, roster)` domain function — resolves vault agents filtered to project roster (case-insensitive)
- [x] Add `updateProjectConfig(projectPath, deps, mutate)` utility — read/modify/write flowti.config.json
- [x] Update iteration `addAgentInteractive` — when project has roster, show only project roster instead of full vault list
- [x] Add "Manage Agents" action to project-detail sitemap page (key: n) — add/remove agents from project roster
- [x] Register handler `project:manage-agents` — interactive add/remove of agent names to config with vault agent listing
- [x] Tests: getProjectAgents (4), updateProjectConfig (3), roster validation (3), manageProjectAgentsInteractive (5)
- [x] Verify: tsc clean, 6132 tests pass, eslint 0 errors, esbuild builds

### Phase 2: Full-Iteration Tasking — DONE

- [x] Add `generateFullIterationBrief(ctx)` — single brief covering all phases from current state to done
- [x] `buildLifecyclePath(template, fromState)` — walks template transitions to build full phase sequence
- [x] Brief includes lifecycle path, phase instructions from orchestration, iteration context, scope items
- [x] Add "Execute Iteration" action to iteration-detail sitemap — in orchestration group
- [x] Register handler `iteration:execute-full` — prompts for agent (roster-filtered), generates brief, writes to `iterations/briefs/iteration-NNN-full.md`
- [x] Tests: 11 tests for full brief generation, lifecycle path, phase instructions, edge cases
- [x] Verify: tsc clean, 6143 tests pass, eslint 0 errors, esbuild builds

### Phase 3: `flowti serve` — Static File Server — DONE

- [x] New `src/domain/serve/static-server.ts` — zero-dep HTTP server using Node `http` + `fs` modules (MIME for 18 extensions, `handleRequest()`, `sanitizePath()` directory traversal protection, `startServer()`, `openInBrowser()`)
- [x] Serves files from a configurable root directory (default: `.flowti/site/`)
- [x] MIME type resolution for common types (html, js, css, json, png, svg, woff2, plus ttf, md, xml, map, etc.)
- [x] Auto-opens browser via `shell.run("start <url>")`
- [x] New controller `src/controller/serve.controller.ts` — `flowti serve [--port=3000] [--dir=.flowti/site]` with flag parsing, server lifecycle, Enter-to-stop
- [x] Add `serve` command to CommandRegistry (project-free)
- [x] Add "Serve Dashboard" action to start page sitemap (key: s, group: tools)
- [x] Tests: 19 tests — MIME resolution (9), request handling (10: index, nested, 404, traversal, query strings, backslash normalization)
- [x] Verify: tsc clean, 6162 tests pass, eslint 0 errors, esbuild builds

### Phase 4: Agent Data Export — DONE

- [x] New `src/domain/agents/agent-export.ts` — `exportAgentDashboardData(vaultRoot, vaultAgentsConfig, projects, deps)` → `DashboardData`
- [x] Export schema: `{ agents: [{ name, agentType, domain?, status, project?, iteration?, phase? }], projects: [{ name, agents }] }`
- [x] Agent status derivation: `deriveAgentStatus()` — `busy` (referenced in in-progress/in-review iteration), `idle` (on roster, no active work), `unassigned` (vault-only). Case-insensitive matching.
- [x] `writeDashboardData()` writes JSON to disk with `mkdirSync` for data directory
- [x] Integrated into `flowti serve` — `regenerateDashboardData()` runs before server start, uses vault-level `cliConfig.agents` for agent directory
- [x] Tests: 14 tests — `deriveAgentStatus` (7: unassigned, idle, busy, case-insensitive), `exportAgentDashboardData` (6: empty, unassigned, idle, busy, projects, types), `writeDashboardData` (1)
- [x] Verify: tsc clean, 6176 tests pass, eslint 0 errors, esbuild builds

### Phase 5: ExcaliburJS Agent Dashboard — DONE

- [x] ExcaliburJS project in `site/agent-dashboard/` with `package.json` (excalibur ^0.30.0), `tsconfig.json` (strict, ES2022), `build.mjs` (esbuild bundler)
- [x] Entry HTML page (`index.html`) — dark background, loads `dashboard.js` as ES module
- [x] `src/main.ts` — engine setup, loads data via `data-loader.ts`, creates `AgentScene`, auto-sizes canvas
- [x] `src/agent-actor.ts` — `AgentActor` extends `ex.Actor` with canvas-drawn circles (no sprite images), type icon (⚙ for AI, 👤 for human), name label, type indicator
- [x] Status visualization — busy agents have pulsing green glow animation, idle agents blue, unassigned agents grey
- [x] `src/agent-scene.ts` — `AgentScene` layouts agents in project groups (grid, 3 per row), unassigned agents in separate area, title + agent count header
- [x] Build pipeline — `esbuild` bundles to `.flowti/site/dashboard.js` (1.1MB), copies `index.html`
- [x] Integrated into `flowti serve` — `buildDashboard()` runs `node build.mjs` before serving if `build.mjs` exists
- [x] Verify: tsc clean, 6176 tests pass, eslint 0 errors, esbuild builds, dashboard builds (1.1MB)

### Closure

- [x] Verify tsc, vitest, eslint, esbuild all pass
- [x] End-to-end walkthrough — assign agents to project, create iteration, generate full brief, serve dashboard, see agent status
- [ ] Push the Plan to Git
- [x] Document learnings
- [x] Capture retrospective notes
- [x] Review completed scope items

## Transition History

| Date | From | To | Reason |
|---|---|---|---|
| 2026-03-14 | ready | in-progress | Advanced to in-progress |
| 2026-03-14 | planned | ready | Advanced to ready |
| 2026-03-14 | new | planned | Advanced to planned |

## Notes

**Retrospective (2026-03-14):**

*What went well:*
- All 5 phases delivered in a single iteration — roster, full-iteration tasking, static server, data export, dashboard
- Brief system evolved significantly: unique per agent, role-aware prompts with wikilinks, AC/DoD, lifecycle (open → active → done)
- Roster-based task assignment flow enables direct agent tasking from iteration context
- 10 agent definitions created covering the full project team (PO, PM, Architect, Developer, Tester, QA Manager, Delivery Manager, UX Designer, Product Manager, Project Manager)

*What to improve:*
- Dashboard directory naming changed mid-iteration (`site/agent-dashboard/` → `agents/`) — plan notes should be updated when decisions change
- Dashboard build not yet wired into CI — `.flowti/site/` must be built manually via `node build.mjs`
- Brief stub generation was initially too minimal — required a second pass to make briefs role-aware with full context

*Learnings:*
- Briefs work best as full role-aware prompts, not minimal stubs — the agent needs enough context to act autonomously
- The lifecycle engine generalizes well beyond iterations — brief lifecycle (open/active/done) reused the same template + transition infrastructure
- Wikilinks are the right abstraction for cross-referencing — they avoid content duplication and keep briefs linked to their source of truth

**Design Decisions:**

**Project Agent Roster Format** — Stored in `flowti.config.json` under `management.agents.roster`:
```json
{
  "management": {
    "agents": { "roster": ["Product Owner", "Software Architect", "Software Developer"] },
    "iterations": {
      "orchestration": {
        "phases": {
          "new": { "agent": "Product Owner", "role": "refiner" },
          "planned": { "agent": "Software Architect", "role": "planner" }
        }
      }
    }
  }
}
```
**Implementation note**: The plan originally specified `management.agents` as a flat `string[]`, but `AgentsConfig` already existed as `{ dir?: string }` for vault-level agent directory config. To avoid a breaking change, the roster was added as `AgentsConfig.roster?: string[]` — extending the existing type. Agents are referenced by name (case-insensitive match against vault-level agent definitions). The roster is the project's "team" — only these agents appear in the iteration agent picker and the "Execute Iteration" agent selector. Orchestration phase bindings should reference agents from the roster.

**Static Server Architecture** — Pure Node.js, zero dependencies:
```
flowti serve [--port=3000] [--dir=.flowti/site]
  1. Build ExcaliburJS dashboard (node build.mjs in site/agent-dashboard/)
  2. Regenerate agent-dashboard.json from vault state
  3. Start http.createServer() serving static files
  4. Open browser via shell.run("start <url>")
  5. Wait for Enter to stop server
```
The server is stateless — it reads the filesystem on each request. No WebSocket, no live reload in MVP. Refresh the browser to see updated state.

**Implementation note**: Obsidian URI detection was deferred — the MVP uses `start "" "<url>"` to open the default browser. The serve command is registered as project-free since it operates at the vault level.

**Agent Status Derivation:**
- `busy` — Agent is referenced in an iteration that is `in-progress` or `in-review` (checked via `iter.agents` array, case-insensitive name match)
- `idle` — Agent is on a project roster but has no active iteration work
- `unassigned` — Agent exists in vault but is not on any project's roster

**Implementation note**: Status derivation uses `BUSY_STATUSES = Set(["in-progress", "in-review"])`. The plan originally specified checking for "active scope item or brief" for busy status, but the implementation simplifies to checking iteration agent references + iteration status. This is sufficient for MVP and avoids coupling to the brief file system.

**ExcaliburJS Project Structure:**
```
site/agent-dashboard/
├── package.json          # excalibur ^0.30.0, esbuild, typescript
├── tsconfig.json         # Strict TS, ES2022, bundler module resolution
├── build.mjs             # esbuild bundler → .flowti/site/dashboard.js + index.html
├── index.html            # Dark background, loads dashboard.js as ES module
└── src/
    ├── main.ts           # Engine setup, auto-sizes canvas, loads data, starts scene
    ├── agent-scene.ts    # Main scene — project groups, unassigned area, title + count
    ├── agent-actor.ts    # AgentActor (canvas circles, type icons ⚙/👤, pulsing glow)
    └── data-loader.ts    # Fetch and parse data/agent-dashboard.json
```
Build output goes to `.flowti/site/` (1.1MB bundle). No sprite images — agents are canvas-drawn circles with emoji icons. The dashboard is the first "scene" — future iterations add more scenes (project map, iteration timeline).

**Full-Iteration Brief Format:**
```markdown
# Full Iteration Brief: Software Architect — Iteration #4

## Your Role
You are the Software Architect for this entire iteration. Execute all phases from planned → done.

## Lifecycle Path
planned → ready → in-progress → in-review → done

## Phase Instructions
### planned (planner)
Break scope into actionable technical tasks with file-level changes
### in-progress (implementer)
Implement scope items and track progress
### in-review (reviewer)
Review all completed work and validate quality

## Iteration Context
- **Goal**: <iteration goal>
- **Scope Items**: <current scope>

## Expected Output
Update the iteration plan file directly:
- Mark completed items as `- [x]`
- Add new items as `- [ ]`
- Add notes under `## Notes`
```

**Obsidian Detection** — Check if `obsidian` CLI is available via `shell.runCaptureStatus("obsidian --version")`. If available, open via `obsidian://open?vault=<name>&file=<path>` URI scheme. Otherwise, fall back to default browser open.
