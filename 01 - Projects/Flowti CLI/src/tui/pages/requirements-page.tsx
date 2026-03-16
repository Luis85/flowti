/**
 * requirements-page.tsx — Requirements list page.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { ListPage } from "./list-page.js";
import { Badge } from "../primitives/badge.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadRequirements } from "../loaders/requirements-loader.js";
import type { PageProps } from "../types.js";

function RequirementsPage({ params, enabled }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadRequirements, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const renderItem = (item: unknown, _i: number, sel: boolean) => {
		const r = item as { name: string; id: string; requirementType: string; priority: string; status: string };
		return React.createElement(Text, { bold: sel },
			`${r.id} ${r.name} `,
			React.createElement(Badge, { text: r.requirementType, color: "blue" }),
			" ",
			React.createElement(Badge, { text: r.priority, color: r.priority === "must" ? "red" : r.priority === "should" ? "yellow" : "gray" }),
		);
	};

	const renderDetail = (item: unknown) => {
		const r = item as { name: string; id: string; requirementType: string; status: string; priority: string };
		return React.createElement(React.Fragment, null,
			React.createElement(Text, { bold: true, color: "cyan" }, `${r.id} \u2014 ${r.name}`),
			React.createElement(Text, null, `Type: ${r.requirementType}`),
			React.createElement(Text, null, `Status: ${r.status}`),
			React.createElement(Text, null, `Priority: ${r.priority}`),
		);
	};

	return React.createElement(ListPage, {
		items: data.items as readonly unknown[],
		renderItem,
		renderDetail,
		enabled,
	});
}

registerPage("requirements", RequirementsPage);
