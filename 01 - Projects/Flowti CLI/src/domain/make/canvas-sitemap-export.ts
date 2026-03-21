/**
 * canvas-sitemap-export.ts — Pure domain: generate Obsidian canvas JSON for a starter sitemap.
 *
 * Creates a sitemap.canvas with:
 * - A _Meta group (brief file node + legend) — ignored by canvas import
 * - If a sitemap exists: colored, grouped nodes matching the original structure
 * - If no sitemap: a starter example showing the method (groups, colors, edges)
 */

import type { CanvasData, CanvasNode, CanvasEdge } from "./canvas-sitemap-types.js";
import type { UnifiedSitemap, PageObject } from "../sitemap/unified-page.js";

// ── Layout Constants ─────────────────────────────────────────────────

const NODE_W = 260;
const NODE_H = 60;
const GROUP_PAD = 30;
const GROUP_HEADER = 40;
const CHILD_GAP = 16;
const GROUP_GAP_X = 140;
const GROUP_GAP_Y = 80;
const STANDALONE_GAP_X = 40;
const META_W = 540;
const META_X = -700;
const META_Y = -60;
const WORK_X = 50;
const WORK_Y = 0;

// ── Kind → Color reverse mapping ────────────────────────────────────

const KIND_TO_COLOR: Record<string, string> = {
	dialog: "1",
	form: "2",
	list: "3",
	page: "4",
	layout: "5",
	system: "6",
};

// ── Legend ────────────────────────────────────────────────────────────

const LEGEND_INTRO = `## Sitemap Canvas

### How to use
1. Add text nodes with a page name
2. Set node **color** to define page kind
3. Set node **shape** for special types
4. Group nodes to set parent
5. Draw arrows for navigation
6. Import canvas from Config tab

_Groups starting with _ are ignored_`;

/** Legend node definitions — color swatches + shape swatches placed visually inside _Meta. */
function buildLegendNodes(baseX: number, baseY: number): CanvasNode[] {
	const nodes: CanvasNode[] = [];
	const sw = 110;
	const sh = 32;
	const gap = 8;
	const col1 = baseX + 20;
	const col2 = baseX + 20 + sw + gap;
	let y = baseY;

	// Color swatches — 2 columns
	const colors: [string, string, string][] = [
		["1", "Dialog", "1"],
		["2", "Form", "2"],
		["3", "List", "3"],
		["4", "Page", "4"],
		["5", "Layout", "5"],
		["6", "System", "6"],
	];
	for (let i = 0; i < colors.length; i += 2) {
		const [id1, label1, color1] = colors[i];
		nodes.push({ id: `legend-c${id1}`, type: "text", x: col1, y, width: sw, height: sh, text: label1, color: color1 });
		if (i + 1 < colors.length) {
			const [id2, label2, color2] = colors[i + 1];
			nodes.push({ id: `legend-c${id2}`, type: "text", x: col2, y, width: sw, height: sh, text: label2, color: color2 });
		}
		y += sh + gap;
	}

	y += 8;

	// Shape swatches — special types
	const shapes: [string, string, string][] = [
		["diamond", "UI Component", "diamond"],
		["circle", "Person / Actor", "circle"],
		["document", "C4 Component", "document"],
	];
	for (const [id, label, shape] of shapes) {
		nodes.push({ id: `legend-s-${id}`, type: "text", x: col1, y, width: sw * 2 + gap, height: sh, text: `${label}  (${shape} shape)`, shape });
		y += sh + gap;
	}

	return nodes;
}

// ── Presets ──────────────────────────────────────────────────────────

export type CanvasPreset = "web-app" | "landing" | "dashboard" | "e-commerce" | "enterprise" | "cli" | "obsidian-plugin" | "docs" | "system-design" | "service-design" | "product-design";

export const CANVAS_PRESETS: { id: CanvasPreset; label: string; description: string }[] = [
	{ id: "web-app", label: "Web App", description: "Pages, components, auth, services" },
	{ id: "landing", label: "Landing Site", description: "Marketing pages, forms, legal" },
	{ id: "dashboard", label: "Dashboard", description: "Admin panels, data views, settings" },
	{ id: "e-commerce", label: "E-Commerce", description: "Catalog, cart, checkout, account" },
	{ id: "enterprise", label: "Enterprise", description: "Portal, workforce, finance, projects, admin" },
	{ id: "cli", label: "CLI App", description: "Commands, config, output, plugins, help" },
	{ id: "obsidian-plugin", label: "Obsidian Plugin", description: "Views, settings, commands, modals, events" },
	{ id: "docs", label: "Documentation", description: "Guides, API reference, examples" },
	{ id: "system-design", label: "System Design", description: "C4 systems, containers, components, actors" },
	{ id: "service-design", label: "Service Design", description: "API gateway, microservices, events, data" },
	{ id: "product-design", label: "Product Design", description: "Personas, journeys, features, touchpoints" },
];

// ── Export Function ──────────────────────────────────────────────────

export function generateSitemapCanvas(opts: {
	briefPath?: string;
	sitemap?: UnifiedSitemap;
	preset?: CanvasPreset;
}): CanvasData {
	const nodes: CanvasNode[] = [];
	const edges: CanvasEdge[] = [];

	// ── _Meta group with visual legend ───────────────────────────
	let metaContentY = META_Y + 40;

	if (opts.briefPath) {
		nodes.push({
			id: "meta-brief",
			type: "file",
			x: META_X + 20,
			y: metaContentY,
			width: META_W - 40,
			height: 60,
			file: opts.briefPath,
		});
		metaContentY += 80;
	}

	// Legend intro text
	nodes.push({
		id: "meta-legend",
		type: "text",
		x: META_X + 20,
		y: metaContentY,
		width: META_W - 40,
		height: 240,
		text: LEGEND_INTRO,
	});
	metaContentY += 256;

	// Visual color + shape swatches
	const legendNodes = buildLegendNodes(META_X, metaContentY);
	nodes.push(...legendNodes);
	const legendBottom = legendNodes.reduce((max, n) => Math.max(max, n.y + n.height), metaContentY);

	const metaH = legendBottom - META_Y + 30;
	nodes.push({
		id: "meta-group",
		type: "group",
		x: META_X,
		y: META_Y,
		width: META_W,
		height: metaH,
		label: "_Meta",
	});

	// ── Build page nodes ─────────────────────────────────────────
	if (opts.sitemap && Object.keys(opts.sitemap.pages).length > 0) {
		buildFromSitemap(opts.sitemap, nodes, edges);
	} else {
		const builder = PRESET_BUILDERS[opts.preset ?? "web-app"] ?? buildStarterExample;
		builder(nodes, edges);
	}

	return { nodes, edges };
}

