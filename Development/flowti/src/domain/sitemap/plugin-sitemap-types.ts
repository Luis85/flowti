export interface PluginSitemap {
	version: 2;
	views: Record<string, ViewDef>;
	commands: CommandDef[];
	ribbon: RibbonDef[];
	modals?: Record<string, ModalDef>;
}

export interface ViewDef {
	kind: "hub" | "panel" | "leaf";
	label: string;
	icon: string;
	type: string;
	tabs?: SitemapTabDef[];
	dataSources?: DataSourceRef[];
	conditions?: ConditionSet;
	legacy?: boolean;
	refreshEvents?: string[];
	/** Lit custom element tag name for leaf/panel views */
	component?: string;
	/** Handler ID for leaf/panel views (looked up in PluginHandlerRegistry) */
	handler?: string;
}

export interface SitemapTabDef {
	id: string;
	label: string;
	icon: string;
	handler?: string;
	component?: string;
	dataSource?: string;
	searchPlaceholder?: string;
}

export interface CommandDef {
	id: string;
	name: string;
	description?: string;
	domain?: string;
	category?: string;
	handler: string;
	hotkey?: string;
	icon?: string;
	conditions?: ConditionSet;
}

export interface RibbonDef {
	icon: string;
	label: string;
	action: string;
	conditions?: ConditionSet;
}

export interface ModalDef {
	kind: "form" | "confirm" | "display";
	label: string;
	fields?: FieldDef[];
	submit?: string;
	conditions?: ConditionSet;
}

export interface FieldDef {
	id: string;
	type: "text" | "textarea" | "select" | "tags" | "toggle" | "number";
	label?: string;
	placeholder?: string;
	options?: string[];
	required?: boolean;
	default?: string;
}

export interface DataSourceRef {
	id: string;
	slot?: string;
	params?: Record<string, string>;
}

export interface ConditionSet {
	hidden?: string;
	disabled?: string;
}
