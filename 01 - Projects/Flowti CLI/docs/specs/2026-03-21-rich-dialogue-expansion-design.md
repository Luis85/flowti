# Rich Dialogue & Interaction Expansion — Design Spec

**Date:** 2026-03-21
**Status:** Approved
**Scope:** Flowti Plugin — Agent World dialogue, pet talk, agent-to-agent interactions

---

## 1. Overview

Expand the Agent World dialogue system to support rich multi-turn conversations, pet inner monologue, relationship-driven tone, dramatic arcs, gossip networks, running jokes, and composable phrase assembly. Leverages the working behaviour tree system for triggering and orchestration.

### Goals

- Back-and-forth agent exchanges (2-4 turn mini-conversations)
- Richer one-shot variety through composable fragments
- Full conversational arcs (debates, gossip, mentoring, celebrations)
- Pets as first-class talk engine participants with three-voice inner monologue
- Pets as social catalysts creating interaction moments between agents
- Relationship tier drives dialogue tone across all systems
- Drama, conflict, and gossip as entertainment
- Running jokes that persist and escalate across sessions
- ~3x content expansion (625 → 1,910 phrase units)

---

## 2. Conversation Script System

### 2.1 Data Model

```typescript
interface ConversationScript {
  id: string;
  tierRange: [RelationshipTier, RelationshipTier];
  domainFilter?: [string, string] | null;
  trigger: ConversationTrigger;
  weight: number;
  cooldownMs: number;
  tags: string[];
  turns: ConversationTurn[];
}

type ConversationTrigger =
  | "proximity"
  | "work-finished"
  | "break"
  | "mood-event"
  | "gossip"
  | "pet-catalyst"
  | "tier-change";

interface ConversationTurn {
  speaker: "A" | "B" | "pet";
  text: string;
  delayMs: number;
  kind: BubbleKind;
  condition?: TurnCondition;
}

type TurnCondition =
  | { type: "mood"; agent: "A" | "B"; mood: AgentMood }
  | { type: "tier"; min: RelationshipTier }
  | { type: "petPresent" }
  | { type: "thirdAgentNearby" };

// AgentMood imported from talk/templates/mood-variants.ts:
// "excited" | "tired" | "frustrated" | "neutral" | "lonely" | "distracted"
```

### 2.2 ConversationEngine

New class in `talk/conversation-engine.ts` (~250 lines).

**Responsibilities:**

- Selects scripts based on relationship tier, domains, and trigger event
- Locks both participants for duration (suppresses ambient chatter)
- Plays turns with timing, routing speech bubbles to correct agent
- Records conversation in relationship system (+2 affinity)
- Tracks per-script play counts (for running joke escalation)
- Manages cooldowns per-script to avoid immediate replay

**Participant locking:** ConversationEngine maintains `private readonly locked = new Set<string>()`. Before `tryScript()` starts, both agents are checked against the locked set. If either is locked, the script is skipped. On script start, both names are added; on final turn completion, both are removed. During lock, `talkEngine.silence(agentName)` is called for each participant to suppress ambient chatter. On the same BT tick, if two triggers fire for overlapping agent pairs, the second `tryScript()` call will find one agent already locked and gracefully fall back to one-liners.

**Integration with BT:** The collected-action processor (not `Socialize()` itself) handles `{ source: "social" }` actions by routing through `ConversationEngine.tryScript()` first. `Socialize()` remains a pure function that collects actions — no new deps injected into the BT agent. The action processor already has access to game systems and can call `conversationEngine.tryScript(agentA, agentB, trigger)`. If no script matches, it falls back to existing one-liner social phrase resolution.

**Variables available in scripts:** `{agentA}`, `{agentB}`, `{pet}`, `{domain_a}`, `{domain_b}`, `{agentC}` (gossip subject) + all existing `TemplateVars`.

---

## 3. Pet Talk Integration

### 3.1 Pet Registration in TalkEngine

Pets register in the existing `TalkEngine` with `domain: "pet"`. The following fields are added to `TemplateVars` in `talk-types.ts` (making pet vars available to the interpolation engine):

```typescript
// Added to TemplateVars in talk-types.ts:
readonly pet_name: string;
readonly pet_type: string;
readonly owner_name: string;
readonly nearby_agent_mood: string;
readonly hunger_level: string;
readonly affection_level: string;
```

`PetVoice` type is also added to `talk-types.ts`:

```typescript
export type PetVoice = "instinct" | "eloquent" | "gremlin";
```

