/** Injectable YAML parser — abstracts Obsidian's parseYaml(). */
export interface IYamlParser {
	parse(content: string): Record<string, unknown> | null;
}
