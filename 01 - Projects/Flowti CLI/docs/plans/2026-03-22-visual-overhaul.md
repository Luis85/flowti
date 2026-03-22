# Agent World Visual Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Agent World from tech-office to fantasy theme using the Ninja Adventure asset pack's tilesets, animated elements, item sprites, and FX — replacing all Canvas2D programmatic drawing with composited sprite rendering.

**Architecture:** Four independent visual layers upgraded sequentially: (1) tileset sprite loader, (2) room backgrounds, (3) interactable objects + workstations, (4) particle effects + animated elements. Each layer produces a visually complete intermediate state. No game logic changes.

**Tech Stack:** TypeScript, ExcaliburJS (Sprites, Animations, Canvas graphics), Ninja Adventure asset pack

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-22-agent-world-visual-overhaul-design.md`

---

## File Map

| File | Change | Responsibility |
|------|--------|----------------|
| `src/game/sprites/tileset-loader.ts` | Create | Load tileset PNGs, extract tile regions, provide tile lookup API |
| `src/game/actors/scene-backgrounds.ts` | Rewrite | 4 room painters → tileset-composited backgrounds |
| `src/game/data/scene-configs.ts` | Modify | Update room names, theme colors, workstation styles |
| `src/game/actors/workstation-actor.ts` | Modify | Canvas2D → sprite rendering per room theme |
| `src/game/actors/coffee-machine.ts` | Modify | Canvas2D → potion brewing station sprite |
| `src/game/actors/water-cooler.ts` | Modify | Canvas2D → water barrel sprite |
| `src/game/actors/snack-table.ts` | Modify | Canvas2D → food cart sprite |
| `src/game/actors/couch-actor.ts` | Modify | Canvas2D → cushion/mat sprite |
| `src/game/actors/whiteboard-actor.ts` | Modify | Canvas2D → scroll board sprite |
| `src/game/actors/plant-actor.ts` | Modify | Canvas2D → potted bamboo sprite |
| `src/game/actors/notice-board.ts` | Modify | Canvas2D → quest board sprite |
| `src/game/actors/merchant-stall.ts` | Modify | Canvas2D → market booth sprite |
| `src/game/actors/food-bowl.ts` | Modify | Canvas2D → wooden bowl sprite |
| `src/game/actors/water-bowl.ts` | Modify | Canvas2D → stone dish sprite |
| `src/game/systems/particle-system.ts` | Modify | Add 4 ambient presets |
| `src/game/engine-simulation.ts` | Modify | Spawn ambient particles per scene in tickVisuals |
| `src/game/scenes/game-scene.ts` | Modify | Add animated element actors to scenes |

All paths relative to `01 - Projects/Flowti Plugin/`.

---

## Chunk 1: Tileset Loader + Room Backgrounds

### Task 1: Create Tileset Loader

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/sprites/tileset-loader.ts`

The tileset loader extracts individual tile regions from the Ninja Adventure tileset PNGs and provides a lookup API for scene background rendering.

- [ ] **Step 1: Read the existing sprite loader pattern**

Read `01 - Projects/Flowti Plugin/src/game/sprites/sprite-loader.ts` to understand how ExcaliburJS sprites are loaded (ImageSource → SpriteSheet → Animation). Follow the same async loading pattern.

- [ ] **Step 2: Inventory the tileset PNGs**

Read the tileset PNG files to understand their grid layout. The Ninja Adventure tilesets use 16x16 tiles:
- `assets/Backgrounds/Tilesets/Interior/TilesetInteriorFloor.png` — floor tiles
- `assets/Backgrounds/Tilesets/Interior/TilesetWallSimple.png` — wall tiles
- `assets/Backgrounds/Tilesets/Interior/TilesetInterior.png` — furniture, decorations
- `assets/Backgrounds/Tilesets/Interior/Elements.png` — props, objects, details

Open each PNG (use the Read tool) to see its dimensions. Divide width and height by 16 to get the tile grid dimensions.

- [ ] **Step 3: Implement tileset-loader.ts**