Default values for pet fields are empty strings (consistent with existing `defaultVars()`), set to actual values when a pet is registered via `updateVars()`. Agent entries ignore the pet fields (empty strings produce no interpolation artifacts since pet templates only use `{pet_name}` etc., and agent templates never reference them).

### 3.2 Three-Voice Inner Monologue

Pet voice selected by context. Conditions use numeric values from `PetBTContext` (`hunger`, `thirst`) and `BTAgentContext.needs.morale` (for nearby agents), not `AgentMood` string literals:

| State | Source | Instinct | Eloquent | Gremlin |
|-------|--------|----------|----------|---------|
| `context.hunger < 30` or `context.thirst < 30` | `PetBTContext` | 80% | 0% | 20% |
| `nearbyAgentMorale < 30` | `PetBTContext.nearbyAgentMorale` | 30% | 70% | 0% |
| `state === "idle"` + high energy | `PetBTContext.state` | 0% | 40% | 60% |
| `state === "sleeping"` | `PetBTContext.state` | 100% | 0% | 0% |
| default | — | 33% | 33% | 33% |

**Voice examples:**

- **Instinct:** `"food. FOOD. why empty. sad."`, `"leg tired. floor good. sleep now."`, `"warm spot. mine. do not move."`
- **Eloquent:** `"They've been staring at the glowing rectangle for 47 minutes. I admire their dedication to nothing."`, `"Another argument about architecture. Neither of them can even open a door handle."`
- **Gremlin:** `"MISSION: steal the clicky thing. OBSTACLE: it's attached to the desk. SOLUTION: chew through desk."`, `"CRISIS: the red dot has returned. Deploying counter-measures. UPDATE: it was on my own nose."`

### 3.3 Pet Reactive Triggers

New trigger types added to the reactive phrase system: `pet-hungry`, `pet-sleepy`, `pet-bored`, `pet-startled`, `pet-affectionate`, `pet-jealous`, `pet-zoomies`

Note: These are `ReactiveTrigger` values (string tags for the talk engine), NOT extensions of `PetState`. The `PetState` type in `pet-bt.ts` remains unchanged — it describes BT locomotion states (`idle`, `wandering`, `sleeping`, `following`, `exiting`). The reactive triggers describe emotional/situational events that fire pet phrases.

### 3.4 Pet Phrase Chains

Multi-step sequences (~20 chains):

- Pet investigates a bug (the insect kind) — 3 steps ending in confusion
- Pet judges an agent's code — eloquent observation sequence
- Pet nap-wake cycle — `"zzz..."` → `"...what year is it"` → `"back to sleep"`
- Pet hunts the cursor — `"it moves..."` → `"POUNCE"` → `"...it was nothing. play it cool"`

---

## 4. Tier-Driven Dialogue Tone

### 4.1 Tier Modifier Pools

Each relationship tier gets prefix and suffix fragment pools that wrap existing phrases:

**Rival** (sarcastic, passive-aggressive):
- Prefixes: `"Oh great, {nearby_agent}'s here."`, `"Don't look now but..."`, `"Speaking of bad ideas..."`
- Suffixes: `"...but what would I know"`, `"...unlike SOME people"`, `"...not naming names"`

**Acquaintance** (polite, slightly awkward):
- Prefixes: `"Hey, uh..."`, `"So..."`, `"Not sure if you're busy but..."`
- Suffixes: `"...anyway!"`, `"...just a thought"`, `"...no worries if not"`

**Colleague** (professional warmth):
- Prefixes: `"Quick thought—"`, `"Oh hey, good timing—"`, `"You'd appreciate this—"`
- Suffixes: `"...worth a look"`, `"...what do you think?"`, `"...you've probably seen this before"`

**Friend** (casual, teasing):
- Prefixes: `"Okay you're gonna love this—"`, `"Don't judge me but—"`, `"Remember what I said about—"`
- Suffixes: `"...you owe me one"`, `"...classic us"`, `"...and that's why we work"`

**Best friend** (shorthand, deep trust):
- Prefixes: `"You already know what I'm going to say—"`, `"Same wavelength—"`, `"Tell me you see it too—"`
- Suffixes: `"...like that time with the deploy"`, `"...you get it"`, `"...us against the codebase"`

### 4.2 Resolution Mechanics

New `resolveTierPhrase()` step in the talk engine's resolution chain. When a nearby agent exists, 20% chance to wrap the selected phrase with a tier-appropriate prefix/suffix. Tier looked up from relationship system at resolve time.

Conversation scripts are tagged by `tierRange` — rival scripts never play between best friends, and vice versa.

