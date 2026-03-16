/**
 * ai-tools-page.tsx — Agent list with detail panel.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { ListPage } from "./list-page.js";
import { Badge } from "../primitives/badge.js";
import { Section } from "../primitives/section.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadAiTools } from "../loaders/ai-tools-loader.js";
import type { AgentListItem } from "../loaders/ai-tools-loader.js";
import type { PageProps } from "../types.js";

function AiToolsPage({ params, navigate, enabled }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadAiTools, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const renderItem = (item: unknown, _i: number, sel: boolean) => {
		const agent = item as AgentListItem;
		return React.createElement(Text, { bold: sel, wrap: "truncate" },
			`${agent.name} `,
			React.createElement(Badge, { text: agent.agentType, color: agent.agentType === "ai" ? "cyan" : "yellow" }),
			agent.domain ? ` ${agent.domain}` : "",
		);
	};

	const renderDetail = (item: unknown) => {
		const agent = item as AgentListItem;
		return React.createElement(React.Fragment, null,
			React.createElement(Text, { bold: true, color: "cyan" }, agent.name),
			React.createElement(Text, { dimColor: true }, agent.description || "No description"),
			agent.skills.length > 0 ? React.createElement(Section, { title: "Skills", children: React.createElement(React.Fragment, null, ...agent.skills.map((s: string) => React.createElement(Text, { key: s }, `  ${s}`))) }) : null,
		);
	};

	return React.createElement(ListPage, {
		items: data.agents as readonly unknown[],
		renderItem,
		renderDetail,
		onSelect: (item: unknown) => { const agent = item as AgentListItem; navigate("agent-detail", { agentName: agent.name }); },
		actions: [{ key: "Enter", label: "Detail" }],
		enabled,
	});
}

registerPage("ai-tools", AiToolsPage);
