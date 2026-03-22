# Data Export & Type Alignment — Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Economy + trust enrichment in agent export, experience→xp migration, action type alignment, goals shape fix
**Depends on:** Economy domain (merged), Trust domain (merged), Agent export (existing)
**Parallel with:** Autonomy Bridge (zero file overlap)

## Problem

The CLI exports agent data via `buildDashboardAgent()` to `agent-dashboard.json`, which the Plugin consumes to render the RPG world. The economy domain (XP, coins, tokens, levels) and trust domain (trust tier, promotion) are fully implemented but not wired into the export. The Plugin's `DashboardAgent` interface already defines optional fields for these (`level`, `coin`, `tokens`, `xp`, `trustTier`, `capabilities`) — they're just never populated.

Additionally:
- The CLI `AgentActionType` is missing 4 action types the Plugin already uses (`seek-food`, `seek-drink`, `seek-preferred-food`, `seek-preferred-drink`)
- The `experience` field and `xp` field represent the same concept — `experience` must be fully removed in favor of `xp` (sourced from the economy ledger)
- The goals export shape is missing the `name` field (identifier) — only `text` and `priority` are exported

## Goals

1. `agent-dashboard.json` includes economy and trust data for every agent
2. Single `xp` field replaces `experience` everywhere (CLI + Plugin)
3. CLI and Plugin share the same action type vocabulary
4. Goals export includes `name` as the primary identifier

## Non-Goals

- World state reconciliation (periodic sync push) — separate spec
- Plugin UI changes to display economy data — follow-on work
- Economy rebalancing or leveling changes

## Architecture

### Approach: Enrich at the Call Site

The economy and trust data is read once in `exportAgentDashboardData()` (which already does I/O) and passed as a lightweight snapshot to the pure `buildDashboardAgent()` mapper. This preserves the existing pattern where `buildDashboardAgent` has no I/O.

```
exportAgentDashboardData()
    ├── readLedger(deps, vaultRoot)          → EconomyLedger (all accounts)
    ├── loadTrustProfile(deps, vaultRoot, agentSlug)  → per agent
    ├── deriveTier(profile)                  → TrustTier
    ├── capabilitiesForLevel(account.level)  → string[]
    └── buildDashboardAgent(agent, derived, economySnapshot)
            → DashboardAgent with economy fields populated
```

No new deps needed. `readLedger` and `loadTrustProfile` both take `{ disk, paths }` which is already `AgentExportDeps`.

## Detailed Changes

### 1. CLI: Economy Enrichment (`agent-export.ts`)

**New type:**

```typescript
interface EconomySnapshot {
    readonly level: number;
    readonly xp: number;
    readonly coin: number;
    readonly tokens: number;
    readonly trustTier: "supervised" | "trusted" | "autonomous";
    readonly capabilities: readonly string[];
}
```

**`exportAgentDashboardData` changes:**

At the top of the function, after loading agents:

```typescript
const ledger = readLedger(deps, vaultRoot);
```

Inside the agent mapping loop, for each agent:

```typescript
const account = getAccount(ledger, agent.name);
const trust = loadTrustProfile(deps, vaultRoot, agent.name);
const tier = deriveTier(trust);
const caps = capabilitiesForLevel(account.level);
const economy: EconomySnapshot = {
    level: account.level,
    xp: account.xp,
    coin: account.coin,
    tokens: account.tokens,
    trustTier: tier,
    capabilities: caps,
};
return buildDashboardAgent(agent, derived, economy);
```

**Key:** Ledger keys and trust profile filenames use raw display names (`agent.name`, e.g., `"Product Owner"`), not slugs. This matches how all existing callers (`vault-executor.ts`, `debug.controller.ts`, `economy.controller.ts`) access the ledger and trust profiles. Use `getAccount(ledger, agent.name)` which already handles the default case.

**`buildDashboardAgent` changes:**

Add third parameter `economy?: EconomySnapshot`. Spread economy fields into the return object:

```typescript
export function buildDashboardAgent(
    agent: AgentSummary,
    derived: { status: AgentStatus; project?: string; iteration?: string; phase?: string },
    economy?: EconomySnapshot,
): DashboardAgent {
    return {
        // ... existing fields ...
        level: economy?.level,
        xp: economy?.xp,
        coin: economy?.coin,
        tokens: economy?.tokens,
        trustTier: economy?.trustTier,
        capabilities: economy?.capabilities ? [...economy.capabilities] : undefined,
    };
}
```

**`DashboardAgent` interface changes (CLI side):**

Remove `experience`. Add:

```typescript
readonly level?: number;
readonly xp?: number;
readonly coin?: number;
readonly tokens?: number;
readonly trustTier?: "supervised" | "trusted" | "autonomous";
readonly capabilities?: readonly string[];
```

**New imports in `agent-export.ts`:**