---

## 5. Drama, Gossip & Conflict

### 5.1 Four Drama Categories

**Professional Tension** (tier: rival to acquaintance):
- Architecture disagreements, code review conflicts, methodology debates
- Progressive escalation scripts ending in frustrated departure

**Sitcom Rivalry** (tier: rival to colleague):
- Petty one-upmanship, exaggerated reactions, performative outrage
- Running bits: one agent keeps "accidentally" refactoring the other's code

**Gossip Network** (tier: colleague to best-friend):
- Three-agent gossip: Agent A talks to Agent B about absent Agent C
- `gossip-target` reactive trigger fires if subject walks nearby during gossip
- Gossip tone (positive/negative) based on affinity toward subject
- 15% chance during social interactions when 2+ agents cluster and 3rd is elsewhere

**Soap Opera Arcs** (tier: any, triggered by tier transitions):
- Rival → acquaintance: reluctant truce
- Friend → best-friend: bonding moment
- Friend → colleague (decay): drifting apart
- Best-friend → friend: betrayal/disappointment

### 5.2 Gossip Mechanics

New `gossipAbout(a: string, b: string, subject: string)` on ConversationEngine. Subject selection weighted by recent state interest (finished big task, mood event, tier change).

---

## 6. Running Jokes & Persistent Comedy

### 6.1 Data Model

```typescript
// RunningJoke is a standalone interface, NOT extending ConversationScript.
// It uses `variants` instead of `turns` — each variant is a full turn sequence
// for a given escalation level. variants[0] is the base version.
interface RunningJoke {
  id: string;                        // e.g. "joke:tabs-vs-spaces"
  tierRange: [RelationshipTier, RelationshipTier];
  domainFilter?: [string, string] | null;
  trigger: ConversationTrigger;
  weight: number;
  cooldownMs: number;
  tags: string[];                    // always includes "running-joke"
  variants: ConversationTurn[][];    // indexed by escalation level; [0] = base
  maxEscalation: number;             // typically 3-5
  callbackChance: number;            // chance an unrelated conversation references this joke
  callbackLines: string[];           // one-liners other agents can drop as callbacks
}
```

### 6.2 Escalation Mechanics

- Play count tracked per joke per agent-pair
- First encounter: base version
- 2nd-3rd encounter: self-aware variant ("Not this again...")
- 4th+: fully meta, characters acknowledge the bit

### 6.3 Planned Running Jokes (~15)

1. **Tabs vs Spaces** — Genuine debate → resigned ritual → one holds up a sign → callback: third agent warns others
2. **The Unfinished Story** — Agent keeps getting interrupted mid-story → finally finishes, nobody listening
3. **Pet's Nemesis** — Pet vs cursor/chair/specific agent → avoidance → peace → re-declared war
4. **The Third-Person Narrator** — Agent narrates self when alone → gets caught → recruits accomplice
5. **The Cursed Variable Name** — x7 appears, spreads, becomes team meme
6. **The Perfect Commit Message** — Agent agonizes over wording → ships "fix stuff" → regret
7. **The Coffee Machine Rivalry** — Two agents racing for the good machine
8. **The Deploy Ritual** — Agent develops increasingly elaborate pre-deploy superstitions
9. **The Documentation Promise** — "I'll document this later" → running tally of broken promises
10. **The Mysterious Bug** — Bug that only appears on Tuesdays → agents develop conspiracy theories
11. **The Meeting That Could Have Been An Email** — Escalates to "could have been a post-it note"
12. **Pet's Opinion On Code** — Pet walks on keyboard, output is treated as code review
13. **The Infinite Refactor** — Agent keeps finding "one more thing" to clean up
14. **The Wrong Terminal** — Agent keeps typing in wrong window → escalates to messaging production
15. **The Standup Novel** — One agent's standups keep getting longer → others start timing it

### 6.4 Persistence

Running joke play counts are stored in a **dedicated structure** on `RelationshipEntry`, NOT in `sharedMemories` (which has a `MAX_SHARED_MEMORIES = 5` cap that would evict joke state):

```typescript
// Added to RelationshipEntry:
jokePlayCounts?: Record<string, number>;  // keyed by joke id, e.g. { "joke:tabs-vs-spaces": 3 }
```

This field is included in `PersistenceData.serialize()` / `restore()` so joke escalation state persists across sessions. The `ConversationEngine` increments the count after a joke script completes and reads it in `tryScript()` to select the correct variant index (`Math.min(playCount, joke.maxEscalation - 1)`).

