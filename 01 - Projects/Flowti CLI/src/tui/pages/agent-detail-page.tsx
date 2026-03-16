/**
 * agent-detail-page.tsx — Single agent deep view.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { DashboardPage } from "./dashboard-page.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadAgentDetail } from "../loaders/agent-detail-loader.js";
import type { PageProps } from "../types.js";

function AgentDetailPage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadAgentDetail, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");
	if (!data.found) return React.createElement(Text, { color: "yellow" }, `Agent "${data.name}" not found`);

	const stats = [
		{ label: "Type", value: data.agentType },
		{ label: "Domain", value: data.domain || "\u2014" },
		{ label: "Skills", value: data.skills.length },
		{ label: "Tools", value: data.tools.length },
	];

	const sections = [
		data.description ? { title: "Description", content: React.createElement(Text, null, data.description) } : null,
		data.skills.length > 0 ? {
			title: "Skills",
			content: React.createElement(React.Fragment, null,
				...data.skills.map((s) => React.createElement(Text, { key: s.name }, `  ${s.name}`, s.level ? ` (${s.level})` : "")),
			),
			collapsible: true,
		} : null,
		data.tools.length > 0 ? {
			title: "Tools",
			content: React.createElement(React.Fragment, null,
				...data.tools.map((t) => React.createElement(Text, { key: t }, `  ${t}`)),
			),
			collapsible: true,
		} : null,
		data.roles.length > 0 ? {
			title: "Roles",
			content: React.createElement(React.Fragment, null,
				...data.roles.map((r) => React.createElement(Text, { key: r }, `  ${r}`)),
			),
		} : null,
		data.persona ? { title: "Persona", content: React.createElement(Text, null, data.persona) } : null,
	].filter(Boolean) as { title: string; content: React.ReactNode; collapsible?: boolean }[];

	return React.createElement(DashboardPage, { stats, sections });
}

registerPage("agent-detail", AgentDetailPage);