// ── Build from existing sitemap ──────────────────────────────────────

function buildFromSitemap(sitemap: UnifiedSitemap, nodes: CanvasNode[], edges: CanvasEdge[]): void {
	const entries = Object.entries(sitemap.pages);

	// Identify pages that act as parents (referenced by other pages)
	const parentIds = new Set<string>();
	for (const [, page] of entries) {
		if (page.parent) parentIds.add(page.parent);
	}

	// Groups = explicit containers OR pages that have children
	const groupIds = new Set<string>();
	const groupEntries: [string, PageObject][] = [];
	const leafEntries: [string, PageObject][] = [];

	for (const entry of entries) {
		const [id, page] = entry;
		if (page.kind === "container" || parentIds.has(id)) {
			groupIds.add(id);
			groupEntries.push(entry);
		} else {
			leafEntries.push(entry);
		}
	}

	// Map leaf children to their parent group
	const childrenOf = new Map<string, [string, PageObject][]>();
	const orphans: [string, PageObject][] = [];

	for (const entry of leafEntries) {
		const [, page] = entry;
		if (page.parent && groupIds.has(page.parent)) {
			const kids = childrenOf.get(page.parent) ?? [];
			kids.push(entry);
			childrenOf.set(page.parent, kids);
		} else {
			orphans.push(entry);
		}
	}

	// ── Layout groups in rows ────────────────────────────────
	const MAX_ROW_W = 1800;
	const groupW = NODE_W + GROUP_PAD * 2;
	let cursorX = WORK_X;
	let cursorY = WORK_Y;
	let rowMaxH = 0;

	for (const [containerId, container] of groupEntries) {
		const children = childrenOf.get(containerId) ?? [];
		const childCount = Math.max(children.length, 1);
		const groupH = GROUP_HEADER + GROUP_PAD + childCount * (NODE_H + CHILD_GAP) - CHILD_GAP + GROUP_PAD;

		// Wrap to next row if exceeding max width
		if (cursorX > WORK_X && cursorX + groupW > MAX_ROW_W) {
			cursorX = WORK_X;
			cursorY += rowMaxH + GROUP_GAP_Y;
			rowMaxH = 0;
		}

		nodes.push({
			id: `page-${containerId}`,
			type: "group",
			x: cursorX,
			y: cursorY,
			width: groupW,
			height: groupH,
			label: container.label,
			color: KIND_TO_COLOR[container.kind] ?? undefined,
		});

		for (let i = 0; i < children.length; i++) {
			const [childId, childPage] = children[i];
			nodes.push({
				id: `page-${childId}`,
				type: "text",
				x: cursorX + GROUP_PAD,
				y: cursorY + GROUP_HEADER + GROUP_PAD + i * (NODE_H + CHILD_GAP),
				width: NODE_W,
				height: NODE_H,
				text: childPage.label,
				color: KIND_TO_COLOR[childPage.kind] ?? undefined,
			});
		}

		cursorX += groupW + GROUP_GAP_X;
		if (groupH > rowMaxH) rowMaxH = groupH;
	}

	// ── Render orphan pages (no parent or parent is a group) ─
	if (orphans.length > 0) {
		const orphanY = groupEntries.length > 0 ? cursorY + rowMaxH + GROUP_GAP_Y : WORK_Y;
		let ox = WORK_X;

		for (const [pageId, page] of orphans) {
			nodes.push({
				id: `page-${pageId}`,
				type: "text",
				x: ox,
				y: orphanY,
				width: NODE_W,
				height: NODE_H,
				text: page.label,
				color: KIND_TO_COLOR[page.kind] ?? undefined,
			});
			ox += NODE_W + STANDALONE_GAP_X;
		}
	}

	// ── Edges from navigate actions ─────────────────────────
	for (const [pageId, page] of entries) {
		for (const action of page.actions ?? []) {
			if (action.type === "navigate" && action.target) {
				const targetExists = entries.some(([id]) => id === action.target);
				if (targetExists) {
					edges.push({
						id: `edge-${pageId}-${action.target}`,
						fromNode: `page-${pageId}`,
						toNode: `page-${action.target}`,
						fromSide: "right",
						toSide: "left",
						label: action.label,
					});
				}
			}
		}
	}
}

// ── Starter example helpers ──────────────────────────────────────────

interface ExampleNode {
	readonly id: string;
	readonly text: string;
	readonly color: string;
	readonly shape?: string;
}

interface ExampleGroup {
	readonly id: string;
	readonly label: string;
	readonly children: readonly ExampleNode[];
}

function groupHeight(children: number): number {
	return GROUP_HEADER + GROUP_PAD + children * (NODE_H + CHILD_GAP) - CHILD_GAP + GROUP_PAD;
}

function placeGroup(
	group: ExampleGroup,
	gx: number,
	gy: number,
	nodes: CanvasNode[],
): void {
	const gw = NODE_W + GROUP_PAD * 2;
	const gh = groupHeight(group.children.length);

	nodes.push({
		id: group.id,
		type: "group",
		x: gx,
		y: gy,
		width: gw,
		height: gh,
		label: group.label,
	});

	for (let i = 0; i < group.children.length; i++) {
		const child = group.children[i];
		nodes.push({
			id: child.id,
			type: "text",
			x: gx + GROUP_PAD,
			y: gy + GROUP_HEADER + GROUP_PAD + i * (NODE_H + CHILD_GAP),
			width: NODE_W,
			height: NODE_H,
			text: child.text,
			color: child.color,
			shape: child.shape,
		});
	}
}

// ── Build starter example ────────────────────────────────────────────

