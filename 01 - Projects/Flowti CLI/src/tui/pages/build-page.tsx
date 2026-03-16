/**
 * build-page.tsx — Build commands dashboard.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { DashboardPage } from "./dashboard-page.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadBuild } from "../loaders/build-loader.js";
import type { PageProps } from "../types.js";

function BuildPage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadBuild, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const sections = [
		{
			title: "Build Commands",
			content: data.commands.length > 0
				? React.createElement(React.Fragment, null, ...data.commands.map((c: string) => React.createElement(Text, { key: c }, `  ${c}`)))
				: React.createElement(Text, { dimColor: true }, "No build commands configured"),
		},
	];

	return React.createElement(DashboardPage, {
		stats: [{ label: "Commands", value: data.commands.length }],
		sections,
	});
}

registerPage("build", BuildPage);
