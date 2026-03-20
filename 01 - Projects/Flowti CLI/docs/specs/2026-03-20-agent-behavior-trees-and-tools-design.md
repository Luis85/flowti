# Agent Behavior Trees & World Tools — Design Spec

## Overview

Replace the rule-based decision engine with mistreevous behavior trees. Give agents real tools (read file, write file, open in vault, query LLM, drop artifact). The brain ticks locally and never blocks on LLM — async queries return `RUNNING` and resolve on future ticks. Without LLM, agents fall back to template-based content generation. Personality (D&D attributes) shapes behavior through parameterized thresholds, not separate trees.

## Goals

1. Agents autonomously read, write, and produce artifacts driven by their goals and needs
2. LLM enhances but never gates agent behavior — brain always ticks
3. Agents drop scroll sprites in the game world that users click to open files
4. Personality genuinely affects productivity and behavior, not just cosmetics
5. Zero runtime dependencies added to CLI (mistreevous is the single addition)

## Non-Goals

- Full game-loop integration (game rendering stays in the Plugin; this spec covers the CLI brain/tool layer)
- Replacing the existing talk template system (it coexists — BT triggers bubbles, templates provide content)
- Multiplayer/networked agent coordination

## Dependencies

This spec depends on the **Agent Liveness Systems** spec (`2026-03-20-agent-liveness-systems-design.md`) being implemented first. Specifically:

- **`AgentNeeds`** type (energy, social, focus, morale — 0-100 scale) — required by the `NeedsSatisfaction` branch and all needs-gating conditions
- **`SensorRule` / sensor event pipeline** — required by the `UrgentReaction` branch

If the liveness systems are not yet in the CLI codebase, Phase 1 of this spec should exclude the `NeedsSatisfaction` and `UrgentReaction` branches. Those branches activate in Phase 2 once the liveness systems land.

---

## 1. Mistreevous Integration

### 1.1 Dependency

```bash
cd "01 - Projects/Flowti CLI"
npm install --save mistreevous
```

The CLI already has three runtime dependencies (`ink`, `@inkjs/ui`, `react`). Mistreevous is a domain-appropriate addition — lightweight (no transitive deps, TypeScript-native, ~15KB minified) and non-trivial to reimplement correctly.

**Alternative:** If the dependency count must stay minimal, mistreevous can be vendored (copy source into `src/vendor/mistreevous/`) instead of installed via npm.

### 1.2 Module Location

```
src/domain/agents/behavior-tree/
  bt-types.ts          — BTAgent interface, context types
  bt-factory.ts        — Creates BT per agent from goals + personality
  bt-agent.ts          — BTAgent object factory (binds tools to methods)
  bt-tick.ts           — Tick orchestration (step + world-state emission)
  subtrees/
    goal-review.ts     — MDSL subtree for "review" goal type
    goal-summarize.ts  — MDSL subtree for "summarize" goal type
    goal-plan.ts       — MDSL subtree for "plan" goal type
    goal-implement.ts  — MDSL subtree for "implement" goal type
    goal-monitor.ts    — MDSL subtree for "monitor" goal type
    goal-report.ts     — MDSL subtree for "report" goal type
    social.ts          — Social interaction subtree
    needs.ts           — Needs satisfaction subtree
    idle.ts            — Idle behavior subtree (wander, emote, chatter)
    urgent.ts          — Sensor-triggered urgent reaction subtree
  templates/
    template-engine.ts — Template-based content generation (LLM fallback)
```

All files are domain-layer pure. No I/O — tool implementations receive deps via injection.

### 1.3 Tree Definition Format

