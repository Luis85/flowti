/**
 * knowledgebase-page.tsx — Knowledgebase info page.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { DashboardPage } from "./dashboard-page.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadKnowledgebase } from "../loaders/knowledgebase-loader.js";
import type { PageProps } from "../types.js";

function KnowledgebasePage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadKnowledgebase, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const sections = [
		{
			title: "Knowledgebase",
			content: data.available
				? React.createElement(Text, { color: "green" }, "Knowledgebase is available in 03 - Resources/")
				: React.createElement(Text, { dimColor: true }, "Knowledgebase directory not found"),
		},
	];

	return React.createElement(DashboardPage, { sections });
}

registerPage("knowledgebase", KnowledgebasePage);