```typescript
import { readLedger } from "../economy/economy-ledger.js";
import { loadTrustProfile } from "../trust/trust-manager.js";
import { deriveTier } from "../trust/trust-manager.js";
import { getAccount } from "../economy/economy-ledger.js";
import { capabilitiesForLevel } from "../economy/leveling.js";
```

Note: `deriveTier` is in `trust-manager.ts` (not `trust-types.ts` which only has type definitions). `capabilitiesForLevel` does not exist yet — needs to be added to `leveling.ts`. It collects all unlocked capabilities up to a given level from `LEVEL_TABLE`.

### 2. CLI: New Helper in `leveling.ts`

Add a function that collects all unlocked capabilities for a given level:

```typescript
export function capabilitiesForLevel(level: number): string[] {
    const caps: string[] = [];
    for (const entry of LEVEL_TABLE) {
        if (level >= entry.level) {
            caps.push(...entry.unlocks);
        }
    }
    return caps;
}
```

### 3. CLI: Goals Shape Fix (`agent-export.ts`)

Current (line 249):

```typescript
goals: agent.goals?.map(g => ({ text: g.name, priority: String(g.priority ?? 0) })),
```

Changed to:

```typescript
goals: agent.goals?.map(g => ({ name: g.name, text: g.name, priority: String(g.priority ?? 0) })),
```

The `name` field serves as the identifier, `text` remains for display. Plugin already has `name?: string` — this makes it always populated.

### 4. CLI: Experience → XP Migration (`agent-export.ts`)

- Remove `experience` from CLI's `DashboardAgent` interface (export type)
- Remove `experience: agent.experience` from `buildDashboardAgent` return
- `xp` is now the sole exported field, sourced from economy ledger (defaults to `0`)

**Scope boundary:** The `experience` field on `AgentDefinition` and `AgentSummary` (in `agent-types.ts`) persists unchanged — it's the raw authored value from agent markdown frontmatter. The economy ledger's `xp` is the authoritative progression value. The export uses the ledger, never the frontmatter field. Code that reads `experience` from agent definitions (e.g., `llm-prompt.ts`, `agent-conversation.ts`, `claude-sync.ts`) is untouched — those are authoring/identity contexts, not dashboard export.

### 5. CLI: Action Type Alignment (`world-state-types.ts`)

Add to `AgentActionType` union:

```typescript
| "seek-food" | "seek-drink"
| "seek-preferred-food" | "seek-preferred-drink"
```

These already exist in the Plugin's `AgentActionType` (lines 12-13 of `src/game/data/types.ts`). No behavioral changes — type parity only.

### 6. Plugin: Drop `experience` from `DashboardAgent` (`data/types.ts`)

Remove `readonly experience?: number;` from the `DashboardAgent` interface. The `xp?: number` field (line 89) is already present and becomes the sole source.

Also fix `readonly` consistency — the economy fields (`level`, `coin`, `tokens`, `xp`, `trustTier`, `capabilities`) should use `readonly` to match all other fields in the interface.

### 7. Plugin: Migrate `experience` References

All Plugin source files referencing `experience` must be updated to `xp`. Complete list:

**Source files (11):**

| File | Line(s) | Change |
|------|---------|--------|
| `src/game/data/types.ts` | 77 | Remove `readonly experience?: number` |
| `src/game/ui/panel-info.ts` | 288, 296 | Destructure `xp` instead of `experience`; update `renderXp()` call |
| `src/game/ui/panel-economy.ts` | 174 | Remove `experience` fallback: `this.agent.xp ?? 0` |
| `src/game/ui/panel-debug.ts` | 328 | Remove `experience` fallback: `this.agent!.xp ?? 0` |
| `src/game/brain/behavior-tree/bt-types.ts` | 58, 165 | Rename `experience` → `xp` on `BTAgentDef` and `BTAgentContext` |
| `src/game/brain/behavior-tree/bt-agent.ts` | 103 | `xp: agent.xp ?? 0` |
| `src/game/config/world-state-agents.ts` | 68, 80 | Read `xp` from world entity components |
| `src/game/config/agent-markdown-roster.ts` | 156 | Parse `xp` from frontmatter (or keep `experience` parse and map to `xp`) |
| `src/game/systems/bt-system.ts` | 54 | `xp: agent.xp` |
| `src/game/engine-lifecycle.ts` | 247 | Remove fallback: `a.xp ?? 0` |
| `src/game/engine-events.ts` | 522 | Remove fallback: `agent?.xp ?? 0` |

**Test files (5):**

| File | Line(s) | Change |
|------|---------|--------|
| `tests/game/ui/panel-debug.test.ts` | 80 | Update mock to use `xp` |
| `tests/game/config/world-state-agents.test.ts` | 84, 97, 108, 125 | Update fixtures |
| `tests/game/config/agent-markdown-roster.test.ts` | 72, 76, 78, 81, 88 | Update fixtures |
| `tests/game/brain/behavior-tree/bt-agent.test.ts` | 25 | Update fixture |
| `tests/game/brain/behavior-tree/bt-agent-extensions.test.ts` | 18 | Update fixture |

