/**
 * resources-page.tsx — Resources list page.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { ListPage } from "./list-page.js";
import { Badge } from "../primitives/badge.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadResources } from "../loaders/resources-loader.js";
import type { PageProps } from "../types.js";

function ResourcesPage({ params, enabled }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadResources, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const renderItem = (item: unknown, _i: number, sel: boolean) => {
		const r = item as { name: string; resourceType: string; remaining: number; amount: number };
		return React.createElement(Text, { bold: sel },
			`${r.name} `,
			React.createElement(Badge, { text: r.resourceType, color: "cyan" }),
			` ${r.remaining}/${r.amount}`,
		);
	};

	const renderDetail = (item: unknown) => {
		const r = item as { name: string; resourceType: string; price: number; amount: number; consumed: number; remaining: number; totalCost: number; consumedCost: number };
		return React.createElement(React.Fragment, null,
			React.createElement(Text, { bold: true, color: "cyan" }, r.name),
			React.createElement(Text, null, `Type: ${r.resourceType}`),
			React.createElement(Text, null, `Amount: ${r.consumed}/${r.amount} (${r.remaining} remaining)`),
			React.createElement(Text, null, `Cost: ${r.consumedCost}/${r.totalCost}`),
		);
	};

	return React.createElement(ListPage, {
		items: data.items as readonly unknown[],
		renderItem,
		renderDetail,
		enabled,
	});
}

registerPage("resources", ResourcesPage);
