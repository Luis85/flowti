# Agent Liveness Systems — Design Spec

> Make agents feel alive, social, and useful — without LLM calls. Template-driven talk, personality-weighted needs, project-aware sensors, escalating Director engagement, configurable rituals, and full tool execution with permission gating.

**Date**: 2026-03-20
**Architecture**: Flat systems (existing pattern) — 6 new systems added alongside 6 existing, wired via callbacks in `createAgentWorld()`

---

## Table of Contents

1. [Needs System](#1-needs-system)
2. [Director Presence](#2-director-presence)
3. [Sensor System](#3-sensor-system)
4. [Group Dynamics](#4-group-dynamics)
5. [Engagement System](#5-engagement-system)
6. [Tool Execution](#6-tool-execution)
7. [Configuration](#7-configuration)
8. [System Wiring & Update Order](#8-system-wiring--update-order)

---

## 1. Needs System

Four needs per agent, personality-weighted by existing D&D-style attributes (STR/INT/WIS/CHA/DEX/CON). Needs drive behavior dynamically — mood becomes derived rather than static.

### Data Model

```typescript
interface AgentNeeds {
  energy:  number;  // 0–100, starts at 80
  social:  number;  // 0–100, starts at 60
  focus:   number;  // 0–100, starts at 70
  morale:  number;  // 0–100, starts at 75
}
```

### Decay & Restore Rules

Each need ticks every second. Rates are per-minute base values, modified by attributes:

| Need | Decays when | Base rate | Attribute modifier | Restores when | Base rate |
|------|-------------|-----------|-------------------|---------------|-----------|
| Energy | Working, walking | -3/min | CON: ×(1 - con/40) — high CON = slower drain | On-break, idle | +5/min |
| Social | Alone (no agent within socialRadius) | -2/min | CHA: ×(1 + cha/20) — high CHA = faster drain (needs people more) | Conversation, nearby agents | +4/min per nearby agent |
| Focus | Interrupted (conversation, engagement nudge) | -4/event | INT: ×(1 - int/40) — high INT = less disruption | Working uninterrupted for 10+s | +2/min |
| Morale | Task error, idle >60s, ignored by Director | -1/event or -1/min | WIS: ×(1 - wis/40) — high WIS = emotional resilience | Task completed, Director praise, celebration | +5/event |

### Behavior Thresholds

| Need | Threshold | Brain effect |
|------|-----------|--------------|
| Energy < 30 | Force break. Agent walks to break area, rests until energy > 60. Idle animation slows (longer pose cycle timing). |
| Energy < 15 | "Exhausted" — yawning emote every 20s, movement speed ×0.6 |
| Social < 25 | socialDrift increases to CHA/10 (doubled). Agent actively seeks nearest idle agent. |
| Social < 10 | "Lonely" — agent drifts toward Director cursor spirit if visible |
| Focus < 20 | focusDrift increases to INT/10. Agent seeks furthest corner. Ignores social conversations. |
| Morale < 30 | Sad emotes replace normal mood emotes. Movement speed ×0.8. Break threshold halved. |
| Morale < 10 | "Demoralized" — agent stops accepting tasks, sits idle with recurring sad thought bubbles until Director interacts or morale recovers |

### Mood Derivation

Mood becomes derived from needs, replacing the static mood set from agent data:

```
If morale > 70 and energy > 50 → "happy"
If focus > 70 and energy > 40 → "focused"
If morale < 30 → "frustrated"
If social > 80 and morale > 50 → "empathetic"
If any task completed in last 60s → "inspired" (temporary, 60s duration)
```

All existing mood-dependent systems (emotes, talk templates, brain habits) react dynamically without changes — they already read mood, they'll just get a dynamic value now.

### Integration Points

- **BrainSystem** reads `getNeeds(name)` each tick to adjust: idleResistance, breakThreshold, socialDrift, focusDrift, speedMultiplier
- **TalkEngine** reads mood (now derived) for template selection
- **EmoteSystem** reads mood (now derived) for emote selection
- **SocialSystem** checks `focus` need before allowing conversations (focus < 20 = reject)

---

## 2. Director Presence

Two layers: a passive cursor spirit that tracks the mouse, plus transient context signals on Director actions.

### Cursor Spirit

A lightweight actor tracking mouse position in world-space coordinates:

- **Visual**: Small radial gradient glow (12px radius, team-color tinted, 0.3 opacity). Canvas-drawn circle with soft falloff, no sprite.
- **Positioning**: Converts screen mouse coordinates to world-space via camera inverse transform. Updates every frame.
- **Visibility**: Only visible when mouse is over the game canvas. Fades in/out over 300ms on enter/leave.
- **No collision**: Agents don't physically bump into it. Purely a presence signal.

### Agent Awareness

Each brain system tick, agents check distance to cursor spirit position:

| Distance | Reaction | Cooldown |
|----------|----------|----------|
| < 60px for 2+s | Agent turns to face cursor direction. Thought bubble: greeting from social templates ("Need something, boss?", "Hey there!") | 30s per agent |
| < 40px for 4+s | Agent waves (emote). If needs.morale < 50, stronger reaction ("Glad you're here", "Could use a hand...") | 60s per agent |
| Cursor leaves radius | Agent returns to previous behavior after 1s settling pause |

Awareness only triggers for idle, on-break, or waiting agents. Working and talking agents ignore the cursor.

### Context Signals (Transient)

Brief visual + behavioral events tied to Director actions:

| Action | Visual signal | Agent reaction |
|--------|--------------|----------------|
| **Click agent** | Soft pulse ring at click position (expands 0→40px, fades over 400ms) | Selected agent faces camera, nearby agents within 80px glance toward click |
| **Send message** | Speech bubble appears from top-center of viewport, floats down to agent | Target agent enters "talking" state, nearby agents look over |
| **Approve permission** | Green flash on agent's workstation | Agent morale +5, nearby agents react ("Nice!", thumbs emote) |
| **Deny permission** | Red flash on agent's workstation | Agent morale -3, shrug emote |
| **Click after task completion** | Star particle burst at agent position | Agent morale +10 ("praise" event), nearby agents clap emote. This is the praise/feedback loop. |
| **Idle 30+s** | Cursor spirit dims to 0.15 opacity | Feeds into engagement escalation (Section 5) |

### Data Model

```typescript
interface DirectorPresence {
  worldPos: { x: number; y: number } | null;  // null = mouse not on canvas
  visible: boolean;
  idleMs: number;          // time since last interaction (click, message, key)
  lastInteraction: {
    type: 'click' | 'message' | 'permission' | 'praise';
    worldPos: { x: number; y: number };
    timestamp: number;
  } | null;
}
```

Exposes `getPresence()` for other systems: EngagementSystem reads `idleMs`, BrainSystem reads `worldPos`, NeedsSystem reads interactions for morale adjustments.

---

## 3. Sensor System

Watches project state changes and maps them to agent reactions via a rule table. Reads CLI output and Obsidian vault events.

### Event Sources

| Source | Detection method | Data extracted |
|--------|-----------------|----------------|
| **Test results** | Watch test report file changes in `.flowti/var/` or CLI executor completion events | Pass/fail counts, delta from last run |
| **Build status** | CLI executor completion event for build commands | Success/failure, duration |
| **Health score** | Health report output after `flowti health` runs | Score value, delta from last known |
| **Iteration state** | Watch iteration data file in `.flowti/var/` | Completion %, items done/total, state changes |
| **File saves** | Obsidian `vault.on('modify')` (already available) | File path, extension, timestamp |
| **File opens** | Obsidian `workspace.on('file-open')` (already available) | File path |

### Rule Table

```typescript
interface SensorRule {
  event: SensorEventType;
  condition?: (data: SensorEventData) => boolean;
  agentFilter: 'nearest-domain' | 'all' | 'domain-match';
  reaction: {
    bubble?: { kind: BubbleKind; template: string };
    emote?: number;
    needsEffect?: Partial<AgentNeeds>;
    brainEvent?: string;
  };
  cooldown: number;
}
```

### Default Rules

| Event | Condition | Who reacts | Reaction |
|-------|-----------|------------|----------|
| Test pass | All tests green | Nearest quality-domain agent | Speech: "All green!" + morale +3 for all agents |
| Test fail | Failures > 0 | Nearest quality-domain agent | Speech: "{count} failures... let me look" + morale -2 for domain-relevant agents |
| Test delta | Failures increased from last run | Nearest quality-domain agent | Thought: "That's more failures than before..." + emote worried |
| Build success | — | Nearest ops-domain agent | Speech: "Build complete!" + morale +2 |
| Build failure | — | Nearest ops-domain agent | Speech: "Build broke." + emote frustrated |
| Health improved | Score delta > 0 | Nearest management-domain agent | Speech: "Health score went up to {score}!" |
| Health dropped | Score delta < 0 | Nearest management-domain agent | Thought: "Health dipped to {score}..." |
| Iteration milestone | Completion crosses 25/50/75/100% | All agents in scene | 25%: product agent speech. 50%: huddle trigger. 75%: celebration emote. 100%: full celebration ritual |
| File saved | Path matches agent's domain | Nearest domain-match agent | Thought: "Changes in {filename}..." (30s cooldown) |
| File opened | Path matches agent's domain | Nearest domain-match agent | Agent faces camera, thought: "Looking at {filename}?" (60s cooldown) |

### Domain-to-Path Mapping

```typescript
const domainPaths: Record<string, string[]> = {
  engineering: ['src/domain/', 'src/infrastructure/'],
  quality:     ['tests/', 'configs/vitest'],
  design:      ['src/ui/', 'styles'],
  operations:  ['configs/', '.flowti/'],
  product:     ['docs/', 'configs/sitemap'],
};
```

### Cooldowns

- Global: 10s between any sensor reactions (prevents event storms during rapid saves)
- Per-rule: as defined in the rule table
- Per-agent: 5s between sensor-triggered bubbles

---

## 4. Group Dynamics

Emergent clusters from proximity + configurable rituals from markdown files.

### Emergent Clusters

Extends the existing SocialSystem's pair detection to 3+ agents:

- **Detection**: Union-find on existing proximity pairs. If A is near B and B is near C → cluster {A, B, C}.
- **Threshold**: 3+ idle agents within socialRadius for 6s (longer than pair's 4s).
- **Flow**:
  1. Highest-CHA agent initiates: thought bubble "Quick sync?"
  2. After 1.5s, agents tighten formation — walk toward cluster centroid, stop at 40px from center
  3. Round-robin: each agent speaks one huddle template line with 2s gaps
  4. After all agents have spoken, 50% chance of reaction round (emotes from 1-2 agents)
  5. Agents disperse after 3s pause — return to previous idle targets
- **Cooldown**: 3 minutes for the same group composition

Huddle templates are a separate category (`"huddle"`) with lines like "Here's where I'm at...", "Anyone else stuck on..?", "Quick update from my side..."

### Configurable Rituals

Rituals defined as markdown files in a configurable folder (default: `.flowti/rituals/`). Each file is one ritual.

**Markdown format**:

```markdown
---
name: standup
trigger: manual          # manual | schedule | event
schedule: "09:00"        # only if trigger: schedule (real clock)
event: iteration-50      # only if trigger: event (sensor event key)
participants: all        # all | domain:<name> | nearby | idle
duration: 30s            # max duration before force-disperse
cooldown: 24h            # minimum time between occurrences
---

# Gathering
<!-- Phase: agents walk to scene center -->
gather: center
settle: 2s

# Lines
<!-- Each agent speaks one line in order. {name}, {domain}, {mood_adj} variables available -->
- "Here's my status: I'm feeling {mood_adj} about {domain} work."
- "Nothing blocked on my end."
- "Could use some help with {domain} stuff."
- "All good here, {mood_adj} day."
- "Making progress. Slowly but surely."

# Reactions
<!-- After all lines spoken -->
emote: random
disperse: true
```

**Ritual engine**:
1. Parses frontmatter for trigger/schedule/event/participants/duration/cooldown
2. Monitors triggers — manual rituals wait for Director UI action, schedule rituals check real clock, event rituals listen to SensorSystem
3. Gathers participants based on `participants` field, sends them walking to gather point
4. Runs the script — phases (gather → settle → lines → reactions → disperse). Lines assigned round-robin. More participants than lines = lines cycle. More lines than participants = extras skipped.
5. Disperse — agents return to previous positions/behavior

**Built-in templates shipped**: `standup.md` and `celebration.md`. Users add their own by dropping files.

**Celebration** is event-triggered by iteration milestones and task completions. Mostly emotes: nearby agents clap/cheer in a staggered burst (200ms between each), optional confetti particles from ParticlePool.

### Integration

- **RitualSystem** calls `BrainSystem.overrideState(agentName, 'talking')` during participation, releases after
- **NeedsSystem** gets social +8 for each participant, morale +5 for celebrations
- **SensorSystem** fires ritual trigger events
- **Director** triggers manual rituals via UI action (panel button or context menu)

---

## 5. Engagement System

Escalating Director engagement — reactive by default, progressively assertive when idle. All timing values configurable.

### Escalation Tiers

Reads `DirectorPresence.idleMs`. Any interaction (click, message, key, mouse move on canvas) resets to Tier 0.

| Tier | Triggers after idle | Behavior | Max frequency |
|------|-------------------|----------|---------------|
| **0 — Passive** | Always (default) | Agents react only to cursor proximity and clicks. No unsolicited outreach. | — |
| **1 — Ambient** | 30s idle | One agent shows a thought bubble with an observation. Not directed at camera — thinking aloud. "Tests haven't run in a while...", "The iteration is at 73%..." | 1 per 45s |
| **2 — Nudge** | 90s idle | One agent walks toward camera edge, speech bubble addressed to Director. "Hey boss, got a sec?" Stays 10s, then returns. | 1 per 90s |
| **3 — Offer** | 180s idle | Agent at camera edge offers a specific action. "Want me to run a health check?" If Director clicks within 10s, action queued as tool permission request. If ignored, agent shrugs and returns. | 1 per 180s |

### Agent Selection Priority

1. Agent with pending sensor event (test fail, health drop) that hasn't been reported
2. Agent with low morale seeking Director attention
3. Agent with completed task waiting for acknowledgment
4. Highest-CHA idle agent (fallback — natural people person)

One agent at a time. No new engagement until current one resolves.

### Observation Templates

**Tier 1 (thinking aloud)**:
```
"Tests haven't run since {lastTestTime}..."
"Health score is sitting at {healthScore}..."
"The iteration has {remainingItems} items left..."
"{agentName} has been working alone for a while..."
"No one's touched {domain} in {daysSince} days..."
```

**Tier 2 (addressing Director)**:
```
"Hey boss, got a minute?"
"Something came up you might want to know about."
"Just wanted to flag something."
"When you get a chance — I noticed something in {domain}."
```

**Tier 3 (offering action)**:
```
"Want me to run a health check? Last one was {timeSince} ago."
"I could generate the {reportType} report if you'd like."
"Should I kick off the tests? Been a while."
"The iteration status might be worth reviewing. Want me to pull it up?"
```

### Director Response Handling

| Director action | Effect |
|----------------|--------|
| Clicks engaging agent | Opens agent panel. Agent morale +5. If Tier 3, queues offered action as permission request. |
| Clicks elsewhere | Engagement dismissed. Agent returns. No penalty. |
| Sends message | Full interaction — resets idle, agent enters talking state. |
| Continues ignoring | No escalation beyond Tier 3. Stays at Tier 3 frequency until interaction. Never more aggressive. |

### Ceiling

Tier 3 is the maximum. Never forces a popup, modal, or blocking UI element. Agents are persistent but polite — they offer, they don't demand.

---

## 6. Tool Execution

Agents propose CLI commands based on sensor data and engagement. Director approves via existing permission system.

### Tool Registry

```typescript
interface AgentTool {
  id: string;
  command: string;            // CLI command template
  description: string;        // shown in permission bubble
  domain: string[];           // which agent domains can use this
  trigger: 'sensor' | 'schedule' | 'need' | 'engagement';
  cooldown: number;           // ms between uses
  requiresApproval: boolean;  // false = auto-execute (read-only)
}
```

### Default Tools

| Tool ID | Command | Domains | Trigger | Approval |
|---------|---------|---------|---------|----------|
| `health-check` | `flowti health --project="{project}" --format=json` | management, orchestration | sensor (health stale >1h), engagement tier 3 | No (read-only) |
| `run-tests` | `flowti test --project="{project}"` | quality, engineering | sensor (file saved in src/), engagement tier 3 | Yes |
| `generate-report` | `flowti reports --project="{project}"` | analysis, management | engagement tier 3, schedule | Yes |
| `build` | `flowti build --project="{project}"` | engineering, operations | sensor (multiple src files changed), engagement tier 3 | Yes |
| `iteration-status` | `flowti info --project="{project}" --format=json` | product, management | sensor (iteration state change), engagement tier 3 | No (read-only) |
| `open-file` | Obsidian `workspace.openLinkText(path)` | all | sensor (file relevance), engagement | No (non-destructive) |
| `validate-sitemap` | `flowti sitemap:validate` | design, product | sensor (sitemap.json modified) | No (read-only) |

### Execution Flow

1. **Trigger** — SensorSystem event, EngagementSystem tier 3, or schedule
2. **Tool selection** — ToolExecutor matches trigger + agent domain to registry entry
3. **Approval gate** — If `requiresApproval: true`, fires existing `requesting-permission` flow
4. **Execution** — Runs via existing `cli-executor.ts`. Agent enters "working" brain state, tool icon spins.
5. **Result parsing** — JSON output parsed for key metrics. Plain text truncated to first meaningful line.
6. **Reporting** — Agent shows result as speech bubble: "Tests passed: 7022/7022" or "Build failed: missing module..."
7. **Feedback loop** — Result data fed back to SensorSystem as new event (enabling chain reactions)
8. **Needs effect** — Success: morale +3, energy -5. Failure: morale -2.

### Result-to-Sensor Feedback

Tool results feed back into SensorSystem, creating natural chains:

```
File saved → Engineering agent notices →
  triggers test suggestion (engagement tier 3) →
  Director approves → tests run →
  results feed back as sensor event →
  Quality agent reports "3 failures" →
  Engineering agent reacts "Let me look at that"
```

No chain runs automatically without Director approval at the permission gate.

### CLI Executor Integration

Wraps existing `cli-executor.ts` with:
- Command template variable substitution (`{project}`, `{file}`, `{domain}`)
- Timeout handling (configurable per tool, default 30s)
- Output capture and parsing
- Result event emission back to SensorSystem

---

## 7. Configuration

All tunable values in `.flowti/world-config.json`. Sensible defaults — zero config to start, full control when wanted.

### Config Schema

```typescript
interface WorldConfig {
  needs: {
    initial: { energy: number; social: number; focus: number; morale: number };
    decay: {
      energy:  { working: number; walking: number };
      social:  { alone: number };
      focus:   { perInterruption: number };
      morale:  { perError: number; idlePerMinute: number; ignored: number };
    };
    restore: {
      energy:  { onBreak: number; idle: number };
      social:  { perNearbyAgent: number; conversation: number };
      focus:   { workingUninterrupted: number };
      morale:  { taskCompleted: number; directorPraise: number; celebration: number };
    };
    thresholds: {
      energy:  { forceBreak: number; exhausted: number };
      social:  { seekCompany: number; seekDirector: number };
      focus:   { seekQuiet: number };
      morale:  { sad: number; demoralized: number };
    };
  };

  director: {
    cursorSpirit: {
      radius: number;
      opacity: number;
      fadeMs: number;
    };
    awareness: {
      noticeRadius: number;
      noticeDelay: number;
      greetRadius: number;
      greetDelay: number;
      greetCooldown: number;
      noticeCooldown: number;
    };
    signals: {
      clickPulseRadius: number;
      clickPulseDuration: number;
      praiseParticleCount: number;
      glanceRadius: number;
    };
  };

  sensors: {
    globalCooldown: number;
    perAgentCooldown: number;
    domainPaths: Record<string, string[]>;
    rules: SensorRule[];
  };

  groups: {
    clusterMinAgents: number;
    clusterProximityMs: number;
    clusterCooldown: number;
    clusterDispersePause: number;
    ritualsFolder: string;
  };

  engagement: {
    tiers: {
      ambient:  { idleMs: number; frequency: number };
      nudge:    { idleMs: number; frequency: number };
      offer:    { idleMs: number; frequency: number };
    };
    maxTier: number;
    engagementDuration: number;
  };

  tools: {
    defaultTimeout: number;
    registry: AgentTool[];
  };
}
```

### Defaults

Every field has a sensible default baked into the system. The config file is entirely optional — if `.flowti/world-config.json` doesn't exist, all defaults apply. Partial overrides via standard deep-merge.

### Runtime Reload

Config file watched via Obsidian `vault.on('modify')`. On change, all systems re-read their section on the next tick. No restart required — tune agent behavior live.

### Ritual Files

Loaded from `groups.ritualsFolder`. Adding, removing, or editing a ritual file triggers re-parse. RitualSystem maintains an in-memory registry synced with folder contents.

---

## 8. System Wiring & Update Order

### Update Order

Systems run sequentially in the engine's `preframe` hook. Upstream systems produce data for downstream:

```
 1. SensorSystem.update()        — processes vault/CLI events, emits sensor data
 2. NeedsSystem.update()         — ticks need decay/restore, derives mood
 3. DirectorPresence.update()    — tracks cursor position, idle timer
 4. EngagementSystem.update()    — reads needs + sensors + director idle, picks tier
 5. BrainSystem.update()         — reads needs + director + engagement, drives movement/state
 6. RitualSystem.update()        — checks triggers, choreographs active rituals
 7. SocialSystem.update()        — proximity pairs + cluster detection
 8. TalkEngine.update()          — ambient chatter, reads dynamic mood
 9. EmoteSystem.update()         — mood emotes, reads dynamic mood
10. ToolExecutor.update()        — runs queued commands, reports results to sensors
11. BubbleSystem.update()        — cleanup/display (always last)
12. ParticlePool.update()        — particle lifecycle (independent)
```

### Data Flow

```
SensorSystem ──→ EngagementSystem (pending events for agent selection)
             ──→ NeedsSystem (morale effects from test/build results)
             ──→ RitualSystem (event triggers like iteration-50)
             ──→ ToolExecutor (trigger tool suggestions)

NeedsSystem  ──→ BrainSystem (thresholds affect movement, breaks, social drift)
             ──→ TalkEngine (derived mood selects templates)
             ──→ EmoteSystem (derived mood selects emotes)
             ──→ EngagementSystem (low morale agents seek Director)

DirectorPresence ──→ BrainSystem (cursor awareness, facing)
                 ──→ EngagementSystem (idle timer drives escalation)
                 ──→ NeedsSystem (interactions affect morale)

EngagementSystem ──→ BrainSystem (walking agent to camera override)
                 ──→ BubbleSystem (engagement speech bubbles)
                 ──→ ToolExecutor (tier 3 offers queue tool requests)

RitualSystem ──→ BrainSystem (override agent state during ritual)
             ──→ NeedsSystem (social/morale boost for participants)
             ──→ BubbleSystem (ritual speech lines)

ToolExecutor ──→ SensorSystem (results feed back as new events)
             ──→ NeedsSystem (success/failure morale effects)
             ──→ BubbleSystem (result reporting)
```

### System Interfaces

Each new system follows the established pattern:

```typescript
interface GameSystem {
  register(agentName: string, agentData: DashboardAgent): void;
  unregister(agentName: string): void;
  update(deltaMs: number, ...callbacks): void;
}
```

Cross-system reads via getter callbacks passed during engine wiring (e.g., BrainSystem receives `getNeeds: (name: string) => AgentNeeds`). Systems never import each other directly.

### File Structure

```
src/game/systems/
  brain-system.ts          (existing — extended to read needs + director)
  bubble-system.ts         (existing — unchanged)
  camera-system.ts         (existing — unchanged)
  emote-system.ts          (existing — mood input becomes dynamic)
  social-system.ts         (existing — extended with cluster detection)
  particle-system.ts       (existing — unchanged)
  talk/                    (existing — mood input becomes dynamic)
  needs-system.ts          (new)
  sensor-system.ts         (new)
  director-system.ts       (new)
  engagement-system.ts     (new)
  ritual-system.ts         (new)
  tool-executor-system.ts  (new)
src/game/data/
  world-config.ts          (new — config types + defaults + loader)
  sensor-rules.ts          (new — default rule table)
  tool-registry.ts         (new — default tool definitions)
  engagement-templates.ts  (new — tier 1/2/3 template lines)
  huddle-templates.ts      (new — cluster conversation lines)
```

---

## Decision Log

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Needs depth | Personality-weighted (C) | Attributes already exist; weighted needs create emergent individuality |
| Director presence | Cursor spirit + context signals (B+D) | Passive glow for continuous presence, transient bursts for meaningful actions |
| Sensor scope | Project-aware (B) | Watches CLI outputs and project state, not user behavioral patterns |
| Group dynamics | Emergent + configurable rituals (C) | Organic clusters for frequent moments, markdown rituals for special events |
| Engagement posture | Escalating (D) | Respects flow state but prevents world from going silent |
| Tool power | Full with permission gate (C) | Agents propose anything, Director approves — permission system already built |
| Ambient life | Minimal (A) | Focus design budget on behavioral systems, not visual polish |
| Architecture | Flat systems (A) | Follows proven pattern, incremental build, no refactoring risk |