function buildStarterExample(nodes: CanvasNode[], edges: CanvasEdge[]): void {
	const gw = NODE_W + GROUP_PAD * 2;

	// ── Row 1: Pages + Components ────────────────────────────

	const pages: ExampleGroup = {
		id: "grp-pages",
		label: "Pages",
		children: [
			{ id: "pg-home", text: "Home", color: "4" },
			{ id: "pg-dashboard", text: "Dashboard", color: "5" },
			{ id: "pg-profile", text: "Profile", color: "4" },
			{ id: "pg-settings", text: "Settings", color: "2" },
			{ id: "pg-search", text: "Search Results", color: "3" },
		],
	};

	const components: ExampleGroup = {
		id: "grp-components",
		label: "Components",
		children: [
			{ id: "cmp-header", text: "App Header", color: "5" },
			{ id: "cmp-sidebar", text: "Sidebar Nav", color: "5" },
			{ id: "cmp-card", text: "Card", color: "4" },
			{ id: "cmp-data-table", text: "Data Table", color: "3" },
			{ id: "cmp-modal", text: "Modal", color: "1" },
			{ id: "cmp-form-field", text: "Form Field", color: "2" },
		],
	};

	const pagesX = WORK_X;
	const componentsX = pagesX + gw + GROUP_GAP_X;

	placeGroup(pages, pagesX, WORK_Y, nodes);
	placeGroup(components, componentsX, WORK_Y, nodes);

	// ── Row 2: Systems + Services ────────────────────────────

	const row1MaxH = Math.max(
		groupHeight(pages.children.length),
		groupHeight(components.children.length),
	);
	const row2Y = WORK_Y + row1MaxH + GROUP_GAP_Y;

	const systems: ExampleGroup = {
		id: "grp-systems",
		label: "Systems",
		children: [
			{ id: "sys-login", text: "Login", color: "6" },
			{ id: "sys-register", text: "Register", color: "2" },
			{ id: "sys-forgot-password", text: "Forgot Password", color: "2" },
			{ id: "sys-error-page", text: "Error Page", color: "6" },
			{ id: "sys-not-found", text: "404 Not Found", color: "6" },
		],
	};

	const services: ExampleGroup = {
		id: "grp-services",
		label: "Services",
		children: [
			{ id: "svc-notifications", text: "Notifications", color: "1" },
			{ id: "svc-confirm-dialog", text: "Confirm Dialog", color: "1" },
			{ id: "svc-toast", text: "Toast Messages", color: "1" },
			{ id: "svc-loading", text: "Loading Overlay", color: "5" },
		],
	};

	placeGroup(systems, pagesX, row2Y, nodes);
	placeGroup(services, componentsX, row2Y, nodes);

	// ── Edges: left→right between groups, top→bottom within ──

	// Pages → Components (right→left, adjacent groups)
	edges.push({ id: "e-dashboard-table", fromNode: "pg-dashboard", toNode: "cmp-data-table", fromSide: "right", toSide: "left", label: "Uses" });
	edges.push({ id: "e-search-card", fromNode: "pg-search", toNode: "cmp-card", fromSide: "right", toSide: "left", label: "Uses" });
	edges.push({ id: "e-settings-form", fromNode: "pg-settings", toNode: "cmp-form-field", fromSide: "right", toSide: "left", label: "Uses" });

	// Systems → Services (right→left, adjacent groups)
	edges.push({ id: "e-login-toast", fromNode: "sys-login", toNode: "svc-toast", fromSide: "right", toSide: "left", label: "Shows" });

	// Systems → Pages (bottom→top, row 2 → row 1)
	edges.push({ id: "e-login-home", fromNode: "sys-login", toNode: "pg-home", fromSide: "top", toSide: "bottom", label: "Authenticate" });
	edges.push({ id: "e-register-login", fromNode: "sys-register", toNode: "sys-login", fromSide: "top", toSide: "bottom", label: "Account created" });
}

// ── Preset: Landing Site ─────────────────────────────────────────────

function buildLandingPreset(nodes: CanvasNode[], edges: CanvasEdge[]): void {
	const gw = NODE_W + GROUP_PAD * 2;

	const marketing: ExampleGroup = {
		id: "grp-marketing", label: "Marketing",
		children: [
			{ id: "pg-home", text: "Home", color: "4" },
			{ id: "pg-about", text: "About", color: "4" },
			{ id: "pg-pricing", text: "Pricing", color: "3" },
			{ id: "pg-features", text: "Features", color: "4" },
			{ id: "pg-blog", text: "Blog", color: "3" },
		],
	};
	const forms: ExampleGroup = {
		id: "grp-forms", label: "Forms",
		children: [
			{ id: "pg-contact", text: "Contact", color: "2" },
			{ id: "pg-newsletter", text: "Newsletter Signup", color: "2" },
			{ id: "pg-demo", text: "Request Demo", color: "2" },
		],
	};
	const legal: ExampleGroup = {
		id: "grp-legal", label: "Legal",
		children: [
			{ id: "pg-privacy", text: "Privacy Policy", color: "4" },
			{ id: "pg-terms", text: "Terms of Service", color: "4" },
			{ id: "pg-cookies", text: "Cookie Policy", color: "4" },
		],
	};

	placeGroup(marketing, WORK_X, WORK_Y, nodes);
	placeGroup(forms, WORK_X + gw + GROUP_GAP_X, WORK_Y, nodes);
	const row2Y = WORK_Y + groupHeight(marketing.children.length) + GROUP_GAP_Y;
	placeGroup(legal, WORK_X, row2Y, nodes);

	edges.push({ id: "e-home-pricing", fromNode: "pg-home", toNode: "pg-pricing", fromSide: "bottom", toSide: "top" });
	edges.push({ id: "e-pricing-demo", fromNode: "pg-pricing", toNode: "pg-demo", fromSide: "right", toSide: "left", label: "Get started" });
	edges.push({ id: "e-home-contact", fromNode: "pg-home", toNode: "pg-contact", fromSide: "right", toSide: "left" });
}

// ── Preset: Dashboard ────────────────────────────────────────────────

