/**
 * help-page.tsx — Help topics dashboard.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { DashboardPage } from "./dashboard-page.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadHelp } from "../loaders/help-loader.js";
import type { PageProps } from "../types.js";

function HelpPage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadHelp, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const sections = data.sections.map((s: { title: string; description: string }) => ({
		title: s.title,
		content: React.createElement(Text, { dimColor: true }, s.description),
	}));

	return React.createElement(DashboardPage, { sections });
}

registerPage("help", HelpPage);
