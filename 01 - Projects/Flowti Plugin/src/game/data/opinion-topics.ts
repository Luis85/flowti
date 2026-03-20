/**
 * opinion-topics.ts — 15 debate topics agents hold opinions on.
 *
 * Each agent gets 2-3 opinions assigned at registration. When two agents
 * share a topic but hold opposing sides, conversations may trigger bickering.
 * Same-side opinions grant an affinity bonus on discovery.
 */

export interface OpinionTopic {
	readonly id: string;
	readonly sideA: string;
	readonly sideB: string;
}

export interface AgentOpinion {
	readonly topic: string;
	readonly side: "A" | "B";
}

export const OPINION_TOPICS: readonly OpinionTopic[] = [
	{ id: "tabs-vs-spaces",           sideA: "Tabs",           sideB: "Spaces" },
	{ id: "tdd-vs-write-after",       sideA: "TDD",            sideB: "Write after" },
	{ id: "react-vs-svelte",          sideA: "React",          sideB: "Svelte" },
	{ id: "vim-vs-vscode",            sideA: "Vim",            sideB: "VS Code" },
	{ id: "dark-vs-light-mode",       sideA: "Dark mode",      sideB: "Light mode" },
	{ id: "meetings-vs-async",        sideA: "Meetings",       sideB: "Async" },
	{ id: "monolith-vs-microservices", sideA: "Monolith",      sideB: "Microservices" },
	{ id: "coffee-vs-tea",            sideA: "Coffee",         sideB: "Tea" },
	{ id: "early-vs-late",            sideA: "Early bird",     sideB: "Night owl" },
	{ id: "docs-vs-code-speaks",      sideA: "Write docs",     sideB: "Code speaks" },
	{ id: "rebase-vs-merge",          sideA: "Rebase",         sideB: "Merge" },
	{ id: "types-vs-dynamic",         sideA: "Static types",   sideB: "Dynamic" },
	{ id: "css-vs-tailwind",          sideA: "Plain CSS",      sideB: "Tailwind" },
	{ id: "agile-vs-kanban",          sideA: "Scrum",          sideB: "Kanban" },
	{ id: "deploy-friday-vs-never",   sideA: "Deploy Friday",  sideB: "Never Friday" },
];

/** Assign 2-3 random opinions to an agent. */
export function assignOpinions(): AgentOpinion[] {
	const count = 2 + (Math.random() < 0.5 ? 1 : 0);
	const shuffled = [...OPINION_TOPICS].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, count).map((t) => ({
		topic: t.id,
		side: Math.random() < 0.5 ? "A" : "B",
	}));
}

/** Check if two agents have opposing opinions on any shared topic. */
export function checkOpinionClash(
	opinionsA: readonly AgentOpinion[],
	opinionsB: readonly AgentOpinion[],
): boolean {
	for (const a of opinionsA) {
		const match = opinionsB.find((b) => b.topic === a.topic);
		if (match && match.side !== a.side) return true;
	}
	return false;
}

/** Check if two agents agree on any shared topic. */
export function checkOpinionAgreement(
	opinionsA: readonly AgentOpinion[],
	opinionsB: readonly AgentOpinion[],
): boolean {
	for (const a of opinionsA) {
		const match = opinionsB.find((b) => b.topic === a.topic);
		if (match && match.side === a.side) return true;
	}
	return false;
}
