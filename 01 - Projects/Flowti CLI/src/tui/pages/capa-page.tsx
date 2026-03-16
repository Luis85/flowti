/**
 * capa-page.tsx — CAPA items list page.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { ListPage } from "./list-page.js";
import { Badge } from "../primitives/badge.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadCapa } from "../loaders/capa-loader.js";
import type { PageProps } from "../types.js";

const SEVERITY_COLORS: Record<string, string> = {
	critical: "red",
	high: "yellow",
	medium: "cyan",
	low: "gray",
};

function CapaPage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadCapa, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const renderItem = (item: unknown, _i: number, sel: boolean) => {
		const c = item as { name: string; id: string; capaType: string; severity: string; status: string };
		return React.createElement(Text, { bold: sel },
			`${c.id} ${c.name} `,
			React.createElement(Badge, { text: c.capaType, color: c.capaType === "corrective" ? "red" : "yellow" }),
			" ",
			React.createElement(Badge, { text: c.severity, color: SEVERITY_COLORS[c.severity] ?? "gray" }),
		);
	};

	const renderDetail = (item: unknown) => {
		const c = item as { name: string; id: string; capaType: string; status: string; severity: string; source: string; owner: string; dueDate: string };
		return React.createElement(React.Fragment, null,
			React.createElement(Text, { bold: true, color: "cyan" }, `${c.id} \u2014 ${c.name}`),
			React.createElement(Text, null, `Type: ${c.capaType}`),
			React.createElement(Text, null, `Status: ${c.status}`),
			React.createElement(Text, null, `Severity: ${c.severity}`),
			React.createElement(Text, null, `Source: ${c.source}`),
			React.createElement(Text, null, `Owner: ${c.owner || "\u2014"}`),
			React.createElement(Text, null, `Due: ${c.dueDate || "\u2014"}`),
		);
	};

	return React.createElement(ListPage, {
		items: data.items as readonly unknown[],
		renderItem,
		renderDetail,
	});
}

registerPage("capa", CapaPage);
