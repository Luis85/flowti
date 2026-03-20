/**
 * bt-factory.ts — Creates a BehaviourTree from an agent definition.
 *
 * Composes all subtrees into the master tree MDSL, creates the BTAgent,
 * and returns both the tree and agent object.
 * Domain-layer pure — mistreevous is a pure computation library.
 */

import { BehaviourTree } from "mistreevous";
import type { AgentSummary } from "../agent-types.js";
import { createBTAgent, type BTAgentObject } from "./bt-agent.js";
import type { AgentToolDeps } from "./bt-types.js";

// Subtree imports
import { REVIEW_SUBTREE } from "./subtrees/goal-review.js";
import { SUMMARIZE_SUBTREE } from "./subtrees/goal-summarize.js";
import { PLAN_SUBTREE } from "./subtrees/goal-plan.js";
import { IMPLEMENT_SUBTREE } from "./subtrees/goal-implement.js";
import { MONITOR_SUBTREE } from "./subtrees/goal-monitor.js";
import { REPORT_SUBTREE } from "./subtrees/goal-report.js";
import { IDLE_SUBTREE } from "./subtrees/idle.js";
import { SOCIAL_SUBTREE } from "./subtrees/social.js";
import { NEEDS_SUBTREE } from "./subtrees/needs.js";
import { URGENT_SUBTREE } from "./subtrees/urgent.js";

export interface AgentBT {
	readonly tree: BehaviourTree;
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
		branch [SocialBehavior]
		branch [NeedsSatisfaction]
		branch [IdleBehavior]
	}
}`;
}

/** Collect all subtree MDSL definitions into one string for mistreevous. */
function collectSubtrees(): string {
	return [
		URGENT_SUBTREE,
		REVIEW_SUBTREE,
		SUMMARIZE_SUBTREE,
		PLAN_SUBTREE,
		IMPLEMENT_SUBTREE,
		MONITOR_SUBTREE,
		REPORT_SUBTREE,
		SOCIAL_SUBTREE,
		NEEDS_SUBTREE,
		IDLE_SUBTREE,
	].join("\n\n");
}

export function createAgentBT(agent: AgentSummary, deps: AgentToolDeps): AgentBT {
	const btAgent = createBTAgent(agent, deps);
	const masterMDSL = buildMasterMDSL();
	const allMDSL = masterMDSL + "\n\n" + collectSubtrees();
	// BTAgentObject satisfies the mistreevous Agent contract at runtime
	// (all condition/action methods are properties). The Agent type requires
	// an index signature that our strict interface omits, so we bridge via unknown.
	const tree = new BehaviourTree(allMDSL, btAgent as unknown as Record<string, unknown>);
	return { tree, agent: btAgent };
}
