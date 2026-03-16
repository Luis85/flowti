/**
 * iterations-page.tsx — Iteration list with detail panel.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { ListPage } from "./list-page.js";
import { Badge } from "../primitives/badge.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadIterations } from "../loaders/iterations-loader.js";
import type { IterationListItem } from "../loaders/iterations-loader.js";
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

function IterationsPage({ params, navigate }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadIterations, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const renderItem = (item: unknown, _i: number, sel: boolean) => {
		const iter = item as IterationListItem;
		return React.createElement(Text, { bold: sel },
			`#${iter.number} ${iter.name} `,
			React.createElement(Badge, { text: iter.status, color: STATUS_COLORS[iter.status] ?? "gray" }),
			iter.scopeTotal > 0 ? ` ${iter.scopeDone}/${iter.scopeTotal}` : "",
		);
	};

	const renderDetail = (item: unknown) => {
		const iter = item as IterationListItem;
		return React.createElement(React.Fragment, null,
			React.createElement(Text, { bold: true, color: "cyan" }, `#${iter.number} ${iter.name}`),
			React.createElement(Text, null, `Status: ${iter.status}`),
			iter.goal ? React.createElement(Text, { dimColor: true }, iter.goal) : null,
			iter.startDate ? React.createElement(Text, null, `${iter.startDate} \u2192 ${iter.endDate}`) : null,
			iter.scopeTotal > 0 ? React.createElement(Text, null, `Scope: ${iter.scopeDone}/${iter.scopeTotal} (${Math.round((iter.scopeDone / iter.scopeTotal) * 100)}%)`) : null,
		);
	};

	return React.createElement(ListPage, {
		items: data.iterations as readonly unknown[],
		renderItem,
		renderDetail,
		onSelect: (item: unknown) => { const iter = item as IterationListItem; navigate("iteration-detail", { number: String(iter.number) }); },
		actions: [{ key: "Enter", label: "Detail" }],
	});
}

registerPage("iterations", IterationsPage);
