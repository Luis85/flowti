/**
 * devtools-page.tsx — Developer tools dashboard.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { DashboardPage } from "./dashboard-page.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadDevtools } from "../loaders/devtools-loader.js";
import type { PageProps } from "../types.js";

function DevtoolsPage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadDevtools, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const sections = [
		{
			title: "Available Tools",
			content: React.createElement(React.Fragment, null,
				...data.tools.map((t: string) => React.createElement(Text, { key: t }, `  ${t}`)),
			),
		},
	];

	return React.createElement(DashboardPage, {
		stats: [{ label: "Tools", value: data.tools.length }],
		sections,
	});
}

registerPage("devtools", DevtoolsPage);
