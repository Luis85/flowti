/**
 * plugins-page.tsx — Plugins info page.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { DashboardPage } from "./dashboard-page.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadPlugins } from "../loaders/plugins-loader.js";
import type { PageProps } from "../types.js";

function PluginsPage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadPlugins, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const sections = [
		{
			title: "Plugins",
			content: data.available
				? React.createElement(Text, null, "Plugin system available. Run 'flowti plugins' for details.")
				: React.createElement(Text, { dimColor: true }, "No plugin configuration found"),
		},
	];

	return React.createElement(DashboardPage, { sections });
}

registerPage("plugins", PluginsPage);