function buildDashboardPreset(nodes: CanvasNode[], edges: CanvasEdge[]): void {
	const gw = NODE_W + GROUP_PAD * 2;

	const views: ExampleGroup = {
		id: "grp-views", label: "Views",
		children: [
			{ id: "pg-overview", text: "Overview", color: "4" },
			{ id: "pg-analytics", text: "Analytics", color: "3" },
			{ id: "pg-reports", text: "Reports", color: "3" },
			{ id: "pg-activity", text: "Activity Log", color: "3" },
		],
	};
	const management: ExampleGroup = {
		id: "grp-management", label: "Management",
		children: [
			{ id: "pg-users", text: "Users", color: "3" },
			{ id: "pg-roles", text: "Roles", color: "2" },
			{ id: "pg-teams", text: "Teams", color: "3" },
			{ id: "pg-invites", text: "Invitations", color: "2" },
		],
	};
	const settings: ExampleGroup = {
		id: "grp-settings", label: "Settings",
		children: [
			{ id: "pg-general", text: "General", color: "2" },
			{ id: "pg-billing", text: "Billing", color: "2" },
			{ id: "pg-integrations", text: "Integrations", color: "4" },
			{ id: "pg-notifications", text: "Notifications", color: "2" },
			{ id: "pg-api-keys", text: "API Keys", color: "2" },
		],
	};
	const components: ExampleGroup = {
		id: "grp-components", label: "Components",
		children: [
			{ id: "cmp-sidebar", text: "Sidebar Nav", color: "5" },
			{ id: "cmp-chart", text: "Chart Widget", color: "5" },
			{ id: "cmp-data-table", text: "Data Table", color: "3" },
			{ id: "cmp-stat-card", text: "Stat Card", color: "4" },
			{ id: "cmp-filters", text: "Filter Bar", color: "2" },
		],
	};

	placeGroup(views, WORK_X, WORK_Y, nodes);
	placeGroup(management, WORK_X + gw + GROUP_GAP_X, WORK_Y, nodes);
	const row2Y = WORK_Y + groupHeight(settings.children.length) + GROUP_GAP_Y;
	placeGroup(settings, WORK_X, row2Y, nodes);
	placeGroup(components, WORK_X + gw + GROUP_GAP_X, row2Y, nodes);

	edges.push({ id: "e-overview-analytics", fromNode: "pg-overview", toNode: "pg-analytics", fromSide: "bottom", toSide: "top" });
	edges.push({ id: "e-overview-reports", fromNode: "pg-overview", toNode: "pg-reports", fromSide: "bottom", toSide: "top" });
	edges.push({ id: "e-users-roles", fromNode: "pg-users", toNode: "pg-roles", fromSide: "bottom", toSide: "top", label: "Assign" });
	edges.push({ id: "e-analytics-chart", fromNode: "pg-analytics", toNode: "cmp-chart", fromSide: "right", toSide: "left", label: "Uses" });
}

// ── Preset: E-Commerce ───────────────────────────────────────────────

function buildECommercePreset(nodes: CanvasNode[], edges: CanvasEdge[]): void {
	const gw = NODE_W + GROUP_PAD * 2;

	const catalog: ExampleGroup = {
		id: "grp-catalog", label: "Catalog",
		children: [
			{ id: "pg-products", text: "Product List", color: "3" },
			{ id: "pg-product-detail", text: "Product Detail", color: "4" },
			{ id: "pg-categories", text: "Categories", color: "3" },
			{ id: "pg-search", text: "Search", color: "3" },
		],
	};
	const checkout: ExampleGroup = {
		id: "grp-checkout", label: "Checkout",
		children: [
			{ id: "pg-cart", text: "Cart", color: "4" },
			{ id: "pg-shipping", text: "Shipping", color: "2" },
			{ id: "pg-payment", text: "Payment", color: "2" },
			{ id: "pg-confirmation", text: "Order Confirmation", color: "4" },
		],
	};
	const account: ExampleGroup = {
		id: "grp-account", label: "Account",
		children: [
			{ id: "pg-login", text: "Login", color: "6" },
			{ id: "pg-register", text: "Register", color: "2" },
			{ id: "pg-profile", text: "Profile", color: "4" },
			{ id: "pg-orders", text: "Order History", color: "3" },
			{ id: "pg-wishlist", text: "Wishlist", color: "3" },
		],
	};
	const admin: ExampleGroup = {
		id: "grp-admin", label: "Admin",
		children: [
			{ id: "pg-inventory", text: "Inventory", color: "3" },
			{ id: "pg-order-mgmt", text: "Order Management", color: "3" },
			{ id: "pg-customers", text: "Customers", color: "3" },
			{ id: "pg-promotions", text: "Promotions", color: "2" },
		],
	};

	placeGroup(catalog, WORK_X, WORK_Y, nodes);
	placeGroup(checkout, WORK_X + gw + GROUP_GAP_X, WORK_Y, nodes);
	const row2Y = WORK_Y + groupHeight(account.children.length) + GROUP_GAP_Y;
	placeGroup(account, WORK_X, row2Y, nodes);
	placeGroup(admin, WORK_X + gw + GROUP_GAP_X, row2Y, nodes);

	edges.push({ id: "e-products-detail", fromNode: "pg-products", toNode: "pg-product-detail", fromSide: "bottom", toSide: "top" });
	edges.push({ id: "e-detail-cart", fromNode: "pg-product-detail", toNode: "pg-cart", fromSide: "right", toSide: "left", label: "Add to cart" });
	edges.push({ id: "e-cart-shipping", fromNode: "pg-cart", toNode: "pg-shipping", fromSide: "bottom", toSide: "top" });
	edges.push({ id: "e-shipping-payment", fromNode: "pg-shipping", toNode: "pg-payment", fromSide: "bottom", toSide: "top" });
	edges.push({ id: "e-payment-confirm", fromNode: "pg-payment", toNode: "pg-confirmation", fromSide: "bottom", toSide: "top" });
	edges.push({ id: "e-login-profile", fromNode: "pg-login", toNode: "pg-profile", fromSide: "bottom", toSide: "top", label: "Authenticate" });
}

// ── Preset: Documentation ────────────────────────────────────────────

