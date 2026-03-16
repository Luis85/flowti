/**
 * project-detail-page.tsx — Project dashboard.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { DashboardPage } from "./dashboard-page.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadProjectDetail } from "../loaders/project-detail-loader.js";
import type { PageProps } from "../types.js";

function ProjectDetailPage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadProjectDetail, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const stats = [
		{ label: "Source Files", value: data.sourceFiles },
		{ label: "Test Files", value: data.testFiles },
	];

	const sections = [
		{ title: "Project", content: React.createElement(Text, null, `${data.name} \u2014 ${data.path}`) },
	];

	return React.createElement(DashboardPage, { stats, sections });
}

registerPage("project-detail", ProjectDetailPage);
