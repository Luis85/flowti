# Ninja Adventure Sprite Integration — Design Spec

**Date**: 2026-03-16
**Status**: Approved
**Scope**: Replace programmatic pixel-art sprites with Ninja Adventure asset pack spritesheets

## Context

The ExcaliburJS agent dashboard currently draws agents using programmatic `CanvasRenderingContext2D` calls in `pixel-sprites.ts`. This produces basic shapes (rectangles for body, limbs, head) that lack character and animation variety. The Ninja Adventure asset pack (CC0 license, 87 characters, 16x16 pixel art with walk/idle animations) provides production-quality sprites that will bring agents to life.

## Decision Record

| Question | Decision |
|---|---|
| Character mapping strategy | Domain-based pools — agents in the same domain share a visual theme |
| Supported animations | Idle (4-frame loop), Walk (4 directions x 4 frames), brain states reuse idle |
| Display size | 4x scale (64x64 on screen), no additional hub scaling |
| Labels and indicators | Keep name label, AI/H badge, and status dot below each agent |

## Architecture

### New Modules

#### `src/sprites/sprite-loader.ts`

Loads PNG spritesheets and produces ExcaliburJS `Animation` objects.

```typescript
interface AgentSprites {
  idle: ex.Animation;
  walkDown: ex.Animation;
  walkLeft: ex.Animation;
  walkRight: ex.Animation;
  walkUp: ex.Animation;
}

async function loadAgentSprites(characterName: string, basePath: string): Promise<AgentSprites>;
```

- Creates `ex.ImageSource` for `SeparateAnim/Idle.png` and `SeparateAnim/Walk.png` with `ex.ImageFiltering.Pixel`
- Calls `.load()` on each image source (async) before slicing into spritesheets
- Idle: 64x16 → `SpriteSheet.fromImageSource()` with 4 columns x 1 row at 16x16
- Walk: 64x64 → `SpriteSheet.fromImageSource()` with 4 columns x 4 rows at 16x16
- Walk rows: 0=down, 1=left, 2=right, 3=up
- Returns pre-built `ex.Animation` objects with configurable frame durations

#### `src/sprites/character-pool.ts`

Maps domains to character sprite pools and deterministically assigns characters.

```typescript
function resolveCharacter(agentName: string, domain: string): string;
```

- Each domain has a pool of character folder names
- Uses a name hash to pick consistently from the pool (same agent always gets same sprite)
- Fallback pool for unmapped domains

**Pool assignments:**

| Domain | Character Pool |
|---|---|
| engineering, qa, devops, development, testing | NinjaBlue, NinjaGreen, NinjaDark, NinjaRed, NinjaGray, NinjaMageBlack |
| design, ux | Princess, Woman, Villager, Villager2, EggGirl, Cavegirl |
| product | Noble, Inspector, Master, Sultan |
| management, delivery, coordination | Samurai, SamuraiBlue, Knight, KnightGold, SamuraiRed |
| quality | Monk, Monk2, Shaman |
| analysis | SorcererBlack, SorcererOrange, NinjaMageOrange |
| operations | RobotGrey, RobotGreen, RobotCamouflage |
| marketing, sales, support | Villager3, Villager4, Villager5, OldMan, Boy |
| orchestration | GoldStatue, RedGladiator, GladiatorBlue |
| fallback | Child, Eskimo, Flam, Hunter, ManGreen |

### Modified Modules

#### `src/actors/agent-actor.ts`

Major refactor — replace programmatic drawing with spritesheet graphics.

**Changes:**
- Canvas size: 64x80 (64x64 sprite area + 16px label area)
- Sprite area: 64x64 (16x16 at 4x scale)
- Constructor accepts `AgentSprites` (pre-loaded animations)
- `buildAllPoses()` replaced by assigning loaded animations to named graphic slots
- `updateFromBrain()` switches between idle/walk animations based on state
- Walk direction derived from movement vector (4-way cardinal mapping)
- Name label, AI/H badge, status dot rendered on a separate `ex.Canvas` graphic layered below the sprite
- Remove all imports from `pixel-sprites.ts`
- Remove `facingLeft` flip logic — replaced by directional walk sprites
- Remove 1.5x hub scale factor

**Brain state → animation mapping:**

