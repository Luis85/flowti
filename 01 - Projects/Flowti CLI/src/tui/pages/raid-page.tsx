/**
 * raid-page.tsx — RAID items list page.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { ListPage } from "./list-page.js";
import { Badge } from "../primitives/badge.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadRaid } from "../loaders/raid-loader.js";
import type { PageProps } from "../types.js";

const SEVERITY_COLORS: Record<string, string> = {
	critical: "red",
	high: "yellow",
	medium: "cyan",
	low: "gray",
};

function RaidPage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadRaid, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const renderItem = (item: unknown, _i: number, sel: boolean) => {
		const r = item as { name: string; itemType: string; severity: string; status: string };
		return React.createElement(Text, { bold: sel },
			`${r.name} `,
			React.createElement(Badge, { text: r.itemType, color: "blue" }),
			" ",
			React.createElement(Badge, { text: r.severity, color: SEVERITY_COLORS[r.severity] ?? "gray" }),
			` [${r.status}]`,
		);
	};

	const renderDetail = (item: unknown) => {
		const r = item as { name: string; itemType: string; status: string; severity: string; owner: string; dueDate: string };
		return React.createElement(React.Fragment, null,
			React.createElement(Text, { bold: true, color: "cyan" }, r.name),
			React.createElement(Text, null, `Type: ${r.itemType}`),
			React.createElement(Text, null, `Status: ${r.status}`),
			React.createElement(Text, null, `Severity: ${r.severity}`),
			React.createElement(Text, null, `Owner: ${r.owner || "\u2014"}`),
			React.createElement(Text, null, `Due: ${r.dueDate || "\u2014"}`),
		);
	};

	return React.createElement(ListPage, {
		items: data.items as readonly unknown[],
		renderItem,
		renderDetail,
	});
}

registerPage("raid", RaidPage);
