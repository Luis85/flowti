/**
 * start-page.tsx — Home dashboard page.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { DashboardPage } from "./dashboard-page.js";
import { Badge } from "../primitives/badge.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadStart } from "../loaders/start-loader.js";
import type { PageProps } from "../types.js";

function StartPage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadStart, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const stats = [
		{ label: "Projects", value: data.projectCount },
		{ label: "Agents", value: data.agentCount },
		{ label: "Iteration", value: data.activeIteration ? `#${data.activeIteration.number}` : "None" },
		{ label: "Progress", value: data.activeIteration ? `${data.activeIteration.completion}%` : "\u2014" },
	];

	const sections = [
		{
			title: "Active Iteration",
			content: data.activeIteration
				? React.createElement(Text, null, `#${data.activeIteration.number} ${data.activeIteration.name} \u2014 ${data.activeIteration.completion}% complete`)
				: React.createElement(Text, { dimColor: true }, "No active iteration"),
		},
		{
			title: "Agent Roster",
			content: data.agents.length > 0
				? React.createElement(React.Fragment, null, ...data.agents.map((a) =>
					React.createElement(Text, { key: a.name }, `  ${a.name} `, React.createElement(Badge, { text: a.agentType, color: a.agentType === "ai" ? "cyan" : "yellow" }), ` ${a.domain}`),
				))
				: React.createElement(Text, { dimColor: true }, "No agents configured"),
		},
	];

	return React.createElement(DashboardPage, { stats, sections });
}

registerPage("start", StartPage);
