/**
 * onboarding-page.tsx — Onboarding prerequisite checks.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { DashboardPage } from "./dashboard-page.js";
import { Badge } from "../primitives/badge.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadOnboarding } from "../loaders/onboarding-loader.js";
import type { PageProps } from "../types.js";

function OnboardingPage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadOnboarding, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const sections = [
		{
			title: "Prerequisites",
			content: data.issues.length === 0
				? React.createElement(Text, { color: "green" }, "All prerequisites met!")
				: React.createElement(React.Fragment, null,
					...data.issues.map((issue: { tool: string; message: string; severity: string }) =>
						React.createElement(Text, { key: issue.tool },
							`  ${issue.tool}: ${issue.message} `,
							React.createElement(Badge, { text: issue.severity, color: issue.severity === "error" ? "red" : "yellow" }),
						),
					),
				),
		},
	];

	return React.createElement(DashboardPage, {
		stats: [
			{ label: "Issues", value: data.issues.length, color: data.issues.length === 0 ? "green" : "red" },
		],
		sections,
	});
}

registerPage("onboarding", OnboardingPage);
