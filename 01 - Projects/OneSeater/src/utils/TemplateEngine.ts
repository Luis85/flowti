import { App, TFile } from "obsidian";

export class TemplateEngine {
  constructor(private app: App) {}

  async loadTemplate(path: string): Promise<string> {
    const af = this.app.vault.getAbstractFileByPath(path);
    if (!(af instanceof TFile)) return ""; // fallback: leeres Template
    return await this.app.vault.read(af);
  }

  render(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, rawKey) => {
      const key = String(rawKey).trim();
      const val = this.getValue(data, key);
      return val == null ? "" : String(val);
    });
  }

  // unterstützt auch nested keys: {{location.country}}
  private getValue(obj: any, key: string): unknown {
    return key.split(".").reduce((acc, part) => (acc ? acc[part] : undefined), obj);
  }
}