function buildDocsPreset(nodes: CanvasNode[], edges: CanvasEdge[]): void {
	const gw = NODE_W + GROUP_PAD * 2;

	const guides: ExampleGroup = {
		id: "grp-guides", label: "Guides",
		children: [
			{ id: "pg-getting-started", text: "Getting Started", color: "4" },
			{ id: "pg-installation", text: "Installation", color: "4" },
			{ id: "pg-quickstart", text: "Quickstart", color: "4" },
			{ id: "pg-tutorials", text: "Tutorials", color: "4" },
			{ id: "pg-faq", text: "FAQ", color: "3" },
		],
	};
	const reference: ExampleGroup = {
		id: "grp-reference", label: "Reference",
		children: [
			{ id: "pg-api", text: "API Reference", color: "3" },
			{ id: "pg-config", text: "Configuration", color: "2" },
			{ id: "pg-cli", text: "CLI Reference", color: "3" },
			{ id: "pg-changelog", text: "Changelog", color: "3" },
		],
	};
	const community: ExampleGroup = {
		id: "grp-community", label: "Community",
		children: [
			{ id: "pg-examples", text: "Examples", color: "4" },
			{ id: "pg-plugins", text: "Plugins", color: "3" },
			{ id: "pg-contributing", text: "Contributing", color: "4" },
		],
	};

	placeGroup(guides, WORK_X, WORK_Y, nodes);
	placeGroup(reference, WORK_X + gw + GROUP_GAP_X, WORK_Y, nodes);
	const row2Y = WORK_Y + groupHeight(guides.children.length) + GROUP_GAP_Y;
	placeGroup(community, WORK_X, row2Y, nodes);

	edges.push({ id: "e-start-install", fromNode: "pg-getting-started", toNode: "pg-installation", fromSide: "bottom", toSide: "top" });
	edges.push({ id: "e-install-quick", fromNode: "pg-installation", toNode: "pg-quickstart", fromSide: "bottom", toSide: "top" });
	edges.push({ id: "e-quick-tutorials", fromNode: "pg-quickstart", toNode: "pg-tutorials", fromSide: "bottom", toSide: "top" });
	edges.push({ id: "e-tutorials-api", fromNode: "pg-tutorials", toNode: "pg-api", fromSide: "right", toSide: "left", label: "Deep dive" });
}

// ── Preset: System Design ────────────────────────────────────────────

function buildSystemDesignPreset(nodes: CanvasNode[], edges: CanvasEdge[]): void {
	const gw = NODE_W + GROUP_PAD * 2;

	const actors: ExampleGroup = {
		id: "grp-actors", label: "Actors",
		children: [
			{ id: "act-end-user", text: "End User", color: "4", shape: "circle" },
			{ id: "act-admin", text: "Administrator", color: "4", shape: "circle" },
			{ id: "act-external", text: "External System", color: "6", shape: "circle" },
		],
	};
	const systems: ExampleGroup = {
		id: "grp-systems", label: "Systems",
		children: [
			{ id: "sys-web-app", text: "Web Application", color: "4" },
			{ id: "sys-api-gateway", text: "API Gateway", color: "5" },
			{ id: "sys-auth", text: "Auth Service", color: "6" },
			{ id: "sys-notification", text: "Notification Service", color: "1" },
		],
	};
	const containers: ExampleGroup = {
		id: "grp-containers", label: "Containers",
		children: [
			{ id: "cnt-frontend", text: "Frontend SPA", color: "4", shape: "document" },
			{ id: "cnt-backend", text: "Backend API", color: "5", shape: "document" },
			{ id: "cnt-worker", text: "Background Worker", color: "6", shape: "document" },
			{ id: "cnt-database", text: "Database", color: "3", shape: "document" },
			{ id: "cnt-cache", text: "Cache", color: "2", shape: "document" },
			{ id: "cnt-queue", text: "Message Queue", color: "1", shape: "document" },
		],
	};

	placeGroup(actors, WORK_X, WORK_Y, nodes);
	placeGroup(systems, WORK_X + gw + GROUP_GAP_X, WORK_Y, nodes);
	const row2Y = WORK_Y + groupHeight(containers.children.length) + GROUP_GAP_Y;
	placeGroup(containers, WORK_X, row2Y, nodes);

	edges.push({ id: "e-user-webapp", fromNode: "act-end-user", toNode: "sys-web-app", fromSide: "right", toSide: "left", label: "Uses" });
	edges.push({ id: "e-admin-webapp", fromNode: "act-admin", toNode: "sys-web-app", fromSide: "right", toSide: "left", label: "Manages" });
	edges.push({ id: "e-webapp-api", fromNode: "sys-web-app", toNode: "sys-api-gateway", fromSide: "bottom", toSide: "top", label: "API calls" });
	edges.push({ id: "e-api-auth", fromNode: "sys-api-gateway", toNode: "sys-auth", fromSide: "bottom", toSide: "top", label: "Validates" });
	edges.push({ id: "e-api-notif", fromNode: "sys-api-gateway", toNode: "sys-notification", fromSide: "right", toSide: "left", label: "Triggers" });
	edges.push({ id: "e-ext-api", fromNode: "act-external", toNode: "sys-api-gateway", fromSide: "right", toSide: "left", label: "Integrates" });
	edges.push({ id: "e-frontend-backend", fromNode: "cnt-frontend", toNode: "cnt-backend", fromSide: "bottom", toSide: "top", label: "REST/GraphQL" });
	edges.push({ id: "e-backend-db", fromNode: "cnt-backend", toNode: "cnt-database", fromSide: "bottom", toSide: "top", label: "Queries" });
	edges.push({ id: "e-backend-cache", fromNode: "cnt-backend", toNode: "cnt-cache", fromSide: "right", toSide: "left", label: "Reads" });
	edges.push({ id: "e-backend-queue", fromNode: "cnt-backend", toNode: "cnt-queue", fromSide: "right", toSide: "left", label: "Publishes" });
	edges.push({ id: "e-worker-queue", fromNode: "cnt-worker", toNode: "cnt-queue", fromSide: "left", toSide: "right", label: "Consumes" });
}

// ── Preset: Service Design ───────────────────────────────────────────

