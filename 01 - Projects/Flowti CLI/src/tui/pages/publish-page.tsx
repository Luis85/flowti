/**
 * publish-page.tsx — Publish endpoints dashboard.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { DashboardPage } from "./dashboard-page.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadPublish } from "../loaders/publish-loader.js";
import type { PageProps } from "../types.js";

function PublishPage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadPublish, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const sections = [
		{
			title: "Publish Endpoints",
			content: data.endpoints.length > 0
				? React.createElement(React.Fragment, null, ...data.endpoints.map((e: string) => React.createElement(Text, { key: e }, `  ${e}`)))
				: React.createElement(Text, { dimColor: true }, "No publish endpoints configured"),
		},
	];

	return React.createElement(DashboardPage, {
		stats: [{ label: "Endpoints", value: data.endpoints.length }],
		sections,
	});
}

registerPage("publish", PublishPage);
