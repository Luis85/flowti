/**
 * agent-types.ts — Type definitions for agent entities.
 *
 * The Agent model is designed for cross-domain compatibility:
 *
 * - **Excalibur.js Actor**: Agents carry named components (behaviors/capabilities)
 *   as key-value pairs, matching the ECS component attachment pattern.
 *   Components can represent physics, graphics, AI controllers, or any capability.
 *
 * - **AI Agents (Claude, Cursor)**: The `ai` section holds model, systemPrompt,
 *   provider, contextWindow, and maxTokens — everything needed to configure
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

/** AI-specific configuration for LLM-backed agents. */
export interface AgentAIConfig {
	/** Model identifier (e.g., "claude-sonnet-4-20250514", "gpt-4o"). */
	model?: string;
	/** AI provider (e.g., "anthropic", "openai", "local"). */
	provider?: string;
	/** System prompt / persona instructions. */
	systemPrompt?: string;
	/** Context window size in tokens. */
	contextWindow?: number;
	/** Max output tokens per response. */
	maxTokens?: number;
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
	components?: AgentComponent[];
	goals?: AgentGoal[];
	behaviors?: string[];
	ai?: AgentAIConfig;
	relationships?: AgentRelationship[];
	file: string;
}
