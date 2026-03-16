/**
 * test-page.tsx — Test presets dashboard.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { DashboardPage } from "./dashboard-page.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadTest } from "../loaders/test-loader.js";
import type { PageProps } from "../types.js";

function TestPage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadTest, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const sections = [
		{
			title: "Test Presets",
			content: data.presets.length > 0
				? React.createElement(React.Fragment, null, ...data.presets.map((p: string) => React.createElement(Text, { key: p }, `  ${p}`)))
				: React.createElement(Text, { dimColor: true }, "No test presets configured"),
		},
	];

	return React.createElement(DashboardPage, {
		stats: [{ label: "Presets", value: data.presets.length }],
		sections,
	});
}

registerPage("test", TestPage);
