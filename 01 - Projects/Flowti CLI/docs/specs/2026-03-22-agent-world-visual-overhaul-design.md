# Agent World Visual Overhaul — Design Spec

## Overview

Redesign the Agent World's 4 rooms, interactable objects, workstations, and particle effects using the Ninja Adventure asset pack's tilesets, animated elements, item sprites, and FX spritesheets. No game logic changes — purely visual layer upgrades.

## Guiding Principle

Replace all Canvas2D programmatic drawing with composited sprite rendering from the existing Ninja Adventure asset pack (`01 - Projects/Flowti Plugin/assets/`). The world shifts from a tech-office aesthetic to a cohesive fantasy theme that matches the character sprites already in use.

---

## 1. Room Reimagining

Four rooms redesigned with fantasy identities, built from the pack's interior tilesets (`TilesetInterior.png`, `TilesetInteriorFloor.png`, `TilesetWallSimple.png`, `Elements.png`).

| Current | New Identity | Visual Theme |
|---------|-------------|-------------|
| Hub | **Tavern** | Warm wood floors, stone walls, central fountain, barrel seating, lanterns |
| Office | **Dojo** | Tatami-style floors, paper walls, weapon racks, training scrolls, banners |
| Village | **Market Square** | Cobblestone ground, market stalls, crates, barrels, hanging fabrics |
| Station | **Workshop/Forge** | Stone floors, forge elements, anvils, tool racks, glowing embers |

### Implementation

Replace the Canvas2D background painter functions (`drawHubFloor`, `drawOfficeBackground`, etc.) in `scene-backgrounds.ts` with tileset-composited renderers. Each room's background is built by:

1. Tiling floor sprites from `TilesetInteriorFloor.png` to fill the canvas (800x500)
2. Compositing wall sprites from `TilesetWallSimple.png` along top and side edges
3. Adding static decoration elements from `Elements.png` and `TilesetInterior.png` (shelves, windows, doors, furniture)
4. Rendering the result to a cached canvas for per-frame blitting (no per-frame tile rendering)

The tileset PNGs use 16x16 tiles. At the engine's 4x pixel-art scale, each tile renders at 64x64. The 800x500 canvas requires a ~13x8 tile grid with some partial tiles at edges.

### Color Themes (Updated)

