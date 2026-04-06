# Leisure System — Rest Days + Leisure Locations

**Date**: 2026-04-06
**Scope**: Weekly rest day system + 4 leisure locations + personality-driven leisure BT branch
**Goal**: Give agents meaningful free time, create gold sinks, and express personality through leisure choices.

---

## Rest Day System

### Mechanic

Every Nth game day is a rest day, controlled by `rest_day_interval` in `game-config.json` (default: 7). A rest day is detected by `day % rest_day_interval === 0` (day 7, 14, 21...).

### BT Integration

A new `IsRestDay()` condition returns `true` when the current day is a rest day.

`IsWorkHours()` gains one additional early-return: if `IsRestDay()` is true, return `false` regardless of time phase. This causes the P1 (job claiming) and P2 (work) branches to be skipped entirely on rest days.

### Config

```json
{
  "rest_day_interval": 7,
  "leisure_mood_threshold": -20
}
```

`leisure_mood_threshold` controls when agents seek leisure on workdays (see BT Branch below).

---

## Leisure Locations

### Four New Locations

| Location | Type | Cost | Primary Effect | Secondary Effect | Attr Bonus | Ticks/Visit |
|---|---|---|---|---|---|---|
| Tavern | leisure | 3g | Social +15 | Mood +5 | — | 20 |
| Park | leisure | 0g | Mood +8 | Social +5 | — | 15 |
| Library | leisure | 1g | Skill XP +1 | Mood +3 | IQ | 20 |
| Bathhouse | leisure | 2g | Energy +20 | Mood +5 | HT | 15 |

### Location Schema

Each leisure location is a standard `WorldLocation` JSON with `type: "leisure"` and a `leisure` configuration block:

```json
{
  "id": "loc-tavern",
  "name": "Tavern",
  "type": "leisure",
  "position": { "x": 250, "y": 280, "region": "market-square" },
  "production": null,
  "leisure": {
    "cost": 3,
    "effects": { "social": 15, "mood": 5, "energy": 0, "skill_xp": 0 },
    "attribute_bonus": null,
    "ticks_per_visit": 20
  }
}
```

**Schema addition** (`location-schema.ts`): Add `LeisureConfigSchema` as an optional field on `WorldLocation`:

```typescript
const LeisureConfigSchema = z.object({
  cost: z.number().min(0),
  effects: z.object({
    social: z.number().default(0),
    mood: z.number().default(0),
    energy: z.number().default(0),
    skill_xp: z.number().default(0),
  }),
  attribute_bonus: z.string().nullable().default(null),
  ticks_per_visit: z.number().int().min(1).default(15),
});
```

Added as `leisure: LeisureConfigSchema.nullable().default(null)` on the location schema. Non-leisure locations have `leisure: null`.

### Gold Flow

Gold is deducted once on arrival (same pattern as rest shelter payment in `RestSystem`). The gold goes to the location's `FacilityComponent.fund`, creating a revenue stream. A `LedgerEntry` with `type: 'purchase'` is appended to `EconomyComponent.ledger` (matching `RestSystem` pattern) so `DailyReportSystem` tracks leisure spending. Broke agents can only visit free locations (park). `GoldFlowed` events are emitted with `subcategory: 'leisure'` for monetary policy tracking.

---

## BT Branch: P2.5 Leisure

### Position in Priority Cascade

Inserted between P2 (role-specific work) and P3 (thirst) in `base.mdsl`:

```
/* P2.5: Leisure — rest day or stressed */
sequence {
    selector {
        condition [IsRestDay]
        condition [IsMoodLow]
    }
    condition [IsDaytime]
    action [ChooseLeisure]
    action [SeekLeisureTarget]
    action [Leisure] while(IsAtLeisure)
}
```

**Activation**: Fires when either `IsRestDay()` is true (weekly rest day) or `IsMoodLow()` is true (mood below `leisure_mood_threshold`, default -20). The `IsDaytime` guard ensures agents don't seek leisure at night — they sleep instead. Note: `IsWorkHours` is NOT used here because it returns `false` on rest days (by design), which would block the primary use case.

