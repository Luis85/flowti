/**
 * capture-page.tsx — Quick capture page.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { DashboardPage } from "./dashboard-page.js";
import { Badge } from "../primitives/badge.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadCapture } from "../loaders/capture-loader.js";
import type { PageProps } from "../types.js";

function CapturePage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadCapture, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const sections = [
		{
			title: "Capture Types",
			content: React.createElement(React.Fragment, null,
				...data.types.map((t: string) =>
					React.createElement(Text, { key: t }, "  ", React.createElement(Badge, { text: t, color: "cyan" })),
				),
			),
		},
	];

	return React.createElement(DashboardPage, {
		stats: [{ label: "Types", value: data.types.length }],
		sections,
	});
}

registerPage("capture", CapturePage);