function buildServiceDesignPreset(nodes: CanvasNode[], edges: CanvasEdge[]): void {
	const gw = NODE_W + GROUP_PAD * 2;

	const gateway: ExampleGroup = {
		id: "grp-gateway", label: "Gateway Layer",
		children: [
			{ id: "gw-api", text: "API Gateway", color: "5" },
			{ id: "gw-auth", text: "Auth Middleware", color: "6" },
			{ id: "gw-rate-limit", text: "Rate Limiter", color: "1" },
		],
	};
	const services: ExampleGroup = {
		id: "grp-services", label: "Services",
		children: [
			{ id: "svc-user", text: "User Service", color: "4" },
			{ id: "svc-order", text: "Order Service", color: "4" },
			{ id: "svc-payment", text: "Payment Service", color: "2" },
			{ id: "svc-inventory", text: "Inventory Service", color: "3" },
			{ id: "svc-notification", text: "Notification Service", color: "1" },
		],
	};
	const data: ExampleGroup = {
		id: "grp-data", label: "Data Stores",
		children: [
			{ id: "db-users", text: "Users DB", color: "3", shape: "document" },
			{ id: "db-orders", text: "Orders DB", color: "3", shape: "document" },
			{ id: "db-inventory", text: "Inventory DB", color: "3", shape: "document" },
			{ id: "cache-session", text: "Session Cache", color: "2", shape: "document" },
		],
	};
	const events: ExampleGroup = {
		id: "grp-events", label: "Events / Messaging",
		children: [
			{ id: "evt-order-placed", text: "order.placed", color: "1" },
			{ id: "evt-payment-ok", text: "payment.completed", color: "1" },
			{ id: "evt-stock-low", text: "inventory.low-stock", color: "1" },
			{ id: "evt-user-registered", text: "user.registered", color: "1" },
		],
	};

	placeGroup(gateway, WORK_X, WORK_Y, nodes);
	placeGroup(services, WORK_X + gw + GROUP_GAP_X, WORK_Y, nodes);
	const row2Y = WORK_Y + groupHeight(services.children.length) + GROUP_GAP_Y;
	placeGroup(data, WORK_X, row2Y, nodes);
	placeGroup(events, WORK_X + gw + GROUP_GAP_X, row2Y, nodes);

	// Gateway → Services (right→left, adjacent groups)
	edges.push({ id: "e-gw-user", fromNode: "gw-api", toNode: "svc-user", fromSide: "right", toSide: "left", label: "Routes" });
	edges.push({ id: "e-gw-order", fromNode: "gw-api", toNode: "svc-order", fromSide: "right", toSide: "left", label: "Routes" });
	// Services → Data (top→bottom, row 1 → row 2)
	edges.push({ id: "e-user-db", fromNode: "svc-user", toNode: "db-users", fromSide: "bottom", toSide: "top" });
	edges.push({ id: "e-order-db", fromNode: "svc-order", toNode: "db-orders", fromSide: "bottom", toSide: "top" });
	// Services → Events (right→left, adjacent in row 2 conceptually)
	edges.push({ id: "e-order-evt", fromNode: "svc-order", toNode: "evt-order-placed", fromSide: "right", toSide: "left", label: "Emits" });
	edges.push({ id: "e-payment-evt", fromNode: "svc-payment", toNode: "evt-payment-ok", fromSide: "right", toSide: "left", label: "Emits" });
}

// ── Preset: Product Design ───────────────────────────────────────────

function buildProductDesignPreset(nodes: CanvasNode[], edges: CanvasEdge[]): void {
	const gw = NODE_W + GROUP_PAD * 2;

	const personas: ExampleGroup = {
		id: "grp-personas", label: "Personas",
		children: [
			{ id: "per-buyer", text: "Buyer", color: "4", shape: "circle" },
			{ id: "per-power-user", text: "Power User", color: "4", shape: "circle" },
			{ id: "per-admin", text: "Admin", color: "6", shape: "circle" },
		],
	};
	const journeys: ExampleGroup = {
		id: "grp-journeys", label: "User Journeys",
		children: [
			{ id: "jrn-onboarding", text: "Onboarding", color: "5" },
			{ id: "jrn-first-purchase", text: "First Purchase", color: "4" },
			{ id: "jrn-repeat-use", text: "Repeat Usage", color: "4" },
			{ id: "jrn-upgrade", text: "Plan Upgrade", color: "2" },
			{ id: "jrn-support", text: "Get Support", color: "1" },
		],
	};
	const features: ExampleGroup = {
		id: "grp-features", label: "Features",
		children: [
			{ id: "ft-search", text: "Search", color: "3" },
			{ id: "ft-recommendations", text: "Recommendations", color: "4" },
			{ id: "ft-checkout", text: "Checkout", color: "2" },
			{ id: "ft-dashboard", text: "Dashboard", color: "5" },
			{ id: "ft-notifications", text: "Notifications", color: "1" },
			{ id: "ft-analytics", text: "Analytics", color: "3" },
		],
	};
	const touchpoints: ExampleGroup = {
		id: "grp-touchpoints", label: "Touchpoints",
		children: [
			{ id: "tp-web", text: "Web App", color: "4" },
			{ id: "tp-mobile", text: "Mobile App", color: "4" },
			{ id: "tp-email", text: "Email", color: "1" },
			{ id: "tp-push", text: "Push Notifications", color: "1" },
		],
	};

	placeGroup(personas, WORK_X, WORK_Y, nodes);
	placeGroup(journeys, WORK_X + gw + GROUP_GAP_X, WORK_Y, nodes);
	const row2Y = WORK_Y + groupHeight(features.children.length) + GROUP_GAP_Y;
	placeGroup(features, WORK_X, row2Y, nodes);
	placeGroup(touchpoints, WORK_X + gw + GROUP_GAP_X, row2Y, nodes);

	// Personas → Journeys (right→left, adjacent groups)
	edges.push({ id: "e-buyer-onboard", fromNode: "per-buyer", toNode: "jrn-onboarding", fromSide: "right", toSide: "left", label: "Starts" });
	edges.push({ id: "e-power-repeat", fromNode: "per-power-user", toNode: "jrn-repeat-use", fromSide: "right", toSide: "left", label: "Daily" });
	// Journey sequence (top→bottom within group)
	edges.push({ id: "e-onboard-purchase", fromNode: "jrn-onboarding", toNode: "jrn-first-purchase", fromSide: "bottom", toSide: "top" });
	edges.push({ id: "e-purchase-repeat", fromNode: "jrn-first-purchase", toNode: "jrn-repeat-use", fromSide: "bottom", toSide: "top" });
	edges.push({ id: "e-repeat-upgrade", fromNode: "jrn-repeat-use", toNode: "jrn-upgrade", fromSide: "bottom", toSide: "top", label: "Converts" });
	// Features → Touchpoints (right→left, adjacent in row 2)
	edges.push({ id: "e-notif-push", fromNode: "ft-notifications", toNode: "tp-push", fromSide: "right", toSide: "left", label: "Delivers" });
}

// ── Preset: Enterprise ───────────────────────────────────────────────

