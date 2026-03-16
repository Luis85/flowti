/**
 * page-registry.ts — Static map of pageId → React component.
 *
 * During migration, most pages point to PlaceholderPage.
 * As pages are migrated, they replace their placeholder entry.
 */

import type { PageProps } from "../types.js";
import { PlaceholderPage } from "./placeholder-page.js";

type PageComponent = (props: PageProps) => React.JSX.Element;

const registry = new Map<string, PageComponent>();

export function registerPage(pageId: string, component: PageComponent): void {
	registry.set(pageId, component);
}

export function getPage(pageId: string): PageComponent {
	return registry.get(pageId) ?? PlaceholderPage;
}

export function getRegisteredPageIds(): string[] {
	return [...registry.keys()];
}
