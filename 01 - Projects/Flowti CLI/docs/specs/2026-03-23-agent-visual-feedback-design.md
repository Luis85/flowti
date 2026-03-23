# Agent Visual Feedback System — Design Spec

**Date**: 2026-03-23
**Project**: Flowti Plugin (Agent World)
**Status**: Approved

## Problem

Agents in the Agent World game don't communicate what they're doing. They look the same whether idle, seeking food, working, or socializing. Actions like eating and drinking happen invisibly. The world feels static and lifeless.

## Goal

A layered visual feedback system where agents telegraph intent before acting, show activity while moving, and deliver satisfying visual payoff on completion. Urgency drives animation style. Idle agents react to their surroundings. The canvas tells the story without needing the sidebar panel.

**Target vibe**: Animated & lively — particle effects, animated emote sequences, directional facing. A living RPG town.

## Architecture

### Visual Feedback System (Presentation Layer)

A new `VisualFeedbackSystem` sits between the blackboard and the rendering layer. It reads state each frame and dispatches visuals. It is pure decision logic — it emits typed visual commands via callbacks, never imports ExcaliburJS.

A thin **render adapter** (wired in `engine-lifecycle.ts`) translates those commands into ExcaliburJS actor operations. This follows the same pattern as `EmoteSystem` which emits via `onEmote(agentName, index)` callback.

```
Blackboard (per-agent state)
    | reads each frame
VisualFeedbackSystem (pure logic — no ExcaliburJS imports)
    |-- detects intent transitions (idle->seeking, seeking->arrived, etc.)
    |-- computes urgency level from needs values
    |-- tracks per-agent visual state (what's currently showing, cooldowns)
    |-- emits visual commands via callbacks:
        |-- onShowIntentIcon(agentName, spritePath, position)
        |-- onHideIntentIcon(agentName)
        |-- onItemPop(agentName, spritePath, fromPos, toPos)
        |-- onParticleBurst(preset, position)
        |-- onEmoteFlash(agentName, emoteIndex)
        |-- onThoughtBubble(agentName, text, iconPath?, duration)
        |-- onFacingChange(agentName, direction)
        |
Render Adapter (thin wiring in engine-lifecycle.ts)
    |-- onShowIntentIcon  -> creates/updates IntentIconActor as child of agent
    |-- onHideIntentIcon  -> fades out and removes IntentIconActor
    |-- onItemPop         -> spawns ItemPopActor in scene
    |-- onParticleBurst   -> calls existing ParticlePool with sprite-based presets
    |-- onEmoteFlash      -> calls EmoteSystem.triggerEmote() (new public method)
    |-- onThoughtBubble   -> calls BubbleSystem.showBubble() with icon support (extended API)
    |-- onFacingChange    -> sets bb.facingDirection, read by AgentActor
```

**Wiring**: Created in `engine-lifecycle.ts` alongside BubbleSystem/TalkEngine/EmoteSystem. Receives the same `BlackboardManager` + `getActor` references. Ticked once per frame in the `tickVisuals` phase of `tickSimulation()`, after locomotion and room transit complete but before the existing engagement/talk systems.

---

## Feature 1: Intent Telegraph

When an agent's intent changes (e.g., idle -> seeking food), the system detects the transition and plays a telegraph sequence. The style depends on urgency.

### Urgency Calculation

```
urgency = clamp(1 - (need / threshold), 0, 1)
```

The threshold is passed as a parameter, not hardcoded. Base thresholds come from the BT conditions (`IsHungry`: 35, `IsThirsty`: 30) but the presets file defines them alongside known quirk overrides:

```typescript
// visual-feedback-presets.ts
URGENCY_THRESHOLDS: {
    hunger: { base: 35, quirks: { snacker: 50 } },
    thirst: { base: 30, quirks: { "coffee-addict": 45 } },
    energy: { base: 30 },
    social: { base: 30 },
}
```

The system resolves the effective threshold per agent by checking `agent.quirks` against the quirk overrides, falling back to `base`.

| Level | Urgency Range | Behavior |
|-------|--------------|----------|
| Low | 0.0-0.3 | Casual response |
| Medium | 0.3-0.6 | Moderate concern |
| High | 0.6-1.0 | Desperate |

### Telegraph Sequences by Urgency

| Urgency | Beat 1 (decision moment) | Beat 2 (movement) |
|---------|--------------------------|---------------------|
| Low | Thought bubble with item icon for 1.5s | Walk at normal speed |
| Medium | Emote flash (concerned face) + intent icon appears | Walk at 1.2x speed |
| High | Emote flash (distressed face) + intent icon immediately, no pause | Walk at 1.4x speed |

