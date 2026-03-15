/**
 * agent-types.ts — Type definitions for agent entities.
 *
 * The Agent model is designed for cross-domain compatibility:
 *
 * - **Excalibur.js Actor**: Agents carry named components (behaviors/capabilities)
 *   as key-value pairs, matching the ECS component attachment pattern.
 *   Components can represent physics, graphics, AI controllers, or any capability.
 *
 * - **AI Agents (Claude, Cursor)**: The `ai` section holds provider, systemPrompt,
 *   and optional tool restrictions — everything needed to configure
 *   an LLM-backed agent for tool-calling workflows.
 *
 * - **Game Design AI**: The `goals` and `behaviors` fields support goal-oriented
 *   action planning (GOAP), behavior trees, and finite state machines.
 *
 * - **Flowti Component System**: Agents share the component vocabulary:
 *   domain, relationships, properties, actions, and states. An agent is
 *   conceptually a "person" ComponentKind that can act autonomously.
 *
 * Persisted as markdown files with YAML frontmatter in docs/agents/.
 */

// ── Core identity ────────────────────────────────────────────────────

/** Agent type discriminator — human actors vs AI-driven agents. */
export type AgentType = "human" | "ai";

/** Skill entry — key-value pair (skill name: proficiency level). */
export interface AgentSkill {
	name: string;
	/** Proficiency level — free text (e.g., "expert", "3", "d20+5"). */
	level: string;
}

/** A named behavior or capability attached to an agent (ECS component pattern). */
export interface AgentComponent {
	/** Component identifier (e.g., "movement", "perception", "tool-caller"). */
	name: string;
	/** Component type for categorization (e.g., "behavior", "sensor", "actuator"). */
	type?: string;
	/** Configuration parameters for this component. */
	config?: Record<string, unknown>;
}

/** A goal the agent pursues (GOAP / utility AI pattern). */
export interface AgentGoal {
	/** Goal identifier (e.g., "complete-review", "patrol-area"). */
	name: string;
	/** Priority weight — higher = more important (default: 1). */
	priority?: number;
	/** Completion condition description. */
	condition?: string;
}

/** Permission mode for agent tool calls. */
export type PermissionMode = "ask" | "auto-allow" | "trust";

/** Policy that determines how an agent's tool calls are approved. */
export interface AgentPermissionPolicy {
	readonly mode: PermissionMode;
	readonly autoAllowTools?: readonly string[];
}

/** AI-specific configuration for LLM-backed agents. */
export interface AgentAIConfig {
	/** AI provider (e.g., "anthropic", "openai", "local"). */
	provider?: string;
	/** System prompt / persona instructions. */
	systemPrompt?: string;
	/** Output format for Claude CLI. Defaults to "stream-json". */
	outputFormat?: "text" | "stream-json";
	/** Optional tool restrictions for autonomous runs. */
	allowedTools?: string[];
	/** Permission model for tool calls (ask / auto-allow / trust). */
	permissions?: AgentPermissionPolicy;
}

/** An explicit relationship to another agent or component. */
export interface AgentRelationship {
	/** Target agent or component name. */
	target: string;
	/** Relationship type. */
	type: "supervises" | "reports-to" | "collaborates" | "delegates-to" | "uses" | "depends-on";
	/** Brief description. */
	description?: string;
}

/** A task the agent can propose in the Assign Task menu. Phase-filtered by iteration status. */
export interface SuggestedTask {
	/** Task description shown to the user. */
	name: string;
	/** Iteration phases where this task is relevant. Empty = all phases. */
	phases: string[];
}

/** A markdown file in the agent's inventory. */
export interface InventoryItem {
	/** Path to the markdown file, relative to vault root. */
	path: string;
	/** Optional display label (defaults to filename). */
	label?: string;
}

/** RPG-style character attributes (1-20 scale). */
export interface AgentAttributes {
	/** Strength — assertiveness, force of will. */
	str?: number;
	/** Intelligence — analytical capability, pattern recognition. */
	int?: number;
	/** Wisdom — experience-based judgement, insight. */
	wis?: number;
	/** Charisma — communication, persuasiveness, leadership. */
	cha?: number;
	/** Dexterity — adaptability, speed, nimbleness. */
	dex?: number;
	/** Constitution — persistence, endurance, resilience. */
	con?: number;
}

// ── Definition and Summary ───────────────────────────────────────────

/** Full agent definition used for creation/editing. */
export interface AgentDefinition {
	name: string;
	agentType: AgentType;
	description: string;
	/** Business domain (e.g., "development", "qa", "design"). */
	domain?: string;
	skills: AgentSkill[];
	tools: string[];
	roles: string[];
	/** Iteration lifecycle phases this agent is most active in (e.g., "planned", "in-progress", "in-review"). */
	preferredPhases?: string[];
	/** RPG-style character attributes (STR, INT, WIS, CHA, DEX, CON). */
	attributes?: AgentAttributes;
	/** Character persona name (e.g., "Alice") — displayed as wikilink in frontmatter. */
	persona?: string;
	/** Current mood / disposition (e.g., "vigilant", "cheerful", "skeptical"). */
	mood?: string;
	/** Character personality traits that shape how the agent communicates. */
	personality?: string[];
	/** Experience points — uncapped, grows as the agent completes work. */
	experience?: number;
	/** Attached components — ECS-style named capabilities. */
	components?: AgentComponent[];
	/** Agent goals — what this agent pursues. */
	goals?: AgentGoal[];
	/** Named behaviors / behavior tree references. */
	behaviors?: string[];
	/** AI-specific config (model, prompt, provider). */
	ai?: AgentAIConfig;
	/** Relationships to other agents or components. */
	relationships?: AgentRelationship[];
	/** Standard tasks this agent can perform, shown in the Assign Task menu. */
	suggestedTasks?: SuggestedTask[];
	/** Markdown files this agent owns or carries. */
	inventory?: InventoryItem[];
	/** Freeform tags for categorization (e.g., PDCA cycle: "plan", "do", "check", "act"). */
	tags?: string[];
}

/** Lightweight agent summary returned by list operations. */
export interface AgentSummary {
	name: string;
	agentType: AgentType;
	description: string;
	domain?: string;
	skills: AgentSkill[];
	tools: string[];
	roles: string[];
	/** Iteration lifecycle phases this agent is most active in. */
	preferredPhases?: string[];
	/** RPG-style character attributes. */
	attributes?: AgentAttributes;
	/** Character persona name. */
	persona?: string;
	/** Current mood / disposition. */
	mood?: string;
	/** Character personality traits. */
	personality?: string[];
	/** Experience points (uncapped). */
	experience?: number;
	components?: AgentComponent[];
	goals?: AgentGoal[];
	behaviors?: string[];
	ai?: AgentAIConfig;
	relationships?: AgentRelationship[];
	suggestedTasks?: SuggestedTask[];
	/** Markdown files this agent owns or carries. */
	inventory?: InventoryItem[];
	/** Freeform tags for categorization. */
	tags?: string[];
	file: string;
}