**`IsMoodLow()`**: Returns `true` when `agent.mood < config.leisure_mood_threshold`. This allows stressed agents to take an unplanned leisure break on workdays — emergent self-care behavior.

### New BT Conditions

| Condition | Logic |
|---|---|
| `IsRestDay()` | `day % config.rest_day_interval === 0` |
| `IsMoodLow()` | `agent.mood < config.leisure_mood_threshold` |
| `IsAtLeisure()` | `memory.btAction === 'leisure' && memory.atLocation === memory.leisureTarget` |

### New BT Actions

| Action | Behavior | Returns |
|---|---|---|
| `ChooseLeisure()` | Score all known leisure locations, pick best, store in `memory.leisureTarget` | `SUCCEEDED` or `FAILED` (no known/affordable options) |
| `SeekLeisureTarget()` | Set `movementTarget` to `memory.leisureTarget` | `RUNNING` (travelling) or `SUCCEEDED` (arrived) |
| `Leisure()` | Call `beginAction('leisure')` with commitment from `ticks_per_visit` | `RUNNING` |

### Working Memory Addition

Add to `WorkingMemory` in `bt-working-memory.ts`:

```typescript
leisureTarget: string | null;  // location ID of chosen leisure destination
```

---

## Agent Selection Algorithm (ChooseLeisure)

### Scoring Formula

```
score = needWeight + attributeBonus - distancePenalty
```

**Pre-filter**: Exclude locations where `cost > agent.gold` (affordability gate).

**Need weight** — how much the agent needs this location's primary effect:
- For `social` effect: `(100 - agent.social) / 100 * effects.social`
- For `mood` effect: `(100 - clamp(agent.mood + 100, 0, 200) / 2) / 100 * effects.mood`
- For `energy` effect: `(100 - agent.energy) / 100 * effects.energy`
- For `skill_xp` effect: flat `effects.skill_xp * 5` (no urgent need, always mildly attractive)
- Total need weight = sum of all non-zero effect weights

**Attribute bonus** — personality pull:
- If `attribute_bonus` is non-null: `agent.getAttribute(attribute_bonus) / aptitude_baseline * 3`
- If null (e.g., park): no bonus
- This creates consistent personality preferences: high-CHR agents gravitate to tavern, high-IQ to library, high-HT to bathhouse

**Distance penalty**: `distance / 100` — mild preference for closer options without dominating the score.

### Selection Behavior

The highest-scoring location wins. On ties, prefer the closer one. If no leisure locations are known or affordable, `ChooseLeisure()` returns `FAILED` and the BT falls through to P3 (thirst) and beyond — the agent has a normal day.

---

## LeisureSystem (Infrastructure)

### System Properties

- **Name**: `LeisureSystem`
- **Priority**: `SystemPriority.LEISURE` — new constant at 6.75 (between FeedSystem 6.6 and SocializeSystem 6.7)
- **Pattern**: Follows `RestSystem` pattern exactly (resolve location, apply per-tick effects, emit events)

### Per-Tick Logic

For each agent where `btAction === 'leisure'`:

1. Look up leisure location from `memory.leisureTarget` via `getLocations()`
2. If location has `leisure` config:
   - Apply per-tick effects (divided by `ticks_per_visit` for gradual application):
     - `social += effects.social / ticks_per_visit`
     - `energy += effects.energy / ticks_per_visit`
     - Mood effect via `externalModifiers` (accumulated, applied by MoodSystem)
   - Skill XP: increment on first tick only (once per visit, not per-tick)
3. On first tick at location (track via `memory.leisureTarget` change, same pattern as `RestSystem.restingAt`):
   - Deduct `leisure.cost` from agent wallet
   - Credit `leisure.cost` to location's `FacilityComponent.fund`
   - Emit `GoldFlowed` event (`category: 'transfer', subcategory: 'leisure'`)
   - Emit `LeisureStarted` event
4. Emit `LeisureComplete` when `btAction` changes away from `'leisure'`

### Mood Effect Application

Store a positive memory when leisure starts at a location. A `leisure_loc-tavern` memory with `outcome: 'positive'` and `significance` proportional to the mood effect naturally boosts mood through the existing memory→mood pipeline. This approach requires zero changes to MoodSystem and the memory persists after the visit (the agent remembers having a good time).

