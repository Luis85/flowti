/**
 * iteration-detail-page.tsx — Single iteration deep view.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { DashboardPage } from "./dashboard-page.js";
import { Badge } from "../primitives/badge.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadIterationDetail } from "../loaders/iteration-detail-loader.js";
import type { PageProps } from "../types.js";

const STATUS_COLORS: Record<string, string> = {
	"new": "gray",
	"planned": "blue",
	"ready": "cyan",
	"in-progress": "green",
	"in-review": "yellow",
	"done": "magenta",
	"cancelled": "red",
};

function IterationDetailPage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadIterationDetail, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");
	if (!data.found) return React.createElement(Text, { color: "yellow" }, `Iteration #${params.number ?? "?"} not found`);

	const completion = data.scopeTotal > 0 ? Math.round((data.scopeDone / data.scopeTotal) * 100) : 0;

	const stats = [
		{ label: "Status", value: data.status },
		{ label: "Scope", value: `${data.scopeDone}/${data.scopeTotal}` },
		{ label: "Progress", value: `${completion}%`, color: completion === 100 ? "green" : completion > 50 ? "yellow" : "red" },
	];

	const sections = [
		{ title: "Goal", content: React.createElement(Text, null, data.goal || "No goal set") },
		{ title: "Timeline", content: React.createElement(Text, null, `${data.startDate} \u2192 ${data.endDate}`) },
		data.scopeItems.length > 0 ? {
			title: "Scope Items",
			content: React.createElement(React.Fragment, null,
				...data.scopeItems.map((item: { text: string; done: boolean }, i: number) =>
					React.createElement(Text, { key: i },
						`  ${item.done ? "\u2713" : "\u25CB"} ${item.text}`,
					),
				),
			),
			collapsible: true,
		} : null,
		data.agents.length > 0 ? {
			title: "Agents",
			content: React.createElement(React.Fragment, null,
				...data.agents.map((a: string) => React.createElement(Text, { key: a }, `  ${a}`)),
			),
		} : null,
	].filter(Boolean) as { title: string; content: React.ReactNode; collapsible?: boolean }[];

	return React.createElement(DashboardPage, { stats, sections });
}

registerPage("iteration-detail", IterationDetailPage);