function buildEnterprisePreset(nodes: CanvasNode[], edges: CanvasEdge[]): void {
	const gw = NODE_W + GROUP_PAD * 2;

	// Row 1: Portal + Workforce + Admin (3 columns)
	const portal: ExampleGroup = {
		id: "grp-portal", label: "Portal",
		children: [
			{ id: "pg-home", text: "Home Dashboard", color: "5" },
			{ id: "pg-notifications", text: "Notification Center", color: "1" },
			{ id: "pg-search", text: "Global Search", color: "3" },
			{ id: "pg-profile", text: "My Profile", color: "4" },
			{ id: "pg-help", text: "Help Center", color: "4" },
		],
	};
	const workforce: ExampleGroup = {
		id: "grp-workforce", label: "Workforce",
		children: [
			{ id: "pg-employees", text: "Employee Directory", color: "3" },
			{ id: "pg-departments", text: "Departments", color: "3" },
			{ id: "pg-roles", text: "Roles & Permissions", color: "2" },
			{ id: "pg-org-chart", text: "Org Chart", color: "5" },
			{ id: "pg-onboarding", text: "Onboarding", color: "4" },
		],
	};
	const admin: ExampleGroup = {
		id: "grp-admin", label: "Administration",
		children: [
			{ id: "pg-users", text: "User Management", color: "3" },
			{ id: "pg-audit-log", text: "Audit Log", color: "3" },
			{ id: "pg-settings", text: "System Settings", color: "2" },
			{ id: "pg-sso", text: "SSO Configuration", color: "6" },
			{ id: "pg-tenant", text: "Tenant Management", color: "6" },
		],
	};

	const col1 = WORK_X;
	const col2 = col1 + gw + GROUP_GAP_X;
	const col3 = col2 + gw + GROUP_GAP_X;

	placeGroup(portal, col1, WORK_Y, nodes);
	placeGroup(workforce, col2, WORK_Y, nodes);
	placeGroup(admin, col3, WORK_Y, nodes);

	// Row 2: Finance + Projects + Integration
	const row1MaxH = groupHeight(portal.children.length);
	const row2Y = WORK_Y + row1MaxH + GROUP_GAP_Y;

	const finance: ExampleGroup = {
		id: "grp-finance", label: "Finance",
		children: [
			{ id: "pg-invoices", text: "Invoices", color: "3" },
			{ id: "pg-budgets", text: "Budgets", color: "2" },
			{ id: "pg-expenses", text: "Expense Claims", color: "2" },
			{ id: "pg-reports", text: "Financial Reports", color: "3" },
			{ id: "pg-approvals", text: "Approvals", color: "1" },
		],
	};
	const projects: ExampleGroup = {
		id: "grp-projects", label: "Projects",
		children: [
			{ id: "pg-project-list", text: "Project List", color: "3" },
			{ id: "pg-tasks", text: "Tasks", color: "3" },
			{ id: "pg-milestones", text: "Milestones", color: "4" },
			{ id: "pg-calendar", text: "Calendar", color: "5" },
			{ id: "pg-timesheets", text: "Timesheets", color: "2" },
		],
	};
	const integration: ExampleGroup = {
		id: "grp-integration", label: "Integration",
		children: [
			{ id: "pg-api-portal", text: "API Portal", color: "4" },
			{ id: "pg-webhooks", text: "Webhooks", color: "2" },
			{ id: "pg-connectors", text: "Connectors", color: "4" },
			{ id: "pg-data-import", text: "Data Import", color: "2" },
			{ id: "pg-data-export", text: "Data Export", color: "2" },
		],
	};

	placeGroup(finance, col1, row2Y, nodes);
	placeGroup(projects, col2, row2Y, nodes);
	placeGroup(integration, col3, row2Y, nodes);

	// Edges: only between adjacent groups, clean flow
	// Portal → Workforce (right→left)
	edges.push({ id: "e-home-employees", fromNode: "pg-home", toNode: "pg-employees", fromSide: "right", toSide: "left", label: "Browse" });
	// Portal → Finance (top→bottom)
	edges.push({ id: "e-home-invoices", fromNode: "pg-home", toNode: "pg-invoices", fromSide: "bottom", toSide: "top", label: "Finance" });
	// Workforce → Admin (right→left)
	edges.push({ id: "e-roles-users", fromNode: "pg-roles", toNode: "pg-users", fromSide: "right", toSide: "left", label: "Manages" });
	// Workforce → Projects (top→bottom)
	edges.push({ id: "e-employees-tasks", fromNode: "pg-employees", toNode: "pg-tasks", fromSide: "bottom", toSide: "top", label: "Assigned" });
	// Finance → Projects (right→left, adjacent in row 2)
	edges.push({ id: "e-budgets-projects", fromNode: "pg-budgets", toNode: "pg-project-list", fromSide: "right", toSide: "left", label: "Allocates" });
	// Projects → Integration (right→left, adjacent in row 2)
	edges.push({ id: "e-tasks-webhooks", fromNode: "pg-tasks", toNode: "pg-webhooks", fromSide: "right", toSide: "left", label: "Triggers" });
}

// ── Preset: CLI App ──────────────────────────────────────────────────

function buildCliPreset(nodes: CanvasNode[], edges: CanvasEdge[]): void {
	const gw = NODE_W + GROUP_PAD * 2;

	const commands: ExampleGroup = {
		id: "grp-commands", label: "Commands",
		children: [
			{ id: "cmd-init", text: "init", color: "4" },
			{ id: "cmd-build", text: "build", color: "4" },
			{ id: "cmd-test", text: "test", color: "4" },
			{ id: "cmd-dev", text: "dev", color: "5" },
			{ id: "cmd-lint", text: "lint", color: "4" },
			{ id: "cmd-publish", text: "publish", color: "6" },
		],
	};
	const config: ExampleGroup = {
		id: "grp-config", label: "Configuration",
		children: [
			{ id: "cfg-global", text: "Global Config", color: "2" },
			{ id: "cfg-project", text: "Project Config", color: "2" },
			{ id: "cfg-env", text: "Environment", color: "2" },
			{ id: "cfg-flags", text: "CLI Flags", color: "3" },
		],
	};
	const output: ExampleGroup = {
		id: "grp-output", label: "Output",
		children: [
			{ id: "out-console", text: "Console Output", color: "5" },
			{ id: "out-json", text: "JSON Output", color: "3" },
			{ id: "out-log-file", text: "Log File", color: "3" },
			{ id: "out-progress", text: "Progress Bar", color: "5" },
		],
	};
	const plugins: ExampleGroup = {
		id: "grp-plugins", label: "Plugins",
		children: [
			{ id: "plg-hooks", text: "Lifecycle Hooks", color: "6" },
			{ id: "plg-custom-cmd", text: "Custom Commands", color: "4" },
			{ id: "plg-reporter", text: "Custom Reporter", color: "5" },
		],
	};
	const help: ExampleGroup = {
		id: "grp-help", label: "Help & Docs",
		children: [
			{ id: "hlp-usage", text: "Usage Text", color: "4" },
			{ id: "hlp-examples", text: "Examples", color: "4" },
			{ id: "hlp-version", text: "Version", color: "6" },
			{ id: "hlp-man", text: "Man Page", color: "4" },
		],
	};

	placeGroup(commands, WORK_X, WORK_Y, nodes);
	placeGroup(config, WORK_X + gw + GROUP_GAP_X, WORK_Y, nodes);
	placeGroup(output, WORK_X + 2 * (gw + GROUP_GAP_X), WORK_Y, nodes);
	const row2Y = WORK_Y + groupHeight(commands.children.length) + GROUP_GAP_Y;
	placeGroup(plugins, WORK_X, row2Y, nodes);
	placeGroup(help, WORK_X + gw + GROUP_GAP_X, row2Y, nodes);

	// Commands → Config (right→left)
	edges.push({ id: "e-init-project", fromNode: "cmd-init", toNode: "cfg-project", fromSide: "right", toSide: "left", label: "Creates" });
	// Commands → Output (right→left, via config)
	edges.push({ id: "e-build-console", fromNode: "cmd-build", toNode: "out-console", fromSide: "right", toSide: "left", label: "Writes" });
	// Commands → Plugins (top→bottom)
	edges.push({ id: "e-build-hooks", fromNode: "cmd-build", toNode: "plg-hooks", fromSide: "bottom", toSide: "top", label: "Triggers" });
	// Config → Flags (within group)
	edges.push({ id: "e-global-flags", fromNode: "cfg-global", toNode: "cfg-flags", fromSide: "bottom", toSide: "top", label: "Overrides" });
}

