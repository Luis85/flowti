# Game World Increment: Sustenance + Economy Foundation

> **For agentic workers:** This is an orchestration document linking two parallel implementation plans. Execute both plans using superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Deepen the Agent World with two parallel tracks — sustenance needs (hunger/thirst) on the Plugin side and task/economy foundations on the CLI side. Together they establish the gameplay loop: agents have needs that drive behavior AND they earn currency by completing real work.

**Date:** 2026-03-21

---

## Two Parallel Tracks

| Track | Project | Plan | Tasks | Est. Commits |
|-------|---------|------|-------|-------------|
| **A: Sustenance** | Flowti Plugin | `01 - Projects/Flowti Plugin/docs/plans/2026-03-21-hunger-thirst.md` | 18 tasks, 4 chunks | ~17 |
| **B: Economy** | Flowti CLI | `01 - Projects/Flowti CLI/docs/plans/2026-03-21-task-economy-engine-phase-a.md` | 10 tasks, 3 chunks | ~10 |

These tracks share **zero files** and can execute fully in parallel. They touch different projects (Plugin vs CLI), different source trees, and different test suites.

---

## Execution Strategy

### Parallel Agent Assignment

If using subagent-driven development, assign one agent per track:

```
Agent 1 → Track A (Plugin: hunger/thirst)
  cd "01 - Projects/Flowti Plugin"
  Follow: docs/plans/2026-03-21-hunger-thirst.md
  Test: npm test

Agent 2 → Track B (CLI: task engine + economy)
  cd "01 - Projects/Flowti CLI"
  Follow: docs/plans/2026-03-21-task-economy-engine-phase-a.md
  Test: npx vitest run --config configs/vitest.config.ts
```

### Sequential Execution (single agent)

If executing sequentially, recommended order:

1. **Track B first** (CLI economy) — pure domain code, no UI, faster to validate
2. **Track A second** (Plugin hunger/thirst) — game engine work, requires visual verification

### Verification Gates

After both tracks complete:

- [ ] CLI tests pass: `cd "01 - Projects/Flowti CLI" && npm test`
- [ ] Plugin tests pass: `cd "01 - Projects/Flowti Plugin" && npm test`
- [ ] Plugin builds: `cd "01 - Projects/Flowti Plugin" && npm run build`
- [ ] CLI builds: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`
- [ ] Manual: Open Obsidian, verify hunger/thirst bars appear in agent info panel
- [ ] Manual: Watch agents seek food/drink stations when hungry/thirsty
- [ ] Manual: Run `flowti economy:balance --agent=auditor` — returns default account
- [ ] Manual: Run `flowti task:list` — returns empty list (no tasks yet)

---

## What This Increment Delivers

### Track A: Sustenance (Plugin)
- Hunger and thirst as energy sub-drivers (low hunger/thirst = faster energy drain)
- FoodBowl and WaterBowl as new interactable actors with Ninja Adventure sprites
- Existing stations (CoffeeMachine, SnackTable, WaterCooler) retrofitted with hunger/thirst effects
- Agent BT: needs-hunger and needs-thirst subtrees in master selector (priority 3 and 4)
- Pet BT: hunger/thirst seeking branches with cross-room transfer
- Pet steal/share mechanic (arrival order determines interaction)
- 6-bar needs display in agent info panel (Energy, Hunger, Thirst, Focus, Social, Morale)
- Pet hunger/thirst persistence across restarts

### Track B: Economy Foundation (CLI)
- Task domain: types, lifecycle state machine (7 states), CRUD store (markdown+JSON)
- Economy domain: types, leveling (8 tiers), ledger (credit/debit/grant), reward rules
- CLI commands: `task:list`, `task:create`, `task:assign`, `economy:balance`, `economy:ledger`, `economy:grant`

---

## What Comes Next

After this increment, the following phases build on both foundations:

| Phase | Depends On | What it adds |
|-------|-----------|-------------|
| **Economy Phase B** | Track B | Trust manager, vault operations, staging area, standing orders |
| **Economy Phase C** | Track B + Phase B | NPC Merchant, shop catalog, delegation flow, `agentType: "npc"` across CLI+Plugin |
| **Economy Phase D** | All above + Track A | WorkerManager routing, journey integration, pet utility roles, visual progression, debug panel |

### Key integration point (Phase D):
- **Pet feeding costs Coin** — when agents share food with pets at stations, the sharing agent's Coin is debited (connects Track A's share mechanic to Track B's economy)
- **Standing orders watch food supply** — agents with standing orders can monitor station usage and restock (connects Track A's stations to Track B's standing orders)
- **Needs bars + economy stats** — same info panel gets both hunger/thirst bars (Track A) and XP/Coin/Level display (Track B's Phase D debug panel)

---

## Review Notes

Both plans have been reviewed and critical issues documented:

**Hunger/Thirst plan** — 6 fixes documented at the top of the plan file:
1. `BtSystem.getPet()` missing — add method
2. `NeedMultipliers` + `DEFAULT_MULTIPLIERS` incomplete — update all 7 phases
3. `EngineContext` + `engine-objects.ts` not updated — use extraction pattern
4. Sprite loading needs error handling — use `Promise.allSettled()`
5. Postframe handler is in `engine-postframe.ts` not `engine.ts`
6. Build command correction

**Economy plan** — all critical issues already fixed in-place:
1. `appendFileSync` → read-then-write pattern
2. `types-infra.ts` → `types.ts` import path
3. `readdirSync` mock → returns strings not objects
4. `process.cwd()` → `VAULT_ROOT` from infrastructure
5. Task store → manual implementation (not fragile `createStore`)
6. `Math.round(7.5)` → 8 in test assertion