| Brain State | Animation | Frame Duration |
|---|---|---|
| idle | Idle loop | 300ms |
| wandering | Walk (direction) | 250ms |
| walking-to | Walk (direction) | 150ms |
| working | Idle loop | 300ms |
| talking | Idle loop | 300ms |
| waiting | Idle loop | 300ms |
| on-break | Idle loop | 400ms (slower) |

**Direction resolution from movement vector:**

```
if abs(dx) > abs(dy):
  dx > 0 → walkRight, dx < 0 → walkLeft
else:
  dy > 0 → walkDown, dy < 0 → walkUp
```

#### `src/main.ts`

- Set `pixelArt: true` and `antialiasing: false` on engine config (replaces current `antialiasing: true`)
- Create a sprite registry (`Map<string, AgentSprites>`) populated during init before engine start
- Use `ex.Loader` to preload all `ImageSource` objects with a loading screen
- Pass `AgentSprites` to agent actors during creation in both hub and room scenes

#### `src/scenes/hub-scene.ts`

- Remove `actor.scale = ex.vec(1.5, 1.5)` — sprites are already 4x via engine scaling
- Adjust `AGENT_SPACING` if needed for larger sprites (currently 120, may need ~140)
- `updateAgents()` receives the sprite registry to pass sprites when creating new `AgentActor` instances

#### `src/scenes/room-scene.ts`

- `spawnAgent()` receives the sprite registry to pass sprites when creating new `AgentActor` instances
- No other changes — room layout, workstations, brain system wiring all stay the same

### Build & Asset Serving

The `build.mjs` script must be updated to copy sprite assets to the output directory:

- Copy `assets/Actor/Characters/*/SeparateAnim/{Idle,Walk}.png` → `.flowti/agents/assets/...` (preserving directory structure)
- Only copy the characters referenced in `character-pool.ts` (41 characters x 2 PNGs = 82 files, ~50KB total)
- The `basePath` in `loadAgentSprites()` resolves to a relative URL from `index.html` (e.g. `assets/Actor/Characters/`)
- Alternative: inline the PNGs as base64 data URLs in the bundle (trades bundle size for zero asset requests). Prefer file-based serving for now.

### Removed

- `src/actors/pixel-sprites.ts` — all programmatic drawing functions become unused. Delete the file.
- `tests/actors/pixel-sprites.test.ts` — remove (source file deleted)

### Unchanged

- Brain system (`brain-system.ts`, `brain-types.ts`, movement logic)
- Bubble system (`bubble-system.ts`)
- Camera system (`camera-system.ts`)
- Panel UI (talk tab, tasks tab, permissions tab, agent panel)
- Scene backgrounds (programmatic canvas — tileset backgrounds are a future effort)
- All domain logic, config, API client

## Asset Format Reference

All characters follow this structure:
```
assets/Actor/Characters/<Name>/
  SpriteSheet.png      — 64x112 (facesets, not used for game sprites)
  Faceset.png          — portrait (not used)
  SeparateAnim/
    Idle.png           — 64x16  (4 frames x 1 row, 16x16 each)
    Walk.png           — 64x64  (4 frames x 4 rows, 16x16 each)
    Attack.png         — 64x16  (4 frames, not used)
    Dead.png           — 16x16  (1 frame, not used)
    Item.png           — 16x16  (1 frame, not used)
    Jump.png           — 64x16  (4 frames, not used)
    Special1.png       — 16x16  (1 frame, not used)
    Special2.png       — 16x16  (1 frame, not used)
```

## Testing Strategy

- New `tests/sprites/character-pool.test.ts`: deterministic assignment, fallback pool, domain mapping, all 23 agents resolve to valid characters
- New `tests/sprites/sprite-loader.test.ts`: mock `ex.ImageSource` and `ex.SpriteSheet`, verify spritesheet slicing params and animation frame counts
- Update `tests/actors/agent-actor.test.ts`: mock `AgentSprites`, test animation switching per brain state, test direction resolution
- Remove `tests/actors/pixel-sprites.test.ts` (source file deleted)
- Existing scene and system tests remain unchanged

## License

Ninja Adventure Asset Pack by Pixel-boy & AAA — CC0 (Creative Commons Zero).
No attribution required. No restrictions on use, modification, or redistribution.
Source: https://pixel-boy.itch.io/ninja-adventure-asset-pack
