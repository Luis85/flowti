/**
 * health-page.tsx — Health dashboard.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { DashboardPage } from "./dashboard-page.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadHealth } from "../loaders/health-loader.js";
import type { PageProps } from "../types.js";

function HealthPage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadHealth, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	if (!data.available) {
		return React.createElement(DashboardPage, {
			sections: [{ title: "Health", content: React.createElement(Text, { dimColor: true }, "No health reports found. Run 'flowti reports' to generate.") }],
		});
	}

	const stats = [
		{ label: "Tests", value: data.tests.total, color: data.tests.failed > 0 ? "red" : "green" },
		{ label: "Passed", value: data.tests.passed, color: "green" },
		{ label: "Failed", value: data.tests.failed, color: data.tests.failed > 0 ? "red" : "green" },
		{ label: "Coverage", value: `${data.coverage.lines.toFixed(1)}%`, color: data.coverage.lines >= 80 ? "green" : "yellow" },
	];

	const sections = [
		{
			title: "Coverage Breakdown",
			content: React.createElement(React.Fragment, null,
				React.createElement(Text, null, `  Lines:     ${data.coverage.lines.toFixed(1)}%`),
				React.createElement(Text, null, `  Branches:  ${data.coverage.branches.toFixed(1)}%`),
				React.createElement(Text, null, `  Functions: ${data.coverage.functions.toFixed(1)}%`),
			),
		},
	];

	return React.createElement(DashboardPage, { stats, sections });
}

registerPage("health", HealthPage);
