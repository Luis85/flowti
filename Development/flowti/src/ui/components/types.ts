/**
 * Component metadata schema for the component registry.
 */

export interface ComponentMeta {
	/** Unique identifier (e.g. "catalog-dashboard", "events-tab"). */
	id: string;
	/** Human-readable name. */
	name: string;
	/** Category grouping (e.g. "event-catalog", "data-exchange", "analytics", "user", "train"). */
	category: string;
	/** Brief description of the component's purpose. */
	description: string;
	/** Source file path relative to src/. */
	source: string;
	/** Layout compatibility: which layout types this component can be mounted in. */
	layouts: string[];
	/** Event types this component emits (if any). */
	emits: string[];
	/** Tags for filtering (e.g. "dashboard", "tab", "master-detail"). */
	tags: string[];
}