Create a module that:
1. Loads each tileset PNG as an ExcaliburJS `ImageSource`
2. Creates a `SpriteSheet` from each (16x16 grid)
3. Exports a function `getTile(sheet: string, col: number, row: number): ex.Sprite` that returns a specific tile
4. Exports an `async loadTilesets(basePath: string): Promise<TilesetAtlas>` function
5. The `TilesetAtlas` holds all loaded spritesheets and provides the tile lookup

```typescript
import * as ex from "excalibur";

export interface TilesetAtlas {
	getTile(sheet: "floor" | "wall" | "interior" | "elements", col: number, row: number): ex.Sprite;
	getItemSprite(category: string, filename: string): ex.Sprite;
}

export async function loadTilesets(basePath: string): Promise<TilesetAtlas> {
	const sheets = {
		floor: `${basePath}/Backgrounds/Tilesets/Interior/TilesetInteriorFloor.png`,
		wall: `${basePath}/Backgrounds/Tilesets/Interior/TilesetWallSimple.png`,
		interior: `${basePath}/Backgrounds/Tilesets/Interior/TilesetInterior.png`,
		elements: `${basePath}/Backgrounds/Tilesets/Interior/Elements.png`,
	};
	// Load each as ImageSource → SpriteSheet (16x16 grid)
	// Return atlas with getTile and getItemSprite
}
```

- [ ] **Step 4: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "tileset-loader"`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/sprites/tileset-loader.ts"
git commit -m "feat(plugin): tileset loader for Ninja Adventure interior tilesets"
```

---

### Task 2: Redesign Tavern (Hub) Background

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/actors/scene-backgrounds.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/data/scene-configs.ts`

- [ ] **Step 1: Read current drawHubFloor**

Read `scene-backgrounds.ts` lines 389-422. This is the simplest background (34 lines) — dark floor with subtle grid and center glow.

- [ ] **Step 2: Read the tileset PNGs**

Open and examine (using the Read tool on the image files):
- `assets/Backgrounds/Tilesets/Interior/TilesetInteriorFloor.png` — find warm wood floor tiles
- `assets/Backgrounds/Tilesets/Interior/TilesetWallSimple.png` — find stone wall tiles
- `assets/Backgrounds/Tilesets/Interior/Elements.png` — find barrel, lantern, shelf, fireplace elements

Identify specific tile grid coordinates (col, row) for:
- Wood plank floor tiles (2-3 variants for visual variation)
- Stone wall tiles (back wall + side walls)
- Barrel sprites (seating area)
- Lantern/torch sprites (ambient light sources)
- Table/counter sprites (tavern central feature)

- [ ] **Step 3: Rewrite drawHubFloor as drawTavernFloor**

Replace the `drawHubFloor` function with `drawTavernFloor`:

1. **Floor layer**: Tile warm wood planks across the full 800x500 canvas using 2-3 alternating tile variants from the floor tileset. Each tile draws at 16x16 source → renders at actual size (the Canvas2D background is drawn at engine resolution, ExcaliburJS handles display scaling).
2. **Wall layer**: Place stone wall tiles along the top 3-4 rows and left/right edges (2-3 tiles deep).
3. **Decoration layer**: Composite barrel sprites, lanterns, shelves, and a central feature (fountain area placeholder — will be replaced by animated element in Task 6).
4. **Lighting accents**: Warm radial gradients near lantern positions (amber/gold tones).

The background renders to a cached canvas once during scene initialization — not per-frame.

- [ ] **Step 4: Update scene-configs.ts**

Change the hub config:
- `label`: "Hub" → "Tavern"
- `drawBackground`: reference `drawTavernFloor`
- `floorColor`: update to warm wood tone (#1a1208)
- Remove workstation references (hub has 0 workstations — stays as-is)

- [ ] **Step 5: Type check and visual test**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -E "scene-backgrounds|scene-configs"`
Expected: No errors

Build and visually verify: `cd "01 - Projects/Flowti Plugin" && npm run build:dev`
Open the game, navigate to Hub, confirm tavern floor/walls render correctly.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/actors/scene-backgrounds.ts" \
       "01 - Projects/Flowti Plugin/src/game/data/scene-configs.ts"
