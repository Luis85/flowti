/**
 * make-types.ts — Type definitions for the Make domain.
 */

export type ProjectTemplateId = "app" | "plugin" | "cli" | "empty";

export interface ProjectTemplate {
	label: string;
	scaffold: (projectPath: string, name: string) => void;
}