### IntentIconActor

A small floating sprite that hovers above the agent while they're moving toward a goal.

- **Sprites**: Ninja Adventure item sprites mapped by intent:
  - Hunger: `assets/Items/Food/Onigiri.png`
  - Thirst: `assets/Items/Potion/WaterPot.png`
  - Work: `assets/Items/Object/Book.png`
  - Merchant: `assets/Items/Treasure/GoldCoin.png`
- **Loading**: A new `loadItemSprite(path)` function in `sprite-loader.ts` handles item sprites (single-frame PNGs, not spritesheets). Loaded once at startup, cached by path.
- **Position**: Top-right of agent (+8px, -14px), gentle bob animation (sine wave, 1px amplitude, 2s period)
- **Lifecycle**: Fades in over 200ms on intent start, fades out over 200ms on arrival or intent change
- **Constraint**: Only one intent icon at a time per agent

### Urgency Speed Boost

A new `urgencySpeedBoost` field on the blackboard (default `1.0`). The system writes it based on urgency. Locomotion reads it and multiplies with the existing level-based speed from `AgentActor.walkSpeedMultiplier` (which returns progression-level speed). The composition is **multiplicative**:

```
effectiveSpeed = BASE_SPEED * SPEED_MAP[movementStyle] * actor.walkSpeedMultiplier * bb.urgencySpeedBoost
```

This avoids naming collision with the existing `walkSpeedMultiplier` getter on AgentActor.

### Directional Facing on Intent Start

When the telegraph fires, the system emits `onFacingChange(agentName, direction)` based on `target.x` vs `agent.x`. The agent faces toward their destination before movement begins, creating a "look then walk" moment during low-urgency thought bubble pauses.

**Implementation note**: This introduces directional sprite flipping for the first time. The existing no-op `setWalkDirection()` stub on AgentActor (line 152) should be removed and replaced with this blackboard-driven approach. AgentActor reads `bb.facingDirection` in `onPreUpdate` and sets `graphics.flipHorizontal`.

---

## Feature 2: Arrival Payoff & Consumption Feedback

When an agent arrives at a station and consumes, the system plays a two-beat reward sequence.

**Trigger**: `bb.arrived` flips to `true` while `bb.intentDetail` matches a seek pattern (`"seek-food"`, `"seek-drink"`, `"seek-preferred-food:*"`, `"seek-preferred-drink:*"`).

### Beat 1 — Item Pop (immediate on arrival)

The system emits `onItemPop(agentName, spritePath, stationPos, targetPos)`. The render adapter spawns an **ItemPopActor** at the station position:
- Sprite: matching item from Ninja Adventure (random pick for variety):
  - Hunger: `assets/Items/Food/Onigiri.png`, `assets/Items/Food/Fish.png`, `assets/Items/Food/Sushi.png`
  - Thirst: `assets/Items/Potion/WaterPot.png`, `assets/Items/Potion/MilkPot.png`
  - Merchant: `assets/Items/Treasure/GoldCoin.png`
- Animation: starts at station position, floats up 20px over 600ms with ease-out, fades from 1.0 to 0.0 opacity
- Self-destructs after animation completes

### Beat 2 — Satisfaction Reaction (400ms after Beat 1)

- Emote flash: happy emote sprite (indices 3 or 5) via `onEmoteFlash` for 1.5s
- Particle burst: `sparkle` preset via `onParticleBurst` — 5-8 sprites over 500ms

### Timing

```
t=0ms      Agent arrives, intent icon fades out (200ms)
t=100ms    ItemPopActor spawns, floats upward (600ms)
t=400ms    Satisfaction emote appears (1500ms) + sparkle burst (500ms)
t=700ms    Item pop complete
t=900ms    Sparkle burst complete
t=1900ms   Satisfaction emote fades — all effects done, agent resumes idle
```

**Cooldown**: 3s minimum between payoff sequences per agent.

---

## Feature 3: Idle Micro-Actions & Contextual Awareness

When agents have no active goal, the system fills the silence with personality-driven ambient behaviors and contextual reactions.

### Ambient Idle Emotes (enhanced frequency)

The system supplements the existing emote system by checking context:
- **Low energy** (< 40): sleep emote (index 7) + occasional thought bubble "zzz"
- **Low morale** (< 30): sad/frustrated emote (index 10, 12)
- **High social need** (< 30): looking-around emote, "!" when nearby agent detected
- **High focus** (> 80): determined emote (index 15, 20), thought bubble with `Book.png` icon

