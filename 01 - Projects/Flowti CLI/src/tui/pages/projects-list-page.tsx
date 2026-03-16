/**
 * projects-list-page.tsx — Project selection list.
 *
 * Shows managed projects, selecting one navigates to project-detail.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { ListPage } from "./list-page.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadProjectsList } from "../loaders/projects-list-loader.js";
import type { ProjectListItem } from "../loaders/projects-list-loader.js";
import type { PageProps } from "../types.js";

function ProjectsListPage({ params, navigate, enabled }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadProjectsList, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	if (data.length === 0) {
		return React.createElement(Text, { dimColor: true }, "No managed projects found.");
	}

	const renderItem = (item: unknown, _i: number, sel: boolean) => {
		const project = item as ProjectListItem;
		return React.createElement(Text, { bold: sel, color: sel ? "cyan" : undefined }, project.name);
	};

	const renderDetail = (item: unknown) => {
		const project = item as ProjectListItem;
		return React.createElement(React.Fragment, null,
			React.createElement(Text, { bold: true, color: "cyan" }, project.name),
			React.createElement(Text, { dimColor: true }, project.path),
		);
	};

	return React.createElement(ListPage, {
		items: data as readonly unknown[],
		renderItem,
		renderDetail,
		onSelect: (item: unknown) => {
			const project = item as ProjectListItem;
			navigate("project-detail", { project: project.name });
		},
		actions: [{ key: "Enter", label: "Open" }],
		enabled,
	});
}

registerPage("projects-list", ProjectsListPage);
