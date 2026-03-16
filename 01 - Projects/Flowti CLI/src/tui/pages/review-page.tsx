/**
 * review-page.tsx — Code review dashboard.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { DashboardPage } from "./dashboard-page.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadReview } from "../loaders/review-loader.js";
import type { PageProps } from "../types.js";

function ReviewPage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadReview, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const sections = [
		{
			title: "Review",
			content: data.available
				? React.createElement(Text, null, "Run 'flowti review' to analyze working tree and evaluate gates.")
				: React.createElement(Text, { dimColor: true }, "No project loaded"),
		},
	];

	return React.createElement(DashboardPage, { sections });
}

registerPage("review", ReviewPage);