**Initialization:** `getOrCreate()` in `RelationshipSystem` must initialize `jokePlayCounts: {}` alongside other entry fields. `ConversationEngine` accesses it directly without null-guarding (the field is always present on any entry returned by `getOrCreate()`).

---

## 7. Composable Fragment System

### 7.1 Data Model

```typescript
// PetVoice is used for fragment filtering — distinct from PetState (BT locomotion)
type PetVoice = "instinct" | "eloquent" | "gremlin";

interface FragmentPool {
  id: string;
  slot: "opener" | "core" | "closer" | "interjection" | "qualifier";
  filters: {
    mood?: AgentMood[];      // from mood-variants.ts
    domain?: string[];
    tier?: RelationshipTier[];
    petVoice?: PetVoice[];   // for pet-specific fragment pools
    timeOfDay?: string[];
  };
  fragments: string[];
}
```

### 7.2 Assembly Distribution

These percentages apply **only to the TalkEngine one-liner fallback path** (i.e., when ConversationEngine has no matching script). They are implemented as probability constants in the `resolvePhrase()` chain, consistent with the existing `MOOD_CHANCE = 0.15` and `CROSSOVER_CHANCE = 0.25` pattern:

```typescript
const TIER_MODIFIER_CHANCE = 0.15;   // wraps a static phrase with tier prefix/suffix
const COMPOSE_CHANCE = 0.25;         // assembles from fragment pools instead of static
```

**Position in resolve chain** (after mood, before crossover — this changes the existing order in `talk-engine.ts` lines 357-365 where crossover currently follows immediately after mood):

1. Active chain → 2. Reactive trigger → 3. Mood variant (`0.15`) → **4. Tier-modified phrase (`0.15`)** → **5. Composed fragment (`0.25`)** → 6. Crossover (`0.25`) → 7. Personality → 8. Social → 9. Domain → 10. Core fallback

The file-level JSDoc comment in `talk-engine.ts` (lines 1-25) must also be updated to reflect the new 10-step priority order.

Approximate outcome distribution:
- **~60%** — Existing static templates (quality floor)
- **~25%** — Composed from fragments
- **~15%** — Tier-modified static templates (Section 4 prefixes/suffixes)

### 7.3 Composition Patterns

1. **Opener + Core** (40%): `"Hmm,"` + `"this dependency graph is a mess"`
2. **Core + Qualifier** (30%): `"The tests are passing"` + `"...suspiciously well"`
3. **Interjection + Core + Closer** (25%): `"Wait—"` + `"did the build just succeed?"` + `"Don't trust it"`
4. **Full assembly** (5%): `opener + core + closer`

### 7.4 Fragment Categories

- **Openers** (60+): mood-filtered intros
- **Core observations** (200+ across domains): domain-specific observations, task reactions, idle musings
- **Closers** (80+): mood-filtered exits
- **Qualifiers** (60+): tone modifiers
- **Interjections** (40+): attention-getters

### 7.5 Pet Fragment Pools (separate, context-switched)

- **Instinct cores** (50+): `"floor warm"`, `"food missing"`, `"tail exists. must catch"`
- **Eloquent cores** (50+): `"One observes the futility of their merge strategy"`
- **Gremlin cores** (50+): `"TACTICAL ASSESSMENT: jump onto keyboard"`

---

## 8. Pet as Social Catalyst

### 8.1 New Pet BT Actions

Added to `pet-bt.ts` MDSL and action set:

1. **DragToy** — Pet carries object to two nearby agents, triggering conversation
2. **SitBetween** — Pet sits between arguing/rival agents, defusing tension with absurdity
3. **BringGift** — Pet delivers "gift" to highest-affection agent; others react
4. **StealSpotlight** — Pet does something dramatic mid-conversation (knocks thing over, zooms)
5. **ComfortSadAgent** — Pet approaches low-morale agent; other agents comment
6. **PickSide** — During argument, pet visibly sits next to one agent

### 8.2 Pet-Agent Affinity

New per-agent (not per-pair) `petAffinity` map on `RelationshipSystem`:

```typescript
// Added to RelationshipSystem:
private readonly petAffinity = new Map<string, number>();  // keyed by agent name, value 0-100

// Added to PersistenceData:
petAffinity: Record<string, number>;  // serialized in serialize() / restored in restore()
```

Affinity changes (0-100 per agent):

| Action | Affinity change |
|--------|----------------|
| Feed pet | +5 |
| Nearby during idle | +1 per cycle |
| Share food | +3 |
| Startle pet | -2 |
| Ignore gift | -1 |

