# Equipment Gate in Job MDSL Design

**Status:** Approved
**Date:** 2026-04-11
**Scope:** 4 MDSL files, 0 TypeScript changes

## Problem

P4.45 (repair equipment) and P4.5 (buy equipment) sit at position ~15 in the base.mdsl selector. Agents always have a higher-priority need (hunger, thirst, social, work) that captures them before reaching equipment branches. After 20 simulated days, all agents had `equip:0` — equipment decayed to zero without ever being repaired or replaced. Market has `equipmentx2` and `toolsx47` sitting untouched.

The commitment break fix correctly fires when equipment needs attention, but the freed tree evaluation gets captured by higher-priority branches before reaching P4.5.

## Design

### Move Equipment Maintenance Into Job MDSL

Instead of relying on low-priority branches in base.mdsl, embed an equipment maintenance gate as the **first branch** in each job's root selector (settler.mdsl, craftsman.mdsl, guard.mdsl). The gate fires before work, ensuring agents resolve equipment issues before starting production.

### Gate Structure

The maintenance gate is a sequence that checks if any equipment issue exists, then resolves it:

```
/* Equipment maintenance before work */
sequence {
    condition [HasJob]
    selector {
        condition [NeedsEquipment]
        condition [NeedsRepair]
    }
    selector {
        /* Option 1: Repair immediately if has tools */
        sequence {
            condition [NeedsRepair]
            condition [HasTools]
            action [RepairWithTools]
        }
        /* Option 2: Buy new equipment if missing/depleted */
        sequence {
            condition [NeedsEquipment]
            condition [CanAffordItem, "equipment"]
            selector {
                sequence {
                    condition [AtLocation, "market"]
                    condition [FacilityHasStock, "equipment"]
                    action [BuyItem, "equipment"]
                }
                action [SeekMarket]
            }
        }
        /* Option 3: Buy tools for repair (repair fires next tick) */
        sequence {
            condition [NeedsRepair]
            condition [CanAffordItem, "tools"]
            selector {
                sequence {
                    condition [AtLocation, "market"]
                    condition [FacilityHasStock, "tools"]
                    action [BuyItem, "tools"]
                }
                action [SeekMarket]
            }
        }
    }
}
```

**Priority order within the gate:**
1. Repair with existing tools (free, immediate, no travel)
2. Buy new equipment (only when `NeedsEquipment` — charges=0 or missing)
3. Buy tools for future repair (only when `NeedsRepair` — charges low but not zero)

Option 2 is guarded by `condition [NeedsEquipment]` to prevent agents with low-but-functional equipment from wastefully buying new equipment when they only need cheap tools. `NeedsEquipment` and `NeedsRepair` are mutually exclusive — `NeedsRepair` requires charges > 0, `NeedsEquipment` requires charges = 0 or missing.

**Broke-agent fallback:** When all three options fail (can't afford anything), the inner selector fails, the gate sequence fails, and control falls to the normal work branch. The agent works without equipment — no equipment means no 20% needs reduction buff, but production still functions. This is intentional: working without equipment is suboptimal but not blocked.

### Per-Role Placement

**Settler and Guard:** The gate is the first branch in the root selector, before work branches.

**Craftsman:** The gate goes **after** the `CollectProduced` branch but **before** the `Work` branch. This way Celia collects her produced tools first (self-supply), then the gate checks equipment. If she needs repair and just collected tools, Option 1 (repair with tools) fires immediately — no market trip needed.

### Cleanup: Remove Duplicate Branches

**settler.mdsl:** Remove the existing `NeedsTools` buy-tools branches (lines 22-34 in current file). These are superseded by the gate's Option 3. Keeping both creates duplicate tool-buying logic.

**base.mdsl:** Remove P4.45 (repair equipment with tools, ~16 lines) and P4.5 (buy equipment, ~14 lines). These never fired and are now handled by job branches.

### Guard Condition

The outer `condition [HasJob]` ensures the gate only fires for employed agents. Guards receive stipend income and visit markets for food already, so market trips for equipment/tools are a natural extension of existing behavior. `CanAffordItem` falls back to `config.items[itemId].baseValue` when no price memory exists, so guards without prior market visits can still evaluate affordability.

### Interaction with Work Branch

The gate is a separate selector branch above the work branch:

```
selector {
    /* Equipment maintenance — fires when NeedsEquipment or NeedsRepair */
    sequence { ... gate ... }
    
    /* Normal work — fires when equipment is fine */
    sequence {
        condition [AtJobFacility]
        action [Work] while(IsWorkHours)
    }
    ...
}
```

When equipment needs attention: gate succeeds, agent goes to market. When equipment is fine: `NeedsEquipment` and `NeedsRepair` are both false, the gate's inner selector fails, the sequence fails, and the normal work branch fires.

### ContinueCommitment Equipment Break — Retained

The existing equipment break conditions in `ContinueCommitment` (from the commitment-breaks spec) stay. They handle the edge case where equipment decays mid-work-commitment (day boundary crosses repair threshold during a 30-tick work commitment). The MDSL gate handles the common case; the commitment break handles the edge case.

## Expected Tool Economy Loop

With this change, the full loop should activate:

1. Agent starts day → seeks work → arrives at facility
2. Equipment gate fires → `NeedsRepair` true (charges < 10) → `HasTools`?
3. If yes → `RepairWithTools` (consume 1 tool, +10 charges capped at 20) → work
4. If no → `SeekMarket` → `BuyItem("tools")` → return to facility → repair next tick → work
5. Celia produces tools → `CollectProduced` → overload at 6 → `SellAtMarket` → tools enter market
6. Other agents buy tools from market for repair
7. Equipment lasts longer → agents buy less frequently → tools have steady demand

## Files Modified

| File | Change |
|------|--------|
| `jobs/settler.mdsl` | Add equipment gate as first branch, remove duplicate NeedsTools branches |
| `jobs/craftsman.mdsl` | Add equipment gate after CollectProduced, before Work |
| `jobs/guard.mdsl` | Add equipment gate as first branch |
| `behavior-trees/base.mdsl` | Remove P4.45 and P4.5 branches |

## No TypeScript Changes

All conditions (`NeedsEquipment`, `NeedsRepair`, `HasTools`, `CanAffordItem`) and actions (`RepairWithTools`, `BuyItem`, `SeekMarket`) already exist and are tested.

## Test Strategy

MDSL changes are not unit-testable (behavior trees are integration-level). Verification is via simulation snapshots:
- Agent buys equipment when `equip:0`
- Agent repairs equipment when charges drop below 10
- Agent buys tools from market for repair
- Market tool stock decreases (currently 47, should decline)
- Equipment charges stay above 0 for employed agents