Trees use MDSL (mistreevous's minimal DSL) stored as string constants in TypeScript files. This keeps trees version-controlled, type-safe at the module boundary, and co-located with their subtree logic.

### 1.4 Master Tree Structure

Every agent gets one master tree composed from subtrees:

```
root {
  selector {
    branch [UrgentReaction]
    branch [ActiveGoal]
    branch [SocialBehavior]
    branch [NeedsSatisfaction]
    branch [IdleBehavior]
  }
}
```

Priority order: urgent reactions > goal work > social > needs recovery > idle. The selector tries top-to-bottom; the first branch that doesn't immediately fail wins the tick.

---

## 2. Agent Toolbox

### 2.1 Tool Interface

Each tool is a method on the BTAgent object. Mistreevous calls them as leaf node actions.

```typescript
interface AgentToolDeps {
  readonly disk: IFileSystem;
  readonly paths: IPaths;
  readonly clock: IClock;
  readonly providerRegistry?: IProviderRegistry;
  readonly worldState: IWorldStateManager;
  readonly checkPermission: (tool: string) => PermissionVerdict;
}
```

The `checkPermission` closure is created at BTAgent construction time by pre-binding the agent's `AgentPermissionPolicy`, accumulated `PermissionGrant[]`, and foreground status:

```typescript
// In bt-agent.ts factory
const checkPermission = (tool: string): PermissionVerdict =>
  permissionEngine.checkPermission(policy, grants, tool, foreground);
```

This wraps the raw 4-arg `checkPermission(policy, grants, tool, foreground)` from `permission-engine.ts` into the single-arg form the BT actions need.

### 2.2 Core Tools

| Tool | Method | Returns | Side Effect |
|------|--------|---------|-------------|
| Read file | `ReadFile()` | `SUCCEEDED` / `FAILED` | Stores content on `context.lastFileContent` |
| Write file | `WriteFile()` | `SUCCEEDED` / `FAILED` | Writes file to disk, stores path on `context.lastWrittenPath` |
| Open in vault | `OpenInVault()` | `SUCCEEDED` | Emits `"open-file"` world-state action (Plugin listens) |
| Query LLM | `QueryLLM()` | `RUNNING` → `SUCCEEDED` / `FAILED` | Async. Stores response on `context.lastLLMResult` |
| Drop artifact | `DropArtifact()` | `SUCCEEDED` | Creates artifact entity in world state |
| Generate from template | `GenerateFromTemplate()` | `SUCCEEDED` | Stores template output on `context.lastLLMResult` (same slot as LLM) |

### 2.3 Permission Gating

Tools pass through the existing `permission-engine.ts`:

- `ReadFile` — auto-allowed (safe tool)
- `WriteFile` — respects agent's `AgentPermissionPolicy`
- `OpenInVault` — auto-allowed (read-only UI action)
- `QueryLLM` — respects policy (uses LLM provider tokens)
- `DropArtifact` — auto-allowed (world-state only, no disk write beyond the already-permitted WriteFile)

If permission is `"prompt-user"` and agent is background, the tool returns `FAILED` and the BT falls through to alternatives. Permission requests queue as `pendingPermissions` on the agent state (existing pattern).

### 2.4 Tool Execution Flow

```
BT leaf node called
  → check permission
    → denied: return FAILED
    → allowed: execute tool via injected deps
      → success: update context, emit world-state action, return SUCCEEDED
      → error: return FAILED
```

---

## 3. BTAgent Object (Blackboard)

The BTAgent is the object mistreevous binds to. It serves as both the callback target and the shared context (blackboard). One BTAgent per spawned agent.

### 3.1 Context Fields

```typescript
// Defined in bt-types.ts — these types do NOT exist in the CLI yet.
// AgentNeeds comes from the liveness-systems spec (prerequisite).
// BTSensorEvent is CLI-local; the Plugin has its own SensorEventData.

interface AgentNeeds {
  energy:  number;  // 0–100, starts at 80
  social:  number;  // 0–100, starts at 60
  focus:   number;  // 0–100, starts at 70
  morale:  number;  // 0–100, starts at 75
}

interface BTSensorEvent {
  readonly type: string;       // e.g. "test-failed", "build-complete", "agent-mentioned"
  readonly source: string;     // originating agent or system
  readonly timestamp: string;  // ISO
  readonly data: Record<string, unknown>;
}

type LLMSlotState = "idle" | "pending" | "resolved" | "failed";

interface LLMSlot {
  state: LLMSlotState;
  process: LLMProcess | null;
  result: string | null;
}

interface BTAgentContext {
  // Identity (read-only, set at creation)
  readonly name: string;
  readonly persona: string | undefined;
  readonly domain: string | undefined;
  readonly attributes: AgentAttributes;
  readonly personality: readonly string[];
  readonly experience: number;

  // Needs (updated by needs system each tick — Phase 2, requires liveness-systems)
  needs: AgentNeeds;

  // Goals
  goals: readonly AgentGoal[];
  activeGoal: AgentGoal | null;
  activeGoalFile: string | null;  // resolved file path for current goal

  // Sensor events (Phase 2, requires liveness-systems sensor pipeline)
  pendingEvent: BTSensorEvent | null;

  // Social
  nearbyAgents: readonly string[];

  // Tool I/O (the blackboard slots)
  lastFileContent: string | null;
  lastLLMResult: string | null;
  lastWrittenPath: string | null;
  workingFilePath: string | null;

  // LLM async state machine (replaces raw _llm* booleans)
  llmSlot: LLMSlot;
}
```

### 3.2 Conditions

```typescript
// Needs gating — thresholds modified by attributes
HasEnoughEnergy: () => this.needs.energy > (30 - (this.attributes.con ?? 10) / 2);
HasEnoughFocus:  () => this.needs.focus > (20 - (this.attributes.int ?? 10) / 3);
HasEnoughMorale: () => this.needs.morale > 10;

// Goal state
HasActiveGoal:   () => this.activeGoal !== null;
HasGoalFile:     () => this.activeGoalFile !== null;

// LLM availability
HasLLMProvider:  () => hasLLMProvider(this.deps.providerRegistry);

// Social
HasNearbyAgent:  () => this.nearbyAgents.length > 0;
HasPendingEvent: () => this.pendingEvent !== null;

// Tool output
HasFileContent:  () => this.lastFileContent !== null;
HasLLMResult:    () => this.llmSlot.state === "resolved" && this.llmSlot.result !== null;
```

### 3.3 Attribute-Derived Parameters

| Attribute | What it Modifies | Formula |
|-----------|-----------------|---------|
| CON | Energy gate threshold | `30 - con/2` (range: 20-30) |
| INT | Focus gate threshold | `20 - int/3` (range: 13-20) |
| INT | Prompt richness | High INT assembles more context files into LLM prompt |
| WIS | Goal priority sorting | High WIS picks highest-priority goal; low WIS picks randomly |
| WIS | Morale resilience | Morale gate: `10 + (10 - wis)/2` |
| CHA | Social branch weight | `lotto` weight for social = `cha * 2` |
| CHA | Chatter frequency | Idle chatter lotto weight = `cha * 1.5` |
| DEX | Wait durations | All `wait` nodes: `baseDuration * (1 - dex/40)` (range: 0.5x-1x) |
| STR | Auto-open assertiveness | High STR (>14): agent auto-opens file after drop |
| STR | Goal selection | High STR takes harder goals first |

---

## 4. Goal Decomposition

### 4.1 Goal Types

```typescript
type GoalType = "review" | "summarize" | "plan" | "implement" | "monitor" | "report";
```

Each goal in the agent's `goals[]` has a `name` that is parsed into a type + target:
- `"review iteration plan"` → type: `review`, target: iteration plan file
- `"summarize health report"` → type: `summarize`, target: health report
- `"monitor test results"` → type: `monitor`, target: test output

### 4.2 Goal → File Resolution

`PickGoalFile` action resolves the goal's target to an actual vault file path:
- Uses keyword matching against known project paths (iteration docs, reports, configs)
- Falls back to knowledgebase search if no direct match
- Stores result on `context.activeGoalFile`

### 4.3 Subtree Pattern

All goal subtrees follow the same skeleton:

```
root [<GoalType>Goal] {
  sequence {
    action [PickGoalFile]
    action [ReadFile]
    selector {
      sequence {
        condition [HasLLMProvider]
        action [QueryLLM]
      }
      action [GenerateFromTemplate]
    }
    action [WriteFile]
    action [DropArtifact]
    action [SpeakBubble]
  }
}
```

Variations per goal type:
- **review**: Prompt asks for assessment + recommendations. Template extracts frontmatter status + structure summary.
- **summarize**: Prompt asks for concise summary. Template generates bullet points from headings.
- **plan**: Prompt asks for actionable steps. Template generates checklist from goal description.
- **implement**: Prompt asks for code/content changes. Template generates scaffold/stub.
- **monitor**: Skips WriteFile. Reads target, checks for changes since last read, speaks result.
- **report**: Reads multiple files (iterates), aggregates, writes combined report.

### 4.4 Template Engine (LLM Fallback)

`GenerateFromTemplate` produces useful (not placeholder) content without LLM:

```typescript
interface TemplateContext {
  goalType: GoalType;
  fileName: string;
  fileContent: string;
  agentName: string;
  persona: string | undefined;
  mood: string;
  timestamp: string;
}

function generateFromTemplate(ctx: TemplateContext): string;
```

Templates are goal-type-specific markdown generators:
- **review template**: Extracts YAML frontmatter fields, counts sections/headings, checks for TODOs/FIXMEs, generates a status summary with the agent's persona voice.
- **summarize template**: Extracts first paragraph + all headings as bullet points + word count.
- **plan template**: Generates numbered checklist from goal description keywords.
- **report template**: Aggregates file metadata (dates, sizes, statuses) into a table.

The output is useful standalone — not "sorry, LLM unavailable" but real analysis at a shallower depth.

---

## 5. Async LLM — The RUNNING Pattern

### 5.1 Tick-by-Tick Flow

**Tick 1 — Fire:**
1. `QueryLLM` assembles prompt from context (`lastFileContent`, goal, identity, mood)
2. Calls `providerRegistry.select({ preferred: agent.ai?.provider, taskType: "autonomous" })`
3. Calls `provider.execute(request)` — returns `LLMProcess` immediately
4. Sets `context.llmSlot = { state: "pending", process, result: null }`
5. Attaches `.result.then()` callback that sets `state: "resolved"` or `state: "failed"`
6. Emits world-state action `"thinking"` (game shows lightbulb pulse)
7. Returns `State.RUNNING`

**Ticks 2-N — Poll:**
1. BT re-enters `QueryLLM` (mistreevous revisits RUNNING nodes each step)
2. **Guard:** checks `llmSlot.state` — if still `"pending"` → returns `State.RUNNING`
3. If `"resolved"` → stores `llmSlot.result` into `lastLLMResult`, resets slot to idle, returns `State.SUCCEEDED`
4. If `"failed"` → resets slot to idle, returns `State.FAILED`

**Important:** The guard on tick 1 checks `llmSlot.state === "idle"` to start the async operation. On ticks 2-N, `state === "pending"` so the action polls instead of re-firing. This prevents duplicate LLM requests.

**Timeout:** Default 60s. After timeout, promise rejects, action returns `FAILED`, selector falls to template.

### 5.2 Non-Blocking Guarantee

- `BehaviourTree.step()` is synchronous and returns immediately
- LLM runs in a background child process (existing `spawnBackground`)
- The `.result.then()` callback transitions `llmSlot.state` from `"pending"` to `"resolved"` or `"failed"`; the tick reads the state synchronously
- Other branches (social, needs, idle) can execute in parallel ticks while LLM is pending — the master tree uses `selector` so only the winning branch runs, but if the `ActiveGoal` branch is RUNNING, the whole tree stays RUNNING and re-enters that branch next tick
- If an urgent event fires while LLM is running, the brain handles it on the next tick when the tree resets

### 5.3 Prompt Assembly

Prompt quality scales with INT attribute:

**Base prompt (all agents):**
```
You are {persona} ({name}), a {domain} specialist.
Goal: {goalType} — {goalName}
File: {fileName}

{fileContent}

{goalTypeInstruction}
```

**INT >= 14 (enhanced context):**
- Includes related files (same directory, referenced in content)
- Includes project health summary
- Includes iteration status

**INT >= 18 (expert context):**
- Cross-references other agents' recent artifacts
- Includes historical goal outcomes

---

## 6. World Artifacts

### 6.1 Artifact Entity

When `DropArtifact` executes:

```typescript
worldState.updateEntity(`artifact-${context.name}-${clock.ms()}`, "artifact", {
  filePath: context.lastWrittenPath,
  droppedBy: context.name,
  droppedAt: clock.iso(),
  goalType: context.activeGoal?.type ?? "note",
  position: "near-agent",  // game resolves to world coordinates
  picked: false,
});
```

### 6.2 World-State Action

```typescript
worldState.emitAction({
  id: `drop-${context.name}-${clock.ms()}`,
  agentName: context.name,
  timestamp: clock.iso(),
  type: "artifact-dropped",
  data: {
    filePath: context.lastWrittenPath,
    goalType: context.activeGoal?.type ?? "note",
    entityId: artifactEntityId,
  },
});
```

### 6.3 Type Extensions

**Extend `WorldEntityType`** (currently `"agent" | "project" | "iteration"`):

```typescript
export type WorldEntityType = "agent" | "project" | "iteration" | "artifact";
```

**Extend `AgentActionType`** (currently 12 values: thinking, speaking, asking, using-tool, tool-complete, requesting-permission, permission-granted, permission-denied, task-started, task-completed, idle, error):

```typescript
export type AgentActionType =
  | /* ...existing 12... */
  | "artifact-dropped"    // Agent placed a file in the world
  | "file-read"           // Agent read a vault file
  | "file-written"        // Agent wrote a vault file
  | "file-opened"         // Agent requested file open in vault
  | "goal-started"        // Agent began pursuing a goal
  | "goal-completed"      // Agent finished a goal
  | "template-generated"; // Agent used template fallback (no LLM)
```

**Extend `STATUS_MAP`** in `world-state-manager.ts` (currently 13 entries):

```typescript
// Add to STATUS_MAP
"artifact-dropped": () => ({ state: "idle", currentAction: "idle" }),
"file-read":        () => ({ state: "busy", currentAction: "reading" }),
"file-written":     () => ({ state: "busy", currentAction: "writing" }),
"file-opened":      () => ({ state: "busy", currentAction: "opening" }),
"goal-started":     (a) => ({ state: "busy", currentAction: "goal", goal: a.data.goalName }),
"goal-completed":   () => ({ state: "idle", currentAction: "idle" }),
"template-generated": () => ({ state: "busy", currentAction: "generating" }),
```

### 6.4 Game-Side Rendering (Plugin — out of scope for CLI implementation)

The Plugin's game layer receives artifact entities via `DataProvider.onEntityUpdate()` and renders them as `ArtifactActor` instances:

- **Sprite variants** by `goalType`: scroll (review/summarize), blueprint (plan/implement), report (monitor/report)
- **Spawn animation**: float-down from agent's position, gentle bounce on landing
- **Domain glow**: subtle radial glow in agent's domain color
- **Hover tooltip**: `"{fileName} — by {persona}"`
- **Click handler**: `app.workspace.openLinkText(filePath)` opens file in Obsidian
- **Pickup**: user click marks `picked: true` on entity; sprite fades out over 500ms

### 6.5 Assertiveness Modifier

Agents with STR >= 14 auto-invoke `OpenInVault` after dropping an artifact — proactively showing their work. Lower STR agents drop silently and let the user discover it.

---

## 7. Integration Points

### 7.1 Worker Manager

`worker-manager.ts` changes:
- On agent spawn: create `BTAgent` + `BehaviourTree` via `bt-factory.ts`
- Replace `processLlmMessage()` / `processNpcMessage()` dispatch with `btTick()` on interval
- **Tick interval: 3 seconds** (configurable via `BT_TICK_INTERVAL_MS`). This balances responsiveness against CPU cost — LLM queries take 10-60s so faster ticks only add overhead. The Plugin's game loop (16ms frames) is a separate concern; the CLI brain ticks independently.
- `btTick()` calls `tree.step()`, collects emitted world-state actions, forwards them
- Existing `dispatchWorldEvent()` feeds sensor events into `BTAgent.pendingEvent`

### 7.1.1 Relationship to agent-process-loop.ts

The existing `createAgentProcessLoop()` manages long-lived agent child processes via JSONL stdin/stdout. The BT brain is a **separate execution model** — it ticks in-process, not via child process IPC.

- **Phase 1:** BT agents and process-loop agents coexist. The worker manager checks `agent.behaviors[]` to decide which model to use. Agents with behaviors get BT; others keep the process loop.
- **Phase 2:** Once all agents migrate to BT, the process loop becomes the LLM execution backend only — `QueryLLM` uses it to run provider requests without blocking the tick.

### 7.2 Decision Engine Replacement

`decision-engine.ts` is superseded by the BT. The migration path:
- Phase 1: BT runs alongside decision engine for new agents with `behaviors[]` defined
- Phase 2: Migrate all agents to BT, remove decision engine

The `LLM_RULES` and `NPC_RULES` map directly to BT branches:
- `task-assigned → execute-task` becomes the `ActiveGoal` branch
- `message-received → respond` stays in the talk system (BT doesn't replace interactive conversation)
- `agent-mentioned → review` becomes a sensor-triggered `UrgentReaction`

### 7.3 Needs System

**Prerequisite:** The needs system does not yet exist in the CLI codebase. It is defined in the liveness-systems spec (`2026-03-20-agent-liveness-systems-design.md`) and must be implemented before the BT's `NeedsSatisfaction` branch and needs-gating conditions can function.

Once implemented, the needs system provides decay/restore rates. The BT reads needs values as conditions. The needs system updates values each tick *before* the BT steps — so the BT always sees current needs.

**Phase 1 fallback:** Without the needs system, the `NeedsSatisfaction` branch is stubbed out (always returns `FAILED`) and needs-gating conditions (`HasEnoughEnergy`, `HasEnoughFocus`, `HasEnoughMorale`) default to `true`. This lets the `ActiveGoal` and `IdleBehavior` branches run unimpeded.

### 7.3.1 Sensor Event Pipeline

**Prerequisite:** The sensor system does not yet exist in the CLI codebase. It is defined in the liveness-systems spec.

Once implemented, CLI-side events reach the BT via `dispatchWorldEvent()` on the worker manager. The worker manager translates incoming `AgentAction` events into `BTSensorEvent` objects and sets them on `BTAgentContext.pendingEvent`. The `UrgentReaction` branch checks `HasPendingEvent` and responds.

**Phase 1 fallback:** Without the sensor system, `pendingEvent` is always `null` and the `UrgentReaction` branch is skipped every tick. The BT still functions — it just lacks interrupt-driven reactions.

### 7.4 Talk System Coexistence

The talk template engine (1,778 phrases in Plugin) stays for ambient chatter. The BT's `SpeakBubble` action emits a world-state action `{ type: "speaking", data: { text, source: "bt" } }`. The **CLI only emits the action** — all visual bubble rendering is a Plugin concern.

- **Template-sourced speech:** BT decides *when* to speak; the Plugin's talk engine decides *what* to say (template selection by mood/domain/personality).
- **LLM-sourced speech:** `QueryLLM` result is included in the action's `data.text` field, rendered directly as a speech bubble by the Plugin.
- **CLI-only mode (no Plugin):** Speech actions are logged to the agent's data file but not rendered.

### 7.5 Open-File Protocol

`OpenInVault` emits a world-state action `{ type: "file-opened", data: { filePath } }`. The Plugin listens via `DataProvider.onAction()` and calls `app.workspace.openLinkText(filePath)`. This is a one-way signal from CLI → Plugin with no acknowledgment needed.

---

## 8. Testing Strategy

### 8.1 Unit Tests

- **bt-agent.ts**: Test each tool method in isolation with mock deps. Verify context updates, permission checks, state returns.
- **bt-factory.ts**: Test tree creation from different goal/personality combinations. Verify MDSL is valid (mistreevous parses without error).
- **bt-tick.ts**: Test tick orchestration with mock BT. Verify world-state actions emitted correctly.
- **subtrees/**: Test each subtree with a mock BTAgent. Step through tree, verify action sequence.
- **template-engine.ts**: Test template generation for each goal type with sample file content.

### 8.2 Integration Tests

- Full BT tick cycle: spawn agent → assign goal → tick N times → verify file written + artifact dropped
- LLM async: mock provider with delayed resolution → verify RUNNING ticks → verify SUCCEEDED after resolve
- LLM fallback: no provider registered → verify template path taken → verify artifact still produced
- Permission denied: write-file denied → verify BT handles FAILED gracefully
- Needs gating: set energy to 10 → verify goal branch skipped → needs branch taken

### 8.3 Existing Test Preservation

Decision engine tests (`decision-engine.test.ts`) remain passing — the engine is not removed in Phase 1. New BT tests are additive.

---

## 9. File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/domain/agents/behavior-tree/bt-types.ts` | BTAgent interface, context types, GoalType |
| Create | `src/domain/agents/behavior-tree/bt-agent.ts` | BTAgent object factory (tools + conditions + context) |
| Create | `src/domain/agents/behavior-tree/bt-factory.ts` | Creates BehaviourTree from agent definition |
| Create | `src/domain/agents/behavior-tree/bt-tick.ts` | Tick orchestration, world-state emission |
| Create | `src/domain/agents/behavior-tree/subtrees/goal-review.ts` | MDSL + logic for review goal |
| Create | `src/domain/agents/behavior-tree/subtrees/goal-summarize.ts` | MDSL + logic for summarize goal |
| Create | `src/domain/agents/behavior-tree/subtrees/goal-plan.ts` | MDSL + logic for plan goal |
| Create | `src/domain/agents/behavior-tree/subtrees/goal-implement.ts` | MDSL + logic for implement goal |
| Create | `src/domain/agents/behavior-tree/subtrees/goal-monitor.ts` | MDSL + logic for monitor goal |
| Create | `src/domain/agents/behavior-tree/subtrees/goal-report.ts` | MDSL + logic for report goal |
| Create | `src/domain/agents/behavior-tree/subtrees/social.ts` | Social interaction subtree |
| Create | `src/domain/agents/behavior-tree/subtrees/needs.ts` | Needs satisfaction subtree |
| Create | `src/domain/agents/behavior-tree/subtrees/idle.ts` | Idle behavior subtree |
| Create | `src/domain/agents/behavior-tree/subtrees/urgent.ts` | Urgent reaction subtree |
| Create | `src/domain/agents/behavior-tree/templates/template-engine.ts` | LLM fallback content generation |
| Modify | `src/domain/agents/world-state-types.ts` | Extend `WorldEntityType` with `"artifact"`, extend `AgentActionType` with 7 new values |
| Modify | `src/infrastructure/worker-manager.ts` | BT creation, tick interval loop, coexistence with agent-process-loop |
| Modify | `src/infrastructure/world-state-manager.ts` | Add 7 `STATUS_MAP` entries for new action types |
