/**
 * A story variant for a single component.
 * Each variant provides a set of properties to render the component with.
 */
export interface StoryVariant {
	/** Human-readable variant name */
	name: string;
	/** Properties to set on the component */
	props: Record<string, unknown>;
}

/**
 * A story definition for a component.
 */
export interface StoryDef {
	/** Component tag name (e.g., 'flowti-status-badge') */
	tag: string;
	/** Human-readable component name */
	title: string;
	/** Story variants to display */
	variants: StoryVariant[];
}