---

## Config Additions

### game-config-schema.ts

```typescript
rest_day_interval: z.number().int().min(1).default(7),
leisure_mood_threshold: z.number().default(-20),
```

### game-config.json

```json
{
  "rest_day_interval": 7,
  "leisure_mood_threshold": -20
}
```

### commitment_ticks (in existing config block)

```json
{
  "leisure": 0
}
```

Leisure commitment comes from `ticks_per_visit` on the location, not from the global commitment config. The `Leisure` action reads it from the location data and sets `memory.commitmentTicks` directly.

---

## Files Summary

### New Files
- `locations/tavern.json` — leisure location
- `locations/park.json` — leisure location
- `locations/library.json` — leisure location
- `locations/bathhouse.json` — leisure location
- `src/infrastructure/systems/leisure-system.ts` — per-tick effects + gold flow
- `tests/infrastructure/systems/leisure-system.test.ts`

### Modified Files
- `src/domain/schemas/location-schema.ts` — add `LeisureConfigSchema`
- `src/domain/schemas/game-config-schema.ts` — add `rest_day_interval`, `leisure_mood_threshold`
- `configs/game-config.json` — add rest day + leisure config values
- `src/domain/systems/behavior-agent.ts` — add `IsRestDay`, `IsMoodLow`, `ChooseLeisure`, `SeekLeisureTarget`, `Leisure`, `IsAtLeisure`
- `src/infrastructure/entity/bt-conditions.ts` — implement 3 new conditions
- `src/infrastructure/entity/bt-actions.ts` — implement 3 new actions
- `src/infrastructure/entity/bt-working-memory.ts` — add `leisureTarget`
- `src/infrastructure/entity/behavior-agent-factory.ts` — wire new conditions/actions, expose leisure location data
- `behavior-trees/base.mdsl` — add P2.5 leisure branch
- `src/infrastructure/engine/game-view.ts` — register `LeisureSystem`
- `src/domain/core/tick-scheduler.ts` — add `SystemPriority.LEISURE`
- `src/infrastructure/entity/bt-conditions.ts` — modify `IsWorkHours` to return false on rest days

### Unchanged
- All existing systems (facility, mood, rest, trade, economy, etc.)
- All existing location types and definitions
- All existing BT branches (P0-P7)

---

## Expected Outcome

| Metric | Before | After |
|---|---|---|
| Agent weekly schedule | Work every day | 6 work days + 1 rest day |
| Leisure behavior | None (work→eat→sleep loop) | Tavern, park, library, bathhouse visits |
| Gold sinks | Rest shelter (1g) only | + Tavern 3g, bathhouse 2g, library 1g per visit |
| Personality expression | Job aptitude only | Leisure preferences from GURPS attributes |
| Mood recovery | Only from needs satisfaction | + Positive memories from leisure visits |
| Social recovery paths | Only SocializeSystem (nearby agents) | + Tavern visits (deliberate social seeking) |
| Agent gold accumulation | Unbounded (953g observed) | Meaningful weekly spending at leisure locations |

The simulation gains a visible weekly rhythm: 6 days of productive work, 1 day of agents dispersing to their preferred leisure spots based on personality and needs. Stressed agents can also take unplanned breaks on workdays. Gold circulates instead of hoarding.

---

## Dependencies

Implementation order:

1. **Schema + config** — `LeisureConfigSchema`, `rest_day_interval`, `leisure_mood_threshold` (standalone)
2. **Location data** — 4 JSON files (depends on schema)
3. **Working memory** — `leisureTarget` field (standalone)
4. **BT conditions** — `IsRestDay`, `IsMoodLow`, `IsAtLeisure` + modify `IsWorkHours` (depends on config)
5. **BT actions** — `ChooseLeisure`, `SeekLeisureTarget`, `Leisure` (depends on conditions + working memory)
6. **LeisureSystem** — per-tick effects + gold flow (depends on actions + locations)
7. **BT integration** — P2.5 branch in `base.mdsl` (depends on conditions + actions)
8. **Game view** — register system (depends on LeisureSystem)