// ── Preset: Obsidian Plugin ─────────────────────────────────────────

function buildObsidianPluginPreset(nodes: CanvasNode[], edges: CanvasEdge[]): void {
	const gw = NODE_W + GROUP_PAD * 2;

	const views: ExampleGroup = {
		id: "grp-views", label: "Views",
		children: [
			{ id: "vw-sidebar", text: "Sidebar View", color: "5" },
			{ id: "vw-tab", text: "Tab View", color: "4" },
			{ id: "vw-status-bar", text: "Status Bar", color: "5" },
			{ id: "vw-ribbon", text: "Ribbon Actions", color: "4" },
		],
	};
	const modals: ExampleGroup = {
		id: "grp-modals", label: "Modals & Dialogs",
		children: [
			{ id: "mdl-settings", text: "Settings Tab", color: "2" },
			{ id: "mdl-suggest", text: "Suggest Modal", color: "1" },
			{ id: "mdl-confirm", text: "Confirm Dialog", color: "1" },
			{ id: "mdl-input", text: "Input Prompt", color: "2" },
			{ id: "mdl-fuzzy", text: "Fuzzy Search", color: "3" },
		],
	};
	const commands: ExampleGroup = {
		id: "grp-commands", label: "Commands",
		children: [
			{ id: "cmd-palette", text: "Command Palette", color: "4" },
			{ id: "cmd-hotkeys", text: "Hotkey Bindings", color: "2" },
			{ id: "cmd-context", text: "Context Menu", color: "4" },
			{ id: "cmd-editor", text: "Editor Commands", color: "4" },
		],
	};
	const events: ExampleGroup = {
		id: "grp-events", label: "Events",
		children: [
			{ id: "evt-file-open", text: "file-open", color: "6" },
			{ id: "evt-file-modify", text: "file-modify", color: "6" },
			{ id: "evt-layout", text: "layout-change", color: "6" },
			{ id: "evt-metadata", text: "metadata-change", color: "6" },
			{ id: "evt-workspace", text: "workspace-ready", color: "6" },
		],
	};
	const data: ExampleGroup = {
		id: "grp-data", label: "Data & Storage",
		children: [
			{ id: "dat-settings", text: "Plugin Settings", color: "2", shape: "document" },
			{ id: "dat-cache", text: "Metadata Cache", color: "3", shape: "document" },
			{ id: "dat-vault", text: "Vault API", color: "4", shape: "document" },
			{ id: "dat-local", text: "Local Storage", color: "2", shape: "document" },
		],
	};

	placeGroup(views, WORK_X, WORK_Y, nodes);
	placeGroup(modals, WORK_X + gw + GROUP_GAP_X, WORK_Y, nodes);
	placeGroup(commands, WORK_X + 2 * (gw + GROUP_GAP_X), WORK_Y, nodes);
	const row2Y = WORK_Y + groupHeight(modals.children.length) + GROUP_GAP_Y;
	placeGroup(events, WORK_X, row2Y, nodes);
	placeGroup(data, WORK_X + gw + GROUP_GAP_X, row2Y, nodes);

	// Views → Modals (right→left)
	edges.push({ id: "e-sidebar-suggest", fromNode: "vw-sidebar", toNode: "mdl-suggest", fromSide: "right", toSide: "left", label: "Opens" });
	// Modals → Commands (right→left)
	edges.push({ id: "e-settings-hotkeys", fromNode: "mdl-settings", toNode: "cmd-hotkeys", fromSide: "right", toSide: "left", label: "Configures" });
	// Commands → Views (loop back, top→bottom)
	edges.push({ id: "e-palette-tab", fromNode: "cmd-palette", toNode: "vw-tab", fromSide: "bottom", toSide: "top", label: "Opens" });
	// Events → Data (right→left, row 2)
	edges.push({ id: "e-filemod-cache", fromNode: "evt-file-modify", toNode: "dat-cache", fromSide: "right", toSide: "left", label: "Updates" });
	// Views → Events (top→bottom)
	edges.push({ id: "e-tab-fileopen", fromNode: "vw-tab", toNode: "evt-file-open", fromSide: "bottom", toSide: "top", label: "Triggers" });
}

// ── Preset lookup ────────────────────────────────────────────────────

type PresetBuilder = (nodes: CanvasNode[], edges: CanvasEdge[]) => void;

const PRESET_BUILDERS: Record<string, PresetBuilder> = {
	"web-app": buildStarterExample,
	"landing": buildLandingPreset,
	"dashboard": buildDashboardPreset,
	"e-commerce": buildECommercePreset,
	"enterprise": buildEnterprisePreset,
	"cli": buildCliPreset,
	"obsidian-plugin": buildObsidianPluginPreset,
	"docs": buildDocsPreset,
	"system-design": buildSystemDesignPreset,
	"service-design": buildServiceDesignPreset,
	"product-design": buildProductDesignPreset,
};