**Note on `panel-info.ts`:** This file has its own `renderXp()` with a simplified leveling formula (`Math.floor(xp / 100)`). After migration to `xp`, it should use the proper level data from `agent.level` (now populated by the export) instead of recalculating. If `panel-economy.ts` already handles XP display, consider removing the duplicate rendering from `panel-info.ts`.

### 8. Key Naming Convention

Both the economy ledger and trust profiles use raw display names (e.g., `"Product Owner"`) as keys, not slugs. This is confirmed by all existing callers (`vault-executor.ts`, `debug.controller.ts`, `economy.controller.ts`, `task-router.ts`). The export uses `agent.name` directly — no slugification needed.

## Error Handling

- **No economy file:** `readLedger` returns `{ accounts: {} }` — agents get default snapshot (level 1, xp 0, coin 0, tokens 0)
- **No trust file:** `loadTrustProfile` returns `defaultProfile()` — tier is "supervised"
- **Malformed JSON:** Let the existing `JSON.parse` throw — `exportAgentDashboardData` is called in a try/catch context by the dashboard build pipeline

## Test Strategy

### CLI Tests (`agent-export.test.ts`)

1. **`buildDashboardAgent` with economy snapshot** — verify all 6 economy fields appear in output
2. **`buildDashboardAgent` without economy snapshot** — verify economy fields are undefined (no defaults leaked)
3. **`exportAgentDashboardData` enrichment** — mock `readLedger` and `loadTrustProfile`, verify economy data flows through to each agent
4. **Goals shape** — verify `name`, `text`, and `priority` are all present
5. **No `experience` field** — verify `experience` is absent from output in all cases

### CLI Tests (`leveling.test.ts`)

1. **`capabilitiesForLevel(1)`** — returns `["vault-read", "simple-tasks"]`
2. **`capabilitiesForLevel(4)`** — returns all unlocks for levels 1-4
3. **`capabilitiesForLevel(8)`** — returns all unlocks

### Plugin Tests

- Update any test referencing `agent.experience` to use `agent.xp`
- No new Plugin tests — changes are field removal + rename

### What We Don't Test

- Economy ledger reading (tested in `economy-ledger.test.ts`)
- Trust profile loading (tested in `trust-manager.test.ts`)
- Leveling/XP thresholds (tested in `leveling.test.ts`)
- Action types (compile-time, validated by `tsc`)

## File Map

### CLI (`01 - Projects/Flowti CLI/`)

| Action | File | Change |
|--------|------|--------|
| Modify | `src/domain/agents/agent-export.ts` | Economy enrichment, drop `experience`, goals shape, new imports |
| Modify | `src/domain/agents/world-state-types.ts` | Add 4 action types |
| Modify | `src/domain/economy/leveling.ts` | Add `capabilitiesForLevel()` |
| Modify | `tests/domain/agents/agent-export.test.ts` | Economy enrichment tests, goals tests, no-experience tests |
| Modify | `tests/domain/economy/leveling.test.ts` | `capabilitiesForLevel` tests |

### Plugin (`01 - Projects/Flowti Plugin/`)

| Action | File | Change |
|--------|------|--------|
| Modify | `src/game/data/types.ts` | Drop `experience`, add `readonly` to economy fields |
| Modify | `src/game/ui/panel-info.ts` | `experience` → `xp`, simplify XP rendering |
| Modify | `src/game/ui/panel-economy.ts` | Remove `experience` fallback |
| Modify | `src/game/ui/panel-debug.ts` | Remove `experience` fallback |
| Modify | `src/game/brain/behavior-tree/bt-types.ts` | `experience` → `xp` on `BTAgentDef` + `BTAgentContext` |
| Modify | `src/game/brain/behavior-tree/bt-agent.ts` | `experience` → `xp` |
| Modify | `src/game/config/world-state-agents.ts` | `experience` → `xp` |
| Modify | `src/game/config/agent-markdown-roster.ts` | `experience` → `xp` |
| Modify | `src/game/systems/bt-system.ts` | `experience` → `xp` |
| Modify | `src/game/engine-lifecycle.ts` | Remove `experience` fallback |
| Modify | `src/game/engine-events.ts` | Remove `experience` fallback |
| Modify | `tests/game/ui/panel-debug.test.ts` | Update fixture |
| Modify | `tests/game/config/world-state-agents.test.ts` | Update fixtures |
| Modify | `tests/game/config/agent-markdown-roster.test.ts` | Update fixtures |
| Modify | `tests/game/brain/behavior-tree/bt-agent.test.ts` | Update fixture |
| Modify | `tests/game/brain/behavior-tree/bt-agent-extensions.test.ts` | Update fixture |

**Zero overlap with Autonomy Bridge files** (`agent-process-loop.ts`, `worker-manager.ts`, `worker-types.ts`, `cli-executor.ts`, `dashboard-store.ts`, `engine-simulation.ts`).
