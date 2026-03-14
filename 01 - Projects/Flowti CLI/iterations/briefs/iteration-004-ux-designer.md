---
agent: UX Designer
iteration: 4
status: done
---

# Agent Brief: UX Designer — Iteration #4

**Agent**: [[ux-designer|UX Designer]]
**Status**: done

## Your Role

Designs user experiences, wireframes, and interaction patterns

**Skills**: User Research, Wireframing, Interaction Design, Accessibility
**Roles**: Designer, Usability Reviewer

## Iteration Context

- **Plan**: [[iteration-004-plan|Iteration #4 Plan]]
- **Name**: Flowti CLI gets a visual presence
- **Goal**: Agents become visible — project-level agent roster, a built-in static server, and an ExcaliburJS agent dashboard as the first served scene
- **Status**: in-progress
- **Dates**: 2026-03-14 → 2026-03-28

## Scope Items

See [[iteration-004-plan|Iteration #4 Plan]] for the full task list.

## Definition of Done

- [x] Track progress daily
- [x] Flag blockers early

## Assigned Tasks

- [x] Please make a review of the current user flow
- [x] Please make a thorough Review of the User flow

---

# UX Review: Flowti CLI User Flow

**Date**: 2026-03-14
**Reviewer**: [[ux-designer|UX Designer]]

## 1. Navigation Architecture

The CLI has **27 pages** across **6 depth levels** with **203 actions**. The structure is a tree rooted at `start`:

```
Start Menu (8 actions)
├── Project Detail (24 actions) ← central hub
│   ├── Capture (idea/note/bug)
│   ├── Actions (make/build/review/publish)
│   ├── Iteration (current/plan/advance) ← context-aware
│   ├── Views (components/events/reports/status)
│   └── Management (7 sub-pages) → resources, timelog, RAID, etc.
│       └── Iterations → Iteration Detail → Iteration Planning
├── Agents and AI Tools (7 actions)
│   └── Agent Detail → Agent Edit
└── Plugins (5 actions)
```

### What works well

- **Context-aware visibility**: `Current Iteration` / `Plan next Iteration` swap based on `iteration:running` condition — users see only what's relevant
- **Consistent navigation pattern**: Every page has Back (b) + Quit (q) signals — predictable escape hatches
- **Group separators**: Action groups create visual sections — capture / actions / iteration / views / manage — reducing cognitive load
- **Project banner**: `onBeforeRender: "project:banner"` provides persistent context
- **Shortcut keys**: Critical actions have stable keys (w=iteration, c=components, m=management)

### Issues found

#### Critical

1. **Project Detail is overloaded** — 24 actions on a single page (highest in the app). Users must scan 6 groups to find their action. The page mixes quick capture (idea/note/bug), navigation (make/review/publish), iteration management, views, and management sub-menus.
   - **Recommendation**: Split into 2-3 focused pages or use a categorized sub-menu pattern (e.g., "Quick Actions" vs "Navigate")

2. **Key collision risk** — `w` is used for both `Current Iteration` and `Plan next Iteration` (swapped by condition). `s` is used for both `Advance Iteration` (project-detail) and `Start Dashboard` (start). While conditions prevent both showing simultaneously, it can confuse muscle memory.
   - **Recommendation**: Assign distinct keys or accept the trade-off with clear labeling

#### Important

3. **Iteration flow is split** — To work on iterations, users go: `Project Detail → Current Iteration (w) → iteration-detail`. But the iteration planning sub-page has 13 actions. The new `Assign Task` action on iteration-detail and the full planning page create two entry points for similar work.
   - **Recommendation**: Consider merging the most common planning actions into iteration-detail and making iteration-planning a power-user "full edit" view

4. **Agent pages live under "AI Tools"** — The `ai-tools` page label is "Agents and AI Tools" but agents are now a core concept (roster, briefs, task assignment). The page hierarchy `Start → AI Tools → Agent Detail` makes agents feel like plugins rather than first-class team members.
   - **Recommendation**: Elevate agents to a top-level concern — either a dedicated `Agents` nav entry on the start page or a `Team` section on project-detail

5. **No direct path from iteration to agent brief** — From iteration-detail, "Assign Task" creates/appends to a brief, but there's no way to _view_ existing briefs for the iteration. Users must navigate the filesystem manually.
   - **Recommendation**: Add a "View Briefs" action to iteration-detail that lists briefs for the current iteration

#### Minor

6. **Knowledgebase is disabled** — `disabled: "knowledgebase:available"` makes it visible but grayed out. Empty pages with no clear timeline to enable are visual noise.
   - **Recommendation**: Use `hidden` instead of `disabled` until the feature is ready

7. **Deep nesting for common tasks** — Resources, timelog, RAID are 3 clicks deep (Project → Management → Resources). For daily use, this adds friction.
   - **Recommendation**: Consider adding "Log Time" or "Add Risk" as quick actions on project-detail

8. **Start menu dashboard actions** — "Start Dashboard" and "Stop Dashboard" are on the start page (global), but the dashboard shows project-specific agent data. This creates a conceptual mismatch.
   - **Recommendation**: Move dashboard actions to project-detail or add a project selector to the dashboard

## 2. User Journeys

### Journey: Assign work to an agent (new in Iteration #4)

```
Project Detail → (w) Current Iteration → iteration-detail
  → Assign Task → pick agent from roster → enter task
  → Brief created/updated with role context, wikilinks, DoD
```

**Verdict**: Clean 3-step flow. The brief generation is now role-aware with full context. The agent wikilink and plan wikilink keep everything connected.

### Journey: Review iteration progress

```
Project Detail → (w) Current Iteration → iteration-detail
  → sees: Assign Task, Execute Iteration, Edit Iteration, Advance
```

**Verdict**: Good. The Advance button disables when the iteration can't advance (terminal state). Missing: a summary view of brief statuses (which agents have briefs, open/active/done).

### Journey: Manage project agents

```
Project Detail → (m) Management → (not listed here?)
```

**Issue**: There's no visible path from project-detail to manage the agent roster. The `project:manage-agents` handler exists but where is it in the sitemap?

### Journey: View the agent dashboard

```
Start Menu → (s) Start Dashboard → browser opens
```

**Verdict**: Simple but disconnected from the project context. User must mentally map between CLI agents and dashboard visualization.

## 3. Summary Recommendations (prioritized)

| Priority | Issue | Fix |
|----------|-------|-----|
| P1 | Project-detail overload (24 actions) | Group into sub-menus or reduce to top actions + "More..." |
| P1 | No way to view briefs from iteration | Add "View Briefs" to iteration-detail |
| P2 | Agents buried under AI Tools | Elevate to top-level or project-level |
| P2 | No agent roster management path | Verify `project:manage-agents` is in sitemap |
| P2 | Iteration progress lacks brief status | Show brief summary on iteration-detail |
| P3 | Knowledgebase visible but disabled | Hide until ready |
| P3 | Dashboard on start vs project scope | Move to project-detail |
| P3 | Deep nesting for daily tasks | Add shortcuts to project-detail |

