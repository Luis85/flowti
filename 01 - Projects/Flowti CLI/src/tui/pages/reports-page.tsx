/**
 * reports-page.tsx — Reports list page.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { ListPage } from "./list-page.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadReports } from "../loaders/reports-loader.js";
import type { PageProps } from "../types.js";

function ReportsPage({ params, enabled }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadReports, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const renderItem = (item: unknown, _i: number, sel: boolean) => {
		const r = item as { name: string };
		return React.createElement(Text, { bold: sel }, r.name);
	};

	return React.createElement(ListPage, {
		items: data.reports as readonly unknown[],
		renderItem,
		enabled,
	});
}

registerPage("reports", ReportsPage);
