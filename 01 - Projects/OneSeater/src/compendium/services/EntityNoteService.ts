import { App } from "obsidian";
import { CacheSettings } from "./DataCacheService"; 
import { ENTITY_REGISTRY } from "src/utils/entities";
import { EntityRegistry } from "src/utils/EntityRegistry";
import { ensureFolder, slugify, upsertFile } from "src/utils/helpers";
import { TemplateEngine } from "src/utils/TemplateEngine";

export class EntityNoteService {
  private tpl: TemplateEngine;

  constructor(
    private app: App,
    private settings: CacheSettings,
    private registry: EntityRegistry
  ) {
    this.tpl = new TemplateEngine(app);
	this.registry = ENTITY_REGISTRY
  }

  async upsertEntityNotes(entityKey: string, rows: Record<string, any>[]) {
    const cfg = this.registry.get(entityKey);
	const folder = cfg?.folder ?? 'entities';
	const templateFile = cfg?.templateFile ?? entityKey;

    const notesRoot = `${this.settings.compendiumFolderPath}/${folder}`;
    await ensureFolder(this.app, notesRoot);

    const templatePath = `${this.settings.templatesFolderPath}/${templateFile}`;
    const template = await this.tpl.loadTemplate(templatePath);

    for (const raw of rows) {
      const row = cfg?.mapRow ? cfg.mapRow(raw) : raw;

      const id = cfg ? String(row[cfg.idField] ?? entityKey).trim() : entityKey;
      if (!id) continue; // skip invalid

      // Dateiname stabil über ID (nicht über Name!)
      const fileName = `${slugify(id)}.md`;
      const filePath = `${notesRoot}/${fileName}`;

      // Default Tokens (immer vorhanden)
      const tokens = {
        ...row,
        entity_type: entityKey,
        entity_id: id,
        updated_at: new Date().toISOString()
      };

      const content = template
        ? this.tpl.render(template, tokens)
        : this.buildFallbackNote(tokens);

      await upsertFile(this.app, filePath, content);
    }
  }

  private buildFallbackNote(tokens: Record<string, any>): string {
    // Falls Template fehlt: trotzdem brauchbare Note erzeugen
    const lines: string[] = [];
    lines.push("---");
    lines.push(`entity_type: ${tokens.entity_type ?? ""}`);
    lines.push(`entity_id: ${tokens.entity_id ?? ""}`);
    lines.push(`updated_at: ${tokens.updated_at ?? ""}`);
    lines.push("---");
    lines.push("");
    lines.push(`# ${tokens.fullName || tokens.name || tokens.entity_id || "Entity"}`);
    lines.push("");
    lines.push("## Available Template Token");
    lines.push("```json");
    lines.push(JSON.stringify(tokens, null, 2));
    lines.push("```");
    return lines.join("\n");
  }
}