git commit -m "feat(plugin): redesign Hub as Tavern — tileset wood floors, stone walls, decorations"
```

---

### Task 3: Redesign Dojo (Office) Background

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/actors/scene-backgrounds.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/data/scene-configs.ts`

- [ ] **Step 1: Read current drawOfficeFloor**

Read `scene-backgrounds.ts` lines 53-145. Complex background with stone walls, windows, bookshelf, floor rug, wall clock, cable conduit, and monitor glow.

- [ ] **Step 2: Identify Dojo tile coordinates**

From the tilesets, identify:
- Tatami/mat floor tiles (lighter wood or fabric tiles)
- Paper/light wall tiles
- Weapon rack elements (from Elements.png or TilesetInterior.png)
- Scroll/banner decorations
- Low table/shelf furniture

- [ ] **Step 3: Rewrite drawOfficeFloor as drawDojoFloor**

Replace with a dojo theme:
1. **Floor**: Tatami-style tiles — lighter, warmer wood with visible grid lines
2. **Walls**: Paper/screen walls — lighter tones (#8a7a6a) with wooden frame accents
3. **Decorations**: Weapon rack on back wall, hanging scroll banners (red accents), shelving with books/scrolls
4. **Window treatment**: Keep 2 window openings but style as paper screen panels with soft light glow

- [ ] **Step 4: Update scene-configs.ts**

Change office config:
- `label`: "Office" → "Dojo"
- `drawBackground`: reference `drawDojoFloor`
- `floorColor`: update to tatami tan (#1a1508)
- `workstationStyle`: "desk" → "scroll-table"
- `workstationColor`: update to match dojo palette

- [ ] **Step 5: Type check and visual verify**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -E "scene-backgrounds|scene-configs"`

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/actors/scene-backgrounds.ts" \
       "01 - Projects/Flowti Plugin/src/game/data/scene-configs.ts"
git commit -m "feat(plugin): redesign Office as Dojo — tatami floors, paper walls, weapon racks"
```

---

### Task 4: Redesign Market Square (Village) + Workshop (Station)

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/actors/scene-backgrounds.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/data/scene-configs.ts`

- [ ] **Step 1: Read current drawVillageFloor and drawStationFloor**

Read lines 149-262 (village) and 266-385 (station).

- [ ] **Step 2: Rewrite drawVillageFloor as drawMarketSquareFloor**

1. **Floor**: Cobblestone tiles — gray stone with visible seam pattern
2. **Walls**: Timber frame walls — dark wood posts with lighter infill
3. **Market features**: Stall awnings, crate stacks, barrel clusters, hanging fabric/banners
4. **Nature**: Flower boxes along edges, planter elements from tileset

- [ ] **Step 3: Rewrite drawStationFloor as drawWorkshopFloor**

1. **Floor**: Dark stone/brick tiles
2. **Walls**: Heavy stone walls with brick accents (red-brown tones)
3. **Forge features**: Anvil area, tool rack outline, forge outline (flames added as animated element in Task 6)
4. **Industrial**: Conveyor belt area outline, water trough, ember glow spots

- [ ] **Step 4: Update scene-configs.ts**

Village config:
- `label`: "Village" → "Market Square"
- `drawBackground`: reference `drawMarketSquareFloor`
- `workstationStyle`: "workbench" → "craft-stall"

Station config:
- `label`: "Station" → "Workshop"
- `drawBackground`: reference `drawWorkshopFloor`
- `workstationStyle`: "console" → "forge-station"

- [ ] **Step 5: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -E "scene-backgrounds|scene-configs"`

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/actors/scene-backgrounds.ts" \
       "01 - Projects/Flowti Plugin/src/game/data/scene-configs.ts"
git commit -m "feat(plugin): redesign Village as Market Square and Station as Workshop"
```

---

## Chunk 2: Interactable Objects + Workstations

### Task 5: Redesign Workstation Styles

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/actors/workstation-actor.ts`

- [ ] **Step 1: Read current workstation rendering**

Read `workstation-actor.ts` fully. Understand the 3 style helpers (`drawDesk`, `drawWorkbench`, `drawConsole`) and the occupation glow overlay.

- [ ] **Step 2: Examine tileset elements for workstation visuals**

Open `assets/Backgrounds/Tilesets/Interior/TilesetInterior.png` and `Elements.png`. Identify tiles for:
- Scroll table (low table with scrolls/papers — for Dojo)
- Market craft stall (booth with wares — for Market Square)
- Forge station (anvil + tools — for Workshop)

- [ ] **Step 3: Replace Canvas2D style helpers with sprite compositing**

Replace `drawDesk()`, `drawWorkbench()`, `drawConsole()` with:
- `drawScrollTable()` — composites 2-3 tiles into a scroll table visual (Dojo theme)
- `drawCraftStall()` — composites tiles into a market stall (Market Square theme)
- `drawForgeStation()` — composites tiles into a forge station (Workshop theme)

Each helper draws onto the existing Canvas2D context using `ctx.drawImage()` with the loaded tileset sprite as source. The occupation glow overlay stays — it renders on top of whatever the base sprite is.

Update the style dispatch in `buildGraphic()` to handle the new style names: `"scroll-table"`, `"craft-stall"`, `"forge-station"`.

- [ ] **Step 4: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "workstation"`

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/actors/workstation-actor.ts"
git commit -m "feat(plugin): redesign workstations — scroll tables, craft stalls, forge stations"
```

---

### Task 6: Redesign Interactable Objects (10 files)

**Files:**
- Modify: All 10 interactable actor files in `src/game/actors/`

- [ ] **Step 1: Read each interactable actor**

Read the Canvas2D drawing in each file's constructor to understand what needs replacing:
- `coffee-machine.ts` — machine body, power light, cup area, steam indicator
- `water-cooler.ts` — cylindrical body, tap, drip tray
- `snack-table.ts` — table surface, food items, legs
- `couch-actor.ts` — cushions, armrests, legs
- `whiteboard-actor.ts` — board surface, frame, markers
- `plant-actor.ts` — pot, stem, leaves
- `notice-board.ts` — board, frame, pinned items
- `merchant-stall.ts` — counter, canopy, wares
- `food-bowl.ts` — bowl shape, food
- `water-bowl.ts` — bowl shape, water

- [ ] **Step 2: Open relevant asset pack sprites**

Examine these asset pack files to find matching sprites:
- `assets/Items/Food/` — food item sprites for snack table, food bowls
- `assets/Items/Potion/` — potion bottles for coffee machine replacement
- `assets/Items/Resource/` — barrels, crates for water cooler
- `assets/Items/Tool/` — tools for workbench items
- `assets/Items/Scroll/` — scrolls for whiteboard/notice board
- `assets/Items/Object/` — miscellaneous objects
- `assets/Backgrounds/Tilesets/Interior/Elements.png` — furniture elements

- [ ] **Step 3: Replace Canvas2D drawing in each actor**

For each interactable actor, replace the `new ex.Canvas({ draw: (ctx) => { ... } })` block with composited sprites from the asset pack. Each replacement:

1. Loads the relevant item sprite via `ex.ImageSource`
2. Creates an `ex.Sprite` from the loaded image
3. Uses `this.graphics.use(sprite)` in the constructor
4. Adjusts `width`, `height`, and `interactionOffset` if the new sprite has different dimensions

The sprite images are 16x16 source sprites. At the engine's pixel-art scale they render at 64x64. Adjust actor dimensions accordingly.

Fantasy mappings:
| Actor | Fantasy Object | Sprite Source |
|-------|---------------|---------------|
| CoffeeMachine | Potion Brewing Station | Items/Potion/ + Elements.png cauldron tiles |
| WaterCooler | Water Barrel | Items/Resource/ barrel + Elements.png |
| SnackTable | Food Cart | Items/Food/ composited on table tiles |
| Couch | Cushion Mat | TilesetInterior.png mat/rug tiles |
| Whiteboard | Scroll Board | Items/Scroll/ + wall frame tiles |
| Plant | Potted Bamboo | Backgrounds/Animated/Plant/ (first frame as static) |
| NoticeBoard | Quest Board | TilesetInterior.png board + Items/Scroll/ pinned |
| MerchantStall | Market Booth | TilesetInterior.png stall + Items/Treasure/ |
| FoodBowl | Wooden Food Bowl | Items/Food/ small food sprite |
| WaterBowl | Stone Water Dish | Elements.png stone dish tiles |

- [ ] **Step 4: Type check all actors**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -E "coffee|water-cooler|snack|couch|whiteboard|plant-actor|notice|merchant|food-bowl|water-bowl"`

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/actors/"
git commit -m "feat(plugin): redesign all interactable objects with Ninja Adventure asset pack sprites"
```

---

## Chunk 3: Animated Elements + Particle Effects

### Task 7: Add Animated Background Elements to Scenes

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/scenes/game-scene.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/sprites/animated-elements.ts`

- [ ] **Step 1: Read animated element spritesheets**

Open and examine the animated element spritesheets in `assets/Backgrounds/Animated/`:
- `Flag/` — flag animation frames
- `Flower/` — flower animation frames
- `Plant/` — plant sway frames
- `Water Ripples/` — water ripple frames
- `Waterfall/` — waterfall frames
- `WaterMill/` or `MillPropeller/` — mill rotation frames

Determine frame count, frame size (likely 16x16), and animation speed.

- [ ] **Step 2: Create animated-elements.ts**

Create a module that:
1. Defines animated element configurations per room
2. Loads spritesheet frames as ExcaliburJS Animations
3. Returns positioned animation actors for each room

```typescript
export interface AnimatedElement {
	readonly name: string;
	readonly spriteDir: string;
	readonly x: number;
	readonly y: number;
	readonly scale: number;
	readonly zIndex: number;
}

export const ROOM_ANIMATED_ELEMENTS: Record<string, AnimatedElement[]> = {
	hub: [
		{ name: "fountain", spriteDir: "Water Ripples", x: 400, y: 250, scale: 4, zIndex: 5 },
		{ name: "fireplace", spriteDir: "Fire", x: 100, y: 60, scale: 4, zIndex: 5 },
		{ name: "banner", spriteDir: "Flag", x: 600, y: 40, scale: 4, zIndex: 5 },
	],
	office: [
		{ name: "bamboo", spriteDir: "Plant", x: 50, y: 100, scale: 4, zIndex: 5 },
		{ name: "dojo-banner", spriteDir: "Flag", x: 400, y: 30, scale: 4, zIndex: 5 },
	],
	village: [
		{ name: "flowers", spriteDir: "Flower", x: 200, y: 380, scale: 4, zIndex: 5 },
		{ name: "market-flag", spriteDir: "Flag", x: 500, y: 30, scale: 4, zIndex: 5 },
		{ name: "mill", spriteDir: "MillPropeller", x: 720, y: 60, scale: 4, zIndex: 3 },
	],
	station: [
		{ name: "forge-fire", spriteDir: "Fire", x: 600, y: 200, scale: 4, zIndex: 5 },
		{ name: "water-channel", spriteDir: "Water Ripples", x: 700, y: 350, scale: 4, zIndex: 5 },
	],
};
```

- [ ] **Step 3: Integrate into game-scene.ts**

In `game-scene.ts`, during scene initialization (after background setup, before actor addition):
1. Import `ROOM_ANIMATED_ELEMENTS` and the animation loading function
2. For each element in the current room's config, create an ExcaliburJS Actor with the loaded animation
3. Add to scene at the configured position and z-index

- [ ] **Step 4: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -E "animated-elements|game-scene"`

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/sprites/animated-elements.ts" \
       "01 - Projects/Flowti Plugin/src/game/scenes/game-scene.ts"
git commit -m "feat(plugin): add animated background elements — fountains, flags, plants, forge fire"
```

---

### Task 8: Add Ambient Particle Presets + Spawning

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/systems/particle-system.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-simulation.ts`

- [ ] **Step 1: Read current particle presets**

Read `particle-system.ts` to see the `PRESET_CONFIGS` shape and existing presets.

- [ ] **Step 2: Add 4 ambient particle presets**

Add to `PRESET_CONFIGS`:

```typescript
embers: { count: 2, colorRange: ["rgba(255,140,50,0.4)", "rgba(255,100,30,0.3)"], lifetime: 3000, speed: 8, radius: 1, spread: 0.8 },
"dust-motes": { count: 1, colorRange: ["rgba(255,220,150,0.2)"], lifetime: 4000, speed: 3, radius: 0.5, spread: Math.PI * 2 },
"leaf-drift": { count: 1, colorRange: ["rgba(100,160,60,0.3)", "rgba(140,120,60,0.3)"], lifetime: 5000, speed: 5, radius: 1.5, spread: 0.5 },
"fireplace-sparks": { count: 1, colorRange: ["rgba(255,180,50,0.5)", "rgba(255,120,30,0.4)"], lifetime: 1500, speed: 15, radius: 0.5, spread: 0.4 },
```

Update the `ParticlePreset` type union to include these new names.

- [ ] **Step 3: Add ambient particle spawning in tickVisuals**

In `engine-simulation.ts`, inside the `tickVisuals` function, add ambient particle spawning based on the current scene. Add after the weather particle spawning block:

```typescript
// Ambient room particles
const currentSceneName = ctx.engine.currentScene?.constructor?.name ?? "";
const AMBIENT_CHANCE = 0.005; // ~0.5% per frame
if (Math.random() < AMBIENT_CHANCE) {
	if (currentSceneName.includes("hub") || currentSceneName.includes("tavern")) {
		sys.particlePool.spawnPreset("fireplace-sparks", 100, 60);
	} else if (currentSceneName.includes("office") || currentSceneName.includes("dojo")) {
		sys.particlePool.spawnPreset("dust-motes", 200 + Math.random() * 400, 100 + Math.random() * 200);
	} else if (currentSceneName.includes("village") || currentSceneName.includes("market")) {
		sys.particlePool.spawnPreset("leaf-drift", Math.random() * 800, 50 + Math.random() * 300);
	} else if (currentSceneName.includes("station") || currentSceneName.includes("workshop")) {
		sys.particlePool.spawnPreset("embers", 600, 200);
	}
}
```

Note: The exact scene identification method needs verification — read how `ctx.engine.currentScene` maps to rooms. It may use the scene config `id` field or scene key. Adjust the condition accordingly.

- [ ] **Step 4: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -E "particle-system|engine-simulation"`

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/particle-system.ts" \
       "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts"
git commit -m "feat(plugin): ambient particle presets — embers, dust motes, leaf drift, fireplace sparks"
```

---

### Task 9: Final Type Check + Visual Verification

- [ ] **Step 1: Full type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -c "error"`
Compare with pre-overhaul error count. No new errors.

- [ ] **Step 2: Run Plugin tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ 2>&1 | tail -10`
Expected: All passing — visual changes should not break any test.

- [ ] **Step 3: Build and visual verify**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build:dev`

Manual verification checklist:
- [ ] Tavern (Hub): Wood floors, stone walls, lanterns, decorations visible
- [ ] Dojo (Office): Tatami floors, paper walls, weapon racks, scroll tables
- [ ] Market Square (Village): Cobblestone, market stalls, flowers, craft stalls
- [ ] Workshop (Station): Dark stone, forge elements, forge stations
- [ ] Animated elements loop smoothly in each room
- [ ] Interactable objects display correct fantasy sprites
- [ ] Workstation occupation glow still works
- [ ] Ambient particles spawn at correct positions per room
- [ ] Room transitions don't glitch
- [ ] Performance is acceptable (cached backgrounds, not per-frame tile rendering)

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(plugin): visual overhaul final adjustments"
```

---

## Dependency Graph

```
Task 1 (tileset loader) → Task 2 (Tavern) → Task 3 (Dojo) → Task 4 (Market + Workshop)
                                                                    ↓
                           Task 5 (workstations) → Task 6 (interactables)
                                                                    ↓
                           Task 7 (animated elements) → Task 8 (ambient particles) → Task 9 (verify)
```

Tasks 2, 3, 4 are sequential (all modify scene-backgrounds.ts). Tasks 5, 6 can follow after scenes are done. Tasks 7, 8 are independent of interactables. Task 9 is the final gate.
