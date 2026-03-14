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









- [ ] Flag blockers early
- [ ] Track progress daily
- [x] Push the Plan to Git
- [x] Kick-off communication
- [x] Verify all prerequisites are met
- [x] Push the Plan to Git
- [x] Assign resources and capacity
- [x] Break scope into actionable tasks
### Phase 1: Project Agent Roster

- [ ] Add `management.agents` to `FlowtiProjectConfig` type — `string[]` of vault agent names
- [ ] Add config schema validation for `management.agents` — array of strings, optional
- [ ] Add `getProjectAgents(deps, projectPath, config)` domain function — resolves vault agents filtered to project roster
- [ ] Update iteration `addAgentInteractive` — when project has `management.agents`, show only project roster instead of full vault list
- [ ] Add "Manage Agents" action to project-detail sitemap page — add/remove agents from project roster
- [ ] Register handler `project:manage-agents` — interactive add/remove of agent names to config
- [ ] Update project config writer to persist `management.agents` changes
- [ ] Tests for roster resolution, filtered picker, config persistence

### Phase 2: Full-Iteration Tasking

- [ ] Add `generateFullIterationBrief(agent, iteration, deps)` — single brief covering all phases from current state to done
- [ ] Brief includes full lifecycle path, all scope items, all phase instructions concatenated
- [ ] Add "Execute Iteration" action to iteration-detail — generates full-iteration brief for assigned agent
- [ ] Register handler `iteration:execute-full` — prompts for agent, generates brief, writes to briefs directory
- [ ] Sitemap: add "Execute Iteration" action to iteration-detail page
- [ ] Tests for full-iteration brief generation

### Phase 3: `flowti serve` — Static File Server

- [ ] New `src/domain/serve/static-server.ts` — zero-dep HTTP server using Node `http` + `fs` modules
- [ ] Serves files from a configurable root directory (default: `.flowti/site/`)
- [ ] MIME type resolution for common types (html, js, css, json, png, svg, woff2)
- [ ] Auto-opens browser via `shell.run("start <url>")` / Obsidian URI detection
- [ ] New controller `src/controller/serve.controller.ts` — `flowti serve [--port=3000] [--dir=.flowti/site]`
- [ ] Add `serve` command to CommandRegistry
- [ ] Add "Serve Dashboard" action to start page sitemap
- [ ] Tests for MIME resolution, file serving, 404 handling

### Phase 4: Agent Data Export

- [ ] New `src/domain/agents/agent-export.ts` — `exportAgentDashboardData(deps, vaultRoot, projects)` → JSON
- [ ] Export schema: `{ agents: [{ name, type, domain, status, project?, iteration?, phase? }], projects: [{ name, agents }] }`
- [ ] Agent status derivation: `busy` (has active brief or in-progress iteration task), `idle` (assigned but no active work), `unassigned` (vault-only)
- [ ] CLI writes `agent-dashboard.json` to `.flowti/site/data/` before serving
- [ ] Integrate into `flowti serve` — regenerate data file on each serve start
- [ ] Tests for status derivation, export schema, edge cases (no agents, no projects)

### Phase 5: ExcaliburJS Agent Dashboard

- [ ] Initialize ExcaliburJS project in `site/agent-dashboard/` with `package.json`, `tsconfig.json`, build script
- [ ] Entry HTML page (`index.html`) — loads ExcaliburJS engine, fetches `data/agent-dashboard.json`
- [ ] Agent sprite rendering — each agent as a labeled entity with type indicator (human/ai icon)
- [ ] Status visualization — idle agents dim/static, busy agents glow/animate, unassigned agents greyed
- [ ] Layout — agents arranged in project groups, unassigned agents in a separate area
- [ ] Build pipeline — `esbuild` bundles the ExcaliburJS app into `.flowti/site/`
- [ ] Integrate build into `flowti serve` — auto-build dashboard before serving if sources changed
- [ ] Add `site:build` to `flowti.config.json` build commands

### Closure

- [ ] Verify tsc, vitest, eslint, esbuild all pass
- [ ] End-to-end walkthrough — assign agents to project, create iteration, generate full brief, serve dashboard, see agent status
- [ ] Push the Plan to Git
- [ ] Document learnings
- [ ] Capture retrospective notes
- [ ] Review completed scope items

## Transition History

| Date | From | To | Reason |
|---|---|---|---|
| 2026-03-14 | ready | in-progress | Advanced to in-progress |
| 2026-03-14 | planned | ready | Advanced to ready |
| 2026-03-14 | new | planned | Advanced to planned |

## Notes

**Design Decisions:**

**Project Agent Roster Format** — Stored in `flowti.config.json` under `management.agents`:
```json
{
  "management": {
    "agents": ["Product Owner", "Software Architect", "Software Developer"],
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
Agents are referenced by name (matching vault-level agent definitions). The roster is the project's "team" — only these agents appear in the iteration agent picker. Orchestration phase bindings must reference agents from the roster.

**Static Server Architecture** — Pure Node.js, zero dependencies:
```
flowti serve [--port=3000] [--dir=.flowti/site]
  1. Regenerate agent-dashboard.json from vault state
  2. Build ExcaliburJS app if sources changed (esbuild)
  3. Start http.createServer() serving static files
  4. Open browser (or Obsidian URI if detected)
```
The server is stateless — it reads the filesystem on each request. No WebSocket, no live reload in MVP. Refresh the browser to see updated state.

**Agent Status Derivation:**
- `busy` — Agent is referenced in an iteration that is `in-progress` or `in-review`, AND has an active scope item or brief
- `idle` — Agent is assigned to a project (in roster) but has no active iteration work
- `unassigned` — Agent exists in vault but is not in any project's roster

**ExcaliburJS Project Structure:**
```
site/agent-dashboard/
├── package.json          # ExcaliburJS dependency
├── tsconfig.json         # Strict TS config
├── src/
│   ├── main.ts           # Engine setup, scene loading
│   ├── agent-scene.ts    # Main scene — renders agents
│   ├── agent-actor.ts    # Agent as ExcaliburJS Actor (sprite, label, status glow)
│   └── data-loader.ts    # Fetch and parse agent-dashboard.json
├── assets/
│   ├── human-agent.png   # Sprite for human agents
│   └── ai-agent.png      # Sprite for AI agents
└── index.html            # Entry point
```
Build output goes to `.flowti/site/` which is the serve root. The dashboard is the first "scene" — future iterations add more scenes (project map, iteration timeline).

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