**Cooldown**: 8-15s between ambient emotes per agent (randomized, personality-weighted). All cooldown values defined in `visual-feedback-presets.ts`.

### Contextual Micro-Reactions

| Trigger | Visual Response | Timing |
|---------|----------------|--------|
| Another agent walks within 40px | Face toward them, "!" emote flash (300ms) | Immediate, 15s cooldown per pair |
| Near own workstation while idle | Thought bubble with domain-specific icon | 10s after arriving near station |
| Another agent eats/drinks nearby | Face toward them, brief "..." thought bubble | 500ms after the other agent's payoff |
| Idle > 60s | Sleep emote (index 7) + slow idle bob | Once, then 45s cooldown |
| Agent enters a new room | Brief pause (200ms), face left then right over 600ms | On room transition |

**Room transition detection**: The system tracks `previousRoom` per agent internally (not on the blackboard — this is system-private state). Each tick it compares `bb.currentRoom` against the stored value to detect transitions.

### Directional Facing for Idle Agents

- Idle agents face the nearest point of interest within 60px (other agent > station > room center)
- If nothing nearby, face direction of last movement
- 200ms transition delay to avoid jittery flipping
- Implemented as `facingDirection: "left" | "right"` on the blackboard
- AgentActor reads it and sets `graphics.flipHorizontal`

### Priority Layering

When multiple micro-actions could fire simultaneously:
1. Active intent feedback (Feature 1) always wins
2. Contextual reactions (proximity triggers) override ambient
3. Ambient idle emotes are lowest priority
4. System skips any visual if another is already playing for that agent

---

## Feature 4: Particle & Effect System

Extends the **existing `ParticlePool`** in `systems/particle-system.ts` with sprite-based presets. The current ParticlePool uses colored circles on canvas. We add a new `spriteBurst()` method and new presets alongside the existing `sparkle`, `hearts`, `embers`, `leaf-drift`, `dust-motes`.

### Extended ParticlePool API

```typescript
// New method on existing ParticlePool
spriteBurst(config: {
    spriteSource: string;       // path to Ninja Adventure FX sprite
    position: { x: number; y: number };
    count: number;              // 3-8
    spread: number;             // radius from center (10-25px)
    lifetime: number;           // ms per particle (300-600ms)
    velocity: { dx: number; dy: number };
    fadeOut: boolean;
    scale: { start: number; end: number };
}): void
```

### New Sprite-Based Presets

| Effect | Sprite | Count | Behavior |
|--------|--------|-------|----------|
| `sprite-sparkle` | `assets/FX/Magic/Spark/SpriteSheet.png` | 5-8 | Radial burst outward, fade out, slight upward drift |
| `sprite-smoke` | `assets/FX/Smoke/SpriteSheet.png` | 3-4 | Expand from center, fade quickly (300ms), no drift |
| `sprite-heart` | `assets/Items/Potion/Heart.png` | 2-3 | Float upward slowly, gentle left-right wobble, fade |
| `sprite-aura` | `assets/FX/Magic/Aura/SpriteSheet.png` | 1 | Pulse scale 0.8-1.2 loop, fades after duration |
| `sprite-leaf` | `assets/FX/Particle/Leaf.png` | 3-5 | Drift downward and sideways, for room entry/idle |

### When Each Effect Fires

- `sprite-sparkle`: Arrival payoff, capability unlock
- `sprite-smoke`: Agent starts walking (high urgency only), agent arrives at destination
- `sprite-heart`: After eating/drinking satisfaction emote
- `sprite-aura`: Active on agent while LLM is processing
- `sprite-leaf`: Room transition idle moment

### Performance Guardrails

The existing ParticlePool has `maxSize = 400` for its lightweight circle particles. Sprite-based particles are heavier, so they get separate caps:
- Max 30 active sprite particles globally (tracked separately from circle particles)
- Max 8 sprite particles per agent at any time
- Sprite textures loaded once at startup via `loadItemSprite()`, shared across all particles
- No sprite particle spawns if agent is off-screen (check against camera viewport)
- Pool reuse: sprite particles return to pool on lifetime expiry

---

## API Extensions to Existing Systems

### BubbleSystem — Icon Mode

Add an optional `iconPath` parameter to `showBubble()`:

```typescript
showBubble(agentName, kind, text, scene, getActor, duration?, priority?, iconPath?: string)
```

When `iconPath` is provided, BubbleActor renders a small item sprite (16x16, scaled to fit) to the left of the text inside the bubble. If text is empty and iconPath is set, the bubble shows just the icon. This enables "thought bubble with food icon" for low-urgency telegraphs.