| Room | Floor Palette | Wall Palette | Accent |
|------|-------------|-------------|--------|
| Tavern | Warm wood (#3a2a1a, #2e2015) | Gray stone (#3a3a4a, #2e2e3a) | Lantern gold (#d4a017) |
| Dojo | Tatami tan (#5a4a2a, #4e3e20) | Paper white (#8a7a6a, #6e6050) | Red banner (#c0392b) |
| Market Square | Cobblestone gray (#4a4a4a, #3e3e3e) | Timber brown (#3a2a1a, #2e2015) | Fabric purple (#7b2d8b) |
| Workshop | Dark stone (#2a2a2a, #1e1e1e) | Brick red (#4a2a2a, #3e2020) | Forge orange (#e67e22) |

---

## 2. Animated Background Elements

Each room gets 2-4 looping sprite animations from `assets/Backgrounds/Animated/` and `assets/FX/`, rendered as scene-layer sprites behind actors but in front of floor tiles.

### Tavern (Hub)
- **Water fountain** — `Water Ripples` spritesheet, centered as room focal point
- **Fireplace** — `Fire` FX spritesheet, back wall, warm ambient glow
- **Banner flag** — `Flag` spritesheet, hanging from ceiling/wall

### Dojo (Office)
- **Swaying bamboo/plants** — `Plant` spritesheet, corners and edges
- **Training banner** — `Flag` spritesheet, back wall
- **Candle flicker** — `Fire` FX spritesheet (small scale), on tables/shelves

### Market Square (Village)
- **Flower boxes** — `Flower` spritesheet, along stall edges
- **Market flags** — `Flag` spritesheet, hanging above stalls
- **Watermill** — `WaterMill` or `MillPropeller` spritesheet, background feature

### Workshop/Forge (Station)
- **Forge flames** — `Fire` FX spritesheet, at forge station, prominent
- **Conveyor belt** — `Conveyor Belt` spritesheet, moving materials
- **Water channel** — `Water Ripples` or `Waterfall` spritesheet, quenching trough

### Implementation

Animated elements are ExcaliburJS `Animation` instances from spritesheets, positioned at fixed coordinates within each scene. They render on a dedicated z-layer between the background canvas and the actor layer. Created during scene initialization alongside the background, not per-frame.

Each animated element needs:
- Source spritesheet path
- Frame dimensions and count
- Position (x, y) within the scene
- Scale factor (match 4x pixel-art zoom)
- Loop behavior (infinite loop, matching original frame timing)

---

## 3. Interactable Object Sprites

Replace all Canvas2D drawn interactables in `interactable-actor.ts` with asset pack sprites.

| Current Object | Fantasy Replacement | Asset Source |
|---------------|-------------------|-------------|
| Coffee Machine | Potion Brewing Station | `Items/Potion/` + cauldron from `Elements.png` |
| Water Cooler | Water Barrel/Well | `Items/Resource/` + barrel from `Elements.png` |
| Snack Table | Food Cart/Platter | `Items/Food/` sprites composited |
| Couch | Cushion/Mat Seating | `TilesetInterior.png` furniture tiles |
| Whiteboard | Scroll Board/Map Wall | `Items/Resource/` scroll + wall element |
| Plant | Bonsai/Potted Bamboo | `Backgrounds/Animated/Plant` (animated) |
| Notice Board | Quest Board | `TilesetInterior.png` board element + pinned items |
| Merchant Stall | Market Booth | `TilesetInterior.png` stall + `Items/Treasure/` display |
| Food Bowls (Hub, Village) | Wooden Bowl with fish/meat | `Items/Food/` small sprites |
| Water Bowls (Office, Station) | Stone Water Dish | `Elements.png` stone dish element |

### Implementation

`interactable-actor.ts` currently draws objects using Canvas2D (`fillRect`, `strokeRect`, gradients). Replace the `draw()` method with sprite rendering:

1. Each interactable type maps to a sprite (or composited sprite group)
2. Sprites loaded via the existing sprite loader infrastructure
3. Occupation state overlay (glow) renders on top of the sprite, not replacing it
4. Interaction point positions may need minor adjustment to match sprite visual centers

The interactable sprite mapping can be defined in a config object (type → sprite path + dimensions), keeping the rendering logic generic.

---

## 4. Workstation Sprites

Replace Canvas2D workstation rendering in `workstation-actor.ts` with themed sprites per room.

| Room | Current Style | Fantasy Replacement | Visual |
|------|-------------|-------------------|--------|
| Tavern | — | — | No workstations (gathering space) |
| Dojo | Desk | Scroll Table | Low table with scrolls, brushes, ink from `TilesetInterior.png` |
| Market Square | Workbench | Craft Stall | Market booth with tools/wares from `Elements.png` |
| Workshop | Console | Forge Station | Anvil + tool rack from `Elements.png` + ember glow |

### Implementation

`workstation-actor.ts` currently renders via Canvas2D with a base color, occupation glow, and tool display. Replace with:

1. Room-specific sprite selection (workstation knows its parent scene ID)
2. Sprite rendering instead of `fillRect` drawing
3. Occupation glow effect preserved — renders as a semi-transparent colored overlay on top of the sprite (existing sine-wave pulse logic stays)
4. Tool display icons can overlay on the workstation sprite corner

The workstation sprite mapping is driven by `scene-configs.ts` workstation style field (already exists: `"desk"`, `"workbench"`, `"console"` — update to `"scroll-table"`, `"craft-stall"`, `"forge-station"`).

---

## 5. Particle Effects Enhancement

Upgrade particle presets in `particle-system.ts` to use FX spritesheets and add room-ambient particles.

### Upgraded Presets

| Preset | Current | Enhancement |
|--------|---------|-------------|
| `steam` | Colored circles | Potion bubble sprites from FX |
| `confetti` | Multi-colored squares | Add sparkle FX sprites alongside |
| `sparkle` | Yellow dots | FX/Thunder or FX/Plant glow sprites |
| `thunder` | Blue flashes | FX/Thunder spritesheet frames |
| `rain` | Blue streaks | FX/Water spritesheet |
| `sunny` | Yellow dots | FX/Plant warm glow |
| `hearts` | Red hearts | Keep as-is (iconic, works well) |

### New Ambient Presets

| Preset | Room | Visual |
|--------|------|--------|
| `embers` | Workshop | Warm orange-red floating particles near forge |
| `dust-motes` | Dojo | Slow golden particles drifting in light beams |
| `leaf-drift` | Market Square | Green/brown leaf shapes drifting slowly |
| `fireplace-sparks` | Tavern | Small upward-drifting orange sparks near fireplace |

### Implementation

Ambient particles spawn at low density (1-2 per second) at fixed positions tied to room features (forge, windows, flower boxes). They are spawned during `tickVisuals` based on the current scene, using the existing particle pool. No new systems — just new preset definitions and spawn triggers in the visual tick.

---

## 6. Files Changed

| File | Change Type | What Changes |
|------|------------|-------------|
| `src/game/actors/scene-backgrounds.ts` | Rewrite | 4 room painters → tileset-composited renderers |
| `src/game/data/scene-configs.ts` | Modify | Room names, theme colors, workstation styles |
| `src/game/actors/workstation-actor.ts` | Rewrite | Canvas2D drawing → sprite rendering per room theme |
| `src/game/actors/interactable-actor.ts` | Rewrite | Canvas2D drawing → asset pack sprite rendering |
| `src/game/systems/particle-system.ts` | Modify | Upgrade presets, add 4 ambient presets |
| `src/game/engine-simulation.ts` | Modify | Add ambient particle spawning in `tickVisuals` per scene |
| `src/game/engine-rendering.ts` | Modify | Integrate animated background elements into scene layers |
| `src/game/scenes/game-scene.ts` | Modify | Add animated element actors to scene initialization |
| `src/game/sprites/sprite-loader.ts` | Modify | Add loading for tileset, item, and FX sprites |

## 7. Files NOT Changed

| File | Why |
|------|-----|
| `src/game/actors/agent-actor.ts` | No actor rendering changes |
| `src/game/actors/pet-actor.ts` | No pet rendering changes |
| `src/game/actors/bubble-actor.ts` | Bubbles stay as-is |
| `src/game/systems/emote-system.ts` | Emotes stay as-is |
| All domain/interaction/BT/needs/social code | No game logic changes |
| `src/game/engine-simulation.ts` (non-visual) | Tick phases untouched except ambient particle spawning |

## 8. No New Assets Required

Everything comes from the existing Ninja Adventure pack in `01 - Projects/Flowti Plugin/assets/`:
- `Backgrounds/Tilesets/Interior/` — floor, wall, element tiles
- `Backgrounds/Animated/` — water, fire, flags, flowers, conveyor, watermill, plants
- `FX/` — explosion, fire, ice, thunder, water, plant, rock spritesheets
- `Items/` — food, potions, weapons, treasures, resources
- `Ui/Emote/` — already in use
- `Actor/` — already in use

## 9. Testing Strategy

No behavioral tests needed — this is purely visual. Verification is manual:
- Each room renders correctly with tileset background
- Animated elements loop smoothly
- Interactable objects display correct sprites and respond to occupation state
- Workstations display room-appropriate sprites with glow
- Ambient particles spawn at correct positions per room
- No visual glitches at room transitions
- Performance: cached background canvas prevents per-frame tile rendering overhead
