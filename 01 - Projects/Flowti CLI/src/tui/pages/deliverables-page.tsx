/**
 * deliverables-page.tsx — Deliverables list page.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { ListPage } from "./list-page.js";
import { Badge } from "../primitives/badge.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadDeliverables } from "../loaders/deliverables-loader.js";
import type { PageProps } from "../types.js";

function DeliverablesPage({ params, enabled }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadDeliverables, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const renderItem = (item: unknown, _i: number, sel: boolean) => {
		const d = item as { name: string; status: string; completionPct: number };
		const color = d.status === "done" ? "green" : d.status === "blocked" ? "red" : "yellow";
		return React.createElement(Text, { bold: sel },
			`${d.name} `,
			React.createElement(Badge, { text: d.status, color }),
			` ${d.completionPct}%`,
		);
	};

	const renderDetail = (item: unknown) => {
		const d = item as { name: string; status: string; dueDate: string; assignee: string; completionPct: number };
		return React.createElement(React.Fragment, null,
			React.createElement(Text, { bold: true, color: "cyan" }, d.name),
			React.createElement(Text, null, `Status: ${d.status}`),
			React.createElement(Text, null, `Due: ${d.dueDate || "\u2014"}`),
			React.createElement(Text, null, `Assignee: ${d.assignee || "\u2014"}`),
			React.createElement(Text, null, `Completion: ${d.completionPct}%`),
		);
	};

	return React.createElement(ListPage, {
		items: data.items as readonly unknown[],
		renderItem,
		renderDetail,
		enabled,
	});
}

registerPage("deliverables", DeliverablesPage);