### EmoteSystem — Public Trigger

Add a `triggerEmote(agentName: string, emoteIndex: number)` method that bypasses the internal mood-to-index mapping and timer. It respects the existing per-agent cooldown but allows the visual feedback system to fire specific emotes on demand.

---

## File Plan

### New Files (all under `src/game/`)

| File | Purpose | ~Lines |
|------|---------|--------|
| `systems/visual-feedback-system.ts` | Pure logic: detects transitions, computes urgency, dispatches visual commands via callbacks. Includes per-agent state tracking, cooldown management, priority layering. | ~350 |
| `systems/visual-feedback-presets.ts` | All constants: urgency thresholds (with quirk overrides), timing values, sprite paths, effect configs, cooldown durations. | ~100 |
| `actors/intent-icon-actor.ts` | Floating item sprite above agent during seek. Fade in/out, gentle bob. ExcaliburJS Actor. | ~80 |
| `actors/item-pop-actor.ts` | Item sprite floats up from station on consumption. Self-destructs. ExcaliburJS Actor. | ~70 |

### Modified Files

| File | Change | Impact |
|------|--------|--------|
| `systems/blackboard.ts` | Add 3 fields: `facingDirection: "left" \| "right"`, `urgencySpeedBoost: number`, `lastIntentTransition: { from, to, timestamp } \| null` | Extend interface + defaults |
| `actors/agent-actor.ts` | Read `bb.facingDirection` -> set `graphics.flipHorizontal` in `onPreUpdate` (~10 lines). Remove no-op `setWalkDirection()` stub. | Small patch |
| `systems/locomotion-system.ts` | Read `bb.urgencySpeedBoost`, multiply into step distance calculation (~3 lines). | Tiny patch |
| `systems/particle-system.ts` | Add `spriteBurst()` method + sprite-based presets + separate sprite particle cap tracking (~60 lines). | Moderate extension |
| `systems/bubble-system.ts` | Add optional `iconPath` parameter to `showBubble()`. Extend BubbleActor to render icon when provided (~20 lines). | Small extension |
| `systems/emote-system.ts` | Add `triggerEmote(agentName, emoteIndex)` public method (~10 lines). | Small extension |
| `sprites/sprite-loader.ts` | Add `loadItemSprite(path)` for single-frame item PNGs (~15 lines). | Small extension |
| `engine-simulation.ts` | Call `visualFeedbackSystem.tick()` in the `tickVisuals` phase, before engagement/talk (~5 lines). | Tiny patch |
| `engine-lifecycle.ts` | Instantiate VisualFeedbackSystem, wire render adapter callbacks, load item/FX sprites at startup (~30 lines). | Moderate patch |

### Test Files (all under `tests/game/`)

| File | Coverage |
|------|----------|
| `systems/visual-feedback-system.test.ts` | Transition detection, urgency calculation (with quirk overrides), sequence dispatching, cooldowns, priority layering, room transition tracking |
| `actors/intent-icon-actor.test.ts` | Fade in/out lifecycle, bob animation, position offset |
| `actors/item-pop-actor.test.ts` | Float animation, self-destruct, random sprite selection |
| `systems/visual-feedback-integration.test.ts` | End-to-end: blackboard state change -> system tick -> correct callback sequence emitted -> blackboard updated with facing/speed |

---

## Blackboard Additions

```typescript
// New fields on AgentBlackboard:
facingDirection: "left" | "right";       // Written by system, read by AgentActor
urgencySpeedBoost: number;               // Written by system, read by locomotion
lastIntentTransition: {                  // Written by system, read internally
    from: string;
    to: string;
    timestamp: number;
} | null;
```

Defaults: `facingDirection: "right"`, `urgencySpeedBoost: 1.0`, `lastIntentTransition: null`.

---

## Pipeline Insertion Point

In `tickSimulation()` the tick order is:

```
tickBT -> tickLocomotion -> tickRoomTransit -> tickInteractions ->
tickSocial -> tickDirector -> tickReactiveTriggers -> tickVisuals
```

The `VisualFeedbackSystem.tick()` runs inside `tickVisuals`, as the first call before the existing engagement system and talk engine. This ensures it has access to the latest locomotion results (arrived, position) and room transit data, while its emote/bubble dispatches don't conflict with the engagement and talk systems that run after it.

Note: The existing `DirectorSystem` (in `tickDirector`) tracks user presence/cursor idle time — it is unrelated to the "director pattern" used here. No naming collision in code; the term "director" in this spec refers only to the architectural pattern, not the existing `DirectorSystem`.
