/**
 * bt-factory.ts — Creates a BehaviourTree from an agent definition.
 *
 * Composes all subtrees into the master tree MDSL, creates the BTAgent,
 * and returns both the tree and agent object.
 * Domain-layer pure — mistreevous is a pure computation library.
 */

import { createTree, type BehaviourTree } from "./bt-service.js";
import { createBTAgent, type BTAgentObject } from "./bt-agent.js";
import type { AgentToolDeps, BtAgentBase, BTAgentDef } from "./bt-types.js";

// Subtree imports
import { URGENT_SUBTREE } from "./subtrees/urgent.js";
import { REVIEW_SUBTREE } from "./subtrees/goal-review.js";
import { SUMMARIZE_SUBTREE } from "./subtrees/goal-summarize.js";
import { PLAN_SUBTREE } from "./subtrees/goal-plan.js";
import { IMPLEMENT_SUBTREE } from "./subtrees/goal-implement.js";
import { MONITOR_SUBTREE } from "./subtrees/goal-monitor.js";
import { REPORT_SUBTREE } from "./subtrees/goal-report.js";
import { SOCIAL_SUBTREE } from "./subtrees/social.js";
import { IDLE_SUBTREE } from "./subtrees/idle.js";
import { IDLE_WANDER_SUBTREE } from "./subtrees/idle-wander.js";
import { BREAK_ROUTINE_SUBTREE } from "./subtrees/break-routine.js";
import { TALKING_TIMEOUT_SUBTREE } from "./subtrees/talking-timeout.js";
import { NEEDS_ENERGY_SUBTREE } from "./subtrees/needs-energy.js";
import { NEEDS_HUNGER_SUBTREE } from "./subtrees/needs-hunger.js";
import { NEEDS_THIRST_SUBTREE } from "./subtrees/needs-thirst.js";
import { NEEDS_SOCIAL_SUBTREE } from "./subtrees/needs-social.js";
import { NEEDS_FOCUS_SUBTREE } from "./subtrees/needs-focus.js";
import { NEEDS_MORALE_SUBTREE } from "./subtrees/needs-morale.js";
import { WORK_CYCLE_SUBTREE } from "./subtrees/work-cycle.js";
import { JOURNEY_EXECUTION_SUBTREE } from "./subtrees/journey-execution.js";
import { MERCHANT_VISIT_SUBTREE } from "./subtrees/merchant-visit.js";
import { INTERACTION_SUBTREE } from "./subtrees/interaction.js";

export interface AgentBT {
	readonly tree: BehaviourTree;
	readonly agent: BtAgentBase;
}

/** Concrete BT produced by createAgentBT — agent is always a full BTAgentObject. */
export interface FullAgentBT extends AgentBT {
	readonly agent: BTAgentObject;
}

/**
 * Build the master MDSL that references subtrees.
 * The ActiveGoal branch uses PickGoal to set the active goal, then
 * a selector tries each goal subtree — the matching one succeeds
 * because PickGoalFile resolves based on the active goal's type.
 */
function buildMasterMDSL(): string {
	return `root {
	selector {
		branch [UrgentReaction]
		branch [TalkingTimeout]
		branch [BreakRoutine]
		branch [NeedsEnergy]
		branch [NeedsHunger]
		branch [NeedsThirst]
		branch [NeedsSocial]
		branch [NeedsFocus]
		branch [NeedsMorale]
		branch [JourneyExecution]
		branch [WorkCycle]
		branch [MerchantVisit]
		sequence {
			condition [HasEnoughEnergy]
			condition [HasEnoughFocus]
			condition [HasEnoughMorale]
			action [PickGoal]
			selector {
				branch [ReviewGoal]
				branch [SummarizeGoal]
				branch [PlanGoal]
				branch [ImplementGoal]
				branch [MonitorGoal]
				branch [ReportGoal]
			}
		}
		branch [InteractionIntent]
		branch [SocialBehavior]
		branch [IdleBehavior]
		branch [IdleWander]
	}
}`;
}

/** Collect all subtree MDSL definitions into one string for mistreevous. */
function collectSubtrees(): string {
	return [
		URGENT_SUBTREE,
		TALKING_TIMEOUT_SUBTREE,
		BREAK_ROUTINE_SUBTREE,
		NEEDS_ENERGY_SUBTREE,
		NEEDS_HUNGER_SUBTREE,
		NEEDS_THIRST_SUBTREE,
		NEEDS_SOCIAL_SUBTREE,
		NEEDS_FOCUS_SUBTREE,
		NEEDS_MORALE_SUBTREE,
		JOURNEY_EXECUTION_SUBTREE,
		WORK_CYCLE_SUBTREE,
		MERCHANT_VISIT_SUBTREE,
		REVIEW_SUBTREE,
		SUMMARIZE_SUBTREE,
		PLAN_SUBTREE,
		IMPLEMENT_SUBTREE,
		MONITOR_SUBTREE,
		REPORT_SUBTREE,
		INTERACTION_SUBTREE,
		SOCIAL_SUBTREE,
		IDLE_SUBTREE,
		IDLE_WANDER_SUBTREE,
	].join("\n\n");
}

export function createAgentBT(agent: BTAgentDef, deps: AgentToolDeps): FullAgentBT {
	const btAgent = createBTAgent(agent, deps);
	const masterMDSL = buildMasterMDSL();
	const allMDSL = masterMDSL + "\n\n" + collectSubtrees();
	// BTAgentObject satisfies the mistreevous Agent contract at runtime
	// (all condition/action methods are properties). The Agent type requires
	// an index signature that our strict interface omits, so we bridge via unknown.
	const tree = createTree(allMDSL, btAgent);
	return { tree, agent: btAgent };
}