Pet catalyst scripts weighted by `petAffinity` — pets gravitate toward favorites but occasionally troll least-favorites.

---

## 9. File Organization

### New Files

| File | Purpose | Est. size |
|------|---------|-----------|
| `talk/conversation-engine.ts` | Script selection, turn playback, locking | ~250 lines |
| `talk/conversation-types.ts` | ConversationScript, RunningJoke, TurnCondition types | ~60 lines |
| `talk/fragment-composer.ts` | Fragment assembly logic | ~120 lines |
| `talk/templates/conversation-scripts-rival.ts` | Rival tier scripts | ~25 scripts |
| `talk/templates/conversation-scripts-acquaintance.ts` | Acquaintance tier scripts | ~20 scripts |
| `talk/templates/conversation-scripts-colleague.ts` | Colleague tier scripts | ~25 scripts |
| `talk/templates/conversation-scripts-friend.ts` | Friend tier scripts | ~30 scripts |
| `talk/templates/conversation-scripts-bestfriend.ts` | Best-friend scripts | ~25 scripts |
| `talk/templates/conversation-scripts-gossip.ts` | Three-agent gossip scripts | ~20 scripts |
| `talk/templates/conversation-scripts-drama.ts` | Tier-transition dramatic arcs | ~15 scripts |
| `talk/templates/conversation-scripts-pet.ts` | Pet catalyst scripts | ~25 scripts |
| `talk/templates/running-jokes.ts` | Running joke definitions with variants | ~15 × 3-5 |
| `talk/templates/pet-phrases.ts` | Pet inner monologue fragments | ~150 fragments |
| `talk/templates/pet-phrase-chains.ts` | Pet multi-step sequences | ~20 chains |
| `talk/templates/pet-reactive-phrases.ts` | Pet reactive triggers | ~70 phrases |
| `talk/templates/fragment-pools.ts` | Composable fragments | ~500 fragments |
| `talk/templates/tier-modifiers.ts` | Tier prefix/suffix pools | ~150 fragments |

### Modified Files

| File | Changes |
|------|---------|
| `talk/talk-engine.ts` | Add `resolveTierPhrase()`, `resolveComposedPhrase()` to chain; pet registration |
| `talk/talk-types.ts` | Extend `TemplateVars` with pet fields; add `PetVoice` type |
| `talk/templates/index.ts` | Register all new template sets |
| `talk/templates/reactive-phrases.ts` | Add 7 pet reactive trigger types to `ReactiveTrigger` union |
| `brain/behavior-tree/pet-bt.ts` | Add 6 catalyst actions + conditions (PetState unchanged) |
| `systems/relationship-system.ts` | Add `petAffinity: Map<string, number>`, `jokePlayCounts` on `RelationshipEntry`, update `PersistenceData` serialize/restore |
| Action processor (wherever `{ source: "social" }` collected actions are handled) | Route through `ConversationEngine.tryScript()` before one-liner fallback |

### Content Totals

| Category | Current | Added | New total |
|----------|---------|-------|-----------|
| Static one-liners | ~600 | ~500 | ~1,100 |
| Phrase chains | ~25 | ~40 | ~65 |
| Conversation scripts | 0 | ~185 | ~185 |
| Running jokes | 0 | ~60 variant sets | ~60 |
| Composable fragments | 0 | ~500 | ~500 |
| **Total phrase units** | **~625** | **~1,285** | **~1,910** |

---

## 10. Integration Summary

```
BT Tick
  └─ Social subtree fires
      ├─ ConversationEngine.tryScript(agentA, agentB, trigger)
      │   ├─ Match by tier + domain + trigger + cooldown
      │   ├─ Lock participants
      │   ├─ Play turns with delays → showBubble()
      │   └─ Record in RelationshipSystem
      └─ Fallback: TalkEngine.resolvePhrase()
          ├─ Active chain
          ├─ Reactive trigger
          ├─ Mood variant
          ├─ Tier-modified phrase (NEW — 15%)
          ├─ Composed fragment (NEW — 25%)
          ├─ Crossover
          ├─ Personality
          ├─ Social one-liner
          ├─ Domain template
          └─ Core fallback

Pet BT Tick
  └─ Catalyst actions (DragToy, SitBetween, BringGift, etc.)
      └─ ConversationEngine.triggerPetCatalyst(pet, nearbyAgents)
  └─ Pet registered in TalkEngine
      └─ Pet phrase resolution (voice-switched by state)
```
