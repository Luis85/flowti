import type { ResultValue } from './result.js';

/**
 * Service for creating markdown files with YAML frontmatter.
 * Handles serialization and template rendering.
 *
 * Consumers: VaultSync, Chronicler, QuestSystem, Director actions
 */
export interface MarkdownService {
	/** Create a markdown string from a frontmatter object and optional body */
	serialize(frontmatter: Record<string, unknown>, body?: string): string;

	/** Create a markdown string from a template, substituting {{variable}} placeholders */
	fromTemplate(template: string, variables: Record<string, unknown>): ResultValue<string>;

	/** Load a template file via VaultAdapter, fill variables, return complete markdown */
	renderTemplate(templatePath: string, variables: Record<string, unknown>): Promise<ResultValue<string>>;
}
