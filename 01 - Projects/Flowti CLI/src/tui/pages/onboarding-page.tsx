/**
 * onboarding-page.tsx — Onboarding prerequisite checks + Start Tour.
 */

import React from "react";
import { Text, useInput } from "ink";
import { registerPage } from "./page-registry.js";
import { DashboardPage } from "./dashboard-page.js";
import { Badge } from "../primitives/badge.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadOnboarding } from "../loaders/onboarding-loader.js";
import type { PageProps } from "../types.js";

function OnboardingPage({ params, navigate, enabled }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadOnboarding, ctx);

	useInput((_input, key) => {
		if (!data || data.issues.length > 0) return;
		if (key.return) {
			navigate("onboarding-tour", { tourId: "project-manager" });
		}
	}, { isActive: enabled });

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const allClear = data.issues.length === 0;

	const sections = [
		{
			title: "Prerequisites",
			content: allClear
				? React.createElement(React.Fragment, null,
					React.createElement(Text, { color: "green" }, "All prerequisites met!"),
					React.createElement(Text, { dimColor: true }, "\nPress Enter to start the onboarding tour."),
				)
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
			{ label: "Issues", value: data.issues.length, color: allClear ? "green" : "red" },
		],
		sections,
		actions: allClear ? [{ key: "Enter", label: "Start Tour" }] : [],
	});
}

registerPage("onboarding", OnboardingPage);
